import { test } from "node:test";
import assert from "node:assert/strict";
import {
  factionSystemStatus,
  factionSystemCounts,
  factionSystemRows,
  factionSystemsCsv,
} from "../dist/js/features/bgs/factionSystems.js";
const system = (name, controls, source = "Spansh") => ({
  name,
  controls,
  source,
  states: [],
  retrievedAt: "2026-11-08T00:00:00Z",
});
const fixtures = [
  system("Zeta", true),
  system("Bêta", false),
  system("Alpha", undefined, "manual"),
  system("Epsilon", undefined),
];
test("un système manuel n’est jamais confirmé contrôlé", () => {
  assert.equal(factionSystemStatus(system("Manual", true, "manual")), "unverified");
  assert.equal(factionSystemStatus(system("Spansh", true)), "controlled");
});
test("présence et contrôle ne sont pas confondus", () => {
  assert.deepEqual(factionSystemCounts(fixtures), { total: 4, controlled: 1, present: 2, unverified: 1 });
});
test("filtre de la catégorie", () => {
  assert.deepEqual(
    factionSystemRows(fixtures, "present").map((x) => x.name),
    ["Bêta", "Epsilon"],
  );
});
test("recherche insensible aux accents et tri alphabétique", () => {
  assert.deepEqual(
    factionSystemRows(fixtures, "all", "beta").map((x) => x.name),
    ["Bêta"],
  );
  assert.deepEqual(
    factionSystemRows(fixtures).map((x) => x.name),
    ["Alpha", "Bêta", "Epsilon", "Zeta"],
  );
});
test("export intégral et contre les formules CSV", () => {
  const rows = Array.from({ length: 120 }, (_, i) => system("S" + i, i % 2 === 0));
  rows[1].name = "=1+1";
  const csv = factionSystemsCsv("1ER ASTRA MILITARUM", rows);
  assert.equal(csv.split("\n").length, 121);
  assert.ok(csv.includes("'\u003d1+1"));
});
test("tableau vide valide", () => {
  assert.deepEqual(factionSystemCounts([]), { total: 0, controlled: 0, present: 0, unverified: 0 });
  assert.equal(factionSystemRows([]).length, 0);
});
