import test from 'node:test';
import assert from 'node:assert/strict';
import { eventKey, safeEvent } from '../dist/js/features/agent/protocol.js';

const mk = () => safeEvent({ event: 'FSDJump', timestamp: '2026-11-10T18:00:00Z', StarSystem: 'Sol' });

test('v1.6.1 : lot invalide refusé immédiatement et entièrement', async () => {
  const received = [];
  const original = globalThis.self;
  globalThis.self = { onmessage: null, postMessage: (message) => received.push(message) };
  try {
    await import('../dist/js/features/agent/agentWorker.js');
    const send = (msg) => globalThis.self.onmessage({ data: msg });
    send({ type: 'batch', batchId: 1, items: [] });
    assert.deepEqual(received.pop(), { type: 'batch-error', batchId: 1, reason: 'invalid-size' });
    send({ type: 'batch', batchId: 2, items: Array.from({ length: 33 }, () => ({ key: 'x', event: mk() })) });
    assert.deepEqual(received.pop(), { type: 'batch-error', batchId: 2, reason: 'invalid-size' });
    const ev = mk();
    send({ type: 'batch', batchId: 3, items: [{ key: eventKey(ev), event: ev }, { key: 'wrong', event: ev }] });
    assert.deepEqual(received.pop(), { type: 'batch-error', batchId: 3, reason: 'invalid-event' });
    assert.equal(received.length, 0, 'aucune réponse de succès partiel');
    send({ type: 'batch', batchId: 4, items: [{ key: eventKey(ev), event: ev }] });
    assert.equal(received.pop().type, 'batch-result', 'traitement normal conservé');
  } finally { globalThis.self = original; }
});
