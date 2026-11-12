/** EDCH-BGS-FACTION-SWITCH-v1.4.9.2: local, per-faction selection helpers. */
import type { BgsState } from "./core.js";

const PREFIX = "edch.bgs.custom.v1.faction.";

/** Never accept empty names, control characters or unexpectedly large input. */
export function cleanFactionName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || name.length > 160 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

export function sameFactionName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/** Reject a cached snapshot that belongs to another faction. */
export function validFactionSnapshot(value: unknown, faction: string): value is BgsState {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<BgsState>;
  return (
    typeof data.faction === "string" &&
    sameFactionName(data.faction, faction) &&
    Array.isArray(data.systems) &&
    Array.isArray(data.history)
  );
}

/** List only validated snapshots already stored locally; no network access. */
export function rememberedFactions(
  storage: Pick<Storage, "length" | "key" | "getItem">,
  current: string,
  preferred = "",
): string[] {
  const values = new Map<string, string>();
  const add = (name: unknown) => {
    const clean = cleanFactionName(name);
    if (clean) values.set(clean.toLocaleLowerCase(), clean);
  };
  add(current);
  add(preferred);
  try {
    const count = Math.min(storage.length, 5000);
    for (let i = 0; i < count; i++) {
      try {
        const key = storage.key(i);
        if (!key?.startsWith(PREFIX)) continue;
        const raw = storage.getItem(key);
        if (!raw || raw.length > 2_500_000) continue;
        const data: unknown = JSON.parse(raw);
        const parsedKey = decodeURIComponent(key.slice(PREFIX.length));
        if (cleanFactionName(parsedKey) && validFactionSnapshot(data, parsedKey)) {
          add((data as BgsState).faction);
        }
      } catch {
        // A corrupt old cache key must never hide another valid faction.
      }
    }
  } catch {
    // Restricted localStorage: the selected faction is still usable.
  }
  return [...values.values()].sort((a, b) => a.localeCompare(b, "fr-FR", { sensitivity: "base" })).slice(0, 100);
}
