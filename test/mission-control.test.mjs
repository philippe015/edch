// The player remains in control: natural-language rules may suggest, never execute.
import test from "node:test";
import assert from "node:assert/strict";
import { pilotIntent, pilotReply } from "../dist/features/agent/missionControl.js";

const state = {
  faction: "1ER ASTRA MILITARUM",
  systems: [{ name: "Sol", controls: true }, { name: "Achenar", controls: false }],
  history: [],
  partial: true,
};
const route = {
  origin: "position",
  originName: "Sol",
  legs: [{ system: { name: "Achenar" }, from: "Sol", ly: 4, score: 9 }],
  totalLy: 4,
  maxLegLy: 15,
  excludedNoCoords: [],
  disconnected: [],
  isPartial: false,
};

test("pilot understands simple French commands without contacting an AI", () => {
  assert.equal(pilotIntent("Quelle est la prochaine cible ?"), "next");
  assert.equal(pilotIntent("Itinéraire de patrouille"), "route");
  assert.equal(pilotIntent("Statut de la faction"), "status");
  assert.equal(pilotIntent("active le pilote automatique"), "help");
});
test("pilot proposes an existing destination, not a game input", () => {
  assert.equal(pilotReply("prochaine cible", state, route).destination, "Achenar");
  assert.equal(pilotReply("statut", state, route).destination, undefined);
});
test("pilot rejects a missing start location and unsafe waypoint names", () => {
  assert.equal(pilotReply("next", state, { ...route, origin: "unknown" }).destination, undefined);
  const malicious = { ...route, legs: [{ ...route.legs[0], system: { name: "Achenar\nEXEC" } }] };
  assert.equal(pilotReply("next", state, malicious).destination, undefined);
});
test("empty routes never invent a jump", () => {
  const answer = pilotReply("next", state, { ...route, legs: [] });
  assert.equal(answer.destination, undefined);
  assert.match(answer.message, /Aucune étape/);
});
