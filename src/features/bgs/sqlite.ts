/** SQLite BGS persistence through the private Tauri backend. No remote phone writes. */
import { isRemote, isTauri } from "../../platform/bridge.js";
import type { BgsState } from "./core.js";

export interface StoredBgs {
  snapshot: string | null;
  visits: { system: string; at: string }[];
}
export const localSqlite = () => isTauri() && !isRemote();
function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!localSqlite()) return Promise.reject(new Error("SQLite disponible uniquement sur le PC"));
  return window.__TAURI__!.core.invoke<T>(cmd, args);
}
export const readBgs = (faction: string) => invoke<StoredBgs>("bgs_load", { faction });
export const writeBgs = (state: BgsState) =>
  invoke<void>("bgs_save", { faction: state.faction, data: JSON.stringify(state) });
export const recordVisitDb = (system: string, at: string) => invoke<void>("bgs_visit", { system, at });
export const sqliteHealth = () => invoke<string>("bgs_health");
