/** EDCH-COG-DURABLE-v1.5.2: isolated, bounded, deterministic worker.
 * One acknowledged batch at a time. No database, shell, web or game input access.
 */
import { eventKey, safeEvent, type AgentAction, type AgentEvent } from "./protocol.js";
import { runMultiAgentPipeline, tallyAudit, type BatchAuditStats } from "./multiAgents.js"; // EDCH-COG-MULTI-v1.6.0

interface WorkerRow {
  key: string;
  event: AgentEvent;
}
type Inbound =
  | { type: "batch"; batchId: number; items: WorkerRow[] }
  | { type: "ping" }
  | { type: "diagnostic" }
  | { type: "events"; events: AgentEvent[] }
  | { type: "reset" };
type Outbound =
  | { type: "batch-error"; batchId: number; reason: "invalid-size" | "invalid-event" }
  | {
      type: "batch-result";
      batchId: number;
      results: { key: string; action: AgentAction | null }[];
      processed: number;
      ignored: number;
      audit: BatchAuditStats;
    }
  | { type: "pong" }
  | { type: "capabilities"; agents: string[]; version: "1.6.0" }
  | { type: "actions"; actions: AgentAction[]; processed: number; dropped: number };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Inbound>) => void) | null;
  postMessage: (message: Outbound) => void;
};
const MAX_BATCH = 32;
// Legacy v1.5.0 compatibility for EDCH's existing regression suite and older assets.
// The v1.5.2 runtime uses ONLY the acknowledged "batch" protocol above.
const legacySeen = new Set<string>();
let legacyProcessed = 0;
let legacyDropped = 0;

scope.onmessage = (message) => {
  const data = message.data;
  if (data?.type === "ping") {
    scope.postMessage({ type: "pong" });
    return;
  }
  if (data?.type === "diagnostic") {
    scope.postMessage({ type: "capabilities", agents: ["observateur", "analyste", "verificateur"], version: "1.6.0" });
    return;
  }
  if (data?.type === "reset") {
    legacySeen.clear();
    legacyProcessed = 0;
    legacyDropped = 0;
    return;
  }
  if (data?.type === "events" && Array.isArray(data.events)) {
    const actions: AgentAction[] = [];
    legacyDropped += Math.max(0, data.events.length - 2048);
    for (const raw of data.events.slice(0, 2048)) {
      const ev = safeEvent(raw);
      if (!ev) continue;
      const key = eventKey(ev);
      if (legacySeen.has(key)) continue;
      legacySeen.add(key);
      if (legacySeen.size > 2048) legacySeen.delete(legacySeen.values().next().value!);
      legacyProcessed++;
      const decision = runMultiAgentPipeline(ev, key);
      if (decision.action && actions.length < MAX_BATCH) actions.push(decision.action);
    }
    scope.postMessage({ type: "actions", actions, processed: legacyProcessed, dropped: legacyDropped });
    return;
  }
  if (data?.type !== "batch" || !Number.isSafeInteger(data.batchId) || data.batchId <= 0) return;
  if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > MAX_BATCH) {
    scope.postMessage({ type: "batch-error", batchId: data.batchId, reason: "invalid-size" });
    return;
  }
  const results: { key: string; action: AgentAction | null }[] = [];
  let ignored = 0;
  const audits = [];
  for (const row of data.items) {
    const ev = safeEvent(row?.event);
    if (!ev || typeof row.key !== "string" || row.key !== eventKey(ev)) {
      scope.postMessage({ type: "batch-error", batchId: data.batchId, reason: "invalid-event" });
      return; // A bad batch is never partially acknowledged or dispatched.
    }
    const decision = runMultiAgentPipeline(ev, row.key);
    audits.push(decision);
    if (!decision.action) ignored++;
    results.push({ key: row.key, action: decision.action });
  }
  scope.postMessage({
    type: "batch-result",
    batchId: data.batchId,
    results,
    processed: results.length,
    ignored,
    audit: tallyAudit(audits),
  });
};
