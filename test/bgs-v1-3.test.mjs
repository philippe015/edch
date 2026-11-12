// EDCH-BGS-v1.3 — unit tests without network or game hardware.
import test from "node:test";
import assert from "node:assert/strict";
import { quoteCsv } from "../dist/js/features/bgs/csv.js";
import { csvOf, fromSpansh, defaultBgs } from "../dist/js/features/bgs/core.js";
import { trendCsv } from "../dist/js/features/bgs/trends.js";
import { routeCsv, planPatrolRoute } from "../dist/js/features/bgs/routes.js";
import { bindingsCsv, repeatedAssignments } from "../dist/js/features/controls/report.js";

const ISO = "2026-11-08T10:00:00Z";
const metadata = {
  controls: { One: { n: "Fire 1", g: "Ship" }, Two: { n: "Fire 2", g: "Ship" }, Three: { n: "Camera", g: "Camera" } },
  keymap: { Joy_1: "Bouton 1" },
};
const binding = (action, options = {}) => ({
  action,
  slot: "primary",
  device: "SaitekX52Pro",
  key: "Joy_1",
  modifiers: [],
  ...options,
});

test("Spansh: owner string, object and unknown are distinguished", () => {
  const row = { name: "Sol", minor_faction_presences: [{ name: "1ER ASTRA MILITARUM", influence: 0.43 }] };
  const read = (extra) => fromSpansh({ ...row, ...extra }, "1ER ASTRA MILITARUM", ISO);
  assert.equal(read({ controlling_minor_faction: "1ER ASTRA MILITARUM" })?.controls, true);
  assert.equal(read({ controlling_minor_faction: { name: "1ER ASTRA MILITARUM" } })?.controls, true);
  assert.equal(read({ controlling_minor_faction: "Other Faction" })?.controls, false);
  assert.equal(read({})?.controls, undefined);
  assert.equal(read({})?.influence, 43);
});
test("Spansh influence fraction or percentage, bounded", () => {
  const mk = (value) =>
    fromSpansh({ name: "One", minor_faction_presences: [{ name: "Faction", influence: value }] }, "Faction", ISO);
  assert.equal(mk(0.42)?.influence, 42);
  assert.equal(mk(42)?.influence, 42);
  assert.equal(mk(102)?.influence, undefined);
  assert.equal(mk(-3)?.influence, undefined);
});
test("Spreadsheet CSV escapes formula-like input and preserves numeric deltas", () => {
  assert.equal(quoteCsv("=1+1"), '"\'=1+1"');
  assert.equal(quoteCsv(" +SUM(1,2)"), '"\' +SUM(1,2)"');
  assert.equal(quoteCsv("-5.30"), '"-5.30"');
  assert.equal(quoteCsv("A;B"), '"A;B"');
  const state = defaultBgs();
  state.systems = [{ name: "=LINK", states: [], source: "manual", note: "@evil", retrievedAt: ISO }];
  assert.match(csvOf(state.systems), /"'=LINK"/);
  assert.match(csvOf(state.systems), /"'@evil"/);
  assert.match(trendCsv(state), /"'=LINK"/);
  const route = planPatrolRoute([{ ...state.systems[0], coords: [1, 0, 0] }], { name: "Sol", coords: [0, 0, 0] });
  assert.match(routeCsv(route), /"'=LINK"/);
});
test("HOTAS CSV outputs displayed language and original English", () => {
  const items = [binding("One")];
  const csv = bindingsCsv(metadata, items, (_m, a) => (a === "One" ? "Tir principal" : a));
  assert.match(csv, /"Tir principal"/);
  assert.match(csv, /"Fire 1"/);
  assert.match(csv, /"Joy_1"/);
  assert.deepEqual(items, [binding("One")]);
});
test("Shared buttons are review hints within one game group only", () => {
  const items = [
    binding("One"),
    binding("Two"),
    binding("Three"),
    binding("One"),
    binding("Two", { modifiers: [{ device: "Keyboard", key: "Key_LeftShift" }] }),
  ];
  const issues = repeatedAssignments(metadata, items);
  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].actions, ["One", "Two"]);
  assert.equal(issues[0].group, "Ship");
});
