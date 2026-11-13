// Controls localization: language selection is display-only and covers every known action.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./i18n-setup.mjs";
import { actionName, englishActionName, parseBinds, setActionLanguage } from "../dist/js/features/controls/binds.js";
import { DEMO_BINDS } from "../dist/js/game/demo.js";

const meta = JSON.parse(readFileSync(new URL("../public/data/binds.json", import.meta.url), "utf8"));
const french = JSON.parse(readFileSync(new URL("../public/data/binds.fr.json", import.meta.url), "utf8"));

test("Controls: French and English names preserve stable action identifiers", () => {
  const original = parseBinds(DEMO_BINDS).binds;
  setActionLanguage("fr", french);
  assert.equal(actionName(meta, "LandingGearToggle"), "Train d'atterrissage");
  assert.equal(actionName(meta, "HumanoidReloadButton"), "Recharger");
  assert.equal(actionName(meta, "GalaxyMapOpen"), "Carte galactique");
  assert.equal(actionName(meta, "UnknownFutureControl"), englishActionName(meta, "UnknownFutureControl"));
  setActionLanguage("en", french);
  assert.equal(actionName(meta, "LandingGearToggle"), "Landing Gear");
  assert.deepEqual(parseBinds(DEMO_BINDS).binds, original);
});

test("Controls: every source action has a non-empty French display name", () => {
  const missing = Object.keys(meta.controls).filter((action) => !french[action]?.trim());
  assert.deepEqual(missing, []);
});
