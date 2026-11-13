// Massacre missions: kills counted from bounties and from combat bonds (conflict massacre
// missions), one mission at a time per issuing faction, and the game's "done" always wins.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyActivityEvents } from "../dist/js/game/activity/index.js";
import { emptyActivity } from "../dist/js/game/activity/state.js";

const ISSUER = "Amicale des Compagnons de l'Espace";
const TARGET = "Dukes of Thadoraton";
const at = (second) => new Date(Date.UTC(2026, 10, 11, 20, 0, second)).toISOString().replace(".000", "");
const accept = (second, id, killCount, issuer = ISSUER, target = TARGET) => ({
  timestamp: at(second),
  event: "MissionAccepted",
  MissionID: id,
  Name: "Mission_Massacre_Conflict_CivilWar",
  Faction: issuer,
  TargetFaction: target,
  KillCount: killCount,
});
const bond = (second) => ({
  timestamp: at(second),
  event: "FactionKillBond",
  Reward: 70217,
  AwardingFaction: ISSUER,
  VictimFaction: TARGET,
});

test("conflict massacre: combat bonds count, one mission at a time per issuer", () => {
  const st = emptyActivity();
  applyActivityEvents(st, [
    accept(1, 1, 3),
    accept(2, 2, 5),
    accept(3, 3, 4, TARGET, ISSUER), // the other side's mission: its kills are the other faction
    ...[10, 11, 12, 13].map(bond),
  ]);
  assert.equal(st.missions[1].kills, 3, "the oldest mission first");
  assert.equal(st.missions[2].kills, 1, "then the next one, at once");
  assert.equal(st.missions[3].kills, 0);
});

test("conflict massacre: the game's redirect completes a mission the journal undercounted (wing kills)", () => {
  const st = emptyActivity();
  applyActivityEvents(st, [
    accept(1, 1, 15),
    accept(2, 2, 42),
    ...[10, 11].map(bond),
    // Wingmates' kills aren't in this journal: the game says mission 1 is done after 2 own bonds.
    { timestamp: at(20), event: "MissionRedirected", MissionID: 1, Name: "Mission_Massacre_Conflict_CivilWar" },
    ...[30, 31, 32].map(bond),
  ]);
  assert.equal(st.missions[1].kills, 15);
  assert.equal(st.missions[1].status, "redirected");
  assert.equal(st.missions[2].kills, 3, "the next kills go to the next mission");
});

test("pirate massacre: bounties still count", () => {
  const st = emptyActivity();
  applyActivityEvents(st, [
    accept(1, 1, 2, ISSUER, "Pirates"),
    { timestamp: at(5), event: "Bounty", VictimFaction: "Pirates", TotalReward: 1000 },
  ]);
  assert.equal(st.missions[1].kills, 1);
});
