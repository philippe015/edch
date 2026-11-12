// EDCH-BGS-v1.2
/** EDCH BGS v1.2: trends are measured observations, never extrapolated ticks. */
import type { BgsState, BgsSystem, Observation } from "./core.js";
import { quoteCsv } from "./csv.js";
// EDCH-BGS-v1.3

export interface TrendSample {
  at: string;
  influence: number;
  controls?: boolean;
  source: string;
}
export interface Trend {
  system: string;
  samples: TrendSample[];
  delta?: number; // percentage points between the two most recent DISTINCT observations
  latestAt?: string;
  earlierAt?: string;
  controlChanged: boolean;
}

// Cache a per-history-array index: rendering hundreds of systems is linear, not O(systems * history).
const indexCache = new WeakMap<Observation[], Map<string, Observation[]>>();
function historyIndex(history: Observation[]): Map<string, Observation[]> {
  const existing = indexCache.get(history);
  if (existing) return existing;
  const index = new Map<string, Observation[]>();
  for (const row of history) {
    for (const key of new Set([row.system.trim().toLowerCase(), row.key.trim().toLowerCase()])) {
      const records = index.get(key) ?? [];
      records.push(row);
      index.set(key, records);
    }
  }
  indexCache.set(history, index);
  return index;
}

/** Retain the latest recorded receipt of each observedAt; sort oldest -> newest. */
export function trendOf(state: BgsState, system: BgsSystem): Trend {
  const byStamp = new Map<string, Observation>();
  const index = historyIndex(state.history);
  const keys = new Set([system.name.trim().toLowerCase(), (system.id64 ?? "").toLowerCase()]);
  const rows = new Set([...keys].flatMap((key) => index.get(key) ?? []));
  for (const row of rows) {
    if (!Number.isFinite(Date.parse(row.observedAt))) continue;
    const previous = byStamp.get(row.observedAt);
    if (!previous || row.receivedAt >= previous.receivedAt) byStamp.set(row.observedAt, row);
  }
  const snapshots = [...byStamp.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const samples: TrendSample[] = snapshots
    .filter(
      (row): row is Observation & { influence: number } =>
        typeof row.influence === "number" &&
        Number.isFinite(row.influence) &&
        row.influence >= 0 &&
        row.influence <= 100,
    )
    .map((row) => ({ at: row.observedAt, influence: row.influence, controls: row.controls, source: row.source }));
  const latest = samples.at(-1);
  const earlier = samples.at(-2);
  const lastWithControl = snapshots.filter((s) => typeof s.controls === "boolean").slice(-2);
  return {
    system: system.name,
    samples,
    delta: latest && earlier ? latest.influence - earlier.influence : undefined,
    latestAt: latest?.at,
    earlierAt: earlier?.at,
    controlChanged: lastWithControl.length === 2 && lastWithControl[0].controls !== lastWithControl[1].controls,
  };
}

/** SVG path for a historical sparkline. No extrapolation or fake intermediate points. */
export function sparklinePath(samples: readonly TrendSample[], width = 240, height = 60): string {
  if (samples.length < 2 || width <= 0 || height <= 0) return "";
  const valid = samples.filter((row) => Number.isFinite(Date.parse(row.at)) && Number.isFinite(row.influence));
  if (valid.length < 2) return "";
  const minTime = Math.min(...valid.map((x) => Date.parse(x.at)));
  const maxTime = Math.max(...valid.map((x) => Date.parse(x.at)));
  const tSpan = maxTime - minTime;
  const pad = 5;
  const scaleX = (date: string, i: number): number =>
    pad + (width - 2 * pad) * (tSpan > 0 ? (Date.parse(date) - minTime) / tSpan : i / (valid.length - 1));
  // Absolute 0-100% scale: a small swing does not look like a huge collapse.
  const scaleY = (value: number) => pad + (height - 2 * pad) * (1 - Math.max(0, Math.min(100, value)) / 100);
  return valid
    .map((row, i) => `${i === 0 ? "M" : "L"}${scaleX(row.at, i).toFixed(1)} ${scaleY(row.influence).toFixed(1)}`)
    .join(" ");
}

export interface TrendAlert {
  system: string;
  text: string;
  severity: "warning" | "danger";
}
/** Explain alerts; recent values from third parties can still be stale or incomplete. */
export function trendAlerts(state: BgsState, now = Date.now()): TrendAlert[] {
  const alerts: TrendAlert[] = [];
  for (const system of state.systems) {
    const trend = trendOf(state, system);
    if (!trend.latestAt || now - Date.parse(trend.latestAt) > 3 * 86_400_000) continue;
    if (trend.controlChanged)
      alerts.push({ system: system.name, text: "Changement de contrôle observé (à vérifier)", severity: "danger" });
    if (trend.delta !== undefined && trend.delta <= -5)
      alerts.push({
        system: system.name,
        text: `Influence : ${trend.delta.toFixed(1)} points entre deux relevés`,
        severity: "warning",
      });
  }
  return alerts;
}

export function trendsSummary(state: BgsState): {
  rising: number;
  falling: number;
  stable: number;
  unavailable: number;
} {
  const out = { rising: 0, falling: 0, stable: 0, unavailable: 0 };
  for (const system of state.systems) {
    const delta = trendOf(state, system).delta;
    if (delta === undefined) out.unavailable++;
    else if (delta > 0.05) out.rising++;
    else if (delta < -0.05) out.falling++;
    else out.stable++;
  }
  return out;
}

export function trendCsv(state: BgsState): string {
  return [
    [
      "Système",
      "Influence précédente %",
      "Influence récente %",
      "Variation points",
      "Observation précédente UTC",
      "Observation récente UTC",
      "Changement contrôle",
    ]
      .map(quoteCsv)
      .join(";"),
    ...state.systems.map((system) => {
      const t = trendOf(state, system);
      return [
        system.name,
        t.samples.at(-2)?.influence.toFixed(2),
        t.samples.at(-1)?.influence.toFixed(2),
        t.delta?.toFixed(2),
        t.earlierAt,
        t.latestAt,
        t.controlChanged ? "oui" : "non",
      ]
        .map(quoteCsv)
        .join(";");
    }),
  ].join("\n");
}
