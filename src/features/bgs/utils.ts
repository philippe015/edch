/** Pure BGS data helpers, shared by the UI and unit tests. */
import type { BgsState } from "./core.js";

export interface LiveVisit {
  system: string;
  at: string;
}
export function readLiveVisit(ev: Record<string, unknown>): LiveVisit | null {
  if (ev.event !== "FSDJump" || typeof ev.StarSystem !== "string" || !ev.StarSystem.trim()) return null;
  if (typeof ev.timestamp !== "string" || !Number.isFinite(Date.parse(ev.timestamp))) return null;
  const at = new Date(ev.timestamp).toISOString();
  return { system: ev.StarSystem.trim(), at };
}

export function decodeTick(body: string): string {
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed !== "string" || !Number.isFinite(Date.parse(parsed))) throw new Error("Réponse tick invalide");
  return new Date(parsed).toISOString();
}
/** Existing v1.0 localStorage visits and new SQLite visits: always keep the newer timestamp. */
export function withVisits(state: BgsState, visits: readonly { system: string; at: string }[]): BgsState {
  const times = new Map<string, string>();
  for (const visit of visits) {
    const k = visit.system.trim().toLowerCase();
    if (!k || !Number.isFinite(Date.parse(visit.at))) continue;
    if (Date.parse(visit.at) > Date.parse(times.get(k) ?? "") || !times.has(k)) times.set(k, visit.at);
  }
  return {
    ...state,
    systems: state.systems.map((s) => {
      const visit = times.get(s.name.trim().toLowerCase());
      return visit && (!s.lastVisitedAt || Date.parse(visit) > Date.parse(s.lastVisitedAt))
        ? { ...s, lastVisitedAt: visit }
        : s;
    }),
  };
}
