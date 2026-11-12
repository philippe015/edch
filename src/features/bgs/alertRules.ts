/** EDCH-BGS-ALERTS-v1.5.4
 * Deterministic local BGS monitoring. Observations are not Frontier-confirmed ticks.
 * No game command, external API, AI, inference of missing measurements, or journal mutation.
 */
import type { BgsState, BgsSystem, Observation } from "./core.js";

export type AlertKind = "influence" | "control" | "conflict" | "patrol" | "stale" | "unvisited";
export type AlertSeverity = "critical" | "warning" | "info";
export interface AlertSettings {
  influence: boolean;
  control: boolean;
  conflict: boolean;
  patrol: boolean;
  stale: boolean;
  unvisited: boolean;
  notifications: boolean;
  sound: boolean;
  influenceDropPoints: number;
  overdueDays: number;
  staleDays: number;
}
export interface BgsAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  system: string;
  text: string;
  evidenceAt?: string;
  /** Only a *new observation*, not old data or passage of time, may notify. */
  observedChange: boolean;
}
export const DEFAULT_ALERT_SETTINGS: Readonly<AlertSettings> = Object.freeze({
  influence: true,
  control: true,
  conflict: true,
  patrol: true,
  stale: true,
  unvisited: false,
  notifications: false,
  sound: false,
  influenceDropPoints: 5,
  overdueDays: 7,
  staleDays: 7,
});
const DAY = 86_400_000;
const FUTURE_SLOP = 5 * 60_000;
const RECENT = 3 * DAY;
const STABLE_LIMIT = 500;
const RISK_STATES = new Set(["war", "civil war", "election", "retreat"]);
const shortName = (text: string): string => text.trim().toLocaleLowerCase();
function dateMs(value: unknown, now: number): number | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && time >= 0 && time <= now + FUTURE_SLOP ? time : null;
}
function validPercent(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
}
function numSetting(input: unknown, fallback: number, min: number, max: number): number {
  return typeof input === "number" && Number.isFinite(input) ? Math.min(max, Math.max(min, Math.round(input))) : fallback;
}
/** Malformed local settings cannot disable guardrails or produce unlimited alerts. */
export function sanitizeAlertSettings(value: unknown): AlertSettings {
  const o = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const bool = (key: keyof AlertSettings): boolean =>
    typeof o[key] === "boolean" ? (o[key] as boolean) : (DEFAULT_ALERT_SETTINGS[key] as boolean);
  return {
    influence: bool("influence"), control: bool("control"), conflict: bool("conflict"),
    patrol: bool("patrol"), stale: bool("stale"), unvisited: bool("unvisited"),
    notifications: bool("notifications"), sound: bool("sound"),
    influenceDropPoints: numSetting(o.influenceDropPoints, 5, 1, 30),
    overdueDays: numSetting(o.overdueDays, 7, 3, 60),
    staleDays: numSetting(o.staleDays, 7, 3, 60),
  };
}
function observationIndex(state: BgsState, now: number): Map<BgsSystem, Observation[]> {
  const keys = new Map<string, BgsSystem>();
  const matches = new Map<BgsSystem, Map<string, Observation>>();
  for (const s of state.systems) {
    if (typeof s.name !== "string" || !s.name.trim()) continue;
    keys.set(shortName(s.name), s);
    if (s.id64) keys.set(shortName(s.id64), s);
  }
  // A repeated community response with the same timestamp is only one observation.
  for (const h of state.history) {
    if (!h || h.source !== "Spansh" || dateMs(h.observedAt, now) === null) continue;
    const system = keys.get(shortName(h.system || "")) ?? keys.get(shortName(h.key || ""));
    if (!system) continue;
    const stamps = matches.get(system) ?? new Map<string, Observation>();
    const current = stamps.get(h.observedAt);
    if (!current || (h.receivedAt || "") > (current.receivedAt || "")) stamps.set(h.observedAt, h);
    matches.set(system, stamps);
  }
  return new Map([...matches].map(([system, byStamp]) => [
    system, [...byStamp.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt)),
  ]));
}

export function buildBgsAlerts(state: BgsState, settings: AlertSettings, now = Date.now()): BgsAlert[] {
  if (!state || !Array.isArray(state.systems) || !Array.isArray(state.history) || !Number.isFinite(now)) return [];
  const options = sanitizeAlertSettings(settings);
  const out: BgsAlert[] = [];
  const index = observationIndex(state, now);
  const add = (alert: BgsAlert) => { out.push(alert); };
  for (const system of state.systems) {
    if (!system || typeof system.name !== "string" || !system.name.trim()) continue;
    const id = shortName(system.name);
    const rows = index.get(system) ?? [];
    if (options.influence) {
      const values = rows.filter((row) => validPercent(row.influence));
      const previous = values.at(-2);
      const recent = values.at(-1);
      if (previous && recent && dateMs(recent.observedAt, now) !== null &&
          now - Date.parse(recent.observedAt) <= RECENT &&
          Date.parse(recent.observedAt) - Date.parse(previous.observedAt) <= 30 * DAY) {
        const delta = recent.influence! - previous.influence!;
        if (delta <= -options.influenceDropPoints) add({
          id: `influence:${id}:${previous.observedAt}:${recent.observedAt}`,
          kind: "influence", severity: delta <= -10 ? "critical" : "warning", system: system.name,
          text: `Baisse observée de ${Math.abs(delta).toFixed(1)} points entre deux relevés Spansh distincts. À vérifier en jeu (pas un tick confirmé).`,
          evidenceAt: recent.observedAt, observedChange: true,
        });
      }
    }
    if (options.control) {
      const values = rows.filter((row) => typeof row.controls === "boolean");
      const previous = values.at(-2);
      const recent = values.at(-1);
      if (previous && recent && previous.controls !== recent.controls &&
          dateMs(recent.observedAt, now) !== null && now - Date.parse(recent.observedAt) <= RECENT &&
          Date.parse(recent.observedAt) - Date.parse(previous.observedAt) <= 30 * DAY) add({
        id: `control:${id}:${previous.observedAt}:${recent.observedAt}`,
        kind: "control", severity: recent.controls === false ? "critical" : "warning", system: system.name,
        text: `${recent.controls ? "Contrôle acquis" : "Contrôle perdu"} selon deux relevés Spansh distincts. À confirmer en jeu.`,
        evidenceAt: recent.observedAt, observedChange: true,
      });
    }
    const stamp = dateMs(system.updatedAt, now);
    const fresh = system.source === "Spansh" && stamp !== null && now - stamp <= RECENT;
    if (options.conflict && fresh && Array.isArray(system.states)) {
      const risk = [...new Set(system.states.filter((s): s is string => typeof s === "string" && RISK_STATES.has(shortName(s))))].sort();
      if (risk.length) add({
        id: `conflict:${id}:${new Date(stamp!).toISOString().slice(0, 10)}:${risk.join("+")}`,
        kind: "conflict", severity: risk.some((s) => ["war", "civil war", "retreat"].includes(shortName(s))) ? "warning" : "info",
        system: system.name, text: `État communautaire signalé : ${risk.join(", ")}. Vérifier le contexte et l'actualité du relevé.`,
        evidenceAt: system.updatedAt, observedChange: true,
      });
    }
    const visit = dateMs(system.lastVisitedAt, now);
    if (options.patrol && visit !== null && now - visit >= options.overdueDays * DAY) add({
      id: `patrol:${id}:${system.lastVisitedAt}`,
      kind: "patrol", severity: "info", system: system.name,
      text: `Dernière visite enregistrée il y a ${Math.floor((now - visit) / DAY)} jours (seuil ${options.overdueDays} jours). Ce n'est pas une preuve d'absence en jeu.`,
      evidenceAt: system.lastVisitedAt, observedChange: false,
    });
    if (options.unvisited && !system.lastVisitedAt) add({
      id: `unvisited:${id}`, kind: "unvisited", severity: "info", system: system.name,
      text: "Aucune visite enregistrée dans EDCH ; cela ne prouve pas que le système n'a jamais été visité.",
      observedChange: false,
    });
    if (options.stale && system.source === "Spansh" && stamp !== null && now - stamp >= options.staleDays * DAY) add({
      id: `stale:${id}:${system.updatedAt}`,
      kind: "stale", severity: "info", system: system.name,
      text: `Horodatage communautaire vieux de ${Math.floor((now - stamp) / DAY)} jours. Actualisation conseillée (sans supposer un nouveau tick).`,
      evidenceAt: system.updatedAt, observedChange: false,
    });
  }
  const priority = { critical: 0, warning: 1, info: 2 } as const;
  out.sort((a, b) => priority[a.severity] - priority[b.severity] || a.system.localeCompare(b.system) || a.id.localeCompare(b.id));
  // Bound CPU/DOM work even with malformed or huge local snapshots. Never invent summary totals.
  return out.slice(0, STABLE_LIMIT);
}
