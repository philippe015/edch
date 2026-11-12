/** EDCH-BGS-v1.4: strict, bounded JSON backup imports; never evaluates code. */
import type { BgsState, BgsSystem, Observation } from "./core.js";

export const MAX_BGS_IMPORT_BYTES = 2_000_000;
const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function string(v: unknown, label: string, max: number): string {
  if (typeof v !== "string" || !v.trim() || v.length > max) throw new Error(`${label} invalide`);
  return v.trim();
}
function optionalString(v: unknown, label: string, max: number): string | undefined {
  return v === undefined || v === null ? undefined : string(v, label, max);
}
function date(v: unknown, label: string, required = false): string | undefined {
  if ((v === null || v === undefined) && !required) return undefined;
  const raw = string(v, label, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(raw) || !Number.isFinite(Date.parse(raw)))
    throw new Error(`${label} : date invalide`);
  return new Date(raw).toISOString();
}
function number(v: unknown, label: string, min: number, max: number): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new Error(`${label} : nombre invalide`);
  return v;
}
function optionalBool(v: unknown, label: string): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "boolean") throw new Error(`${label} : booléen invalide`);
  return v;
}
function states(v: unknown, label: string): string[] {
  if (!Array.isArray(v) || v.length > 32) throw new Error(`${label} : liste d'états invalide`);
  return v.map((s, i) => string(s, `${label}[${i}]`, 100));
}
function system(v: unknown, i: number): BgsSystem {
  if (!obj(v)) throw new Error(`Système ${i} invalide`);
  const name = string(v.name, `Système ${i}`, 180);
  if (v.source !== "manual" && v.source !== "Spansh") throw new Error(`${name} : source invalide`);
  let coords: [number, number, number] | undefined;
  if (v.coords !== null && v.coords !== undefined) {
    if (
      !Array.isArray(v.coords) ||
      v.coords.length !== 3 ||
      !v.coords.every((c: unknown) => typeof c === "number" && Number.isFinite(c) && Math.abs(c) <= 1e9)
    )
      throw new Error(`${name} : coordonnées invalides`);
    coords = [v.coords[0], v.coords[1], v.coords[2]];
  }
  const id64 = optionalString(v.id64, `${name} ID`, 24);
  if (id64 !== undefined && !/^\d+$/.test(id64)) throw new Error(`${name} : ID64 invalide`);
  // Empty note is a valid way to clear an existing annotation.
  const note =
    v.note === undefined || v.note === null
      ? undefined
      : typeof v.note === "string" && v.note.length <= 500
        ? v.note
        : (() => {
            throw new Error(`${name} : note invalide`);
          })();
  return {
    name,
    id64,
    coords,
    note,
    states: states(v.states, `${name} états`),
    source: v.source,
    influence: number(v.influence, `${name} influence`, 0, 100),
    distance: number(v.distance, `${name} distance`, 0, 1e9),
    controls: optionalBool(v.controls, `${name} contrôle`),
    anchor: optionalBool(v.anchor, `${name} ancrage`),
    updatedAt: date(v.updatedAt, `${name} actualisation`),
    lastVisitedAt: date(v.lastVisitedAt, `${name} visite`),
    retrievedAt: date(v.retrievedAt, `${name} réception`, true)!,
  };
}
function observation(v: unknown, i: number): Observation {
  if (!obj(v)) throw new Error(`Observation ${i} invalide`);
  return {
    key: string(v.key, `Observation ${i} clé`, 180),
    system: string(v.system, `Observation ${i} système`, 180),
    states: states(v.states, `Observation ${i} états`),
    source: string(v.source, `Observation ${i} source`, 70),
    observedAt: date(v.observedAt, `Observation ${i} relevé`, true)!,
    receivedAt: date(v.receivedAt, `Observation ${i} réception`, true)!,
    influence: number(v.influence, `Observation ${i} influence`, 0, 100),
    controls: optionalBool(v.controls, `Observation ${i} contrôle`),
  };
}
/** Returns a new, sanitized object; unknown fields and dangerous prototypes are never retained. */
export function parseBgsBackup(json: string): BgsState {
  if (typeof json !== "string" || new TextEncoder().encode(json).byteLength > MAX_BGS_IMPORT_BYTES)
    throw new Error("Fichier trop volumineux (maximum 2 Mo)");
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("JSON illisible");
  }
  if (!obj(data)) throw new Error("Structure BGS invalide");
  const faction = string(data.faction, "Faction", 160);
  if (
    !Array.isArray(data.systems) ||
    data.systems.length > 5000 ||
    !Array.isArray(data.history) ||
    data.history.length > 10000
  )
    throw new Error("Trop de systèmes ou d'observations");
  const systems = data.systems.map(system);
  const history = data.history.map(observation);
  const names = new Set<string>();
  for (const s of systems) {
    const key = s.name.toLocaleLowerCase();
    if (names.has(key)) throw new Error(`Système présent deux fois : ${s.name}`);
    names.add(key);
  }
  return {
    faction,
    systems,
    history,
    lastFetchedAt: date(data.lastFetchedAt, "Dernière recherche"),
    tickAt: date(data.tickAt, "Dernier tick"),
    tickCheckedAt: date(data.tickCheckedAt, "Vérification tick"),
    partial: optionalBool(data.partial, "Recherche partielle"),
    reportedTotal: number(data.reportedTotal, "Total des systèmes", 0, 1e7),
  };
}
