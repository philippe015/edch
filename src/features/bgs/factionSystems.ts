/** EDCH-BGS-v1.4.2: presentation of observed systems for the selected CMDR faction.
 * An entry added by hand is not evidence of faction presence or control.
 */
import type { BgsSystem } from "./core.js";

export type FactionSystemFilter = "all" | "controlled" | "present" | "unverified";
export type FactionSystemStatus = Exclude<FactionSystemFilter, "all">;

export function factionSystemStatus(system: BgsSystem): FactionSystemStatus {
  if (system.source !== "Spansh") return "unverified";
  if (system.controls === true) return "controlled";
  return "present";
}

/** Counts all entries, including manually added/unverified systems, without conflating them. */
export function factionSystemCounts(systems: readonly BgsSystem[]) {
  const result = { total: 0, controlled: 0, present: 0, unverified: 0 };
  for (const system of systems) {
    result.total++;
    result[factionSystemStatus(system)]++;
  }
  return result;
}

const searchFold = (text: string) =>
  text
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR");

/** Search is bounded by the already loaded Spansh pages; no invented systems. */
export function factionSystemRows(
  systems: readonly BgsSystem[],
  filter: FactionSystemFilter = "all",
  search = "",
): BgsSystem[] {
  const needle = searchFold(search);
  return systems
    .filter(
      (system) =>
        (filter === "all" || factionSystemStatus(system) === filter) &&
        (!needle || searchFold(system.name).includes(needle)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "fr-FR", { sensitivity: "base", numeric: true }));
}

const csvCell = (value: unknown): string => {
  const plain = String(value ?? "");
  const safe = /^[\s]*[=+@\-]/.test(plain) ? "'" + plain : plain;
  return '"' + safe.replace(/"/g, '""') + '"';
};

/** Export all loaded systems, not merely the current UI page; guards CSV formulas. */
export function factionSystemsCsv(faction: string, systems: readonly BgsSystem[]): string {
  const header = [
    "Faction",
    "Système",
    "Statut",
    "Influence %",
    "États",
    "Distance AL",
    "Source",
    "Données mises à jour UTC",
    "Dernière visite UTC",
  ];
  const labels: Record<FactionSystemStatus, string> = {
    controlled: "Contrôlé",
    present: "Présente",
    unverified: "Non vérifié (manuel)",
  };
  const rows = factionSystemRows(systems).map((s) => [
    faction,
    s.name,
    labels[factionSystemStatus(s)],
    s.influence?.toFixed(2) ?? "",
    s.states.join(" / "),
    s.distance?.toFixed(1) ?? "",
    s.source,
    s.updatedAt ?? "",
    s.lastVisitedAt ?? "",
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\n");
}
