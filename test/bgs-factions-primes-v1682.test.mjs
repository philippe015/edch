// EDCH v1.6.8.2: strict payee attribution and non-destructive replay enrichment.
import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyCommanderEvent,
  commanderKey,
  commanderSummary,
  journalAwardingFactions,
  readCommanderLog,
  recordCommanderEvents,
  resetCommanderJournalContext,
} from "../dist/js/features/bgs/commander.js";

const mem = new Map();
globalThis.localStorage = {
  getItem: (key) => mem.get(key) ?? null,
  setItem: (key, value) => mem.set(key, value),
  removeItem: (key) => mem.delete(key),
};
const time = "2026-11-11T17:22:29Z";
const kill = { event: "FactionKillBond", timestamp: time, Reward: 22872,
  AwardingFaction: "Astra Militarum", VictimFaction: "Rival Faction" };

test("FactionKillBond reads AwardingFaction but never the enemy faction", () => {
  const result = classifyCommanderEvent(kill);
  assert.equal(result.kind, "kill-bond");
  assert.deepEqual(result.factions, ["Astra Militarum"]);
  assert.equal(result.amount, 22872);
  assert.equal(result.factions.includes("Rival Faction"), false);
});

test("payee enrichment does not change the persisted deduplication key", () => {
  const before = classifyCommanderEvent({event:kill.event,timestamp:time,Reward:kill.Reward});
  const after = classifyCommanderEvent(kill);
  assert.equal(before.key, after.key);
});

test("Bounty extracts each explicitly paying Rewards faction only", () => {
  const e = {event:"Bounty",timestamp:time,TotalReward:4000,
    Rewards:[{Faction:"Alpha",Reward:3000},{Faction:"Beta",Reward:1000}],
    VictimFaction:"Gamma"};
  assert.deepEqual(classifyCommanderEvent(e).factions, ["Alpha","Beta"]);
  assert.equal(classifyCommanderEvent(e).factions.includes("Gamma"), false);
});

test("single faction skimmer bounty is not duplicated", () => {
  const e = {event:"Bounty",timestamp:time,Reward:1000,Faction:"Alpha",Target:"Skimmer",
    Rewards:[{Faction:"Alpha",Reward:1000}]};
  assert.deepEqual(classifyCommanderEvent(e).factions, ["Alpha"]);
});

test("unknown or attacker/victim names do not invent a paying faction", () => {
  assert.deepEqual(journalAwardingFactions({event:"FactionKillBond",VictimFaction:"Enemy"}), []);
  assert.deepEqual(journalAwardingFactions({event:"Bounty",Rewards:[{},null,{Faction:""},{Faction:"Valid"}]}), ["Valid"]);
  assert.deepEqual(journalAwardingFactions({event:"MissionCompleted",AwardingFaction:"Wrong"}), []);
});

test("matching old 13-event history is enriched on replay but no activity is added", () => {
  mem.clear();
  resetCommanderJournalContext();
  const cm = "CMDR_TEST_FACTION";
  const legacy = classifyCommanderEvent({...kill, AwardingFaction:undefined});
  legacy.system = "Capricorni Sector DL-Y c15";
  legacy.factions = [];
  mem.set(commanderKey(cm), JSON.stringify({commander:cm,entries:[legacy]}));
  const count = recordCommanderEvents(cm,[
    {event:"Location", timestamp:"2026-11-11T17:00:00Z", StarSystem:"Capricorni Sector DL-Y c15"},
    kill,
    {event:"FactionKillBond",timestamp:"2026-11-11T17:23:00Z",Reward:12345,AwardingFaction:"Astra Militarum"}
  ], true);
  assert.equal(count,1);
  const profile = readCommanderLog(cm);
  assert.equal(profile.entries.length,1);
  assert.deepEqual(profile.entries[0].factions,["Astra Militarum"]);
  assert.equal(profile.entries[0].system,"Capricorni Sector DL-Y c15");
  assert.equal(profile.entries[0].amount,22872);
  assert.equal(profile.entries[0].key,legacy.key);
  assert.equal(recordCommanderEvents(cm,[kill],true),0);
  const summary=commanderSummary(profile,"Astra Militarum",[],Date.parse("2026-11-11T18:00:00Z"));
  assert.equal(summary.linkedEvents,1);
  assert.equal(summary.unattributed,0);
});

test("replay never changes the value of an existing faction or adds a historical event", () => {
  mem.clear();
  resetCommanderJournalContext();
  const cm="CMDR_TEST_PRESERVE";
  const previous=classifyCommanderEvent({event:"FactionKillBond",timestamp:time,Reward:22872});
  previous.factions=["Recorded Faction"];
  mem.set(commanderKey(cm),JSON.stringify({commander:cm,entries:[previous]}));
  recordCommanderEvents(cm,[kill],true);
  const entries=readCommanderLog(cm).entries;
  assert.equal(entries.length,1);
  assert.deepEqual(entries[0].factions,["Recorded Faction","Astra Militarum"]);
  assert.equal(entries[0].amount,22872);
});

test("no BGS influence is inferred from attributed combat events", () => {
  const e=classifyCommanderEvent(kill);
  assert.equal(Object.hasOwn(e,"influence"),false);
});
