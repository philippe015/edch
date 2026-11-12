import test from "node:test";
import assert from "node:assert/strict";
import {
  appendConsoleEntry,
  consoleEntry,
  consoleSummary,
  CONSOLE_LIMIT,
} from "../dist/js/features/agent/consoleModel.js";

const action = (id, type = "bgs.visit") => ({
  type,
  at: "2026-11-09T20:00:00.000Z",
  event: type === "bgs.visit" ? "FSDJump" : "MissionAccepted",
  source: "journal",
  text: `Événement vérifié ${id}`,
  important: false,
  system: "TEST",
});

test("console: refuse une action externe ou commande système", () => {
  assert.equal(consoleEntry({ ...action(1), type: "shell.exec" }), null);
  assert.equal(consoleEntry({ ...action(1), source: "internet" }), null);
  assert.equal(consoleEntry({ ...action(1), text: "" }), null);
});

test("console: transforme uniquement les actions validées en lignes locales", () => {
  assert.deepEqual(consoleEntry(action(7)), {
    at: "2026-11-09T20:00:00.000Z",
    category: "bgs.visit",
    message: "Événement vérifié 7",
    source: "journal",
  });
});

test("console: conserve les événements récents dans une mémoire bornée", () => {
  let items = [];
  for (let n = 0; n < 200; n++) items = appendConsoleEntry(items, action(n));
  assert.equal(items.length, CONSOLE_LIMIT);
  assert.equal(items[0].message, "Événement vérifié 199");
  assert.equal(items.at(-1).message, "Événement vérifié 100");
});

test("console: les entrées invalides ne changent pas l'historique", () => {
  const items = appendConsoleEntry([], action(1));
  assert.deepEqual(appendConsoleEntry(items, { type: "arbitrary" }), items);
});

test("console: calcule des catégories à partir des actions réellement reconnues", () => {
  const items = [action(1), action(2), action(3, "mission.changed")].reduce(
    (state, event) => appendConsoleEntry(state, event),
    [],
  );
  assert.deepEqual({ ...consoleSummary(items) }, { "mission.changed": 1, "bgs.visit": 2 });
});

test("worker: le ping répond sans créer de visite fictive", async () => {
  const messages = [];
  const previous = globalThis.self;
  globalThis.self = {
    onmessage: null,
    postMessage: (message) => messages.push(message),
  };
  try {
    await import("../dist/js/features/agent/agentWorker.js");
    globalThis.self.onmessage({ data: { type: "ping" } });
    assert.deepEqual(messages, [{ type: "pong" }]);
  } finally {
    if (previous === undefined) delete globalThis.self;
    else globalThis.self = previous;
  }
});
