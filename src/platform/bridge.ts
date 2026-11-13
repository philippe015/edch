// Talks to the Rust side when running inside Tauri; falls back to a demo mode in a
// plain browser so the UI can be developed and checked without the game.

import { backendMessage, t } from "./i18n.js";
interface TauriGlobal {
  core: { invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> };
  event: { listen<T>(name: string, cb: (e: { payload: T }) => void): Promise<() => void> };
}

declare global {
  interface Window {
    __TAURI__?: TauriGlobal;
  }
}

export interface JournalBatch {
  lines: string[];
  replay: boolean;
  file: string;
}

export interface WatchStatus {
  state: "live" | "waiting" | "error" | "demo" | "idle" | "remote" | "offline";
  file?: string | null;
  message?: string | null;
}

export interface AuxFile {
  name: string;
  content: string;
}

// ---------------- logging of every call to the Rust side ----------------

let debugCalls = false;
/** Debug mode: every call to the Rust side is logged (the logger switches it). */
export const setCallLogging = (on: boolean) => {
  debugCalls = on;
};

/** Writes one log line through Rust (never logged itself). */
export function rawLog(level: string, source: string, message: string): Promise<void> {
  if (!isTauri() || remote) return Promise.resolve();
  return window.__TAURI__!.core.invoke<void>("log_write", { level, source, message }).catch(() => undefined);
}

/** Calls nobody needs in the debug log: they run all the time and log themselves when useful. */
const QUIET = new Set(["log_write", "log_set_debug", "http_fetch", "remote_publish", "remote_qr"]);
/** Arguments that may hold secrets or big payloads: only their size is logged. */
const HIDDEN = /token|key|secret|data|state|body|content|text/i;

function describeArgs(args?: Record<string, unknown>): string {
  if (!args) return "";
  return Object.entries(args)
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}=[${v.length}]`;
      if (typeof v === "string")
        return HIDDEN.test(k) ? `${k}=<${v.length} chars>` : `${k}=${v.length > 120 ? `${v.slice(0, 120)}…` : v}`;
      if (v && typeof v === "object") return `${k}={…}`;
      return `${k}=${v}`;
    })
    .join(" ");
}

/** A Rust error (an error code, see backendMessage) as text in the app's language. */
function translatedError(err: unknown): unknown {
  if (typeof err === "string") return backendMessage(err);
  if (err instanceof Error) err.message = backendMessage(err.message);
  return err;
}

function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const started = performance.now();
  const call = window.__TAURI__!.core.invoke<T>(cmd, args);
  if (QUIET.has(cmd)) return call.catch((err) => Promise.reject(translatedError(err)));
  return call.then(
    (value) => {
      if (debugCalls)
        void rawLog(
          "DEBUG",
          "call",
          `${cmd} ${describeArgs(args)} → ok (${Math.round(performance.now() - started)} ms)`,
        );
      return value;
    },
    (err) => {
      // Logged as the code (English, the same in every language), shown translated.
      void rawLog("WARN", "call", `${cmd} ${describeArgs(args)} → ${String((err as Error)?.message ?? err)}`);
      throw translatedError(err);
    },
  );
}

export const isTauri = (): boolean => typeof window !== "undefined" && Boolean(window.__TAURI__?.core);

/** True when this page is served by EDCH's local server to another device (phone, tablet). */
let remote = false;
export const isRemote = () => remote;
export const setRemote = (on: boolean) => {
  remote = on;
};

const TOKEN_KEY = "edch.remoteToken";

/** The pairing secret kept by the phone (sent as a header too, for browsers that drop the cookie). */
export function remoteToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function forgetRemoteToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing stored */
  }
}

/** fetch() to the PC with the pairing secret. */
export function remoteFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = remoteToken();
  if (token) headers.set("X-EDCH-Token", token);
  return fetch(path, { credentials: "same-origin", ...init, headers });
}

async function remoteJson(path: string, init?: RequestInit): Promise<any> {
  const res = await remoteFetch(path, init);
  if (!res.ok) throw new Error(t("bridge.edchPcAnswered", { status: res.status }));
  return res.status === 204 ? null : res.json();
}

export async function defaultJournalDir(): Promise<string | null> {
  if (!isTauri()) return null;
  return tauriInvoke<string | null>("default_journal_dir");
}

export async function startJournal(dir: string): Promise<void> {
  if (!isTauri()) return;
  await tauriInvoke("start_journal", { dir });
}

export async function readAuxFile(dir: string, name: string): Promise<string> {
  if (!isTauri()) throw new Error("not in app");
  return tauriInvoke<string>("read_aux_file", { dir, name });
}

export async function onJournal(handlers: {
  batch: (b: JournalBatch) => void;
  status: (s: WatchStatus) => void;
  aux: (a: AuxFile) => void;
}): Promise<void> {
  if (!isTauri()) return;
  const ev = window.__TAURI__!.event;
  await ev.listen<JournalBatch>("journal-batch", (e) => handlers.batch(e.payload));
  await ev.listen<WatchStatus>("journal-status", (e) => handlers.status(e.payload));
  await ev.listen<AuxFile>("aux-file", (e) => handlers.aux(e.payload));
}

export interface HttpReply {
  status: number;
  body: string;
}

/** HTTP through Rust in the app (no CORS); plain fetch in a browser. Never throws on HTTP status. */
export async function httpFetch(
  method: string,
  url: string,
  body?: string,
  contentType = "application/json",
): Promise<HttpReply> {
  if (remote) {
    return remoteJson("/api/http", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, url, body: body ?? null, contentType }),
    });
  }
  if (isTauri()) {
    return tauriInvoke<HttpReply>("http_fetch", { method, url, body: body ?? null, contentType });
  }
  const response = await fetch(url, { method, headers: body ? { "Content-Type": contentType } : undefined, body });
  return { status: response.status, body: await response.text() };
}

const TRANSIENT = new Set([500, 502, 503, 504, 520, 521, 522, 523, 524]);

/** Spansh's servers sometimes answer 502/503 under load: retry twice before giving up. */
async function spanshFetch(method: string, url: string, body?: string, contentType?: string): Promise<HttpReply> {
  const waits = [1500, 4000];
  for (let attempt = 0; ; attempt++) {
    let reply: HttpReply | null = null;
    let failure: unknown = null;
    try {
      reply = await httpFetch(method, url, body, contentType);
    } catch (e) {
      failure = e;
    }
    const retry = failure !== null || (reply !== null && TRANSIENT.has(reply.status));
    if (!retry || attempt >= waits.length) {
      if (failure !== null) throw failure;
      return reply!;
    }
    await new Promise((ok) => setTimeout(ok, waits[attempt]));
  }
}

function parse(reply: HttpReply, what: string): any {
  if (reply.status === 429) throw new Error(t("bridge.tooManyRequestsTryAgainMoment", { what }));
  if (TRANSIENT.has(reply.status))
    throw new Error(t("bridge.temporarilyUnavailableErrorTryAgainMoment", { what, status: reply.status }));
  if (reply.status < 200 || reply.status >= 300) throw new Error(t("bridge.answered", { what, status: reply.status }));
  try {
    return JSON.parse(reply.body);
  } catch {
    throw new Error(t("bridge.unreadableAnswer", { what }));
  }
}

/** POST a Spansh JSON search (systems/bodies/stations). */
export async function spanshPost(endpoint: string, body: unknown): Promise<any> {
  return parse(await spanshFetch("POST", `https://spansh.co.uk/api/${endpoint}`, JSON.stringify(body)), "Spansh");
}

export async function spanshGet(path: string): Promise<any> {
  return parse(await spanshFetch("GET", `https://spansh.co.uk/api/${path}`), "Spansh");
}

/** Spansh route plotters: submit a form, then poll the job until it is done. */
export async function spanshJob(
  endpoint: string,
  form: [string, string][],
  onWait?: (n: number) => void,
): Promise<any> {
  const encoded = form.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const submitted = parse(
    await httpFetch("POST", `https://spansh.co.uk/api/${endpoint}`, encoded, "application/x-www-form-urlencoded"),
    "Spansh",
  );
  if (submitted.error) throw new Error(String(submitted.error));
  const job = submitted.job;
  if (!job) throw new Error(t("bridge.spanshReturnedNoJobNumber"));
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    onWait?.(i);
    const res = parse(await spanshFetch("GET", `https://spansh.co.uk/api/results/${job}`), "Spansh");
    if (res.status === "queued") continue;
    // The exact (galaxy) plotter also says "state": still running until it is "completed".
    if (res.status === "ok" && res.state && res.state !== "completed" && !res.result) continue;
    if (res.status === "ok" && res.result) return res.result;
    throw new Error(String(res.error ?? t("bridge.spanshPlotFailed", { status: res.status ?? "?" })));
  }
  throw new Error(t("bridge.spanshStillPlottingAfter3Minutes"));
}

export interface OptionFile {
  folder: "Bindings" | "Graphics";
  name: string;
  size: number;
  modified: number;
}

export interface ImportReport {
  written: string[];
  skipped: string[];
  backup: string;
}

const invoke = <T>(cmd: string, args?: Record<string, unknown>) => {
  if (remote) return Promise.reject(new Error(t("bridge.onlyAvailablePc")));
  if (!isTauri()) return Promise.reject(new Error(t("bridge.availableAppNotDemoMode")));
  return tauriInvoke<T>(cmd, args);
};

/** EDCH Cyberpunk Philou v1.6.11: local, read-only storage inventory. */
export interface StorageEntry {
  id: string;
  label: string;
  path: string;
  bytes: number;
  files: number;
  exists: boolean;
  incomplete: boolean;
}
export interface DataFileState {
  id: string;
  name: string;
  exists: boolean;
  bytes: number;
  modifiedUnix: number | null;
}
export interface StorageDiagnostic {
  entries: StorageEntry[];
  dataFiles: DataFileState[];
  agentBackups: number;
  latestAgentBackupUnix: number | null;
  checkedUnix: number;
}
export const storageDiagnostic = (): Promise<StorageDiagnostic> => invoke<StorageDiagnostic>("storage_diagnostic");
export const storageBgsIntegrity = (): Promise<string> => invoke<string>("storage_bgs_integrity");

export const optionsDir = () => invoke<string>("options_dir");
export const listOptionFiles = (): Promise<OptionFile[]> =>
  remote ? remoteJson("/api/options") : invoke<OptionFile[]>("list_option_files");
export const readOptionFile = async (folder: string, name: string): Promise<string> => {
  if (!remote) return invoke<string>("read_option_file", { folder, name });
  const res = await remoteFetch(`/api/option?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.text();
};
export const exportConfig = (includeGraphics: boolean) => invoke<string>("export_config", { includeGraphics });
export const importConfig = (bytes: Uint8Array) => invoke<ImportReport>("import_config", { data: Array.from(bytes) });
export const revealPath = (path: string) => invoke<void>("reveal_path", { path });
// EDCH-BGS-RELIABILITY-v1.4.9: native backup, never a WebKit blob download on desktop.
export const bgsSaveJson = (snapshot: string): Promise<string> => invoke<string>("bgs_save_json", { snapshot });
// EDCH-ONFOOT-EDIT-v1.4.4: creates a NEW file, never overwrites existing presets.
export interface FootPresetResult {
  preset: string;
  filename: string;
  path: string;
  changes: number;
}
export const footSavePreset = (
  sourceFile: string,
  changes: { action: string; slot: "primary" | "secondary"; key: string; modifiers: string[] }[],
): Promise<FootPresetResult> => invoke<FootPresetResult>("foot_save_preset", { sourceFile, changes });
/** v1.6.5: creates a new .binds preset under Elite Dangerous Options/Bindings; never overwrites. */
export interface ControlsPresetChange {
  action: string;
  slot: "primary" | "secondary";
  device: string;
  key: string;
  modifiers: { device: string; key: string }[];
  replaceExisting: boolean;
}
export interface ControlsPresetResult { preset: string; filename: string; path: string }
export const controlsSavePreset = (sourceFile: string, change: ControlsPresetChange): Promise<ControlsPresetResult> =>
  invoke<ControlsPresetResult>("controls_save_preset", { sourceFile, change });
/** v1.6.6: checked multi-change generation, never modifying the original file. */
export const controlsSavePresetBatch = (sourceFile: string, changes: ControlsPresetChange[]): Promise<ControlsPresetResult> =>
  invoke<ControlsPresetResult>("controls_save_preset_batch", { sourceFile, changes });
/** v1.6.21: stable user-readable name, explicit overwrite only with automatic backup. */
export const controlsSaveNamedPresetBatch = (
  sourceFile:string, changes:ControlsPresetChange[], presetName:string,
  updateExisting:boolean, frenchAzerty:boolean,
):Promise<ControlsPresetResult> => invoke<ControlsPresetResult>("controls_save_named_preset_batch",
  {sourceFile,changes,presetName,updateExisting,frenchAzerty});
/** v1.6.7: optional Linux joystick inspection. Raw indexes are NOT game .binds IDs. */
export interface HotasDevice { id: string; name: string; vendor?: string | null; product?: string | null; readable: boolean; }
export interface HotasEvent { deviceId: string; kind: "button" | "axis"; inputIndex: number; value: number; }
export const hotasDevices = (): Promise<HotasDevice[]> => invoke<HotasDevice[]>("hotas_devices");
export const hotasCapture = (deviceId: string, kind: "button" | "axis", timeoutMs: number): Promise<HotasEvent> =>
  invoke<HotasEvent>("hotas_capture", { deviceId, kind, timeoutMs });
/** Native HTML report persistence. Old PDF command is retained only for backwards compatibility. */
export const saveHtmlReport = (kind: "bgs" | "commandes", html: string): Promise<string> =>
  invoke<string>("save_html_report", { kind, html });

// EDCH-BGS-PDF-v1.4.3
export const bgsSavePdf = (bytes: Uint8Array): Promise<string> =>
  invoke<string>("bgs_save_pdf", { data: Array.from(bytes) });

// ----- mobile access (local server) -----
export interface RemoteInfo {
  port: number;
  addresses: string[];
}
export const remoteStart = (token: string, port: number) => invoke<RemoteInfo>("remote_start", { token, port });
export const remoteStop = () => invoke<void>("remote_stop");
export const remotePublish = (state: string) => invoke<void>("remote_publish", { state });
export const remoteQr = (text: string) => invoke<string>("remote_qr", { text });
export const remoteAddresses = () => invoke<string[]>("remote_addresses");
/** This PC's Tailscale address (100.x.y.z), or null when Tailscale isn't running. */
export interface NetAddress {
  ip: string;
  kind: "ethernet" | "wifi" | "tailscale" | "vpn";
  /** Network name as Windows shows it (Wi-Fi name, or the LAN's name such as "ASUS"). */
  network: string;
  /** Adapter name ("Wi-Fi", "Ethernet 2"…). */
  adapter: string;
}
export const remoteInterfaces = () => invoke<NetAddress[]>("remote_interfaces").catch(() => [] as NetAddress[]);
export const remoteTailscale = () => invoke<string | null>("remote_tailscale").catch(() => null);
export async function onRemoteAction(cb: (action: any) => void): Promise<void> {
  if (!isTauri()) return;
  await window.__TAURI__!.event.listen<any>("remote-action", (e) => cb(e.payload));
}

/** Phone side: wait for the next state published by the PC (long poll). */
export async function remoteState(since: number): Promise<{ version: number; state: any }> {
  return remoteJson(`/api/state?since=${since}`);
}
export async function remoteAction(action: unknown): Promise<void> {
  await remoteJson("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
}

/** Live link to a wing's ntfy topic (Rust keeps the connection open and pushes each line). */
export const ntfySubscribe = (topic: string, since: string) => invoke<void>("ntfy_subscribe", { topic, since });
/** The encrypted "leaving" message Rust sends when EDCH closes (null: nothing to send). */
export const ntfySetFarewell = (topic: string, text: string | null) =>
  invoke<void>("ntfy_set_farewell", { topic, text }).catch(() => undefined);
export const ntfyUnsubscribe = () => invoke<void>("ntfy_unsubscribe").catch(() => undefined);
export async function onNtfy(
  line: (topic: string, text: string) => void,
  state: (topic: string, connected: boolean, message?: string | null) => void,
): Promise<() => void> {
  const ev = window.__TAURI__!.event;
  const a = await ev.listen<{ topic: string; line: string }>("ntfy-line", (e) => line(e.payload.topic, e.payload.line));
  const b = await ev.listen<{ topic: string; connected: boolean; message?: string | null }>("ntfy-state", (e) =>
    state(e.payload.topic, e.payload.connected, e.payload.message),
  );
  return () => {
    a();
    b();
  };
}
export const clipboardWrite = (text: string) => invoke<void>("clipboard_write", { text });
export const gameRunning = () => invoke<string>("game_running").catch(() => "");
/** Is Elite Dangerous the window in front: "yes", "no", or "unknown" (not on Windows). */
export const gameFocused = () => invoke<string>("game_focused").catch(() => "unknown");
export const launchGame = (method: string, path: string) => invoke<void>("launch_game", { method, path });
export const setCloseBehavior = (mode: string) => invoke<void>("set_close_behavior", { mode }).catch(() => undefined);
export const appQuit = () => invoke<void>("app_quit");
export async function onConfirmClose(cb: () => void): Promise<void> {
  if (!isTauri() || remote) return;
  await window.__TAURI__!.event.listen("confirm-close", () => cb());
}
export const setFullscreen = (on: boolean) =>
  isTauri() && !remote ? invoke<void>("set_fullscreen", { on }).catch(() => undefined) : Promise.resolve();
export const openPageInBrowser = (view: string) => invoke<void>("open_page_in_browser", { view });
export const logWrite = (level: string, source: string, message: string) =>
  invoke<void>("log_write", { level, source, message });
export const logSetDebug = (on: boolean) => invoke<string | null>("log_set_debug", { on });
export const logsOpen = () => invoke<string>("logs_open");
/** Writes missing-data.txt next to the logs (features/dataGaps/missingData.ts). */
export const missingDataSave = (text: string) => invoke<void>("missing_data_save", { text });
/** Shows missing-data.txt in the file explorer. */
export const missingDataShow = () => invoke<void>("missing_data_show");
/** Does missing-data.txt still exist (false: the player deleted it)? */
export const missingDataExists = () => invoke<boolean>("missing_data_exists");
/** Was a GitHub issue holding `reportId` created (public search)? */
export const missingDataReported = (reportId: string) => invoke<boolean>("missing_data_reported", { reportId });
/** Portable build (no installer): updates open the release page instead. */
/** How updates are installed: "installer" (Windows setup) or not ("portable", "linux", "macos": the release page opens). */
export const updateMode = () =>
  isTauri() && !isRemote() ? invoke<string>("update_mode").catch(() => "installer") : Promise.resolve("installer");
export const isPortable = () =>
  isTauri() && !isRemote() ? invoke<boolean>("is_portable").catch(() => false) : Promise.resolve(false);
export const installerLanguage = () =>
  isTauri() ? invoke<number | null>("installer_language").catch(() => null) : Promise.resolve(null);

export async function openUrl(url: string): Promise<void> {
  if (isTauri() && !remote) {
    await tauriInvoke("open_url", { url });
  } else {
    window.open(url, "_blank", "noopener");
  }
}

/**
 * Copies text to the clipboard. On a phone (remote), nothing is copied on the phone: the text
 * goes to the PC's clipboard, where the game runs.
 */
let copyHereToo = false;
/** On a phone: also copy on the phone itself (Settings option), besides the PC. */
export const setRemoteCopyHere = (on: boolean) => {
  copyHereToo = on;
};

export async function copyText(text: string): Promise<boolean> {
  if (remote) {
    if (copyHereToo) await localCopy(text);
    try {
      await remoteAction({ type: "clipboard", text });
      return true;
    } catch {
      return false;
    }
  }
  return localCopy(text);
}

async function localCopy(text: string): Promise<boolean> {
  // In the app, the backend writes the clipboard: the webview's clipboard refuses to write while
  // EDCH's window isn't focused, which is always the case when the copy follows a game event.
  if (isTauri() && !remote) {
    try {
      await invoke<void>("clipboard_write", { text });
      return true;
    } catch {
      /* the webview's clipboard below */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for webviews without clipboard permission.
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

// ----- updates (GitHub releases) -----
export interface UpdateInfo {
  version: string;
  current: string;
  notes: string;
  page: string;
  asset: string;
  url: string;
  size: number;
  digest: string | null;
}

/** `preReleases`: also offer pre-releases; `installed`: the tag this build was installed from. */
export const updateCheck = (preReleases: boolean, installed: string | null) =>
  invoke<UpdateInfo | null>("update_check", { preReleases, installed });
export const updateDownload = (info: UpdateInfo) => invoke<string>("update_download", { info });
export const updateInstall = (path: string) => invoke<void>("update_install", { path });
export async function onUpdateProgress(cb: (done: number, total: number) => void): Promise<() => void> {
  if (!isTauri()) return () => undefined;
  return window.__TAURI__!.event.listen<{ done: number; total: number }>("update-progress", (e) =>
    cb(e.payload.done, e.payload.total),
  );
}

/** Journal lines of the last `days` days for these events (start-up rebuild of the activity). */
export async function scanHistory(dir: string, days: number, events: string[]): Promise<string[]> {
  if (!isTauri() || remote) return [];
  return tauriInvoke<string[]>("scan_history", { dir, days, events });
}
