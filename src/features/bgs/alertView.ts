/** EDCH BGS v1.6.2: pure, read-only alert presentation. No BGS writes or network access. */
import type { AlertKind, AlertSeverity, BgsAlert } from "./alertRules.js";

export interface AlertQuery {
  query: string;
  kind: AlertKind | "all";
  severity: AlertSeverity | "all";
  page: number;
  pageSize: number;
}

export interface AlertPage {
  rows: readonly BgsAlert[];
  filtered: readonly BgsAlert[];
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
}

export const DEFAULT_ALERT_QUERY: Readonly<AlertQuery> = Object.freeze({
  query: "", kind: "all", severity: "all", page: 1, pageSize: 40,
});
const normalise = (text: string): string =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR");
const KINDS: readonly string[] = ["influence", "control", "conflict", "patrol", "stale", "unvisited", "all"];
const LEVELS: readonly string[] = ["critical", "warning", "info", "all"];

/** Selection never mutates, reorders or generates alerts. The input is already priority-sorted. */
export function selectAlertPage(alerts: readonly BgsAlert[], raw: AlertQuery): AlertPage {
  const query = normalise((typeof raw.query === "string" ? raw.query : "").trim().slice(0, 120));
  const kind = KINDS.includes(raw.kind) ? raw.kind : "all";
  const severity = LEVELS.includes(raw.severity) ? raw.severity : "all";
  const size = [20, 40, 80].includes(raw.pageSize) ? raw.pageSize : 40;
  const filtered = alerts.filter((alert) =>
    (kind === "all" || alert.kind === kind) &&
    (severity === "all" || alert.severity === severity) &&
    (!query || normalise(`${alert.system} ${alert.text}`).includes(query)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const request = Number.isSafeInteger(raw.page) ? raw.page : 1;
  const page = Math.max(1, Math.min(request, pages));
  const start = (page - 1) * size;
  const rows = filtered.slice(start, start + size);
  return {
    rows, filtered, page, pages,
    from: filtered.length ? start + 1 : 0,
    to: start + rows.length,
    total: filtered.length,
  };
}

/** Defensive CSV export: untrusted community names/text cannot become spreadsheet formulas. */
function safeCsvCell(input: string): string {
  let text = input.replace(/\u0000/g, "");
  if (/^\s*[=+@\-\t\r]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
export function exportAlertCsv(alerts: readonly BgsAlert[]): string {
  const header = ["Priorité", "Catégorie", "Système", "Observation", "Date source"];
  const levels: Record<AlertSeverity, string> = {
    critical: "Priorité élevée", warning: "À vérifier", info: "Suivi",
  };
  const rows = alerts.map((alert) => [
    levels[alert.severity], alert.kind, alert.system, alert.text, alert.evidenceAt ?? "",
  ]);
  return "\uFEFF" + [header, ...rows].map((cells) => cells.map(safeCsvCell).join(",")).join("\r\n") + "\r\n";
}
