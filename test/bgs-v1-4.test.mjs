// EDCH-BGS-v1.4 - import cannot silently overwrite local game faction data.
import test from "node:test";
import assert from "node:assert/strict";
import { parseBgsBackup, MAX_BGS_IMPORT_BYTES } from "../dist/js/features/bgs/importSafety.js";

const when = "2026-11-08T09:20:00.000Z";
const base = () => ({
  faction: "1ER ASTRA MILITARUM",
  systems: [
    {
      name: "Sol",
      states: ["Boom"],
      source: "manual",
      retrievedAt: when,
      lastVisitedAt: when,
      anchor: true,
      note: "Contrôler",
    },
  ],
  history: [
    { key: "sol", system: "Sol", states: [], source: "Spansh", observedAt: when, receivedAt: when, influence: 42 },
  ],
});
test("BGS v1.4: valid backup is parsed without retaining unexpected fields", () => {
  const input = base();
  input.systems[0].extra = "ignored";
  const output = parseBgsBackup(JSON.stringify(input));
  assert.equal(output.systems[0].note, "Contrôler");
  assert.equal(output.history[0].influence, 42);
  assert.equal("extra" in output.systems[0], false);
  assert.notEqual(output.systems[0], input.systems[0]);
});
test("BGS v1.4: malformed/oversize/duplicate backups are rejected", () => {
  assert.throws(() => parseBgsBackup("{"), /JSON illisible/);
  assert.throws(() => parseBgsBackup("x".repeat(MAX_BGS_IMPORT_BYTES + 1)), /volumineux/);
  const input = base();
  input.systems.push({ ...input.systems[0] });
  assert.throws(() => parseBgsBackup(JSON.stringify(input)), /deux fois/);
});
test("BGS v1.4: reject invalid coordinates, influence and dates", () => {
  const input = base();
  input.systems[0].coords = [1, Infinity, 2];
  assert.throws(() => parseBgsBackup(JSON.stringify(input)), /coordonnées/); // Infinity serialized as null
  delete input.systems[0].coords;
  input.systems[0].influence = 150;
  assert.throws(() => parseBgsBackup(JSON.stringify(input)), /influence/);
  delete input.systems[0].influence;
  input.history[0].observedAt = "not a date";
  assert.throws(() => parseBgsBackup(JSON.stringify(input)), /date invalide/);
});
test("BGS v1.4: empty local notes are preserved without breaking import", () => {
  const input = base();
  input.systems[0].note = "";
  const output = parseBgsBackup(JSON.stringify(input));
  assert.equal(output.systems[0].note, "");
});
test("BGS v1.4: JSON prototype-like fields do not escape whitelist", () => {
  const data = JSON.stringify(base()).replace('{"faction":', '{"__proto__":{"polluted":true},"faction":');
  const result = parseBgsBackup(data);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(Object.hasOwn(result, "polluted"), false);
});
