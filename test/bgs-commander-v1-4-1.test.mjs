// EDCH-BGS-v1.4.1: per-commander journal filtering; no attribution of unknown influence.
import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyCommanderEvent,
  commanderSummary,
  recordCommanderEvents,
  commanderKey,
  readCommanderLog,
  setCommanderFaction,
  commanderCsv,
} from "../dist/js/features/bgs/commander.js";
const at = "2026-11-08T09:20:00Z";
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => mem.set(k, v),
  removeItem: (k) => mem.delete(k),
};
const mission = {
  event: "MissionCompleted",
  timestamp: at,
  Faction: "1ER ASTRA MILITARUM",
  Reward: 250000,
  MissionID: 1234,
};
test("Only explicit in-journal faction attribution; no invented influence", () => {
  const m = classifyCommanderEvent(mission);
  assert.equal(m.kind, "mission");
  assert.deepEqual(m.factions, ["1ER ASTRA MILITARUM"]);
  assert.equal(m.amount, 250000);
  assert.equal("influence" in m, false);
  const other = classifyCommanderEvent({ event: "MarketSell", timestamp: at, TotalSale: 5000 });
  assert.deepEqual(other.factions, []);
});
test("Per CMDR isolation, deduplication and saved faction", () => {
  assert.equal(recordCommanderEvents("PHILOU", [mission, mission]), 1);
  assert.equal(recordCommanderEvents("PHILOU", [mission]), 0);
  assert.equal(recordCommanderEvents("ANOTHER", [{ ...mission, MissionID: 3456 }]), 1);
  assert.equal(readCommanderLog("PHILOU").entries.length, 1);
  assert.equal(readCommanderLog("ANOTHER").entries.length, 1);
  assert.notEqual(commanderKey("PHILOU"), commanderKey("ANOTHER"));
  assert.equal(setCommanderFaction("PHILOU", "1ER ASTRA MILITARUM"), true);
  assert.equal(readCommanderLog("PHILOU").followedFaction, "1ER ASTRA MILITARUM");
});
test("No historical events or missing CMDR assumed live", () => {
  assert.equal(classifyCommanderEvent({ event: "FSDJump", StarSystem: "Sol", timestamp: "invalid" }), null);
  assert.equal(recordCommanderEvents("", [mission]), 0);
  assert.equal(readCommanderLog("").entries.length, 0);
});
test("Summary counts arrivals to tracked systems and linked missions separately", () => {
  recordCommanderEvents("PHILOU", [
    { event: "FSDJump", timestamp: at, StarSystem: "Sol" },
    { event: "FSDJump", timestamp: "2026-11-08T09:20:01Z", StarSystem: "Other" },
    { event: "Bounty", timestamp: "2026-11-08T09:20:02Z", TotalReward: 100 },
  ]);
  const s = commanderSummary(
    readCommanderLog("PHILOU"),
    "1ER ASTRA MILITARUM",
    ["Sol"],
    Date.parse("2026-11-08T10:00:00Z"),
  );
  assert.equal(s.jumps, 2);
  assert.equal(s.trackedJumps, 1);
  assert.equal(s.missionForFaction, 1);
  assert.equal(s.unattributed, 1);
});
test("CSV escapes spreadsheet formula prefixes", () => {
  const csv = commanderCsv({
    commander: "=malicious",
    entries: [{ at, kind: "jump", system: '=HYPERLINK(\"x\")', factions: [], key: "a" }],
  });
  assert.match(csv, /\"'=malicious\"/);
  assert.match(csv, /\"'=HYPERLINK/);
});
test("Invalid local data is rejected rather than mixed with another account", () => {
  mem.set(commanderKey("PHILOU"), JSON.stringify({ commander: "ANOTHER", entries: [mission] }));
  assert.equal(readCommanderLog("PHILOU").entries.length, 0);
});
