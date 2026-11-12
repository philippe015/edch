import test from "node:test";
import assert from "node:assert/strict";
import { manualWingCopies, wingScope } from "../dist/js/features/missions/wingManual.js";

const now = Date.parse("2026-11-08T17:00:00.000Z");
const mission = {
  id: 55301,
  name: "Mission_Delivery_Wing",
  title: "Livraison",
  faction: "Faction",
  status: "active",
  expiry: "2026-11-09T20:00:00.000Z",
};
const mk = (id = 55301, code = "ABCD1234") => ({ id, code, at: "2026-11-08T16:59:00.000Z" });

test("code scoping and confirmation, transparent manual flag", () => {
  assert.equal(wingScope("abcd-1234"), "ABCD1234");
  assert.deepEqual(manualWingCopies([mk()], "abcd-1234", [mission], [], now), [{ ...mission, manualConfirmed: true }]);
  assert.deepEqual(manualWingCopies([mk()], "other-code", [mission], [], now), []);
});
test("no phantom missions, no echo of another manual copy", () => {
  assert.deepEqual(manualWingCopies([mk()], "ABCD1234", [], [], now), []);
  assert.deepEqual(manualWingCopies([mk()], "ABCD1234", [{ ...mission, manualConfirmed: true }], [], now), []);
});
test("no duplicate of a journal mission; expired missions excluded", () => {
  assert.deepEqual(manualWingCopies([mk()], "ABCD1234", [mission], [mission], now), []);
  assert.deepEqual(manualWingCopies([mk()], "ABCD1234", [{ ...mission, expiry: "2026-11-07T00:00:00Z" }], [], now), []);
});
test("corrupt receipts ignored and duplicate ids deduplicated", () => {
  assert.equal(
    manualWingCopies(
      [null, mk(-1), mk(), mk(), { id: 42, code: "ABCD1234", at: "garbage" }],
      "ABCD1234",
      [mission],
      [],
      now,
    ).length,
    1,
  );
});
test("maximum 20 published missions respected", () => {
  const missions = Array.from({ length: 40 }, (_, i) => ({ ...mission, id: 100 + i }));
  const receipts = missions.map((m) => mk(m.id));
  assert.equal(manualWingCopies(receipts, "ABCD1234", missions, [], now).length, 20);
  assert.equal(manualWingCopies(receipts, "ABCD1234", missions, [mission], now).length, 19);
});
