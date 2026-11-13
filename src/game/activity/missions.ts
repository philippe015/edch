// Missions: accepted, redirected, finished, cargo deliveries, massacre kills, and the combat
// rewards counted in the session.

import {
  num,
  symbolId,
  type ActivityState,
  type EventHandler,
  type EventHandlers,
  type Json,
  type Mission,
} from "./state.js";
import { t } from "../../platform/i18n.js";

/** "Mission_Delivery_Boom_Wing_name" → "Delivery Boom Wing" (when the game gave no localised title). */
export function missionTitle(symbol: string): string {
  return (
    symbol
      .replace(/^Mission_/i, "")
      .replace(/_name$/i, "")
      .replace(/_/g, " ")
      .trim() || t("common.mission")
  );
}

/** A kill against victimFaction counts toward the oldest unfinished mission per issuer.
 * Both bounties and combat bonds can advance massacre missions in conflict zones.
 * Source: BKNadir/edch commit 060a7d0 (v0.10.12), adapted to Cyberpunk Philou.
 */
function massacreKill(st: ActivityState, victimFaction: string) {
  const byIssuer = new Map<string, Mission>();
  const candidates = Object.values(st.missions)
    .filter((m) => m.status === "active" && m.killCount && m.targetFaction === victimFaction && m.kills < m.killCount)
    .sort((a, b) => a.accepted.localeCompare(b.accepted));
  for (const m of candidates) if (!byIssuer.has(m.faction)) byIssuer.set(m.faction, m);
  for (const m of byIssuer.values()) m.kills += 1;
}

/** MissionCompleted, MissionFailed, MissionAbandoned. */
const onMissionCompleted: EventHandler = (st, ev, at) => {
  const session = st.session;
  const id = Number(ev.MissionID);
  const known = Boolean(st.missions[id]);
  delete st.missions[id];
  st.finished[id] = {
    status: ev.event === "MissionCompleted" ? "done" : ev.event === "MissionFailed" ? "failed" : "abandoned",
    at,
  };
  if (ev.event === "MissionCompleted") {
    session.missions += num(ev.Reward) ?? 0;
    session.missionsDone += 1;
  }
  // Keep the list of finished missions short.
  const ids = Object.keys(st.finished);
  if (ids.length > 200) for (const old of ids.slice(0, ids.length - 200)) delete st.finished[Number(old)];
  return known || ev.event === "MissionCompleted";
};

/** Journal events of this domain. */
export const MISSIONS_EVENTS: EventHandlers = {
  Missions: (st, ev, at) => {
    const list: Json[] = ev.Active ?? [];
    const active = new Set<number>(list.map((m: Json) => Number(m.MissionID)));
    for (const id of Object.keys(st.missions).map(Number)) if (!active.has(id)) delete st.missions[id];
    // Missions the archive didn't show being accepted (older than the archive, or accepted in a way
    // the journal doesn't log): keep them visible with what the login list says.
    for (const m of list) {
      const id = Number(m.MissionID);
      if (st.missions[id] || !id) continue;
      const name = String(m.Name ?? "");
      st.missions[id] = {
        id,
        name,
        title: missionTitle(name),
        faction: "",
        accepted: at,
        expiry:
          typeof m.Expires === "number" && at ? new Date(Date.parse(at) + m.Expires * 1000).toISOString() : undefined,
        wing: /wing/i.test(name),
        kills: 0,
        status: "active",
      };
    }
    return true;
  },
  MissionAccepted: (st, ev, at) => {
    const id = Number(ev.MissionID);
    st.missions[id] = {
      id,
      name: String(ev.Name ?? ""),
      title: String(ev.LocalisedName ?? ev.Name ?? ""),
      faction: String(ev.Faction ?? ""),
      accepted: at,
      expiry: ev.Expiry,
      destSystem: ev.DestinationSystem,
      destStation: ev.DestinationStation ?? ev.DestinationSettlement,
      wing: Boolean(ev.Wing),
      reward: num(ev.Reward),
      influence: ev.Influence,
      reputation: ev.Reputation,
      commodity: ev.Commodity_Localised ?? ev.Commodity,
      commodityId: ev.Commodity ? symbolId(ev.Commodity) : undefined,
      count: num(ev.Count),
      targetFaction: ev.TargetFaction,
      target: ev.Target_Localised ?? ev.Target ?? ev.TargetType_Localised,
      killCount: num(ev.KillCount),
      kills: 0,
      passengers: num(ev.PassengerCount),
      status: "active",
    };
    return true;
  },
  MissionRedirected: (st, ev) => {
    const m = st.missions[Number(ev.MissionID)];
    if (!m) return false;
    m.status = "redirected";
    m.destSystem = ev.NewDestinationSystem ?? m.destSystem;
    m.destStation = ev.NewDestinationStation ?? m.destStation;
    if (m.killCount) m.kills = Math.max(m.kills, m.killCount);
    return true;
  },
  MissionCompleted: onMissionCompleted,
  MissionFailed: onMissionCompleted,
  MissionAbandoned: onMissionCompleted,
  CargoDepot: (st, ev, at) => {
    const id = Number(ev.MissionID);
    if (!st.missions[id] && id && !st.finished[id]) {
      st.missions[id] = {
        id,
        name: "Mission_Delivery_Wing",
        title: missionTitle(`Mission_Delivery_${ev.CargoType ?? ""}`),
        faction: "",
        accepted: at,
        wing: true,
        kills: 0,
        status: "active",
      };
    }
    const m = st.missions[id];
    if (!m) return false;
    m.delivered = num(ev.ItemsDelivered) ?? m.delivered;
    m.collected = num(ev.ItemsCollected) ?? m.collected;
    m.total = num(ev.TotalItemsToDeliver) ?? m.total;
    return true;
  },
  // Bounties and combat bonds count as earned at the kill (Thargoid bonds included); what was
  // cashed in at a station (RedeemVoucher) is kept apart, so the page shows what is left to cash.
  Bounty: (st, ev) => {
    const session = st.session;
    session.kills += 1;
    // Ships: TotalReward (all the factions' bounties); skimmers and others: Reward.
    session.bounties += num(ev.TotalReward) ?? num(ev.Reward) ?? 0;
    const victim = ev.VictimFaction_Localised ?? ev.VictimFaction;
    if (victim) massacreKill(st, String(victim));
    return true;
  },
  FactionKillBond: (st, ev) => {
    const session = st.session;
    session.kills += 1;
    session.bonds += num(ev.Reward) ?? 0;
    // A conflict massacre mission counts kills in its conflict zone.
    const victim = ev.VictimFaction_Localised ?? ev.VictimFaction;
    if (victim) massacreKill(st, String(victim));
    return true;
  },
  RedeemVoucher: (st, ev) => {
    const session = st.session;
    const amount = num(ev.Amount) ?? 0;
    if (ev.Type === "bounty") session.bountiesCashed += amount;
    else if (ev.Type === "CombatBond") session.bondsCashed += amount;
    return true;
  },
};

/** Massacre stacks: per target faction, kills still needed (the largest per-issuer remainder). */
export function massacreStacks(missions: Mission[]): {
  target: string;
  needed: number;
  done: number;
  issuers: { faction: string; kills: number; total: number; missions: number; reward: number }[];
}[] {
  const byTarget = new Map<string, Mission[]>();
  for (const m of missions)
    if (m.killCount && m.targetFaction) byTarget.set(m.targetFaction, [...(byTarget.get(m.targetFaction) ?? []), m]);
  return [...byTarget.entries()].map(([target, list]) => {
    const issuers = new Map<
      string,
      { faction: string; kills: number; total: number; missions: number; reward: number }
    >();
    for (const m of list) {
      const i = issuers.get(m.faction) ?? { faction: m.faction, kills: 0, total: 0, missions: 0, reward: 0 };
      i.kills += Math.min(m.kills, m.killCount!);
      i.total += m.killCount!;
      i.missions += 1;
      i.reward += m.reward ?? 0;
      issuers.set(m.faction, i);
    }
    const all = [...issuers.values()].sort((a, b) => b.total - a.total);
    const needed = Math.max(0, ...all.map((i) => i.total));
    const done = Math.max(0, ...all.map((i) => i.kills));
    return { target, needed, done, issuers: all };
  });
}
