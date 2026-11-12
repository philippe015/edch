/** EDCH-BGS-ALERTS-v1.5.4 — bounded, per-CMDR/per-faction local preferences and deduplication. */
import {
  DEFAULT_ALERT_SETTINGS,
  sanitizeAlertSettings,
  type AlertSettings,
  type BgsAlert,
} from "./alertRules.js";

export interface AlertScope { commander: string; faction: string }
export interface AlertLocalState {
  settings: AlertSettings;
  seen: string[];
  muted: string[];
  initialized: boolean;
}
interface LocalStorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
const PREFIX = "edch.bgs.alerts.v154.";
const MAX_SEEN = 1200;
const MAX_MUTED = 500;
const fallbacks = new Map<string, AlertLocalState>();
const normalized = (text: string): string => text.trim().toLocaleLowerCase();

export function validAlertScope(scope: unknown): scope is AlertScope {
  if (!scope || typeof scope !== "object") return false;
  const s = scope as Record<string, unknown>;
  return [s.commander, s.faction].every((v) =>
    typeof v === "string" && v.trim().length > 0 && v.trim().length <= 160 && !/[\x00-\x1f\x7f]/.test(v));
}
export function alertScopeKey(scope: AlertScope): string {
  if (!validAlertScope(scope)) throw new Error("CMDR et faction requis pour les alertes locales");
  return `${PREFIX}${encodeURIComponent(normalized(scope.commander))}.${encodeURIComponent(normalized(scope.faction))}`;
}
export function emptyAlertState(): AlertLocalState {
  return { settings: { ...DEFAULT_ALERT_SETTINGS }, seen: [], muted: [], initialized: false };
}
function boundedKeys(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 450))].slice(-max);
}
export function sanitizeAlertState(value: unknown): AlertLocalState {
  if (!value || typeof value !== "object") return emptyAlertState();
  const data = value as Record<string, unknown>;
  return {
    settings: sanitizeAlertSettings(data.settings),
    seen: boundedKeys(data.seen, MAX_SEEN),
    muted: boundedKeys(data.muted, MAX_MUTED),
    initialized: data.initialized === true,
  };
}
/** Browser storage can be unavailable in WebKitGTK private mode: no false claim of persistence. */
export function loadAlertState(scope: AlertScope, storage?: LocalStorageLike | null): { state: AlertLocalState; persistent: boolean } {
  const key = alertScopeKey(scope);
  if (storage === undefined) {
    try { storage = window.localStorage; } catch { storage = null; }
  }
  if (storage) {
    try {
      const raw = storage.getItem(key);
      if (raw !== null) return { state: sanitizeAlertState(JSON.parse(raw)), persistent: true };
      return { state: fallbacks.get(key) ?? emptyAlertState(), persistent: true };
    } catch { /* degrade explicitly */ }
  }
  return { state: fallbacks.get(key) ?? emptyAlertState(), persistent: false };
}
export function saveAlertState(scope: AlertScope, input: AlertLocalState, storage?: LocalStorageLike | null): boolean {
  const key = alertScopeKey(scope);
  const state = sanitizeAlertState(input);
  fallbacks.set(key, state);
  if (storage === undefined) {
    try { storage = window.localStorage; } catch { storage = null; }
  }
  if (!storage) return false;
  try { storage.setItem(key, JSON.stringify(state)); return true; } catch { return false; }
}
/** First scan establishes a silent baseline. Only *later* observed changes may notify. */
export function captureNewAlerts(input: AlertLocalState, alerts: readonly BgsAlert[]): {
  state: AlertLocalState; toNotify: BgsAlert[]; newlyObserved: number;
} {
  const state = sanitizeAlertState(input);
  const seen = new Set(state.seen);
  const muted = new Set(state.muted);
  const fresh = alerts.filter((a) => !seen.has(a.id));
  const toNotify = state.initialized && state.settings.notifications
    ? fresh.filter((a) => a.observedChange && !muted.has(a.id)).slice(0, 2)
    : [];
  for (const alert of fresh) seen.add(alert.id);
  state.seen = [...seen].slice(-MAX_SEEN);
  state.initialized = true;
  return { state, toNotify, newlyObserved: fresh.length };
}
export function muteAlert(input: AlertLocalState, id: string): AlertLocalState {
  const state = sanitizeAlertState(input);
  if (typeof id === "string" && id.length > 0 && id.length <= 450)
    state.muted = [...new Set([...state.muted, id])].slice(-MAX_MUTED);
  return state;
}
export function clearMutedAlerts(input: AlertLocalState): AlertLocalState {
  const state = sanitizeAlertState(input);
  state.muted = [];
  return state;
}
