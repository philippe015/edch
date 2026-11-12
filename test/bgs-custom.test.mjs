import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchFactionPages,
  mergeSearch,
  defaultBgs,
  patrolScore,
  patrolCategory,
  changeAlerts,
  csvOf,
} from "../dist/js/features/bgs/core.js";
const make = (n, inf = 0.2) => ({
  name: `SYS-${n}`,
  id64: String(n + 1),
  updated_at: "2026-11-07T10:00:00Z",
  distance: n,
  controlling_minor_faction: "OTHER",
  minor_faction_presences: [{ name: "1ER ASTRA MILITARUM", influence: inf, state: "Boom" }],
});
test("BGS 125 entries over 3 pages, with no losses", async () => {
  const pages = [
    Array.from({ length: 50 }, (_, i) => make(i)),
    Array.from({ length: 50 }, (_, i) => make(i + 50)),
    Array.from({ length: 25 }, (_, i) => make(i + 100)),
  ];
  const result = await fetchFactionPages(
    "1ER ASTRA MILITARUM",
    { reference_system: "Sol" },
    async (_, body) => ({ count: 125, results: pages[body.page] }),
    { pageSize: 50 },
  );
  assert.equal(result.pages, 3);
  assert.equal(result.systems.length, 125);
  assert.equal(result.partial, false);
});
test("BGS detects pagination cap explicitly", async () => {
  const res = await fetchFactionPages(
    "1ER ASTRA MILITARUM",
    {},
    async () => ({ count: 900, results: Array.from({ length: 100 }, (_, i) => make(i)) }),
    { pageSize: 100, maxPages: 2 },
  );
  assert.equal(res.partial, true);
  assert.equal(res.systems.length, 100);
});
test("Repeated Spansh updatedAt does not invent a new observation", () => {
  let st = defaultBgs();
  const s = {
    name: "SYS",
    id64: "42",
    influence: 42,
    controls: false,
    states: ["Boom"],
    updatedAt: "2026-11-07T11:00:00Z",
    source: "Spansh",
    retrievedAt: "2026-11-07T12:00:00Z",
  };
  st = mergeSearch(st, { systems: [s], total: 1, partial: false, pages: 1 });
  st = mergeSearch(st, { systems: [s], total: 1, partial: false, pages: 1 });
  assert.equal(st.history.length, 1);
});
test("Partial retrieval preserves previously known systems", () => {
  let st = mergeSearch(defaultBgs(), {
    systems: [{ name: "KNOWN", states: [], source: "manual", retrievedAt: "2026-11-07T11:00:00Z" }],
    total: 1,
    partial: false,
    pages: 1,
  });
  st = mergeSearch(st, { systems: [], total: 99, partial: true, pages: 1 });
  assert.equal(st.systems.length, 1);
});
test("Patrol prioritization and warning rules", () => {
  const s = { name: "X", states: ["War"], anchor: true, source: "Spansh", retrievedAt: "2026-11-07T10:00:00Z" };
  assert.ok(patrolScore(s) > 80);
  assert.equal(patrolCategory(s), "unknown");
  const state = {
    ...defaultBgs(),
    systems: [{ ...s, id64: "99" }],
    history: [
      {
        key: "99",
        system: "X",
        observedAt: "2026-11-06T10:00:00Z",
        receivedAt: "2026-11-06T12:00:00Z",
        source: "Spansh",
        controls: true,
        states: [],
        influence: 50,
      },
      {
        key: "99",
        system: "X",
        observedAt: "2026-11-07T10:00:00Z",
        receivedAt: "2026-11-07T12:00:00Z",
        source: "Spansh",
        controls: false,
        states: [],
        influence: 43,
      },
    ],
  };
  const current = new Date();
  state.history[1].observedAt = current.toISOString();
  state.history[0].observedAt = new Date(current.getTime() - 86400000).toISOString();
  assert.equal(changeAlerts(state).length, 2);
  assert.ok(csvOf([{ ...s, note: 'a;"b"' }]).includes('"a;""b"""'));
});
