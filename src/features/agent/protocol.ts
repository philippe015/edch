/** EDCH BGS Agent Journal v1.5.0 — deterministic planner and independent verifier.
 * COG-inspired worker/verifier separation, no imported third-party COG code.
 * A journal event is untrusted input; it can never become a shell command.
 */
export interface AgentEvent {
  event: string;
  timestamp?: string;
  StarSystem?: string;
  StationName?: string;
  MissionID?: number;
  Name?: string;
  LocalisedName?: string;
  Faction?: string;
  Wing?: boolean;
  TotalItemsToDeliver?: number;
  ItemsDelivered?: number;
}

export type AgentActionType = "bgs.visit" | "mission.changed" | "mission.progress" | "wing.changed" | "station.arrived";
export interface AgentAction {
  type: AgentActionType;
  text: string;
  at: string;
  event: string;
  system?: string;
  missionId?: number;
  important: boolean;
  source: "journal";
}

const SUPPORTED = new Set([
  "FSDJump", "Docked", "MissionAccepted", "MissionCompleted", "MissionFailed",
  "MissionAbandoned", "CargoDepot", "WingJoin", "WingLeave",
]);
const validText = (x: unknown, max = 160): string =>
  typeof x === "string" ? x.replace(/[\x00-\x1F\x7F]/g, " ").trim().slice(0, max) : "";
const positiveId = (x: unknown): number | undefined =>
  typeof x === "number" && Number.isSafeInteger(x) && x > 0 ? x : undefined;
const safeTime = (s: unknown): string =>
  typeof s === "string" && s.length <= 45 && Number.isFinite(Date.parse(s))
    ? new Date(s).toISOString() : "";

/** Only fields needed by the agent: never send the whole commander journal to a model or network. */
export function safeEvent(raw: unknown): AgentEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.event !== "string" || !SUPPORTED.has(e.event)) return null;
  const timestamp = safeTime(e.timestamp);
  if (!timestamp) return null;
  return {
    event: e.event, timestamp,
    StarSystem: validText(e.StarSystem), StationName: validText(e.StationName),
    MissionID: positiveId(e.MissionID),
    Name: validText(e.Name), LocalisedName: validText(e.LocalisedName),
    Faction: validText(e.Faction), Wing: e.Wing === true,
    TotalItemsToDeliver: positiveId(e.TotalItemsToDeliver),
    ItemsDelivered: typeof e.ItemsDelivered === "number" && Number.isFinite(e.ItemsDelivered)
      ? Math.max(0, Math.floor(e.ItemsDelivered)) : undefined,
  };
}

/** Planner. Descriptions in French, never speculative BGS influence or imagined actions. */
export function proposeAction(ev: AgentEvent): AgentAction | null {
  if (!ev.timestamp || !safeTime(ev.timestamp)) return null;
  const base = { at: safeTime(ev.timestamp), event: ev.event, source: "journal" as const };
  const sys = validText(ev.StarSystem);
  const missionId = positiveId(ev.MissionID);
  switch (ev.event) {
    case "FSDJump":
      return sys ? { ...base, type: "bgs.visit", system: sys, text: `Arrivée dans ${sys}`, important: false } : null;
    case "Docked":
      return { ...base, type: "station.arrived", system: sys || undefined,
        text: `Amarrage : ${validText(ev.StationName) || "station inconnue"}${sys ? ` · ${sys}` : ""}`, important: false };
    case "MissionAccepted":
    case "MissionCompleted":
    case "MissionFailed":
    case "MissionAbandoned": {
      const status: Record<string, string> = {
        MissionAccepted: "acceptée", MissionCompleted: "terminée", MissionFailed: "échouée", MissionAbandoned: "abandonnée",
      };
      return { ...base, type: "mission.changed", missionId,
        text: `Mission ${status[ev.event]}${missionId ? ` (#${missionId})` : ""}${ev.Faction ? ` · ${validText(ev.Faction, 90)}` : ""}`,
        important: ev.event === "MissionFailed" };
    }
    case "CargoDepot":
      return missionId ? { ...base, type: "mission.progress", missionId,
        text: `Livraison escadrille #${missionId} : ${ev.ItemsDelivered ?? "?"} / ${ev.TotalItemsToDeliver ?? "?"}`,
        important: false } : null;
    case "WingJoin": return { ...base, type: "wing.changed", text: "Escadrille rejointe", important: false };
    case "WingLeave": return { ...base, type: "wing.changed", text: "Escadrille quittée", important: true };
    default: return null;
  }
}

const ACTION_TYPES = new Set<AgentActionType>([
  "bgs.visit", "mission.changed", "mission.progress", "wing.changed", "station.arrived",
]);
/** Independent verification gate. No arbitrary OS commands, URL, script, or filesystem write. */
export function verifyAction(action: unknown): action is AgentAction {
  if (!action || typeof action !== "object" || Array.isArray(action)) return false;
  const a = action as Record<string, unknown>;
  return ACTION_TYPES.has(a.type as AgentActionType) && a.source === "journal" &&
    typeof a.text === "string" && a.text.length > 0 && a.text.length <= 300 &&
    typeof a.at === "string" && !!safeTime(a.at) &&
    typeof a.event === "string" && SUPPORTED.has(a.event) &&
    typeof a.important === "boolean" &&
    (a.system === undefined || (typeof a.system === "string" && a.system.length <= 160)) &&
    (a.missionId === undefined || positiveId(a.missionId) !== undefined);
}

export function eventKey(ev: AgentEvent): string {
  return [ev.timestamp, ev.event, ev.StarSystem ?? "", ev.MissionID ?? "",
    ev.ItemsDelivered ?? "", ev.StationName ?? ""].join("|");
}
