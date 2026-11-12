import test from 'node:test';
import assert from 'node:assert/strict';
import { safeEvent, proposeAction, eventKey } from '../dist/js/features/agent/protocol.js';
import {
  observeJournal, analyzeObservation, verifyProposal, runMultiAgentPipeline, tallyAudit,
} from '../dist/js/features/agent/multiAgents.js';

const when = '2026-11-10T19:20:00Z';
const sample = (event, rest = {}) => ({ event, timestamp: when, ...rest });
const fsd = sample('FSDJump', { StarSystem: 'Sol' });
const observed = () => observeJournal(fsd);

test('v1.6.0: Observateur retire secrets et garde la preuve du journal', () => {
  const ob = observeJournal({ ...fsd, Password: 'SECRET', Script: 'exec' });
  assert.equal(ob.event.StarSystem, 'Sol');
  assert.equal('Password' in ob.event, false);
  assert.equal(ob.category, 'navigation');
  assert.equal(ob.key, eventKey(ob.event));
});
test('v1.6.0: l’observateur refuse événements inventés, dates invalides et mauvaises clés', () => {
  assert.equal(observeJournal(sample('ShellExec', { command: 'sh' })), null);
  assert.equal(observeJournal({ ...fsd, timestamp: 'not-a-date' }), null);
  assert.equal(observeJournal(fsd, 'FAUSSE-CLE'), null);
});
test('v1.6.0: Analyste + vérificateur reconnaissent visite réelle sans BGS fictive', () => {
  const proposal = analyzeObservation(observed());
  const audit = verifyProposal(proposal.observation, proposal.action);
  assert.equal(audit.reason, 'accepted');
  assert.equal(audit.action.type, 'bgs.visit');
  assert.equal(audit.action.text, 'Arrivée dans Sol');
  assert.equal('influence' in audit.action, false);
});
test('v1.6.0: la vérification refuse une visite inventée sur une mission', () => {
  const ob = observeJournal(sample('MissionCompleted', { MissionID: 123 }));
  const forged = { ...proposeAction(ob.event), type: 'bgs.visit', system: 'Sol', text: 'Arrivée dans Sol' };
  const audit = verifyProposal(ob, forged);
  assert.equal(audit.action, null);
  assert.equal(audit.reason, 'evidence-mismatch');
});
test('v1.6.0: refus de changement de système ou horodatage', () => {
  const ob = observed();
  const action = proposeAction(ob.event);
  assert.equal(verifyProposal(ob, { ...action, system: 'Lave' }).verified, false);
  assert.equal(verifyProposal(ob, { ...action, at: '2026-11-11T00:00:00Z' }).verified, false);
  assert.equal(verifyProposal(ob, { ...action, text: 'Arrivée dans Lave' }).verified, false);
});
test('v1.6.0: refus de script ou métadonnées additionnelles', () => {
  const ob = observed();
  const action = proposeAction(ob.event);
  assert.equal(verifyProposal(ob, { ...action, command: 'rm -rf /' }).verified, false);
  assert.equal(verifyProposal(ob, { ...action, url: 'https://evil.example' }).verified, false);
  assert.equal(verifyProposal(ob, { ...action, important: true }).verified, false);
});
test('v1.6.0: aucune visite si FSDJump sans StarSystem', () => {
  const audit = runMultiAgentPipeline(sample('FSDJump'));
  assert.equal(audit.reason, 'unsupported');
  assert.equal(audit.action, null);
});
test('v1.6.0: événements de mission et d’escadrille acceptés avec leur preuve', () => {
  for (const raw of [
    sample('MissionAccepted', { MissionID: 777, Faction: '1ER ASTRA MILITARUM' }),
    sample('MissionFailed', { MissionID: 888 }),
    sample('CargoDepot', { MissionID: 123, ItemsDelivered: 3, TotalItemsToDeliver: 10 }),
    sample('Docked', { StationName: 'Jameson Memorial', StarSystem: 'Shinrarta Dezhra' }),
    sample('WingJoin'), sample('WingLeave'),
  ]) assert.equal(runMultiAgentPipeline(raw).verified, true, raw.event);
});
test('v1.6.0: CargoDepot sans identifiant est ignoré sans inventer de mission', () => {
  const decision = runMultiAgentPipeline(sample('CargoDepot', { ItemsDelivered: 3 }));
  assert.equal(decision.reason, 'unsupported');
});
test('v1.6.0: statistiques séparées des trois agents et rejets vérifiés', () => {
  const ob = observed();
  const accepted = runMultiAgentPipeline(fsd);
  const rejected = verifyProposal(ob, { ...proposeAction(ob.event), important: true });
  const skipped = runMultiAgentPipeline(sample('FSDJump'));
  const tally = tallyAudit([accepted, rejected, skipped]);
  assert.deepEqual(tally, { observed: 3, proposed: 2, verified: 1, rejected: 1 });
});
test('v1.6.0: Worker conserve le protocole batch ACK et expose le diagnostic local', async () => {
  const received = [];
  globalThis.self = { onmessage: null, postMessage: (msg) => received.push(msg) };
  try {
    await import('../dist/js/features/agent/agentWorker.js');
    const ev = safeEvent(fsd), key = eventKey(ev);
    self.onmessage({ data: { type: 'batch', batchId: 77, items: [{ key, event: ev }] } });
    const result = received.find((msg) => msg.type === 'batch-result');
    assert.equal(result.batchId, 77);
    assert.deepEqual(result.audit, { observed: 1, proposed: 1, verified: 1, rejected: 0 });
    assert.equal(result.results[0].action.system, 'Sol');
    self.onmessage({ data: { type: 'ping' } });
    assert.deepEqual(received.at(-1), { type: 'pong' });
    self.onmessage({ data: { type: 'diagnostic' } });
    const diag = received.at(-1);
    assert.equal(diag.version, '1.6.0');
    assert.deepEqual(diag.agents, ['observateur', 'analyste', 'verificateur']);
  } finally {
    delete globalThis.self;
  }
});
