// EDCH-BGS-v1.2: robust coordinate parsing, preserving established BGS data
// EDCH-BGS-v1.1 — preservation of user-created systems and annotations
import { quoteCsv } from "./csv.js";
// EDCH-BGS-v1.3 — reliable Spansh attribution and safe CSV
/** EDCH BGS extension: pure, testable state and patrol logic. All timestamps UTC ISO 8601. */
export interface BgsSystem {
  name: string;
  id64?: string;
  coords?: [number, number, number];
  distance?: number;
  influence?: number; // percentage points, 0..100
  controls?: boolean;
  states: string[];
  updatedAt?: string; // Spansh's system timestamp; NOT a guaranteed faction tick time
  retrievedAt: string;
  source: "Spansh" | "manual";
  lastVisitedAt?: string;
  anchor?: boolean;
  note?: string;
}
export interface Observation {
  key: string;
  system: string;
  influence?: number;
  controls?: boolean;
  states: string[];
  source: string;
  observedAt: string;
  receivedAt: string;
}
export interface BgsState {
  faction: string;
  systems: BgsSystem[];
  history: Observation[];
  lastFetchedAt?: string;
  tickAt?: string;
  tickCheckedAt?: string;
  partial?: boolean;
  reportedTotal?: number;
}
export interface SearchResult {
  systems: BgsSystem[];
  total: number;
  partial: boolean;
  pages: number;
}
export const defaultBgs = (): BgsState => ({ faction: "1ER ASTRA MILITARUM", systems: [], history: [] });
const norm = (x: string) => x.trim().toLocaleLowerCase();
const validDate = (x: unknown): string | undefined => {
  if (typeof x !== "string" || !Number.isFinite(Date.parse(x))) return undefined;
  return new Date(x).toISOString();
};
const number = (x: unknown): number | undefined => (typeof x === "number" && Number.isFinite(x) ? x : undefined);
export const keyOf = (s: Pick<BgsSystem, "name" | "id64">) => s.id64 || norm(s.name);
export const ageDays = (date?: string, now = Date.now()): number | undefined => {
  const stamp = date ? Date.parse(date) : NaN;
  return Number.isFinite(stamp) ? Math.max(0, (now - stamp) / 86_400_000) : undefined;
};

/** Decodes a Spansh systems/search record; missing influence is never fabricated. */
export function fromSpansh(raw: any, faction: string, retrievedAt: string): BgsSystem | null {
  const name = String(raw?.name ?? "").trim();
  if (!name) return null;
  const presences: any[] = Array.isArray(raw?.minor_faction_presences) ? raw.minor_faction_presences : [];
  const p = presences.find((x) => norm(String(x?.name ?? "")) === norm(faction));
  if (!p) return null;
  const rawInfluence = number(p.influence);
  // Some import sources express influence in [0,1], others in [0,100].
  const influence =
    rawInfluence === undefined || rawInfluence < 0 || rawInfluence > 100
      ? undefined
      : rawInfluence <= 1
        ? rawInfluence * 100
        : rawInfluence;
  const controller =
    typeof raw.controlling_minor_faction === "string"
      ? raw.controlling_minor_faction
      : typeof raw.controlling_minor_faction?.name === "string"
        ? raw.controlling_minor_faction.name
        : typeof raw.controlling_minor_faction_name === "string"
          ? raw.controlling_minor_faction_name
          : undefined;
  // Spansh's API versions may expose coordinates as an array, object or x/y/z fields.
  const coords = raw?.coords ?? raw?.coordinates;
  const xyz = Array.isArray(coords)
    ? coords
    : coords && typeof coords === "object"
      ? [coords.x, coords.y, coords.z]
      : [raw?.x, raw?.y, raw?.z];
  const pos =
    Array.isArray(xyz) &&
    xyz.length >= 3 &&
    xyz.slice(0, 3).every((n: unknown) => typeof n === "number" && Number.isFinite(n))
      ? ([xyz[0], xyz[1], xyz[2]] as [number, number, number])
      : undefined;
  const active = Array.isArray(p.active_states)
    ? p.active_states
        .map((s: any) => (typeof s === "string" ? s : (s?.state ?? s?.State)))
        .filter((s: unknown): s is string => typeof s === "string")
    : [];
  return {
    name,
    id64: raw.id64 == null ? undefined : String(raw.id64),
    coords: pos,
    distance: number(raw.distance),
    influence,
    controls: controller === undefined ? undefined : norm(controller) === norm(faction),
    states: [...new Set([p.state, ...active].filter((x): x is string => typeof x === "string" && x !== "None"))],
    updatedAt: validDate(raw.updated_at),
    retrievedAt,
    source: "Spansh",
  };
}

/** Fetch paginated Spansh data. No infinite loops, deduplicates, explicitly reports truncation. */
export async function fetchFactionPages(
  faction: string,
  reference: Record<string, unknown>,
  post: (endpoint: string, body: unknown) => Promise<any>,
  opts: { pageSize?: number; maxPages?: number; onPage?: (found: number, total: number) => void } = {},
): Promise<SearchResult> {
  const pageSize = Math.max(1, Math.min(100, opts.pageSize ?? 100));
  const maxPages = Math.max(1, Math.min(100, opts.maxPages ?? 30));
  const systems = new Map<string, BgsSystem>();
  let total = 0;
  let pages = 0;
  let complete = false;
  const retrievedAt = new Date().toISOString();
  for (let page = 0; page < maxPages; page++) {
    const body = {
      filters: { minor_faction_presences: [{ name: { value: [faction] } }] },
      sort: [{ distance: { direction: "asc" } }],
      size: pageSize,
      page,
      ...reference,
    };
    const response = await post("systems/search", body);
    const records: any[] = Array.isArray(response?.results) ? response.results : [];
    const reported = Number(response?.count);
    if (Number.isFinite(reported) && reported >= 0) total = reported;
    pages++;
    const before = systems.size;
    for (const raw of records) {
      const system = fromSpansh(raw, faction, retrievedAt);
      if (system) systems.set(keyOf(system), system);
    }
    opts.onPage?.(systems.size, total);
    if (
      records.length === 0 ||
      (records.length < pageSize && (!total || (page + 1) * pageSize >= total)) ||
      (total && (page + 1) * pageSize >= total)
    ) {
      complete = true;
      break;
    }
    // Backend repeating the same page must not cause a long duplicate loop.
    if (systems.size === before) break;
  }
  return { systems: [...systems.values()], total: total || systems.size, pages, partial: !complete };
}

/** Merge observations without reinterpreting a repeated cached answer as a new tick. */
export function mergeSearch(state: BgsState, next: SearchResult, fetchedAt = new Date().toISOString()): BgsState {
  const old = new Map(state.systems.map((s) => [keyOf(s), s]));
  const history = [...state.history];
  const seen = new Set(history.map((h) => `${h.key}|${h.observedAt}|${h.source}`));
  const systems = next.systems.map((s) => {
    // A manually added system can acquire an id64 during its first Spansh lookup.
    // Recover its visit, anchor and notes by system name in that case.
    const prev = old.get(keyOf(s)) ?? state.systems.find((p) => norm(p.name) === norm(s.name));
    const merged: BgsSystem = { ...s, lastVisitedAt: prev?.lastVisitedAt, anchor: prev?.anchor, note: prev?.note };
    // Keep previously observed coordinates if the remote result omitted them.
    if (!merged.coords && prev?.coords) merged.coords = prev.coords;
    if (s.updatedAt) {
      const observationKey = `${keyOf(s)}|${s.updatedAt}|${s.source}`;
      if (!seen.has(observationKey)) {
        history.push({
          key: keyOf(s),
          system: s.name,
          influence: s.influence,
          controls: s.controls,
          states: s.states,
          source: s.source,
          observedAt: s.updatedAt,
          receivedAt: fetchedAt,
        });
        seen.add(observationKey);
      }
    }
    return merged;
  });
  // Keep local/manual systems even after a complete third-party query. On partial
  // Spansh results, also retain all previously known systems (no false disappearances).
  for (const prev of state.systems) {
    if (!next.partial && prev.source !== "manual") continue;
    if (!systems.some((s) => norm(s.name) === norm(prev.name))) systems.push(prev);
  }
  history.sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  return {
    ...state,
    systems,
    history: history.slice(-10000),
    lastFetchedAt: fetchedAt,
    partial: next.partial,
    reportedTotal: next.total,
  };
}

/** Scores are priority hints, not a claim about actual BGS threats. */
export function patrolScore(s: BgsSystem, now = Date.now()): number {
  const age = ageDays(s.lastVisitedAt, now);
  const dataAge = ageDays(s.updatedAt, now);
  let score = s.anchor ? 35 : 0;
  score += age === undefined ? 50 : age >= 7 ? 40 : age >= 3 ? 20 : 0;
  score += dataAge === undefined ? 25 : dataAge >= 7 ? 25 : dataAge >= 3 ? 12 : 0;
  if (s.influence !== undefined && s.influence < 15) score += 15;
  if (s.states.some((x) => ["War", "Civil War", "Election", "Retreat"].includes(x))) score += 12;
  return score;
}
export function patrolOrder(systems: BgsSystem[], now = Date.now()): BgsSystem[] {
  return [...systems].sort(
    (a, b) =>
      patrolScore(b, now) - patrolScore(a, now) ||
      (a.distance ?? Infinity) - (b.distance ?? Infinity) ||
      a.name.localeCompare(b.name),
  );
}
export function patrolCategory(s: BgsSystem, now = Date.now()): "unknown" | "over7" | "over3" | "recent" {
  const age = ageDays(s.lastVisitedAt, now);
  return age === undefined ? "unknown" : age >= 7 ? "over7" : age >= 3 ? "over3" : "recent";
}

/** Only reliable adjacent measurements can produce a directional alert; no inferred tick. */
export function changeAlerts(state: BgsState): { system: string; text: string }[] {
  const alerts: { system: string; text: string }[] = [];
  for (const system of state.systems) {
    const values = state.history
      .filter((h) => h.key === keyOf(system))
      .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
      .slice(-2);
    if (values.length !== 2) continue;
    const [a, b] = values;
    if (b.observedAt === a.observedAt || ageDays(b.observedAt)! > 3) continue;
    if (a.controls === true && b.controls === false)
      alerts.push({ system: system.name, text: "Changement de contrôle observé (à vérifier en jeu)" });
    if (a.influence !== undefined && b.influence !== undefined && b.influence - a.influence < -5)
      alerts.push({
        system: system.name,
        text: `Baisse observée : ${(b.influence - a.influence).toFixed(1)} points (à vérifier)`,
      });
  }
  return alerts;
}

export function csvOf(systems: BgsSystem[]): string {
  return [
    ["Système", "Influence_%", "Contrôle", "États", "Source", "MAJ_UTC", "Visite_UTC", "Ancrage", "Note"]
      .map(quoteCsv)
      .join(";"),
    ...systems.map((s) =>
      [
        s.name,
        s.influence?.toFixed(2) ?? "",
        s.controls === undefined ? "" : s.controls ? "oui" : "non",
        s.states.join(" | "),
        s.source,
        s.updatedAt,
        s.lastVisitedAt,
        s.anchor ? "oui" : "",
        s.note,
      ]
        .map(quoteCsv)
        .join(";"),
    ),
  ].join("\n");
}
