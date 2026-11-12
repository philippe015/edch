import test from 'node:test';
import assert from 'node:assert/strict';
import { eventKey, proposeAction } from '../dist/js/features/agent/protocol.js';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const local = new Map();
const fakeWindow = new EventTarget();
fakeWindow.setTimeout = setTimeout;
fakeWindow.clearTimeout = clearTimeout;
globalThis.window = fakeWindow;
globalThis.localStorage = { getItem: k => local.get(k) ?? null, setItem: (k, v) => { local.set(k, String(v)); } };
let failNextBatch = true;
class FakeWorker {
  onmessage = null;
  onerror = null;
  onmessageerror = null;
  terminated = false;
  constructor() { FakeWorker.spawned++; }
  static spawned = 0;
  terminate() { this.terminated = true; }
  postMessage(msg) {
    if (this.terminated) return;
    if (msg.type === 'ping') {
      queueMicrotask(() => { if (!this.terminated) this.onmessage?.({ data: { type: 'pong' } }); });
    }
    if (msg.type !== 'batch') return;
    if (failNextBatch) {
      failNextBatch = false;
      queueMicrotask(() => { if (!this.terminated) this.onerror?.({ message: 'injected test failure' }); });
      return;
    }
    const reply = {
      type: 'batch-result', batchId: msg.batchId,
      results: msg.items.map(item => ({ key: item.key, action: proposeAction(item.event) })),
      processed: msg.items.length, ignored: 0,
    };
    assert.equal(msg.items[0].key, eventKey(msg.items[0].event));
    queueMicrotask(() => { if (!this.terminated) this.onmessage?.({ data: reply }); });
  }
}
globalThis.Worker = FakeWorker;

test('v1.5.2 runtime : erreur Worker puis reprise sans perdre un lot', async () => {
  const rt = await import('../dist/js/features/agent/runtime.js');
  const actions = [];
  fakeWindow.addEventListener('edch-agent-action', event => actions.push(event.detail));
  assert.equal(rt.setAgentEnabled(true), true);
  rt.enqueueAgentEvents([{ event: 'FSDJump', timestamp: '2026-11-09T16:10:00Z', StarSystem: 'RUNTIME-TEST' }]);
  for (let n = 0; n < 80 && actions.length === 0; n++) await pause(20);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].system, 'RUNTIME-TEST');
  assert.equal(rt.agentQueueHealth().processed, 1);
  assert.ok(FakeWorker.spawned >= 2, 'worker redémarré automatiquement');
  assert.equal(rt.requestAgentPing(), true);
  await pause(30);
  assert.equal(rt.agentQueueHealth().mode, 'volatile');
  rt.setAgentEnabled(false);
});
