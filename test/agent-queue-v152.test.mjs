import test from "node:test";
import assert from "node:assert/strict";
import {
  MemoryAgentQueue, AGENT_QUEUE_LIMIT, AGENT_BATCH_LIMIT, AGENT_SEEN_LIMIT,
} from "../dist/js/features/agent/durableQueue.js";
import { eventKey, proposeAction, safeEvent, verifyAction } from "../dist/js/features/agent/protocol.js";

const ev = (i = 1, event = "FSDJump") => safeEvent({
  event,
  timestamp: new Date(Date.UTC(2026, 10, 9, 12, 0, i % 60)).toISOString(),
  StarSystem: `Système ${i}`,
  MissionID: i,
});

function results(rows) {
  return rows.map((row) => ({ key: row.key, action: proposeAction(row.event) }));
}

test("v1.5.2 : file bornée, FIFO et accès par lots de 32", async () => {
  const q = new MemoryAgentQueue();
  const all = Array.from({ length: 50 }, (_, i) => ev(i + 1));
  assert.deepEqual(await q.enqueue(all), { added: 50, duplicate: 0, overflow: 0 });
  assert.deepEqual((await q.take()).map((x) => x.key), all.slice(0, AGENT_BATCH_LIMIT).map(eventKey));
  assert.equal((await q.stats()).pending, 50);
});

test("v1.5.2 : les répétitions du journal sont écartées pendant et après traitement", async () => {
  const q = new MemoryAgentQueue();
  const e = ev(1);
  await q.enqueue([e, e]);
  assert.equal((await q.stats()).pending, 1);
  const batch = await q.take();
  await q.acknowledge(batch, results(batch));
  assert.deepEqual(await q.enqueue([e]), { added: 0, duplicate: 1, overflow: 0 });
  assert.equal((await q.stats()).seen, 1);
  assert.equal((await q.stats()).outbox, 1);
});

test("v1.5.2 : une fermeture avant ACK laisse l'événement en attente", async () => {
  const q = new MemoryAgentQueue();
  await q.enqueue([ev(2)]);
  const before = await q.take();
  // Worker failure: no ACK; a new worker can take the identical event.
  const after = await q.take();
  assert.deepEqual(after, before);
  assert.equal((await q.stats()).outbox, 0);
});

test("v1.5.2 : l'ACK est vérifié et un accusé mal ordonné ne vide rien", async () => {
  const q = new MemoryAgentQueue();
  await q.enqueue([ev(3), ev(4)]);
  const batch = await q.take();
  await assert.rejects(() => q.acknowledge(batch, results([...batch].reverse())), /invalide/);
  assert.equal((await q.stats()).pending, 2);
});

test("v1.5.2 : boîte de sortie locale, livraison et anti double-ACK", async () => {
  const q = new MemoryAgentQueue();
  await q.enqueue([ev(5)]);
  const rows = await q.take();
  await q.acknowledge(rows, results(rows));
  await q.acknowledge(rows, results(rows));
  const outbox = await q.takeOutbox();
  assert.equal(outbox.length, 1);
  assert.ok(verifyAction(outbox[0].action));
  assert.equal(outbox[0].action.system, "Système 5");
  await q.delivered([outbox[0].id]);
  assert.equal((await q.stats()).outbox, 0);
});

test("v1.5.2 : file pleine = refus explicite, sans écraser un événement antérieur", async () => {
  const q = new MemoryAgentQueue();
  // Reuse time while keeping unique systems.
  const all = Array.from({ length: AGENT_QUEUE_LIMIT + 2 }, (_, i) => ev(i + 1));
  const status = await q.enqueue(all);
  assert.equal(status.added, AGENT_QUEUE_LIMIT);
  assert.equal(status.overflow, 2);
  assert.equal((await q.take(1))[0].event.StarSystem, "Système 1");
});

test("v1.5.2 : mémoire des événements traités plafonnée", async () => {
  const q = new MemoryAgentQueue();
  for (let start = 1; start <= AGENT_SEEN_LIMIT + 60; start += 32) {
    const inputs = Array.from({ length: Math.min(32, AGENT_SEEN_LIMIT + 61 - start) }, (_, i) => ev(start + i));
    await q.enqueue(inputs);
    const batch = await q.take();
    await q.acknowledge(batch, results(batch));
    await q.delivered((await q.takeOutbox(32)).map((x) => x.id));
  }
  assert.equal((await q.stats()).pending, 0);
  assert.equal((await q.stats()).seen, AGENT_SEEN_LIMIT);
});

test("v1.5.2 : suppression explicite n'altère pas la mémoire des ACK", async () => {
  const q = new MemoryAgentQueue();
  await q.enqueue([ev(40)]);
  await q.acknowledge(await q.take(), results(await q.take()));
  await q.enqueue([ev(41), ev(42)]);
  assert.equal(await q.clearPending(), 2);
  assert.equal((await q.stats()).pending, 0);
  assert.equal((await q.stats()).seen, 1);
});

test("v1.5.2 : le Worker ne produit que des actions vérifiées, aucun appel système", async () => {
  const calls = [];
  const selfPrevious = globalThis.self;
  globalThis.self = { onmessage: null, postMessage: (response) => calls.push(response) };
  try {
    await import("../dist/js/features/agent/agentWorker.js");
    globalThis.self.onmessage({ data: { type: "ping" } });
    assert.deepEqual(calls.pop(), { type: "pong" });
    const input = ev(7);
    globalThis.self.onmessage({ data: { type: "batch", batchId: 1, items: [{ key: eventKey(input), event: input }] } });
    const reply = calls.pop();
    assert.equal(reply.type, "batch-result");
    assert.equal(reply.batchId, 1);
    assert.equal(reply.processed, 1);
    assert.equal(reply.results[0].action.type, "bgs.visit");
    assert.ok(verifyAction(reply.results[0].action));
    const previous = calls.length;
    globalThis.self.onmessage({ data: { type: "batch", batchId: 2, items: [{ key: "wrong-key", event: input }] } });
    assert.equal(calls.length, previous + 1);
    assert.deepEqual(calls.at(-1), { type: 'batch-error', batchId: 2, reason: 'invalid-event' });
  } finally {
    globalThis.self = selfPrevious;
  }
});
