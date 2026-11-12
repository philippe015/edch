import test from "node:test";
import assert from "node:assert/strict";
import {
  addCombatZone, readCombatZones, deleteCombatZone, combatZoneKey,
  combatZoneSummary, combatZoneCsv,
} from "../dist/js/features/bgs/combatZones.js";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    map,
  };
}

const input = {
  at: "2026-11-12T15:00:00Z", id: "CZ-A1",
  faction: "1ER ASTRA MILITARUM", system: "Sol",
  kind: "ship", grade: "high", outcome: "win", count: 3,
};

test("manual CZ entries are kept per commander and never inferred from bonds", () => {
  const storage = memoryStorage();
  addCombatZone("PHILOU", input, storage);
  assert.equal(readCombatZones("PHILOU", storage).records.length, 1);
  assert.equal(readCombatZones("OTHER", storage).records.length, 0);
  assert.equal(readCombatZones("PHILOU", storage).records[0].count, 3);
  assert.notEqual(combatZoneKey("PHILOU"), combatZoneKey("OTHER"));
});

test("CZ totals are distinct from journal event counts and scoped by faction", () => {
  const storage = memoryStorage();
  addCombatZone("PHILOU", input, storage);
  addCombatZone("PHILOU", {
    ...input, id: "CZ-A2", kind: "on-foot", outcome: "loss", grade: "low",
    faction: "Amicale des Compagnons de l'Espace", count: 1,
  }, storage);
  const history = readCombatZones("PHILOU", storage);
  assert.deepEqual(combatZoneSummary(history.records, input.faction, Date.parse("2026-11-12T15:05:00Z")), {
    total: 4, faction: 3, wins: 3, losses: 1, ship: 3, onFoot: 1, last30: 4,
  });
  assert.equal(combatZoneSummary(history.records, input.faction, Date.parse("2027-01-01T00:00:00Z")).last30, 0);
});

test("bad data never silently replaces the original CZ history", () => {
  const storage = memoryStorage();
  const key = combatZoneKey("PHILOU");
  storage.setItem(key, "{bad json");
  assert.match(readCombatZones("PHILOU", storage).error, /SyntaxError|JSON|Unexpected|Expected/);
  assert.throws(() => addCombatZone("PHILOU", input, storage));
  assert.equal(storage.getItem(key), "{bad json");
});

test("reject invalid user input and duplicate identifiers", () => {
  const storage = memoryStorage();
  assert.throws(() => addCombatZone("PHILOU", { ...input, count: 0 }, storage));
  assert.throws(() => addCombatZone("PHILOU", { ...input, count: 51 }, storage));
  assert.throws(() => addCombatZone("PHILOU", { ...input, outcome: "invented" }, storage));
  assert.throws(() => addCombatZone("PHILOU", { ...input, system: "Sol\nscript" }, storage));
  addCombatZone("PHILOU", input, storage);
  assert.throws(() => addCombatZone("PHILOU", input, storage));
});

test("delete one saved group, preserving the rest", () => {
  const storage = memoryStorage();
  addCombatZone("PHILOU", input, storage);
  addCombatZone("PHILOU", { ...input, id: "CZ-A2", count: 2 }, storage);
  assert.equal(deleteCombatZone("PHILOU", "CZ-A1", storage), true);
  assert.equal(readCombatZones("PHILOU", storage).records.length, 1);
  assert.equal(readCombatZones("PHILOU", storage).records[0].id, "CZ-A2");
  assert.equal(deleteCombatZone("PHILOU", "missing", storage), false);
});

test("CSV defuses leading spreadsheet formula characters", () => {
  const row = { ...input, faction: "=HYPERLINK(1)", system: "+COMMAND" };
  const csv = combatZoneCsv("-PHILOU", [{ ...row, source: "manual" }]);
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /"'\+COMMAND/);
  assert.match(csv, /"'-PHILOU"/);
});
