/** EDCH-COG-DURABLE-v1.5.2
 * Bounded, asynchronous journal-action queue. IndexedDB is the durable local store;
 * if storage is unavailable, the agent degrades explicitly to volatile memory.
 * Never touches Elite Dangerous journals, .binds, SQLite, network or the OS shell.
 */
import { eventKey, type AgentAction, type AgentEvent } from "./protocol.js";

export const AGENT_QUEUE_LIMIT = 4096;
export const AGENT_SEEN_LIMIT = 4096;
export const AGENT_BATCH_LIMIT = 32;

export interface PendingAgentEvent {
  key: string;
  event: AgentEvent;
  addedAt: number;
}
export interface AgentQueueResult {
  key: string;
  action: AgentAction | null;
}
export interface PendingAgentAction {
  id: number;
  action: AgentAction;
}
export interface AgentEnqueueStats {
  added: number;
  duplicate: number;
  overflow: number;
}
export interface AgentQueueStats {
  pending: number;
  outbox: number;
  seen: number;
}
export interface AgentQueue {
  readonly mode: "indexeddb" | "volatile";
  enqueue(events: readonly AgentEvent[]): Promise<AgentEnqueueStats>;
  take(limit?: number): Promise<PendingAgentEvent[]>;
  acknowledge(rows: readonly PendingAgentEvent[], results: readonly AgentQueueResult[]): Promise<void>;
  takeOutbox(limit?: number): Promise<PendingAgentAction[]>;
  delivered(ids: readonly number[]): Promise<void>;
  stats(): Promise<AgentQueueStats>;
  clearPending(): Promise<number>;
}

/** Volatile backend also serves as a deterministic test double for the durable protocol. */
export class MemoryAgentQueue implements AgentQueue {
  readonly mode = "volatile" as const;
  private pending = new Map<string, PendingAgentEvent>();
  private done = new Map<string, number>();
  private outbox = new Map<number, AgentAction>();
  private outboxSeq = 1;

  async enqueue(events: readonly AgentEvent[]): Promise<AgentEnqueueStats> {
    const counts = { added: 0, duplicate: 0, overflow: 0 };
    for (const ev of events) {
      const key = eventKey(ev);
      if (this.pending.has(key) || this.done.has(key)) {
        counts.duplicate++;
      } else if (this.pending.size >= AGENT_QUEUE_LIMIT) {
        counts.overflow++;
      } else {
        this.pending.set(key, { key, event: ev, addedAt: Date.now() });
        counts.added++;
      }
    }
    return counts;
  }
  async take(limit = AGENT_BATCH_LIMIT): Promise<PendingAgentEvent[]> {
    return [...this.pending.values()].slice(0, Math.max(0, Math.min(AGENT_BATCH_LIMIT, limit)));
  }
  async acknowledge(rows: readonly PendingAgentEvent[], results: readonly AgentQueueResult[]): Promise<void> {
    if (rows.length !== results.length || rows.some((row, i) => row.key !== results[i]?.key)) {
      throw new Error("Accusé de traitement invalide");
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!this.pending.delete(row.key)) continue;
      this.done.set(row.key, Date.now());
      const action = results[i].action;
      if (action) this.outbox.set(this.outboxSeq++, action);
    }
    while (this.done.size > AGENT_SEEN_LIMIT) this.done.delete(this.done.keys().next().value!);
  }
  async takeOutbox(limit = AGENT_BATCH_LIMIT): Promise<PendingAgentAction[]> {
    return [...this.outbox.entries()]
      .slice(0, Math.max(0, Math.min(AGENT_BATCH_LIMIT, limit)))
      .map(([id, action]) => ({ id, action }));
  }
  async delivered(ids: readonly number[]): Promise<void> {
    for (const id of ids) this.outbox.delete(id);
  }
  async stats(): Promise<AgentQueueStats> {
    return { pending: this.pending.size, outbox: this.outbox.size, seen: this.done.size };
  }
  async clearPending(): Promise<number> {
    const size = this.pending.size;
    this.pending.clear();
    return size;
  }
}

interface DoneRow {
  key: string;
  finishedAt: number;
}
interface OutboxRow {
  id?: number;
  action: AgentAction;
}
const DB_NAME = "edch-bgs-agent-queue-v152";

/** Await a request without using synchronous storage in the journal callback. */
function requestValue<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function completed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
  });
}

async function openAgentDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB indisponible");
  return await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      const queue = db.createObjectStore("queue", { keyPath: "seq", autoIncrement: true });
      queue.createIndex("key", "key", { unique: true });
      const done = db.createObjectStore("done", { keyPath: "key" });
      done.createIndex("finishedAt", "finishedAt");
      db.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Ouverture IndexedDB impossible"));
    req.onblocked = () => reject(new Error("IndexedDB bloquée par une autre instance"));
  });
}

export class IndexedAgentQueue implements AgentQueue {
  readonly mode = "indexeddb" as const;
  constructor(private readonly db: IDBDatabase) {}

  async enqueue(events: readonly AgentEvent[]): Promise<AgentEnqueueStats> {
    if (!events.length) return { added: 0, duplicate: 0, overflow: 0 };
    const tx = this.db.transaction(["queue", "done"], "readwrite");
    const finished = completed(tx);
    const queue = tx.objectStore("queue");
    const done = tx.objectStore("done");
    const result = { added: 0, duplicate: 0, overflow: 0 };
    // Chain IDB callbacks inside the same transaction. No network/await between requests.
    const count = queue.count();
    count.onsuccess = () => {
      let free = Math.max(0, AGENT_QUEUE_LIMIT - count.result);
      const insert = (index: number) => {
        if (index >= events.length) return;
        const ev = events[index];
        const key = eventKey(ev);
        const alreadyDone = done.getKey(key);
        alreadyDone.onsuccess = () => {
          if (alreadyDone.result !== undefined) {
            result.duplicate++;
            insert(index + 1);
            return;
          }
          const alreadyPending = queue.index("key").getKey(key);
          alreadyPending.onsuccess = () => {
            if (alreadyPending.result !== undefined) {
              result.duplicate++;
            } else if (!free) {
              result.overflow++;
            } else {
              queue.add({ key, event: ev, addedAt: Date.now() } satisfies PendingAgentEvent);
              result.added++;
              free--;
            }
            insert(index + 1);
          };
        };
      };
      insert(0);
    };
    await finished;
    return result;
  }

  async take(limit = AGENT_BATCH_LIMIT): Promise<PendingAgentEvent[]> {
    const tx = this.db.transaction("queue", "readonly");
    const finished = completed(tx);
    const found: PendingAgentEvent[] = [];
    const cursor = tx.objectStore("queue").openCursor();
    const cap = Math.max(0, Math.min(AGENT_BATCH_LIMIT, limit));
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c && found.length < cap) {
        found.push(c.value as PendingAgentEvent);
        c.continue();
      }
    };
    await finished;
    return found;
  }

  async acknowledge(rows: readonly PendingAgentEvent[], results: readonly AgentQueueResult[]): Promise<void> {
    if (rows.length !== results.length || rows.some((row, i) => row.key !== results[i]?.key)) {
      throw new Error("Accusé de traitement invalide");
    }
    const tx = this.db.transaction(["queue", "done", "outbox"], "readwrite");
    const finished = completed(tx);
    const queue = tx.objectStore("queue");
    const done = tx.objectStore("done");
    const outbox = tx.objectStore("outbox");
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result = results[i];
      const found = queue.index("key").getKey(row.key);
      found.onsuccess = () => {
        if (found.result === undefined) return; // late repeated result: never redeliver
        queue.delete(found.result);
        done.put({ key: row.key, finishedAt: Date.now() } satisfies DoneRow);
        if (result.action) outbox.add({ action: result.action } satisfies OutboxRow);
      };
    }
    const count = done.count();
    count.onsuccess = () => {
      const excess = Math.max(0, count.result + rows.length - AGENT_SEEN_LIMIT);
      if (!excess) return;
      let removed = 0;
      const oldest = done.index("finishedAt").openCursor();
      oldest.onsuccess = () => {
        const c = oldest.result;
        if (c && removed < excess) {
          c.delete();
          removed++;
          c.continue();
        }
      };
    };
    await finished;
  }

  async takeOutbox(limit = AGENT_BATCH_LIMIT): Promise<PendingAgentAction[]> {
    const tx = this.db.transaction("outbox", "readonly");
    const finished = completed(tx);
    const found: PendingAgentAction[] = [];
    const cap = Math.max(0, Math.min(AGENT_BATCH_LIMIT, limit));
    const cursor = tx.objectStore("outbox").openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c && found.length < cap) {
        const row = c.value as OutboxRow;
        found.push({ id: Number(row.id), action: row.action });
        c.continue();
      }
    };
    await finished;
    return found;
  }

  async delivered(ids: readonly number[]): Promise<void> {
    const tx = this.db.transaction("outbox", "readwrite");
    const finished = completed(tx);
    const store = tx.objectStore("outbox");
    for (const id of ids) store.delete(id);
    await finished;
  }

  async stats(): Promise<AgentQueueStats> {
    const tx = this.db.transaction(["queue", "done", "outbox"], "readonly");
    const finished = completed(tx);
    const [pending, seen, outbox] = await Promise.all([
      requestValue(tx.objectStore("queue").count()),
      requestValue(tx.objectStore("done").count()),
      requestValue(tx.objectStore("outbox").count()),
    ]);
    await finished;
    return { pending, seen, outbox };
  }

  async clearPending(): Promise<number> {
    const tx = this.db.transaction("queue", "readwrite");
    const finished = completed(tx);
    const store = tx.objectStore("queue");
    const count = await requestValue(store.count());
    store.clear();
    await finished;
    return count;
  }
}

/** Fallback is EXPLICITLY volatile and reported as such to the user. */
export async function createAgentQueue(): Promise<AgentQueue> {
  try {
    return new IndexedAgentQueue(await openAgentDb());
  } catch {
    return new MemoryAgentQueue();
  }
}
