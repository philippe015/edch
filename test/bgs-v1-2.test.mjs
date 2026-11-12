// EDCH-BGS-v1.2
import test from "node:test";
import assert from "node:assert/strict";
import { planPatrolRoute, distanceLy, routeCsv } from "../dist/js/features/bgs/routes.js";
import { trendOf, trendAlerts, sparklinePath, trendCsv, trendsSummary } from "../dist/js/features/bgs/trends.js";
import { fromSpansh, mergeSearch, defaultBgs } from "../dist/js/features/bgs/core.js";

const iso = "2026-11-07T08:00:00Z";
const system = (name, coords, extra = {}) => ({
  name,
  coords,
  states: [],
  source: "Spansh",
  retrievedAt: iso,
  ...extra,
});
test("Routes: no hops above 15 LY, disconnected and unknown positions are reported", () => {
  const list = [system("A", [10, 0, 0]), system("B", [24, 0, 0]), system("C", [50, 0, 0]), system("D", undefined)];
  const route = planPatrolRoute(list, { name: "Origin", coords: [0, 0, 0] }, { maxLegLy: 15, maxStops: 10 });
  assert.deepEqual(
    route.legs.map((x) => x.system.name),
    ["A", "B"],
  );
  assert.ok(route.legs.every((x) => x.ly <= 15));
  assert.equal(route.totalLy, 24);
  assert.deepEqual(route.disconnected, ["C"]);
  assert.deepEqual(route.excludedNoCoords, ["D"]);
  assert.equal(route.isPartial, true);
  assert.match(routeCsv(route), /"A"/);
});
test("Routes: without live player coordinates, use a known anchor", () => {
  const route = planPatrolRoute([system("Anchor", [5, 0, 0], { anchor: true }), system("B", [11, 0, 0])]);
  assert.equal(route.origin, "anchor");
  assert.equal(route.originName, "Anchor");
  assert.deepEqual(
    route.legs.map((x) => x.system.name),
    ["B"],
  );
  assert.equal(route.totalLy, 6);
  assert.equal(planPatrolRoute([system("No Coord")]).origin, "unknown");
});
test("Routes: bounded stops and valid distances, no fabricated navigation", () => {
  assert.equal(distanceLy([1, 2, 3], [4, 6, 3]), 5);
  const route = planPatrolRoute(
    [system("A", [1, 0, 0]), system("B", [2, 0, 0])],
    { name: "Home", coords: [0, 0, 0] },
    { maxStops: 1 },
  );
  assert.equal(route.legs.length, 1);
  assert.equal(route.isPartial, true);
});
test("Trends: dedupe identical observed timestamps; compute only real deltas", () => {
  const s = system("Sol", [0, 0, 0], { id64: "100" });
  const state = {
    faction: "TEST",
    systems: [s],
    history: [
      {
        key: "sol",
        system: "Sol",
        source: "Spansh",
        observedAt: "2026-11-05T10:00:00Z",
        receivedAt: "2026-11-05T10:01:00Z",
        influence: 61,
        states: [],
        controls: true,
      },
      {
        key: "100",
        system: "Sol",
        source: "Spansh",
        observedAt: "2026-11-06T10:00:00Z",
        receivedAt: "2026-11-06T10:01:00Z",
        influence: 56,
        states: [],
        controls: false,
      },
      {
        key: "100",
        system: "Sol",
        source: "Spansh",
        observedAt: "2026-11-06T10:00:00Z",
        receivedAt: "2026-11-06T10:05:00Z",
        influence: 55,
        states: [],
        controls: false,
      },
    ],
  };
  const trend = trendOf(state, s);
  assert.equal(trend.samples.length, 2);
  assert.equal(trend.delta, -6);
  assert.equal(trend.controlChanged, true);
  assert.equal(trendAlerts(state, Date.parse("2026-11-07T09:00:00Z")).length, 2);
  assert.equal(trendsSummary(state).falling, 1);
  assert.match(trendCsv(state), /"-6.00"/);
  assert.match(sparklinePath(trend.samples), /^M/);
});
test("Trends: no false comparison on single observation", () => {
  const s = system("One", [0, 0, 0]);
  const state = {
    faction: "TEST",
    systems: [s],
    history: [
      { key: "one", system: "One", source: "Spansh", observedAt: iso, receivedAt: iso, influence: 40, states: [] },
    ],
  };
  assert.equal(trendOf(state, s).delta, undefined);
  assert.equal(trendsSummary(state).unavailable, 1);
  assert.equal(sparklinePath(trendOf(state, s).samples), "");
});
test("Spansh decoding: array, object, x/y/z coordinate variants", () => {
  for (const raw of [{ coords: [1, 2, 3] }, { coords: { x: 1, y: 2, z: 3 } }, { x: 1, y: 2, z: 3 }]) {
    const out = fromSpansh({ name: "A", minor_faction_presences: [{ name: "F", influence: 0.3 }], ...raw }, "F", iso);
    assert.deepEqual(out?.coords, [1, 2, 3]);
  }
});
test("Search refresh: preserve previous coordinates when fresh remote row omits them", () => {
  const state = defaultBgs();
  state.systems = [system("Home", [1, 2, 3], { id64: "100", note: "hello" })];
  const result = mergeSearch(state, {
    systems: [system("Home", undefined, { id64: "100" })],
    total: 1,
    pages: 1,
    partial: false,
  });
  assert.deepEqual(result.systems[0].coords, [1, 2, 3]);
  assert.equal(result.systems[0].note, "hello");
});
