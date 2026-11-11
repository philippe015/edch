/** EDCH Commandes PRO v1.6.4 — read-only audits and profile comparison.
 * No game input, .binds writes, telemetry, shell or network calls.
 */
import type { Bind, BindsMeta } from "./binds.js";

export interface DeviceAudit {
  device: string;
  assigned: number;
  actions: number;
  distinctInputs: number;
  axes: number;
  groups: string[];
  sharedInputs: number;
  catalogued: boolean;
}
export interface KeyOverlap {
  device: string;
  key: string;
  modifiers: string;
  group: string;
  actions: string[];
}
export interface EssentialCheck {
  action: string;
  bound: boolean;
}
export interface TranslationAudit {
  boundActions: number;
  referenceFrench: number;
  toReview: string[];
}
export interface ProfileDifference {
  action: string;
  slot: Bind["slot"];
  status: "added" | "removed" | "changed";
  before: string[];
  after: string[];
}

const MAX_BINDINGS = 20_000;
const MAX_DIFFERENCES = 1_500;
const ESSENTIAL_ACTIONS = [
  "HyperSuperCombination", "GalaxyMapOpen", "LandingGearToggle", "DeployHardpointToggle",
  "SelectTarget", "TargetAhead", "FirePrimary", "FireSecondary", "UIFocus",
] as const;
const checked = (binds: readonly Bind[]): readonly Bind[] => binds.slice(0, MAX_BINDINGS);
const safe = (s: string): string => (typeof s === "string" ? s : "");
const str = (x: unknown): string => typeof x === "string" ? x : "";
const mods = (b: Bind): string =>
  (Array.isArray(b.modifiers) ? b.modifiers : [])
    .map((m) => `${str(m.device)}:${str(m.key)}`)
    .sort()
    .join("+");
export function assignmentText(b: Bind): string {
  const text = `${safe(b.device)} : ${safe(b.key)}${mods(b) ? ` + ${mods(b)}` : ""}`;
  return `${text}${b.inverted ? " (axe inversé)" : ""}`;
}
const slotKey = (b: Bind): string => JSON.stringify([b.action, b.slot]);
const inputKey = (b: Bind): string => JSON.stringify([b.device, b.key, mods(b)]);

/** Shared keys are candidates for manual review, not proof of incompatible Elite contexts. */
export function findInputOverlaps(binds: readonly Bind[], groupOfAction: (id: string) => string): KeyOverlap[] {
  const inputs = new Map<string, { device: string; key: string; modifiers: string; group: string; actions: Set<string> }>();
  for (const b of checked(binds)) {
    if (!b?.device || !b.key || !b.action) continue;
    const group = groupOfAction(b.action);
    const k = JSON.stringify([inputKey(b), group]);
    const entry = inputs.get(k) ?? { device: b.device, key: b.key, modifiers: mods(b), group, actions: new Set<string>() };
    entry.actions.add(b.action);
    inputs.set(k, entry);
  }
  return [...inputs.values()].filter((x) => x.actions.size > 1)
    .map(({actions, ...x}) => ({...x, actions: [...actions].sort()}))
    .sort((a, b) => a.device.localeCompare(b.device) || a.group.localeCompare(b.group) || a.key.localeCompare(b.key));
}

export function auditDevices(binds: readonly Bind[], meta: BindsMeta): DeviceAudit[] {
  const rows = checked(binds);
  const byDevice = new Map<string, Bind[]>();
  for (const b of rows) {
    if (!b?.device || !b.key || !b.action) continue;
    const list = byDevice.get(b.device) ?? [];
    list.push(b);
    byDevice.set(b.device, list);
  }
  const overlaps = findInputOverlaps(rows, (action) => meta.controls[action]?.g ?? "Non classé");
  return [...byDevice.entries()].map(([device, list]) => {
    const mapped = meta.vidpid?.[device.toUpperCase()];
    const catalogued = Boolean(meta.devices?.[device] || meta.templates?.[device] || (mapped && meta.devices?.[mapped]));
    return {
      device, assigned: list.length, actions: new Set(list.map((b) => b.action)).size,
      distinctInputs: new Set(list.map(inputKey)).size,
      axes: list.filter((b) => b.slot === "axis").length,
      groups: [...new Set(list.map((b) => meta.controls[b.action]?.g ?? "Non classé"))].sort(),
      sharedInputs: overlaps.filter((o) => o.device === device).length,
      catalogued,
    };
  }).sort((a, b) => a.device.localeCompare(b.device));
}

/** Only flags commands explicitly present in metadata, and does not claim a required binding. */
export function essentialChecks(binds: readonly Bind[], meta: BindsMeta): EssentialCheck[] {
  const actions = new Set(checked(binds).map((b) => b.action));
  return ESSENTIAL_ACTIONS.filter((action) => Object.hasOwn(meta.controls, action))
    .map((action) => ({ action, bound: actions.has(action) }));
}

/** Counts curated French vocabulary only; fallback translations may still be displayed. */
export function auditFrenchReferences(
  binds: readonly Bind[], english: (id: string) => string, curatedFrench: (name: string) => string | undefined,
): TranslationAudit {
  const names = [...new Set(checked(binds).map((b) => b.action).filter(Boolean))];
  const toReview = names.filter((id) => !curatedFrench(english(id))).sort();
  return { boundActions: names.length, referenceFrench: names.length - toReview.length, toReview };
}

function profileIndex(binds: readonly Bind[]): Map<string, { action: string; slot: Bind["slot"]; values: string[] }> {
  const index = new Map<string, { action: string; slot: Bind["slot"]; values: string[] }>();
  for (const b of checked(binds)) {
    if (!b?.action || !b.device || !b.key) continue;
    const k = slotKey(b);
    const entry = index.get(k) ?? { action: b.action, slot: b.slot, values: [] };
    entry.values.push(assignmentText(b));
    index.set(k, entry);
  }
  for (const v of index.values()) v.values.sort();
  return index;
}
/** Compare slots regardless of input document order. Differences never mutate either source. */
export function compareBindProfiles(before: readonly Bind[], after: readonly Bind[]): ProfileDifference[] {
  const left = profileIndex(before);
  const right = profileIndex(after);
  const keys = [...new Set([...left.keys(), ...right.keys()])].sort();
  const out: ProfileDifference[] = [];
  for (const key of keys) {
    const a = left.get(key), b = right.get(key);
    const prior = a?.values ?? [], next = b?.values ?? [];
    if (JSON.stringify(prior) === JSON.stringify(next)) continue;
    out.push({ action: (a ?? b)!.action, slot: (a ?? b)!.slot,
      status: !a ? "added" : !b ? "removed" : "changed",
      before: [...prior], after: [...next] });
    if (out.length >= MAX_DIFFERENCES) break;
  }
  return out;
}

function csv(value: unknown): string {
  const raw = String(value ?? "").replace(/\u0000/g, "");
  const guarded = /^[\s\t\r]*[=+@-]/.test(raw) ? "'" + raw : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}
export function comparisonCsv(differences: readonly ProfileDifference[], label: (action: string) => string): string {
  const rows = [["Statut", "Commande FR", "Action Elite", "Affectation", "Ancien profil", "Nouveau profil"]];
  for (const d of differences.slice(0, MAX_DIFFERENCES)) {
    rows.push([d.status, label(d.action), d.action, d.slot, d.before.join(" | "), d.after.join(" | ")]);
  }
  return "\uFEFF" + rows.map((cols) => cols.map(csv).join(";")).join("\r\n") + "\r\n";
}
