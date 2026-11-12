// Wing mission sharing between EDCH users, through ntfy.sh.
//
// Everyone in the wing types the same code. The code gives the ntfy topic (a hash of it, so the
// code itself never travels) and the AES-GCM key that encrypts every message: ntfy only ever sees
// random-looking text. Each EDCH publishes its wing missions when they change, plus a heartbeat,
// and polls the topic for the others'.

import { httpFetch, isTauri, ntfySetFarewell, ntfySubscribe, ntfyUnsubscribe, onNtfy } from "../platform/bridge.js";
import { log } from "../platform/logger.js";
import type { Mission } from "../game/activity/state.js";
import { t } from "../platform/i18n.js";

export interface WingMission {
  id: number;
  /** Journal symbol (language-independent), e.g. Mission_Delivery_Boom_Wing_name. */
  name?: string;
  title: string;
  faction: string;
  destSystem?: string;
  destStation?: string;
  expiry?: string;
  status: string;
  killCount?: number;
  kills?: number;
  delivered?: number;
  total?: number;
  reward?: number;
  commodity?: string;
  count?: number;
  /** EDCH-BGS-WING-RECEIPTS-v1.4.9.1: acknowledged by the member in the game, NOT detected in the journal. */
  manualConfirmed?: boolean;
}

export interface WingMember {
  id: string;
  name: string;
  at: string;
  missions: WingMission[];
  left?: boolean;
  /** Why they left: EDCH closed, left the wing in game, or turned sharing off. */
  reason?: LeaveReason;
}

export type LeaveReason = "closed" | "wing" | "off";

interface Packet {
  v: 1;
  from: string;
  name: string;
  at: string;
  missions: WingMission[];
  bye?: boolean;
  reason?: LeaveReason;
}

const NTFY = "https://ntfy.sh/";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const normaliseCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function topicFor(code: string): Promise<string> {
  return `edch_${(await sha256Hex(`edch-wing-topic:${normaliseCode(code)}`)).slice(0, 32)}`;
}

async function keyFor(code: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", textEncoder.encode(normaliseCode(code)), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: textEncoder.encode("edch-wing-v1"), iterations: 150_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export async function seal(key: CryptoKey, packet: Packet): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(JSON.stringify(packet))),
  );
  const out = new Uint8Array(iv.length + data.length);
  out.set(iv);
  out.set(data, iv.length);
  return `edch1:${toB64(out)}`;
}

export async function open(key: CryptoKey, text: string): Promise<Packet | null> {
  if (!text.startsWith("edch1:")) return null;
  try {
    const raw = fromB64(text.slice(6));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, key, raw.slice(12));
    const p = JSON.parse(textDecoder.decode(plain));
    return p && p.v === 1 && typeof p.from === "string" ? (p as Packet) : null;
  } catch {
    return null; // another wing's message on a colliding topic, or tampered: ignore
  }
}

export function toWingMission(m: Mission): WingMission {
  return {
    id: m.id,
    name: m.name,
    title: m.title.slice(0, 80),
    faction: m.faction.slice(0, 60),
    destSystem: m.destSystem,
    destStation: m.destStation,
    expiry: m.expiry,
    status: m.status,
    killCount: m.killCount,
    kills: m.killCount ? m.kills : undefined,
    delivered: m.delivered,
    total: m.total,
    reward: m.reward,
    commodity: m.commodity,
    count: m.count,
  };
}

/** The missions we publish: those chosen by `share`, at most 20. */
export function toWingMissions(missions: Mission[], share: (m: Mission) => boolean = (m) => m.wing): WingMission[] {
  return missions.filter(share).slice(0, 20).map(toWingMission);
}

const norm = (s?: string) => (s ?? "").trim().toLowerCase();

/**
 * Same mission seen by two commanders. The copy a wingmate accepts can carry another id, another
 * language for its title and no "wing" flag, so it is matched on what the game doesn't translate:
 * mission type (journal symbol), issuing faction, destination and an expiry within a few hours.
 */
export function sameMission(a: WingMission, b: WingMission): boolean {
  if (a.id === b.id) return true;
  // A field only one side knows (a mission seen only in the login list has no faction or
  // destination) doesn't count against the match.
  const differ = (x?: string, y?: string) => Boolean(norm(x) && norm(y) && norm(x) !== norm(y));
  if (differ(a.faction, b.faction) || differ(a.destSystem, b.destSystem) || differ(a.destStation, b.destStation))
    return false;
  if (a.expiry && b.expiry && Math.abs(Date.parse(a.expiry) - Date.parse(b.expiry)) > 3 * 3600000) return false;
  if (a.name && b.name) return norm(a.name).replace(/_name$/, "") === norm(b.name).replace(/_name$/, "");
  return a.title === b.title;
}

/**
 * Two copies of one mission: keep what either knows (a copy seen only through a cargo depot
 * update has no title or faction) and the furthest delivery progress.
 */
export function mergeMission(a: WingMission, b: WingMission): WingMission {
  const out: WingMission = { ...a };
  for (const k of ["name", "faction", "destSystem", "destStation", "expiry", "reward", "commodity", "count"] as const) {
    if ((out[k] === undefined || out[k] === "") && b[k] !== undefined && b[k] !== "")
      (out as unknown as Record<string, unknown>)[k] = b[k];
  }
  if (!out.title || /^Mission_/.test(out.title)) out.title = b.title || out.title;
  if (b.total && (b.delivered ?? 0) >= (out.delivered ?? 0)) {
    out.delivered = b.delivered;
    out.total = b.total;
  }
  return out;
}

export interface WingRow {
  mission: WingMission;
  holders: string[];
  /** Which holders explicitly confirmed manually (not journal proof). */
  manualHolders: string[];
  /** Ids of active members who don't have it. */
  missing: string[];
  mine: boolean;
}

/**
 * A member with no news for this long is considered gone (EDCH crashed, PC asleep…): the
 * heartbeat comes every 20 minutes, so two missed beats plus a margin.
 */
const ACTIVE_MS = 45 * 60 * 1000;

export const isActive = (m: WingMember, now = Date.now()) => !m.left && now - Date.parse(m.at) < ACTIVE_MS;

/** Every wing mission anyone has, with who holds it. */
export function wingRows(me: WingMember, others: WingMember[], now = Date.now()): WingRow[] {
  const members = [me, ...others.filter((o) => isActive(o, now))];
  const rows: WingRow[] = [];
  for (const m of members) {
    for (const mission of m.missions) {
      let row = rows.find((r) => sameMission(r.mission, mission));
      if (!row) {
        row = { mission: { ...mission }, holders: [], manualHolders: [], missing: [], mine: false };
        rows.push(row);
      } else {
        row.mission = mergeMission(row.mission, mission);
      }
      if (!row.holders.includes(m.id)) row.holders.push(m.id);
      if (mission.manualConfirmed && !row.manualHolders.includes(m.id)) row.manualHolders.push(m.id);
      if (m.id === me.id) row.mine = true;
    }
  }
  for (const r of rows) r.missing = members.filter((m) => !r.holders.includes(m.id)).map((m) => m.id);
  return rows.sort((a, b) => (a.mission.expiry ?? "").localeCompare(b.mission.expiry ?? ""));
}

export interface WingEvents {
  /** Someone has a wing mission you don't. */
  newMission: (row: WingRow, by: string) => void;
  /** Every active member now has this mission. */
  everyone: (row: WingRow) => void;
  /** A member accepted a mission you share. */
  accepted: (row: WingRow, by: string) => void;
  /** A member left: EDCH closed, left the wing in game, or stopped sharing. */
  left: (name: string, reason: LeaveReason | undefined) => void;
  changed: () => void;
  error: (message: string) => void;
}

/** One running link to a wing. */
export class WingLink {
  members = new Map<string, WingMember>();
  status: "connecting" | "ok" | "error" = "connecting";
  lastError = "";
  private key!: CryptoKey;
  private topic = "";
  private since = "6h";
  private timer?: number;
  private beat?: number;
  private stopped = false;
  private announcedNew = new Set<string>();
  private announcedAll = new Set<string>();
  private announcedHolders = new Set<string>();
  private lastSent = "";
  /** The first poll only learns what already exists: no notifications for old news. */
  private primed = false;

  constructor(
    private code: string,
    private me: () => WingMember,
    private on: WingEvents,
  ) {}

  async start() {
    this.key = await keyFor(this.code);
    this.topic = await topicFor(this.code);
    await this.publish(true);
    await this.poll();
    this.beat = window.setInterval(() => void this.publish(true), 20 * 60 * 1000);
    // In the app: a live connection, ntfy pushes each message at once. A slow poll stays as a
    // safety net. In a plain browser (demo): poll every 15 s.
    if (isTauri()) {
      try {
        this.unlisten = await onNtfy(
          (topic, line) => {
            if (topic === this.topic) void this.handleLines([line]);
          },
          (topic, connected, message) => {
            if (topic !== this.topic) return;
            this.live = connected;
            if (!connected && message) log.warn("wing", `ntfy: ${message}`);
          },
        );
        await ntfySubscribe(this.topic, this.since);
        this.timer = window.setInterval(() => void this.poll(), 120_000);
        return;
      } catch (e) {
        log.warn("wing", `Live link unavailable, polling instead: ${String((e as Error)?.message ?? e)}`);
      }
    }
    this.timer = window.setInterval(() => void this.poll(), 15_000);
  }

  /** True while the live connection to ntfy is open. */
  live = false;
  private unlisten?: () => void;

  async stop() {
    this.stopped = true;
    window.clearInterval(this.timer);
    window.clearInterval(this.beat);
    this.unlisten?.();
    if (isTauri()) {
      void ntfyUnsubscribe();
      void ntfySetFarewell(this.topic, null);
    }
    try {
      const me = this.me();
      await this.send({
        v: 1,
        from: me.id,
        name: me.name,
        at: new Date().toISOString(),
        missions: [],
        bye: true,
        reason: "off",
      });
    } catch {
      /* leaving quietly is fine */
    }
  }

  /** Out of the wing in game: tell the others, and stay quiet until we join one again. */
  private away = false;

  async leftWing() {
    if (this.away || this.stopped || !this.key) return;
    this.away = true;
    if (isTauri()) void ntfySetFarewell(this.topic, null);
    try {
      const me = this.me();
      await this.send({
        v: 1,
        from: me.id,
        name: me.name,
        at: new Date().toISOString(),
        missions: [],
        bye: true,
        reason: "wing",
      });
      this.lastSent = "";
    } catch (e) {
      this.fail(e);
    }
  }

  async joinedWing() {
    if (!this.away) return;
    this.away = false;
    await this.publish(true);
  }

  /** Keeps Rust ready to tell the wing we're gone if EDCH closes (it must be newer than our last message). */
  private async armFarewell() {
    if (!isTauri() || this.stopped || this.away) return;
    const me = this.me();
    const text = await seal(this.key, {
      v: 1,
      from: me.id,
      name: me.name,
      at: new Date(Date.now() + 1000).toISOString(),
      missions: [],
      bye: true,
      reason: "closed",
    });
    void ntfySetFarewell(this.topic, text);
  }

  /** Publishes our wing missions when they changed (or always, for the heartbeat). */
  async publish(force = false) {
    if (this.stopped || !this.key || this.away) return;
    const me = this.me();
    const body = JSON.stringify(me.missions);
    if (!force && body === this.lastSent) return;
    this.lastSent = body;
    try {
      await this.send({ v: 1, from: me.id, name: me.name, at: new Date().toISOString(), missions: me.missions });
      this.ok();
      void this.armFarewell();
    } catch (e) {
      this.fail(e);
    }
  }

  private async send(p: Packet) {
    const text = await seal(this.key, p);
    const reply = await httpFetch("POST", NTFY + this.topic, text, "text/plain");
    if (reply.status === 429) throw new Error(t("wing.ntfyShTooManyMessagesTry"));
    if (reply.status < 200 || reply.status >= 300) throw new Error(t("wing.ntfyShAnswered", { status: reply.status }));
  }

  private ok() {
    if (this.status !== "ok") {
      this.status = "ok";
      this.lastError = "";
      this.on.changed();
    }
  }

  private fail(e: unknown) {
    log.warn("wing", String((e as Error)?.message ?? e));
    this.status = "error";
    this.lastError = String((e as Error)?.message ?? e);
    this.on.error(this.lastError);
    this.on.changed();
  }

  async poll() {
    if (this.stopped || !this.key) return;
    try {
      const reply = await httpFetch("GET", `${NTFY}${this.topic}/json?poll=1&since=${encodeURIComponent(this.since)}`);
      if (reply.status < 200 || reply.status >= 300)
        throw new Error(t("wing.ntfyShAnswered", { status: reply.status }));
      await this.handleLines(reply.body.split("\n"));
    } catch (e) {
      this.fail(e);
    }
  }

  /** ntfy lines, from a poll or from the live connection. Messages are processed in order. */
  private queue: Promise<void> = Promise.resolve();
  handleLines(lines: string[]): Promise<void> {
    this.queue = this.queue.then(() => this.process(lines)).catch(() => undefined);
    return this.queue;
  }

  private async process(lines: string[]) {
    if (this.stopped || !this.key) return;
    const myId = this.me().id;
    let changed = false;
    for (const line of lines) {
      if (!line.trim()) continue;
      let msg: { id?: string; event?: string; message?: string };
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.event !== "message" || !msg.message) continue;
      if (msg.id) this.since = msg.id;
      const p = await open(this.key, msg.message);
      if (!p || p.from === myId) continue;
      const prev = this.members.get(p.from);
      if (prev && prev.at > p.at) continue;
      if (p.bye && prev && !prev.left && this.primed) this.on.left(p.name || prev.name || "CMDR", p.reason);
      this.members.set(p.from, {
        id: p.from,
        name: p.name || "CMDR",
        at: p.at,
        missions: p.bye ? [] : (p.missions ?? []),
        left: p.bye,
        reason: p.bye ? p.reason : undefined,
      });
      log.debug(
        "wing",
        `${p.name || "CMDR"}: ${p.bye ? "left" : `${(p.missions ?? []).length} mission(s)`} ${(p.missions ?? []).map((m) => `#${m.id}${m.total ? ` ${m.delivered ?? 0}/${m.total}` : ""}`).join(" ")}`,
      );
      changed = true;
    }
    this.ok();
    if (changed || !this.primed) this.check();
    this.primed = true;
    if (changed) this.on.changed();
  }

  /** Fires the notifications for what changed. Called after polls and when our missions change. */
  check() {
    const me = this.me();
    const others = [...this.members.values()];
    const rows = wingRows(me, others);
    const key = (r: WingRow) =>
      `${norm(r.mission.name) || r.mission.title}|${norm(r.mission.faction)}|${norm(r.mission.destSystem)}|${(r.mission.expiry ?? "").slice(0, 13)}`;
    const activeCount = 1 + others.filter((o) => isActive(o)).length;
    for (const r of rows) {
      const k = key(r);
      if (!r.mine && !this.announcedNew.has(k)) {
        this.announcedNew.add(k);
        const by = others.find((o) => r.holders.includes(o.id))?.name ?? "";
        if (this.primed) this.on.newMission(r, by);
      }
      if (r.mine) {
        for (const holder of r.holders) {
          if (holder === me.id || this.announcedHolders.has(`${k}|${holder}`)) continue;
          this.announcedHolders.add(`${k}|${holder}`);
          const by = others.find((o) => o.id === holder)?.name ?? "";
          if (this.primed && r.missing.length > 0) this.on.accepted(r, by);
        }
      }
      if (activeCount >= 2 && r.missing.length === 0 && !this.announcedAll.has(k)) {
        this.announcedAll.add(k);
        if (this.primed) this.on.everyone(r);
      }
    }
  }
}
