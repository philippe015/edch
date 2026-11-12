/** CZ victories are NOT emitted by the Elite Dangerous journal.
 * Player-confirmed combat-zone results are stored separately from FactionKillBond events.
 * Local records are scoped per CMDR; journal replay must never increment them.
 */
export type CzKind = "ship" | "on-foot";
export type CzGrade = "low" | "medium" | "high" | "unknown";
export type CzOutcome = "win" | "loss" | "unknown";

export interface CombatZoneRecord {
  id: string;
  at: string;
  faction: string;
  system?: string;
  kind: CzKind;
  grade: CzGrade;
  outcome: CzOutcome;
  count: number;
  source: "manual";
}

export interface CombatZoneHistory {
  commander: string;
  records: CombatZoneRecord[];
  error?: string;
}

export interface CzStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AddCombatZone {
  faction: string;
  system?: string;
  kind: CzKind;
  grade: CzGrade;
  outcome: CzOutcome;
  count: number;
  at?: string;
  id?: string;
}

const PREFIX = "edch.cyberpunk.cz.v1.";
export const MAX_CZ_RECORDS = 2000;
const MAX_BYTES = 950_000;
const safeName = (text: unknown, limit: number): text is string =>
  typeof text === "string" &&
  text.trim().length > 0 &&
  text.trim().length <= limit &&
  !/[\x00-\x1f\x7f]/.test(text);
const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
const validDate = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 45 && Number.isFinite(Date.parse(value));
const validKind = (value: unknown): value is CzKind => value === "ship" || value === "on-foot";
const validGrade = (value: unknown): value is CzGrade =>
  value === "low" || value === "medium" || value === "high" || value === "unknown";
const validOutcome = (value: unknown): value is CzOutcome =>
  value === "win" || value === "loss" || value === "unknown";

function validRecord(value: unknown): value is CombatZoneRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return safeName(item.id, 90) &&
    validDate(item.at) &&
    safeName(item.faction, 160) &&
    (item.system === undefined || safeName(item.system, 180)) &&
    validKind(item.kind) &&
    validGrade(item.grade) &&
    validOutcome(item.outcome) &&
    Number.isSafeInteger(item.count) &&
    (item.count as number) >= 1 &&
    (item.count as number) <= 50 &&
    item.source === "manual";
}

export function combatZoneKey(commander: string): string | undefined {
  return safeName(commander, 90) ? PREFIX + encodeURIComponent(commander.trim().toLocaleLowerCase()) : undefined;
}

export function readCombatZones(commander: string, storage: CzStorage = localStorage): CombatZoneHistory {
  const key = combatZoneKey(commander);
  if (!key) return { commander, records: [], error: "Commandant non reconnu." };
  try {
    const raw = storage.getItem(key);
    if (!raw) return { commander, records: [] };
    if (raw.length > MAX_BYTES) throw new Error("Historique trop volumineux : export/diagnostic requis.");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Format de sauvegarde incorrect.");
    const value = parsed as Record<string, unknown>;
    if (value.version !== 1 || typeof value.commander !== "string" || !same(value.commander, commander) ||
      !Array.isArray(value.records) || value.records.length > MAX_CZ_RECORDS ||
      !value.records.every(validRecord))
      throw new Error("Historique CZ incompatible ou endommagé.");
    const records = value.records as CombatZoneRecord[];
    if (new Set(records.map((record) => record.id)).size !== records.length)
      throw new Error("Doublons dans l'historique CZ.");
    return { commander, records };
  } catch (error) {
    return { commander, records: [], error: String((error as Error).message ?? error) };
  }
}

function saveCombatZones(commander: string, records: CombatZoneRecord[], storage: CzStorage): void {
  const key = combatZoneKey(commander);
  if (!key) throw new Error("Commandant non reconnu.");
  if (records.length > MAX_CZ_RECORDS) throw new Error("Limite d'historique CZ atteinte. Exporte les données.");
  const json = JSON.stringify({ version: 1, commander, records });
  if (json.length > MAX_BYTES) throw new Error("Stockage CZ trop volumineux. Exporte les données.");
  storage.setItem(key, json);
}

/** A manual entry can group several previously completed CZs, never bond-event counts. */
export function addCombatZone(commander: string, input: AddCombatZone, storage: CzStorage = localStorage): CombatZoneRecord {
  const history = readCombatZones(commander, storage);
  if (history.error) throw new Error(history.error);
  const system = input.system?.trim() || undefined;
  if (!safeName(input.faction, 160) || (system !== undefined && !safeName(system, 180)) ||
    !validKind(input.kind) || !validGrade(input.grade) || !validOutcome(input.outcome) ||
    !Number.isSafeInteger(input.count) || input.count < 1 || input.count > 50)
    throw new Error("Faction, type, difficulté, résultat ou nombre CZ invalide.");
  const at = input.at ?? new Date().toISOString();
  if (!validDate(at)) throw new Error("Date CZ invalide.");
  const id = input.id ?? crypto.randomUUID();
  if (!safeName(id, 90) || history.records.some((record) => record.id === id))
    throw new Error("Identifiant CZ dupliqué ou invalide.");
  const record: CombatZoneRecord = {
    id,
    at: new Date(at).toISOString(),
    faction: input.faction.trim(),
    system,
    kind: input.kind,
    grade: input.grade,
    outcome: input.outcome,
    count: input.count,
    source: "manual",
  };
  saveCombatZones(commander, [...history.records, record], storage);
  return record;
}

export function deleteCombatZone(commander: string, id: string, storage: CzStorage = localStorage): boolean {
  const history = readCombatZones(commander, storage);
  if (history.error) throw new Error(history.error);
  const remaining = history.records.filter((record) => record.id !== id);
  if (remaining.length === history.records.length) return false;
  saveCombatZones(commander, remaining, storage);
  return true;
}

export function combatZoneSummary(records: readonly CombatZoneRecord[], faction: string, now = Date.now()) {
  const sum = (matching: (record: CombatZoneRecord) => boolean) =>
    records.reduce((total, record) => total + (matching(record) ? record.count : 0), 0);
  return {
    total: sum(() => true),
    faction: sum((record) => same(record.faction, faction)),
    wins: sum((record) => record.outcome === "win"),
    losses: sum((record) => record.outcome === "loss"),
    ship: sum((record) => record.kind === "ship"),
    onFoot: sum((record) => record.kind === "on-foot"),
    last30: sum((record) => {
      const age = now - Date.parse(record.at);
      return age >= 0 && age <= 30 * 86400_000;
    }),
  };
}

export function combatZoneCsv(commander: string, records: readonly CombatZoneRecord[]): string {
  const esc = (value: unknown) => {
    const raw = String(value ?? "");
    const guarded = /^[=+@\-\t\r]/.test(raw) ? "'" + raw : raw;
    return '"' + guarded.replace(/"/g, '""') + '"';
  };
  const header = ["CMDR", "Date UTC", "Système", "Faction", "Support", "Difficulté", "Résultat", "CZ effectuées", "Source"];
  const lines = records.map((record) => [
    commander, record.at, record.system, record.faction, record.kind,
    record.grade, record.outcome, record.count, record.source,
  ]);
  return [header, ...lines].map((line) => line.map(esc).join(";")).join("\n");
}
