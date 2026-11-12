/** Community tick monitor. Polls only when desktop is running, never invents a tick. */
import { httpFetch, isRemote } from "../../platform/bridge.js";
import { decodeTick } from "./utils.js";

export interface TickResult {
  tickAt: string;
  checkedAt: string;
  changed: boolean;
}
const STORAGE = "edch.bgs.lastTick.v1.1";
const TICK_URL = "https://tick.edcd.io/api/tick";
let started = false;
let active: Promise<TickResult> | undefined;
let last = "";
try {
  last = localStorage.getItem(STORAGE) ?? "";
} catch {
  /* optional */
}

export function currentTick() {
  return last;
}
export function refreshTick(): Promise<TickResult> {
  if (active) return active;
  active = (async () => {
    const reply = await httpFetch("GET", TICK_URL);
    if (reply.status !== 200) throw new Error(`EDCD HTTP ${reply.status}`);
    const tickAt = decodeTick(reply.body);
    const changed = Boolean(last) && tickAt > last;
    last = tickAt;
    try {
      localStorage.setItem(STORAGE, tickAt);
    } catch {
      /* read-only fallback */
    }
    const result = { tickAt, checkedAt: new Date().toISOString(), changed };
    window.dispatchEvent(new CustomEvent<TickResult>("edch-bgs-tick", { detail: result }));
    return result;
  })().finally(() => {
    active = undefined;
  });
  return active;
}
export function startBgsTickMonitor() {
  if (started || isRemote()) return;
  started = true;
  void refreshTick().catch(() => undefined);
  window.setInterval(() => {
    void refreshTick().catch(() => undefined);
  }, 15 * 60_000);
}
