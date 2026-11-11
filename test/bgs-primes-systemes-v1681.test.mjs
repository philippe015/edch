import test from 'node:test';
import assert from 'node:assert/strict';
import { JournalSystemTracker } from '../dist/js/features/bgs/journalSystem.js';
import { classifyCommanderEvent, recordCommanderEvents, resetCommanderJournalContext, readCommanderLog, commanderKey } from '../dist/js/features/bgs/commander.js';
const mem = new Map();
globalThis.localStorage = {
  getItem: k => mem.get(k) ?? null,
  setItem: (k,v) => mem.set(k,v),
  removeItem: k => mem.delete(k),
};
const ev = (event,timestamp,extra={}) => ({event,timestamp,...extra});
const t = '2026-11-11T15:00:00Z';
const t1 = '2026-11-11T15:01:00Z';
const t2 = '2026-11-11T15:02:00Z';

test('Bounty and FactionKillBond inherit only an observed earlier system', () => {
  const tr = new JournalSystemTracker();
  assert.equal(tr.consume(ev('Bounty', t, {TotalReward:100}), 'Alpha').system, undefined);
  assert.equal(tr.consume(ev('Location',t,{StarSystem:'Sol'}), 'Alpha').system,'Sol');
  const a=tr.consume(ev('Bounty',t1,{TotalReward:250}), 'Alpha');
  assert.equal(a.system,'Sol'); assert.equal(a.source,'context');
  assert.equal(tr.consume(ev('FSDJump',t2,{StarSystem:'Achenar'}), 'Alpha').system,'Achenar');
  assert.equal(tr.consume(ev('FactionKillBond','2026-11-11T15:03:00Z',{Reward:500}), 'Alpha').system,'Achenar');
});

test('RedeemVoucher gets redemption system, never alleged combat origin', () => {
  const tr=new JournalSystemTracker();
  tr.consume(ev('Location',t,{StarSystem:'Combat Zone'}),'Alpha');
  tr.consume(ev('FSDJump',t1,{StarSystem:'Station System'}),'Alpha');
  const d=tr.consume(ev('RedeemVoucher',t2,{Amount:1500}),'Alpha');
  assert.deepEqual({system:d.system,source:d.source},{system:'Station System',source:'context'});
});

test('No guessing after logout, session switch, jump start, or 24 hours', () => {
  const tr=new JournalSystemTracker();
  tr.consume(ev('Location',t,{StarSystem:'Sol'}),'Alpha');
  tr.consume(ev('StartJump',t1,{JumpType:'Hyperspace'}),'Alpha');
  assert.equal(tr.consume(ev('Bounty',t2),'Alpha').system,undefined);
  tr.consume(ev('Location',t,{StarSystem:'Sol'}),'Alpha');
  tr.consume(ev('Shutdown',t1),'Alpha');
  assert.equal(tr.consume(ev('Bounty',t2),'Alpha').system,undefined);
  tr.consume(ev('Location',t,{StarSystem:'Sol'}),'Alpha');
  assert.equal(tr.consume(ev('Bounty','2026-11-13T16:00:00Z'),'Alpha').system,undefined);
  tr.consume(ev('LoadGame',t2,{Commander:'Beta'}),'Alpha');
  assert.equal(tr.consume(ev('Location',t2,{StarSystem:'Different'}),'Alpha').accepted,false);
});

test('No future system assigned to an earlier event or a different commander', () => {
  const tr=new JournalSystemTracker();
  tr.consume(ev('Location',t2,{StarSystem:'Future'}),'Alpha');
  assert.equal(tr.consume(ev('Bounty',t),'Alpha').system,undefined);
  assert.equal(tr.consume(ev('Bounty',t2),'Beta').system,undefined);
});

test('Replay repairs only known saved entries, without adding replayed events', () => {
  resetCommanderJournalContext();
  mem.clear();
  const voucher=ev('RedeemVoucher',t2,{Amount:1500});
  const bond=ev('FactionKillBond',t1,{Reward:500});
  assert.equal(recordCommanderEvents('Alpha',[voucher,bond]),2);
  const before=readCommanderLog('Alpha');
  assert.deepEqual(before.entries.map(x=>x.system),[undefined,undefined]);
  const count=recordCommanderEvents('Alpha',[
    ev('LoadGame','2026-11-11T14:59:59Z',{Commander:'Alpha'}),
    ev('Location',t,{StarSystem:'Sol'}), bond, voucher,
    ev('Bounty','2026-11-11T15:03:00Z',{TotalReward:123})
  ],true);
  assert.equal(count,2);
  const after=readCommanderLog('Alpha');
  assert.equal(after.entries.length,2);
  assert.deepEqual(after.entries.map(x=>x.system),['Sol','Sol']);
  assert.deepEqual(after.entries.map(x=>x.systemSource),['context','context']);
  assert.deepEqual(after.entries.map(x=>x.key),before.entries.map(x=>x.key));
  assert.equal(recordCommanderEvents('Alpha', [bond,voucher],true),0);
});

test('New live entries keep the system evidenced in the same ordered journal batch', () => {
  resetCommanderJournalContext();
  mem.clear();
  assert.equal(recordCommanderEvents('Alpha',[
    ev('LoadGame','2026-11-11T14:59:59Z',{Commander:'Alpha'}),
    ev('Location',t,{StarSystem:'Sol'}),
    ev('Bounty',t1,{TotalReward:100}),
    ev('FSDJump',t2,{StarSystem:'Achenar'}),
    ev('RedeemVoucher','2026-11-11T15:03:00Z',{Amount:300}),
  ]),3);
  const rows=readCommanderLog('Alpha').entries;
  assert.equal(rows.find(x=>x.kind==='bounty').system,'Sol');
  assert.equal(rows.find(x=>x.kind==='voucher').system,'Achenar');
  assert.equal(rows.find(x=>x.kind==='voucher').systemSource,'context');
  assert.equal(classifyCommanderEvent(ev('Bounty',t1,{TotalReward:100})).system,undefined);
});

test('Log is isolated by identity even when a saved key exists', () => {
  assert.notEqual(commanderKey('Alpha'),commanderKey('Beta'));
  resetCommanderJournalContext();
  mem.clear();
  assert.equal(recordCommanderEvents('Alpha',[ev('LoadGame',t,{Commander:'Beta'}),ev('Bounty',t1,{TotalReward:90})]),0);
  assert.equal(readCommanderLog('Alpha').entries.length,0);
});
