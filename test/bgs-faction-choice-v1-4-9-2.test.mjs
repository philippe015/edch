// EDCH-BGS-FACTION-SWITCH-v1.4.9.2
import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanFactionName,
  validFactionSnapshot,
  rememberedFactions,
  sameFactionName,
} from "../dist/js/features/bgs/factionChoice.js";

const snapshot = (faction) => ({ faction, systems: [], history: [] });
function storage(values) {
  const keys = Object.keys(values);
  return {
    length: keys.length,
    key: (n) => keys[n] ?? null,
    getItem: (key) => values[key] ?? null,
  };
}

test("faction choice: normalise les noms sans toucher à leur casse affichée", () => {
  assert.equal(cleanFactionName("  1ER ASTRA MILITARUM  "), "1ER ASTRA MILITARUM");
  assert.equal(cleanFactionName("\n"), null);
  assert.equal(cleanFactionName("A\u0000B"), null);
  assert.equal(cleanFactionName("a".repeat(161)), null);
  assert.ok(sameFactionName(" Faction alpha ", "faction ALPHA"));
});

test("faction choice: ne mélange pas les snapshots de factions différentes", () => {
  assert.ok(validFactionSnapshot(snapshot("Faction A"), "FACTION A"));
  assert.ok(!validFactionSnapshot(snapshot("Faction A"), "Faction B"));
  assert.ok(!validFactionSnapshot({ faction: "Faction A", systems: [] }, "Faction A"));
});

test("faction choice: choix historisés et sélection actuelle, sans noms inventés", () => {
  const prefix = "edch.bgs.custom.v1.faction.";
  const known = storage({
    [prefix + encodeURIComponent("faction a")]: JSON.stringify(snapshot("Faction A")),
    [prefix + encodeURIComponent("faction b")]: JSON.stringify(snapshot("Faction B")),
    [prefix + encodeURIComponent("faction c")]: JSON.stringify(snapshot("Faction D")),
  });
  assert.deepEqual(rememberedFactions(known, "Faction A", "Faction C"), ["Faction A", "Faction B", "Faction C"]);
  assert.deepEqual(rememberedFactions(storage({}), "Faction X"), ["Faction X"]);
  const corrupt = storage({
    [prefix + "%invalid"]: "not json",
    [prefix + encodeURIComponent("faction a")]: JSON.stringify(snapshot("Faction A")),
  });
  assert.deepEqual(rememberedFactions(corrupt, "Faction X"), ["Faction A", "Faction X"]);
});
