import test from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
const fakeWindow = new EventTarget();
fakeWindow.setTimeout = (cb, ms) => setTimeout(cb, Math.min(5, ms));
fakeWindow.clearTimeout = (id) => clearTimeout(id);
globalThis.window = fakeWindow;
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => { storage.set(key, String(value)); },
};
class FakeWorker {
  static instances = [];
  onmessage = null;
  onerror = null;
  terminated = false;
  constructor() { FakeWorker.instances.push(this); }
  terminate() { this.terminated = true; }
  postMessage(msg) {
    if (msg.type === 'diagnostic' && !this.terminated) this.onmessage?.({ data: {
      type: 'capabilities', version: '1.6.0', agents: ['observateur', 'analyste', 'verificateur'],
    } });
  }
}
globalThis.Worker = FakeWorker;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('v1.6.1 : état Worker invalidé à l’arrêt, redémarrage et messages tardifs ignorés', async () => {
  const rt = await import('../dist/js/features/agent/runtime.js');
  assert.equal(rt.setAgentEnabled(true), true);
  assert.equal(rt.agentWorkerHealth().phase, 'starting');
  const oldWorker = FakeWorker.instances.at(-1);
  assert.equal(rt.requestMultiAgentDiagnostic(), true);
  assert.equal(rt.agentWorkerHealth().phase, 'ready');
  rt.setAgentEnabled(false);
  assert.equal(rt.agentWorkerHealth().phase, 'stopped');
  oldWorker.onmessage?.({ data: { type: 'capabilities', version: '1.6.0', agents: ['observateur','analyste','verificateur'] } });
  assert.equal(rt.agentWorkerHealth().phase, 'stopped');
  rt.setAgentEnabled(true);
  assert.equal(rt.agentWorkerHealth().phase, 'starting');
  assert.equal(rt.requestMultiAgentDiagnostic(), true);
  assert.equal(rt.agentWorkerHealth().phase, 'ready');
  rt.setAgentEnabled(false);
});

test('v1.6.1 : échecs répétitifs suspendus après cinq essais, sans vider la file', async () => {
  const rt = await import('../dist/js/features/agent/runtime.js');
  rt.setAgentEnabled(true);
  for (let i = 1; i <= 5; i++) {
    const w = FakeWorker.instances.at(-1);
    w.onerror?.({ message: 'erreur de test' });
    assert.equal(rt.agentWorkerHealth().phase, i < 5 ? 'retry' : 'paused');
    if (i < 5) {
      await pause(30);
      assert.equal(rt.agentWorkerHealth().phase, 'starting');
    }
  }
  const length = FakeWorker.instances.length;
  await pause(30);
  assert.equal(FakeWorker.instances.length, length, 'pas de boucle de redémarrages infinie');
  assert.equal(rt.agentQueueHealth().pending, 0);
  assert.match(rt.agentDiagnosticSummary(), /Reprise|Worker : paused/);
  rt.retryAgentQueue();
  assert.equal(rt.agentWorkerHealth().phase, 'starting', 'relance manuelle permise');
  rt.setAgentEnabled(false);
});
