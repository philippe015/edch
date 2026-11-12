/** EDCH-COG-MULTI-v1.6.0 — deterministic, offline, three-stage verification.
 * No LLM, network, filesystem, keyboard, game input or arbitrary execution.
 * Only existing journal types are eligible; invalid evidence is rejected closed.
 */
import { eventKey, proposeAction, safeEvent, verifyAction, type AgentAction, type AgentEvent, type AgentActionType } from "./protocol.js";

export interface Observation {
  readonly key: string;
  readonly event: AgentEvent;
  readonly category: "navigation" | "mission" | "escadrille";
}
export interface Proposal {
  readonly observation: Observation;
  readonly action: AgentAction | null;
}
export type AuditReason = "accepted" | "invalid-event" | "unsupported" | "invalid-action" | "evidence-mismatch";
export interface AuditResult {
  readonly action: AgentAction | null;
  readonly reason: AuditReason;
  readonly observed: boolean;
  readonly proposed: boolean;
  readonly verified: boolean;
}
export interface BatchAuditStats {
  observed: number;
  proposed: number;
  verified: number;
  rejected: number;
}

/** Stage 1 — Observateur: accepts only redacted journal fields. */
export function observeJournal(raw: unknown, key?: string): Observation | null {
  const event = safeEvent(raw);
  if (!event) return null;
  const computed = eventKey(event);
  if (key !== undefined && key !== computed) return null;
  const category = event.event === "FSDJump" || event.event === "Docked"
    ? "navigation" : event.event === "WingJoin" || event.event === "WingLeave"
      ? "escadrille" : "mission";
  return { key: computed, event, category };
}

/** Stage 2 — Analyste: only deterministic proposals from the existing protocol. */
export function analyzeObservation(observation: Observation): Proposal {
  return { observation, action: proposeAction(observation.event) };
}

/** Stage 3 — Vérificateur: reconstructs the permitted *evidence-to-action* mapping
 * independently of proposeAction; rejects fabricated visits, timestamps, extra fields,
 * speculative influence, scripts, URLs and shell commands.
 */
function expectedFromEvidence(ev: AgentEvent): { type: AgentActionType; text: string; system?: string; missionId?: number; important: boolean } | null {
  const system = ev.StarSystem?.trim() || undefined;
  const missionId = ev.MissionID;
  switch (ev.event) {
    case "FSDJump":
      return system ? { type: "bgs.visit", system, text: `Arrivée dans ${system}`, important: false } : null;
    case "Docked":
      return { type: "station.arrived", system,
        text: `Amarrage : ${ev.StationName || "station inconnue"}${system ? ` · ${system}` : ""}`, important: false };
    case "MissionAccepted":
    case "MissionCompleted":
    case "MissionFailed":
    case "MissionAbandoned": {
      const statuses: Record<string, string> = {
        MissionAccepted: "acceptée", MissionCompleted: "terminée", MissionFailed: "échouée", MissionAbandoned: "abandonnée",
      };
      const faction = ev.Faction ? ` · ${ev.Faction.slice(0, 90)}` : "";
      return { type: "mission.changed", missionId,
        text: `Mission ${statuses[ev.event]}${missionId ? ` (#${missionId})` : ""}${faction}`,
        important: ev.event === "MissionFailed" };
    }
    case "CargoDepot":
      return missionId ? { type: "mission.progress", missionId,
        text: `Livraison escadrille #${missionId} : ${ev.ItemsDelivered ?? "?"} / ${ev.TotalItemsToDeliver ?? "?"}`,
        important: false } : null;
    case "WingJoin": return { type: "wing.changed", text: "Escadrille rejointe", important: false };
    case "WingLeave": return { type: "wing.changed", text: "Escadrille quittée", important: true };
    default: return null;
  }
}

const KEYS = new Set(["type", "text", "at", "event", "system", "missionId", "important", "source"]);
export function verifyProposal(observation: Observation, candidate: unknown): AuditResult {
  const ev = safeEvent(observation?.event);
  if (!ev || eventKey(ev) !== observation?.key) {
    return { action: null, reason: "invalid-event", observed: false, proposed: candidate != null, verified: false };
  }
  if (candidate === null) {
    return { action: null, reason: "unsupported", observed: true, proposed: false, verified: false };
  }
  if (!verifyAction(candidate)) {
    return { action: null, reason: "invalid-action", observed: true, proposed: true, verified: false };
  }
  const action = candidate as AgentAction;
  const keys = Object.keys(action);
  const expected = expectedFromEvidence(ev);
  if (!expected || keys.some((key) => !KEYS.has(key)) ||
      action.event !== ev.event || action.at !== ev.timestamp || action.source !== "journal" ||
      action.type !== expected.type || action.text !== expected.text ||
      action.important !== expected.important || action.system !== expected.system ||
      action.missionId !== expected.missionId) {
    return { action: null, reason: "evidence-mismatch", observed: true, proposed: true, verified: false };
  }
  return { action, reason: "accepted", observed: true, proposed: true, verified: true };
}

export function runMultiAgentPipeline(raw: unknown, key?: string): AuditResult {
  const observation = observeJournal(raw, key);
  if (!observation) return { action: null, reason: "invalid-event", observed: false, proposed: false, verified: false };
  return verifyProposal(observation, analyzeObservation(observation).action);
}

export function tallyAudit(results: readonly AuditResult[]): BatchAuditStats {
  return results.reduce<BatchAuditStats>((stats, result) => {
    stats.observed += Number(result.observed);
    stats.proposed += Number(result.proposed);
    stats.verified += Number(result.verified);
    stats.rejected += Number(result.proposed && !result.verified);
    return stats;
  }, { observed: 0, proposed: 0, verified: 0, rejected: 0 });
}
