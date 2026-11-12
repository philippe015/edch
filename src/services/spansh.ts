// EDCH-BGS-CUSTOM-v1
// Spansh search API: turns a "where to find" rule into a Spansh query near the reference
// system, runs it (with a short cache) and returns systems, bodies or stations with their distance.

import { gameName, locale, t } from "../platform/i18n.js";
import { spanshPost } from "../platform/bridge.js";
import type { Vec3 } from "../game/journal/state.js";
import type { Finder } from "../features/materials/sources.js";
import type { Settings } from "../state/store.js";

export interface Reference {
  coords?: Vec3;
  system?: string;
  label: string;
}

export interface ResultRow {
  /** What gets copied and searched in the galaxy map. */
  system: string;
  title: string; // system, body or station name
  distance: number;
  sub: string[];
  badges: { text: string; tone?: "hit" | "warn" | "muted" }[];
  links: { label: string; url: string }[];
  updated?: string;
}

export interface FinderResult {
  rows: ResultRow[];
  total: number;
}

const cache = new Map<string, { at: number; value: FinderResult }>();
const TTL = 10 * 60 * 1000;

const num = (n: unknown) => (typeof n === "number" ? n : Number(n ?? NaN));
const oneDecimal = (n: number) => n.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtPop = (n: number) =>
  n >= 1e9
    ? t("spansh.bnPop", { value: oneDecimal(n / 1e9) })
    : n >= 1e6
      ? t("spansh.mPop", { value: oneDecimal(n / 1e6) })
      : n >= 1e3
        ? t("spansh.kPop", { value: Math.round(n / 1e3) })
        : t("spansh.pop", { n });

const SECURITY_LABELS: Record<string, string> = {
  High: t("common.highSecurity"),
  Medium: t("common.mediumSecurity"),
  Low: t("common.lowSecurity"),
  Anarchy: t("common.anarchy"),
};

export const inaraSystem = (name: string) => `https://inara.cz/elite/starsystem/?search=${encodeURIComponent(name)}`;

function reference(ref: Reference): Record<string, unknown> {
  if (ref.coords) return { reference_coords: { x: ref.coords[0], y: ref.coords[1], z: ref.coords[2] } };
  return { reference_system: ref.system ?? "Sol" };
}

function freshness(days: number): Record<string, unknown> {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 19);
  return { updated_at: { comparison: "<=>", value: [cutoff, "2999-12-31T00:00:00"] } };
}

export function buildRequest(f: Finder, ref: Reference, s: Settings): Record<string, unknown> {
  const filters: Record<string, unknown> = {
    ...(f.filters ?? {}),
    distance: { min: "0", max: String(s.maxDistance) },
    ...(f.fresh && s.maxAgeDays > 0 ? freshness(s.maxAgeDays) : {}),
  };
  return {
    filters,
    sort: [{ distance: { direction: "asc" } }],
    size: f.size ?? (f.type === "bodies" ? 30 : 10),
    page: 0,
    ...reference(ref),
  };
}

function systemRow(r: any, f: Finder): ResultRow {
  const badges: ResultRow["badges"] = [];
  const wanted = new Set(f.states ?? []);
  const presences: any[] = Array.isArray(r.minor_faction_presences) ? r.minor_faction_presences : [];
  if (wanted.size) {
    const hits = new Map<string, string[]>();
    for (const p of presences) {
      const all = new Set<string>(
        [p.state, ...(Array.isArray(p.active_states) ? p.active_states : [])].filter(Boolean),
      );
      for (const st of all) if (wanted.has(st)) hits.set(st, [...(hits.get(st) ?? []), p.name]);
    }
    for (const [st, names] of hits)
      badges.push({
        text: `${gameName(st)} · ${names.length > 1 ? t("spansh.factionCount", { count: names.length }) : names[0]}`,
        tone: "hit",
      });
  }
  if (
    r.controlling_minor_faction_state &&
    !wanted.has(r.controlling_minor_faction_state) &&
    r.controlling_minor_faction_state !== "None"
  ) {
    badges.push({ text: gameName(r.controlling_minor_faction_state), tone: "muted" });
  }
  const sub: string[] = [];
  if (r.population) sub.push(fmtPop(num(r.population)));
  if (r.allegiance) sub.push(r.allegiance);
  if (r.security) sub.push(SECURITY_LABELS[r.security] ?? r.security);
  if (r.primary_economy) sub.push(r.primary_economy);
  return {
    system: r.name,
    title: r.name,
    distance: num(r.distance),
    sub,
    badges,
    links: [
      ...(r.id64 ? [{ label: "Spansh", url: `https://spansh.co.uk/system/${r.id64}` }] : []),
      { label: "Inara", url: inaraSystem(r.name) },
    ],
    updated: r.updated_at,
  };
}

function bodyRow(r: any, f: Finder): ResultRow & { share: number } {
  const mats: any[] = Array.isArray(r.materials) ? r.materials : [];
  const hit = f.materialName
    ? mats.find((x) => String(x.name).toLowerCase() === f.materialName!.toLowerCase())
    : undefined;
  const share = hit ? num(hit.share) : 0;
  const sub: string[] = [];
  if (r.subtype) sub.push(r.subtype);
  if (r.distance_to_arrival !== undefined)
    sub.push(t("spansh.lsFromArrival", { locale: Math.round(num(r.distance_to_arrival)).toLocaleString(locale()) }));
  if (r.gravity !== undefined && r.is_landable) sub.push(`${num(r.gravity).toFixed(2)} g`);
  const badges: ResultRow["badges"] = [];
  if (hit) badges.push({ text: `${f.materialName} ${share.toFixed(1)} %`, tone: "hit" });
  if (r.reserve_level) badges.push({ text: r.reserve_level, tone: "muted" });
  if (Array.isArray(r.rings) && r.rings.length && !f.materialName) {
    badges.push({ text: [...new Set(r.rings.map((x: any) => x.type))].join(", "), tone: "muted" });
  }
  if (Array.isArray(r.signals) && f.filters && "signals" in f.filters) {
    for (const sig of r.signals)
      if (/guardian|thargoid/i.test(sig.name)) badges.push({ text: `${sig.name} ×${sig.count}`, tone: "hit" });
  }
  return {
    system: r.system_name,
    title: r.name,
    distance: num(r.distance),
    sub,
    badges,
    links: [
      ...(r.id64 ? [{ label: "Spansh", url: `https://spansh.co.uk/body/${r.id64}` }] : []),
      { label: "Inara", url: inaraSystem(r.system_name) },
    ],
    updated: r.updated_at,
    share,
  };
}

function stationRow(r: any): ResultRow {
  const sub: string[] = [];
  if (r.type) sub.push(r.type);
  if (r.distance_to_arrival !== undefined)
    sub.push(t("common.ls", { locale: Math.round(num(r.distance_to_arrival)).toLocaleString(locale()) }));
  const badges: ResultRow["badges"] = [];
  if (r.has_large_pad === true) badges.push({ text: t("spansh.lPad") });
  else if (r.medium_pads > 0) badges.push({ text: t("spansh.mPad"), tone: "muted" });
  else if (r.small_pads > 0) badges.push({ text: t("spansh.sPadOnly"), tone: "warn" });
  if (r.is_planetary) badges.push({ text: t("spansh.planetary"), tone: "muted" });
  return {
    system: r.system_name,
    title: `${r.name} | ${r.system_name}`,
    distance: num(r.distance),
    sub,
    badges,
    links: [
      ...(r.market_id ? [{ label: "Spansh", url: `https://spansh.co.uk/station/${r.market_id}` }] : []),
      { label: "Inara", url: inaraSystem(r.system_name) },
    ],
    updated: r.updated_at,
  };
}

export async function runFinder(f: Finder, ref: Reference, s: Settings, force = false): Promise<FinderResult> {
  if (f.type === "info") return { rows: [], total: 0 };
  const body = buildRequest(f, ref, s);
  const cacheKey = `${f.type}:${JSON.stringify(body)}`;
  const hit = cache.get(cacheKey);
  if (hit && !force && Date.now() - hit.at < TTL) return hit.value;

  const data = await spanshPost(`${f.type}/search`, body);
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  let rows: ResultRow[];
  if (f.type === "systems") rows = results.map((r) => systemRow(r, f));
  else if (f.type === "stations") rows = results.map(stationRow);
  else {
    const bodies = results.map((r) => bodyRow(r, f));
    if (f.materialName) {
      // Best percentage wins, distance breaks ties; keep it short.
      bodies.sort((a, b) => b.share - a.share || a.distance - b.distance);
      rows = bodies.slice(0, 8);
    } else rows = bodies;
  }
  const value = { rows, total: num(data?.count) || rows.length };
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
}

// ---------------- faction search ----------------

export interface FactionQuery {
  faction: string;
  /** Only the systems the faction controls. */
  ownerOnly: boolean;
  /** Faction states wanted (English game names); empty: any state. */
  states: string[];
}

/** The faction's presence in a Spansh system result. */
const presenceOf = (r: any, faction: string): any =>
  (Array.isArray(r.minor_faction_presences) ? r.minor_faction_presences : []).find(
    (p: any) => String(p.name).toLowerCase() === faction.toLowerCase(),
  );

const controls = (r: any, faction: string) =>
  String(r.controlling_minor_faction ?? "").toLowerCase() === faction.toLowerCase();

function factionRow(r: any, q: FactionQuery): ResultRow {
  const presence = presenceOf(r, q.faction) ?? {};
  const wanted = new Set(q.states);
  const states = [
    ...new Set<string>(
      [presence.state, ...(Array.isArray(presence.active_states) ? presence.active_states : [])].filter(
        (st) => st && st !== "None",
      ),
    ),
  ];
  const badges: ResultRow["badges"] = [];
  if (controls(r, q.faction)) badges.push({ text: t("spansh.controlsSystem"), tone: "hit" });
  if (typeof presence.influence === "number")
    badges.push({ text: t("spansh.influence", { value: oneDecimal(presence.influence * 100) }) });
  for (const st of states) badges.push({ text: gameName(st), tone: wanted.has(st) ? "hit" : "muted" });
  const sub: string[] = [];
  if (r.controlling_minor_faction && !controls(r, q.faction))
    sub.push(t("spansh.controlledBy", { faction: r.controlling_minor_faction }));
  if (r.population) sub.push(fmtPop(num(r.population)));
  return {
    system: r.name,
    title: r.name,
    distance: num(r.distance),
    sub,
    badges,
    links: [
      ...(r.id64 ? [{ label: "Spansh", url: `https://spansh.co.uk/system/${r.id64}` }] : []),
      { label: "Inara", url: inaraSystem(r.name) },
    ],
    updated: r.updated_at,
  };
}

/**
 * Systems where a minor faction is present (or that it controls), nearest first, optionally only
 * where it is in one of `states`. Spansh filters on the faction's main state.
 */
export async function searchFaction(q: FactionQuery, ref: Reference): Promise<FinderResult> {
  // All pages, not only the 50 closest systems. Safety cap prevents runaway requests.
  const size = 100;
  const maxPages = 30;
  const all = new Map<string, ResultRow>();
  let reportedTotal = 0;
  let complete = false;
  for (let page = 0; page < maxPages; page++) {
    const presence: Record<string, unknown> = { name: { value: [q.faction] } };
    if (q.states.length) presence.state = { value: q.states };
    const result = await spanshPost("systems/search", {
      filters: { minor_faction_presences: [presence] },
      sort: [{ distance: { direction: "asc" } }],
      size,
      page,
      ...reference(ref),
    });
    const rows: any[] = Array.isArray(result?.results) ? result.results : [];
    const count = Number(result?.count);
    if (Number.isFinite(count) && count >= 0) reportedTotal = count;
    const before = all.size;
    for (const record of rows) {
      if (q.ownerOnly && !controls(record, q.faction)) continue;
      const row = factionRow(record, q);
      all.set(String(record.id64 ?? row.system.toLowerCase()), row);
    }
    if (
      !rows.length ||
      (reportedTotal && (page + 1) * size >= reportedTotal) ||
      (rows.length < size && !reportedTotal)
    ) {
      complete = true;
      break;
    }
    // Do not loop forever on a Spansh API that ignores the page number.
    if (all.size === before && !q.ownerOnly) break;
  }
  const rows = [...all.values()];
  // For a truncated search, the reported count signals possible additional results.
  return { rows, total: q.ownerOnly || complete ? rows.length : Math.max(reportedTotal, rows.length) };
}

export function distance(a?: Vec3, b?: Vec3 | null): number | undefined {
  if (!a || !b) return undefined;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export const fmtLy = (n?: number) =>
  n === undefined || Number.isNaN(n)
    ? ""
    : t("common.ly", { locale: n.toLocaleString(locale(), { maximumFractionDigits: n < 100 ? 2 : 1 }) });
