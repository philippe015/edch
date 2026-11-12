import test from 'node:test';
import assert from 'node:assert/strict';
import {
  safeEvent, proposeAction, verifyAction, eventKey
} from '../dist/js/features/agent/protocol.js';

const t = '2026-11-09T17:00:00Z';
test('safeEvent accepts only allowlisted journal events, without leaking raw fields', () => {
  const clean = safeEvent({ timestamp: t, event: 'FSDJump', StarSystem: 'Sol', Password: 'secret' });
  assert.equal(clean.StarSystem, 'Sol');
  assert.equal('Password' in clean, false);
  assert.equal(safeEvent({ timestamp:t, event:'RunShell', script:'rm -rf /' }), null);
  assert.equal(safeEvent({ timestamp:'bad', event:'FSDJump', StarSystem:'Sol' }), null);
});
test('worker planner recognises safe BGS events and translates them to French', () => {
  const action = proposeAction(safeEvent({ timestamp:t, event:'FSDJump', StarSystem:'Sol' }));
  assert.equal(action.type, 'bgs.visit');
  assert.match(action.text,/Arrivée dans Sol/);
  assert.equal(action.important, false);
  assert.equal(verifyAction(action), true);
});
test('mission actions do not fabricate BGS influence or missing mission IDs', () => {
  const action = proposeAction(safeEvent({ timestamp:t, event:'MissionCompleted', MissionID:42,Faction:'Faction A' }));
  assert.equal(action.type, 'mission.changed');
  assert.equal(action.missionId, 42);
  assert.equal('influence' in action, false);
  const missing = proposeAction(safeEvent({timestamp:t,event:'CargoDepot'}));
  assert.equal(missing,null);
});
test('independent verifier refuses shell, arbitrary URL, and unknown actions', () => {
  assert.equal(verifyAction({ type:'system.exec', source:'journal', text:'evil',at:t,event:'FSDJump',important:true }),false);
  assert.equal(verifyAction({ type:'bgs.visit', source:'journal', text:'',at:t,event:'FSDJump',important:false }),false);
  assert.equal(verifyAction({ type:'bgs.visit', source:'journal', text:'ok',at:t,event:'FSDJump',important:false }),true);
});
test('a repeated event has a stable deduplication key', () => {
  const a = safeEvent({timestamp:t,event:'CargoDepot',MissionID:17,ItemsDelivered:20});
  assert.equal(eventKey(a),eventKey({...a}));
  assert.notEqual(eventKey(a),eventKey({...a,ItemsDelivered:30}));
});

test('worker runs in its own event context, deduplicates, and reports actions', async () => {
  const received = [];
  globalThis.self = { onmessage: null, postMessage: (m) => received.push(m) };
  await import('../dist/js/features/agent/agentWorker.js');
  const ev = safeEvent({ timestamp:t, event:'FSDJump', StarSystem:'Sol'});
  globalThis.self.onmessage({data:{type:'events',events:[ev,ev]}});
  await new Promise((resolve) => setTimeout(resolve,25));
  const actions = received.flatMap((r) => r.actions);
  assert.equal(actions.length,1);
  assert.equal(actions[0].system,'Sol');
  assert.equal(received.at(-1).processed,1);
  delete globalThis.self;
});
