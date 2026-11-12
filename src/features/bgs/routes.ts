// EDCH-BGS-v1.2
/** EDCH BGS v1.2: bounded, conservative route hints, not a ship FSD plotter. */
import { patrolScore, type BgsSystem } from "./core.js";
import { quoteCsv } from "./csv.js";
// EDCH-BGS-v1.3

export type Vec3 = [number, number, number];
export interface PatrolLeg {
  system: BgsSystem;
  from?: string;
  ly: number;
  score: number;
}
export interface PatrolRoute {
  origin: "position" | "anchor" | "unknown";
  originName: string;
  legs: PatrolLeg[];
  totalLy: number;
  maxLegLy: number;
  excludedNoCoords: string[];
  disconnected: string[];
  isPartial: boolean;
}
export const distanceLy = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const goodCoords = (coords?: Vec3): coords is Vec3 =>
  Boolean(coords && coords.length === 3 && coords.every(Number.isFinite));
/**
 * Prefer urgency, then distance. Every leg must be <= maxLegLy; if unreachable, stop
 * rather than inventing intermediate systems. The result is a hint, not an optimal path.
 */
export function planPatrolRoute(
  systems: readonly BgsSystem[],
  current?: { name: string; coords: Vec3 },
  options: { maxLegLy?: number; maxStops?: number; now?: number } = {},
): PatrolRoute {
  const maxLegLy = Math.max(1, Math.min(100, options.maxLegLy ?? 15));
  const maxStops = Math.max(1, Math.min(50, Math.trunc(options.maxStops ?? 15)));
  const now = options.now ?? Date.now();
  let coords: Vec3 | undefined = goodCoords(current?.coords) ? current?.coords : undefined;
  let origin: PatrolRoute["origin"] = coords ? "position" : "unknown";
  let originName = coords ? current?.name || "Position actuelle" : "Coordonnées indisponibles";
  const candidate = systems.filter((s) => goodCoords(s.coords));
  const excludedNoCoords = systems.filter((s) => !goodCoords(s.coords)).map((s) => s.name);
  // Without a valid live position, a tagged anchor is a fixed starting reference.
  let startingAnchor: BgsSystem | undefined;
  if (!coords) {
    startingAnchor = candidate.filter((s) => s.anchor).sort((a, b) => a.name.localeCompare(b.name))[0];
    if (startingAnchor?.coords) {
      coords = startingAnchor.coords;
      origin = "anchor";
      originName = startingAnchor.name;
    }
  }
  const visited = new Set<string>();
  if (startingAnchor) visited.add(startingAnchor.name.toLowerCase());
  const legs: PatrolLeg[] = [];
  let totalLy = 0;
  let from = originName;
  if (coords) {
    while (legs.length < maxStops) {
      const reachable = candidate.filter(
        (s) => !visited.has(s.name.toLowerCase()) && distanceLy(coords!, s.coords!) <= maxLegLy + 1e-9,
      );
      if (!reachable.length) break;
      // Priority weight 3 points per LY: rank nearby urgent systems ahead of distant low-priority ones.
      reachable.sort((a, b) => {
        const da = distanceLy(coords!, a.coords!),
          db = distanceLy(coords!, b.coords!);
        return patrolScore(b, now) - 3 * db - (patrolScore(a, now) - 3 * da) || da - db || a.name.localeCompare(b.name);
      });
      const target = reachable[0];
      const ly = distanceLy(coords!, target.coords!);
      legs.push({ system: target, from, ly, score: patrolScore(target, now) });
      totalLy += ly;
      visited.add(target.name.toLowerCase());
      coords = target.coords;
      from = target.name;
    }
  }
  const disconnected = candidate.filter((s) => !visited.has(s.name.toLowerCase())).map((s) => s.name);
  return {
    origin,
    originName,
    legs,
    totalLy,
    maxLegLy,
    excludedNoCoords,
    disconnected,
    isPartial: disconnected.length > 0 || excludedNoCoords.length > 0 || origin === "unknown",
  };
}

export function routeCsv(route: PatrolRoute): string {
  const rows = [
    ["Ordre", "De", "Vers", "Distance AL", "Priorité", "Coordonnées X", "Y", "Z"],
    ...route.legs.map((leg, i) => [
      String(i + 1),
      leg.from ?? "",
      leg.system.name,
      leg.ly.toFixed(2),
      String(leg.score),
      String(leg.system.coords?.[0] ?? ""),
      String(leg.system.coords?.[1] ?? ""),
      String(leg.system.coords?.[2] ?? ""),
    ]),
  ];
  return rows.map((row) => row.map(quoteCsv).join(";")).join("\n");
}
