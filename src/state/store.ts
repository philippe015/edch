// The app's state: settings, wishlist, current page and selection, the commander's state from
// the journal and the activity, saved in localStorage. Pages subscribe to it and redraw.

import { log } from "../platform/logger.js";
import { type ThemeSettings } from "./themeSettings.js";
import { DEFAULT_THEME } from "./themeSettings.js";
import { emptyActivity, type ActivityState } from "../game/activity/state.js";
import type { Game } from "../game/data.js";
import { emptyState, type CommanderState } from "../game/journal/state.js";
import type { Blueprint } from "../game/types.js";
import type { WatchStatus } from "../platform/bridge.js";
import { type SyncSettings } from "./syncSettings.js";
import { DEFAULT_SYNC } from "./syncSettings.js";

export interface Settings {
  journalDir: string;
  /** Minimum population for "high population" HGE searches. */
  hgeMinPopulation: number;
  /** Search radius around you, light years. */
  maxDistance: number;
  /** Ignore Spansh BGS data older than this many days for state-based searches. */
  maxAgeDays: number;
  /** Used when the game hasn't told us where we are yet. */
  fallbackSystem: string;
  largePadOnly: boolean;
  sync: SyncSettings;
  remote: RemoteSettings;
  /** Look for a new release on GitHub at start-up and every few hours. */
  autoUpdate: boolean;
  /** Also offer pre-releases (test builds) as updates. */
  updatePreReleases: boolean;
  /** A version the user chose to skip ("Plus tard" hides it until the next one). */
  skippedVersion: string;
  notify: NotifySettings;
  wing: WingSettings;
  mining: MiningSettings;
  theme: ThemeSettings;
  /** Writes a separate, detailed debug log (Settings → Logs). */
  debugLog: boolean;
  /** Clicking a system name also opens Navigation with it as destination. */
  systemOpensNav: boolean;
  /** Where "Export my ship" opens the current ship (Settings → Preferences). */
  buildSite: "edsy" | "coriolis";
  /** How to start the game from EDCH. */
  gameLaunch: { method: "steam" | "epic" | "exe"; path: string };
  /** What the window's close button does. */
  closeBehavior: "quit" | "minimize" | "tray" | "ask";
  /** Show what's new after an update. */
  showChangelog: boolean;
  /** Version whose news were last shown (empty: first start). */
  lastSeenVersion: string;
  /** Pages hidden from the menu (PC and phone). */
  hiddenViews: string[];
  /** Page to open at start-up ("" = the last one). */
  startView: string;
  /** Interface size, in percent. */
  uiScale: number;
  /** On a phone, also copy to the phone's own clipboard (the PC's always gets it). */
  copyOnPhone: boolean;
  /** Keyboard drawn on the Controls page ("auto": from the bindings file). */
  kbLayout: "auto" | "qwerty" | "azerty" | "qwertz";
  /** ISO (Europe: L-shaped Enter) or ANSI (US). */
  kbFormat: "auto" | "iso" | "ansi";
  /** Wishlist engineers and the engineer tour. */
  engineers: EngineerSettings;
  /** Navigation page: copy the next system of the ship route on arrival. */
  navAutoCopy: boolean;
  /** An EDCH notification (Notifications tab, sound if chosen) when a next jump is copied. */
  navNotifyCopy: boolean;
  /** Copy the next system to enter (route or engineer tour) when the game's window comes to the front (Windows). */
  copyOnGameFocus: boolean;
  /** Navigation: exact route with fuel (Spansh Galaxy Plotter) rather than the quick neutron route. */
  navExact: boolean;
  /** Menu order chosen in the menu's edit mode ("-" = a line between groups); empty = default. */
  navOrder: string[];
  /** Pages switched off for the phone in the menu's edit mode. */
  phoneHidden: string[];
}

/** How the Wishlist page opens: every line and the materials, or the engineer tour only. */
export type WishlistMode = "advanced" | "simple";

export interface EngineerSettings {
  /** Show one engineer per line (the best one) instead of the full list. */
  autoPick: boolean;
  /** Only engineers already in the journal (met, invited, unlocked…). */
  knownOnly: boolean;
  /** Leave out the engineers of the other region (Bubble / Colonia). */
  regionLimit: boolean;
  /** Longest engineer tour proposed, in ly (straight lines between stops). */
  maxTourLy: number;
  /** Tick wishlist lines off when the game says a modification was made (EngineerCraft). */
  autoTick: boolean;
  /** How the Wishlist page opens. */
  wishlistMode: WishlistMode;
}

export const DEFAULT_ENGINEER_SETTINGS: EngineerSettings = {
  autoPick: true,
  knownOnly: true,
  regionLimit: true,
  maxTourLy: 2000,
  autoTick: true,
  wishlistMode: "advanced",
};

export interface NotifySettings {
  sound: boolean;
  color: boolean;
  /** chime | beep | radar */
  tone: string;
  volume: number;
  /** CSS colour of the flashing tab. */
  flash: string;
  /** Hide the side tab entirely. */
  hideTab: boolean;
}

export interface WingSettings {
  enabled: boolean;
  /** Shared secret: everyone in the wing types the same code. */
  code: string;
  /** Name shown to the others; empty = commander name. */
  name: string;
  notifyNew: boolean;
  notifyAll: boolean;
  /** A wingmate accepted a mission I share. */
  notifyAccept: boolean;
  /** A wingmate closed EDCH or left the wing in game. */
  notifyLeave: boolean;
  /** Share every wing mission as soon as it's accepted (otherwise one by one). */
  autoShare: boolean;
  /** Ids of the missions shared by hand. */
  shared: number[];
  /** EDCH-BGS-WING-RECEIPTS-v1.4.9.1: explicit acknowledgements, scoped to the wing code. */
  manualReceived: { id: number; code: string; at: string }[];
}

export interface MiningSettings {
  /** Materials to call out when prospected, with the minimum percentage. */
  targets: { id: string; min: number }[];
  alert: boolean;
  /** Merit Miner: power (empty = pledged power) and minerals searched. */
  power: string;
  minerals: string[];
  /** Mining types hidden from the "Where to mine" results ("laser", "subsurface", "core"). */
  hiddenMethods: string[];
  /** How many of the last prospected asteroids the Mining page shows (1, 3 or 5). */
  shownAsteroids: number;
}

export const DEFAULT_NOTIFY: NotifySettings = {
  sound: true,
  color: true,
  tone: "chime",
  volume: 0.6,
  flash: "#ff7a18",
  hideTab: false,
};
export const DEFAULT_WING: WingSettings = {
  enabled: false,
  code: "",
  name: "",
  notifyNew: true,
  notifyAll: true,
  notifyAccept: true,
  notifyLeave: true,
  autoShare: false,
  shared: [],
  manualReceived: [],
};
export const DEFAULT_MINING: MiningSettings = {
  targets: [
    { id: "painite", min: 25 },
    { id: "platinum", min: 20 },
  ],
  alert: true,
  power: "",
  minerals: ["Platinum", "Painite", "Low Temperature Diamonds"],
  hiddenMethods: [],
  shownAsteroids: 3,
};

/** A wing code: 4 groups of 4 letters/digits (80 bits), easy to read out. */
export function newWingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

export interface RemoteSettings {
  enabled: boolean;
  port: number;
  /** Secret carried by the QR code; replacing it disconnects every paired device. */
  token: string;
  /** Address put in the QR code; "" = first detected LAN address. */
  host: string;
  /** Put the Tailscale address in the QR code and the link (access from anywhere). */
  tailscale: boolean;
}

export const DEFAULT_REMOTE: RemoteSettings = { enabled: false, port: 47800, token: "", host: "", tailscale: false };

export function newRemoteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface WishItem {
  id: string;
  /** `${kind}|${module}|${name}` */
  bp: string;
  gradeFrom: number;
  gradeTo: number;
  /** Rolls per grade for modifications. */
  rolls: Record<number, number>;
  /** How many times (e.g. 4 thrusters, 2 synthesis runs). */
  count: number;
  note?: string;
  /**
   * Imported builds: the ship's slots the line comes from (journal names, lower case, e.g.
   * "mediumhardpoint2"), so a module's effect stays tied to its own modification, and the ship
   * type (journal symbol, e.g. "krait_mkii"). Lines added by hand have neither.
   */
  slots?: string[];
  shipType?: string;
}

export interface AppState {
  cmdr: CommanderState;
  /** Missions, colonisation, goals, exploration… rebuilt from the journal archive. */
  activity: ActivityState;
  watch: WatchStatus;
  settings: Settings;
  wishlist: WishItem[];
  view: string;
  selected?: string; // material id in the detail panel
  /** Elite Dangerous on the PC: "game", "launcher" or "" (not running); undefined = unknown. */
  game?: string;
}

const DEFAULT_SETTINGS: Settings = {
  journalDir: "",
  hgeMinPopulation: 1_000_000,
  maxDistance: 300,
  maxAgeDays: 3,
  fallbackSystem: "Sol",
  largePadOnly: false,
  sync: DEFAULT_SYNC,
  remote: DEFAULT_REMOTE,
  autoUpdate: true,
  updatePreReleases: false,
  skippedVersion: "",
  notify: DEFAULT_NOTIFY,
  wing: DEFAULT_WING,
  mining: DEFAULT_MINING,
  theme: DEFAULT_THEME,
  debugLog: false,
  systemOpensNav: false,
  buildSite: "edsy",
  gameLaunch: { method: "steam", path: "" },
  closeBehavior: "quit",
  showChangelog: true,
  lastSeenVersion: "",
  hiddenViews: [],
  startView: "",
  uiScale: 100,
  copyOnPhone: false,
  kbLayout: "auto",
  kbFormat: "auto",
  engineers: DEFAULT_ENGINEER_SETTINGS,
  navAutoCopy: false,
  navNotifyCopy: true,
  copyOnGameFocus: true,
  navExact: true,
  navOrder: [],
  phoneHidden: [],
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function loadArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

type Listener = (state: AppState) => void;

export class Store {
  state: AppState;
  private listeners = new Set<Listener>();
  private scheduled = false;

  constructor() {
    this.state = {
      // Last known state is shown instantly at startup, then the journal replay overwrites it.
      cmdr: { ...emptyState(), ...load<CommanderState>("edc.cmdr", emptyState()) },
      activity: emptyActivity(),
      watch: { state: "idle" },
      settings: (() => {
        const loaded = load<Settings>("edc.settings", DEFAULT_SETTINGS);
        return {
          ...loaded,
          sync: { ...DEFAULT_SYNC, ...(loaded.sync ?? {}) },
          remote: { ...DEFAULT_REMOTE, ...(loaded.remote ?? {}) },
          notify: { ...DEFAULT_NOTIFY, ...(loaded.notify ?? {}) },
          wing: { ...DEFAULT_WING, ...(loaded.wing ?? {}) },
          mining: { ...DEFAULT_MINING, ...(loaded.mining ?? {}) },
          theme: { ...DEFAULT_THEME, ...(loaded.theme ?? {}) },
          engineers: { ...DEFAULT_ENGINEER_SETTINGS, ...(loaded.engineers ?? {}) },
        };
      })(),
      wishlist: loadArray<WishItem>("edc.wishlist"),
      view: (() => {
        try {
          return localStorage.getItem("edc.view") ?? "materials";
        } catch {
          return "materials";
        }
      })(),
    };
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Coalesces bursts (journal replay) into one render per frame. */
  notify() {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      for (const fn of this.listeners) fn(this.state);
    });
  }

  persistCmdr() {
    save("edc.cmdr", this.state.cmdr);
  }

  setView(view: string) {
    if (view !== this.state.view) log.debug("ui", `View: ${view}`);
    this.state.view = view;
    save("edc.view", view);
    this.notify();
  }

  select(id?: string) {
    this.state.selected = id;
    this.notify();
  }

  updateSettings(patch: Partial<Settings>) {
    // Only the names of the changed settings: values can hold API keys.
    log.debug("settings", `Changed: ${Object.keys(patch).join(", ")}`);
    this.state.settings = { ...this.state.settings, ...patch };
    save("edc.settings", this.state.settings);
    this.notify();
  }

  /** Called after a local wishlist change (the phone forwards it to the PC). */
  onWishlistChange?: (items: WishItem[]) => void;

  setWishlist(items: WishItem[], fromRemote = false) {
    log.debug("wishlist", `${items.length} line(s)${fromRemote ? " (from the phone)" : ""}`);
    this.state.wishlist = items;
    save("edc.wishlist", items);
    this.notify();
    if (!fromRemote) this.onWishlistChange?.(items);
  }
}

export const bpKey = (bp: Blueprint) => `${bp.kind}|${bp.module}|${bp.name}`;

/** Grades of one blueprint, keyed by grade (0 for blueprints without grades). */
export function blueprintGrades(game: Game, key: string): Map<number, Blueprint> {
  const map = new Map<number, Blueprint>();
  for (const bp of game.data.blueprints) if (bpKey(bp) === key) map.set(bp.grade ?? 0, bp);
  return map;
}

/** Default rolls for a modification grade: one per grade level is a fair average with a max-rank engineer. */
export const defaultRolls = (grade: number) => Math.max(1, grade);

/** Materials needed by one wishlist line. */
export function wishNeeds(game: Game, item: WishItem): Record<string, number> {
  const grades = blueprintGrades(game, item.bp);
  const needs: Record<string, number> = {};
  const addAll = (bp: Blueprint, times: number) => {
    for (const [id, n] of Object.entries(bp.ingredients)) needs[id] = (needs[id] ?? 0) + n * times;
  };
  if (grades.has(0) || grades.size === 1) {
    const bp = grades.get(0) ?? [...grades.values()][0];
    if (bp) addAll(bp, item.count);
    return needs;
  }
  for (let g = item.gradeFrom; g <= item.gradeTo; g++) {
    const bp = grades.get(g);
    if (!bp) continue;
    const rolls = bp.kind === "modification" ? (item.rolls[g] ?? defaultRolls(g)) : 1;
    addAll(bp, rolls * item.count);
  }
  return needs;
}

export function totalNeeds(game: Game, items: WishItem[]): Record<string, number> {
  const total: Record<string, number> = {};
  for (const item of items) {
    for (const [id, n] of Object.entries(wishNeeds(game, item))) total[id] = (total[id] ?? 0) + n;
  }
  return total;
}
