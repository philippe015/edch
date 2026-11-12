import test from "node:test";
import assert from "node:assert/strict";
import { decodeTick, readLiveVisit, withVisits } from "../dist/js/features/bgs/utils.js";
import { defaultBgs, mergeSearch } from "../dist/js/features/bgs/core.js";

test("Journal: only live FSDJump can represent an arrival", () => {
  const right = { event: "FSDJump", StarSystem: " Sol ", timestamp: "2026-11-07T18:31:01Z" };
  assert.deepEqual(readLiveVisit(right), { system: "Sol", at: "2026-11-07T18:31:01.000Z" });
  assert.equal(readLiveVisit({ ...right, event: "Location" }), null);
  assert.equal(readLiveVisit({ ...right, event: "Docked" }), null);
  assert.equal(readLiveVisit({ ...right, StarSystem: "" }), null);
  assert.equal(readLiveVisit({ ...right, timestamp: "garbage" }), null);
});
test("SQLite recorded visits merge without erasing newer manual visits", () => {
  const state = {
    faction: "1ER ASTRA MILITARUM",
    systems: [
      {
        name: "Sol",
        states: [],
        source: "manual",
        retrievedAt: "2026-11-07T00:00:00Z",
        lastVisitedAt: "2026-11-07T18:00:00.000Z",
      },
      { name: "Achenar", states: [], source: "manual", retrievedAt: "2026-11-07T00:00:00Z" },
    ],
    history: [],
  };
  const merged = withVisits(state, [
    { system: "sol", at: "2026-11-07T17:00:00.000Z" },
    { system: "ACHENAR", at: "2026-11-07T15:00:00.000Z" },
    { system: "Achenar", at: "2026-11-07T19:00:00.000Z" },
  ]);
  assert.equal(merged.systems[0].lastVisitedAt, "2026-11-07T18:00:00.000Z");
  assert.equal(merged.systems[1].lastVisitedAt, "2026-11-07T19:00:00.000Z");
  assert.equal(state.systems[1].lastVisitedAt, undefined, "pure: no mutation");
});
test("EDCD tick parses valid JSON and rejects malformed data", () => {
  assert.equal(decodeTick('"2026-11-06T18:14:31+00:00"'), "2026-11-06T18:14:31.000Z");
  assert.throws(() => decodeTick('{"date":"foo"}'));
  assert.throws(() => decodeTick('"not a date"'));
});

test("A full Spansh refresh preserves local manual systems and annotations", () => {
  const state = defaultBgs();
  state.systems = [
    {
      name: "LOCAL PATROL",
      source: "manual",
      states: [],
      retrievedAt: "2026-11-07T00:00:00Z",
      anchor: true,
      note: "Keep me",
    },
    { name: "KNOWN SYSTEM", source: "manual", states: [], retrievedAt: "2026-11-07T00:00:00Z", note: "Local note" },
  ];
  const result = mergeSearch(state, {
    systems: [
      {
        name: "KNOWN SYSTEM",
        id64: "721",
        source: "Spansh",
        states: [],
        retrievedAt: "2026-11-07T10:00:00Z",
        controls: true,
      },
    ],
    total: 1,
    pages: 1,
    partial: false,
  });
  assert.equal(result.systems.length, 2);
  assert.equal(result.systems.find((x) => x.name === "LOCAL PATROL").note, "Keep me");
  assert.equal(result.systems.find((x) => x.name === "KNOWN SYSTEM").note, "Local note");
});
