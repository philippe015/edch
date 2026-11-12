import test from "node:test";
import assert from "node:assert/strict";
import { validMemoryScope, checkedMemoryAction } from "../dist/js/features/agent/memory.js";

test("memory scope needs a real commander and a faction", () => {
  assert.equal(validMemoryScope({ commander: "PHILOU", faction: "1ER ASTRA MILITARUM" }), true);
  assert.equal(validMemoryScope({ commander: "", faction: "1ER ASTRA MILITARUM" }), false);
  assert.equal(validMemoryScope({ commander: "PHILOU", faction: "" }), false);
  assert.equal(validMemoryScope({ commander: "\nBAD", faction: "Faction" }), false);
});
test("memory only accepts independently verified COG actions", () => {
  assert.equal(checkedMemoryAction({ type: "shell", text: "rm -rf /" }), null);
  assert.equal(checkedMemoryAction(null), null);
});
