// Discreet notifications: a short sound and/or a coloured flash on the side tab. No Windows pop-ups.
// The side tab opens a small overview panel; another click (anywhere) closes it.

import { h, replace } from "./dom.js";
import { log } from "../platform/logger.js";
import type { Store } from "../state/store.js";
import { t } from "../platform/i18n.js";

let audio: AudioContext | null = null;

function audioContext(): AudioContext | null {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    return audio;
  } catch {
    return null;
  }
}

function note(
  ac: AudioContext,
  start: number,
  freq: number,
  dur: number,
  volume: number,
  type: OscillatorType = "sine",
  to?: number,
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export const TONES: [string, string][] = [
  ["chime", t("notifier.chime")],
  ["beep", t("notifier.beep")],
  ["radar", t("notifier.radar")],
  ["soft", t("notifier.soft")],
];

export function playTone(tone: string, volume: number) {
  const ac = audioContext();
  if (!ac) return;
  const v = Math.max(0, Math.min(1, volume)) * 0.35;
  const startAt = ac.currentTime + 0.02;
  if (tone === "beep") {
    note(ac, startAt, 1000, 0.09, v * 0.6, "square");
    note(ac, startAt + 0.14, 1000, 0.09, v * 0.6, "square");
  } else if (tone === "radar") {
    note(ac, startAt, 420, 0.45, v, "sine", 1250);
  } else if (tone === "soft") {
    note(ac, startAt, 523, 0.35, v * 0.8, "triangle");
    note(ac, startAt + 0.18, 659, 0.45, v * 0.8, "triangle");
  } else {
    note(ac, startAt, 880, 0.25, v);
    note(ac, startAt + 0.16, 1320, 0.4, v);
  }
}

export interface Alert {
  at: string;
  text: string;
}

let store: Store | null = null;
let tab: HTMLElement | null = null;
let panel: HTMLElement | null = null;
let badge: HTMLElement | null = null;
let renderPanel: () => (Node | null)[] = () => [];
let label = t("common.notifications");
const alerts: Alert[] = [];
let unseen = 0;

export const recentAlerts = () => alerts;

/** Removes one notification from the panel (the very object listed by `recentAlerts`). */
export function dismissAlert(alert: Alert) {
  const index = alerts.indexOf(alert);
  if (index < 0) return;
  alerts.splice(index, 1);
  unseen = Math.min(unseen, alerts.length);
  if (!unseen) tab?.classList.remove("flash");
  refresh();
}

/** Empties the panel's list of notifications and stops the tab's flash. */
export function clearAlerts() {
  alerts.length = 0;
  unseen = 0;
  tab?.classList.remove("flash");
  refresh();
}

/** Plays the chosen sound and/or flashes the tab, and keeps the message in the panel. */
export function notify(text: string, opts: { sound?: boolean } = {}) {
  if (!store) return;
  log.info("notify", text);
  const n = store.state.settings.notify;
  alerts.unshift({ at: new Date().toISOString(), text });
  alerts.length = Math.min(alerts.length, 15);
  unseen += 1;
  if (n.sound && opts.sound !== false) playTone(n.tone, n.volume);
  if (n.color && tab) {
    tab.style.setProperty("--flash", n.flash);
    tab.classList.add("flash");
  }
  refresh();
}

function close() {
  panel?.classList.remove("open");
}

function toggle(e: Event) {
  e.stopPropagation();
  if (!panel) return;
  const opening = !panel.classList.contains("open");
  panel.classList.toggle("open", opening);
  if (opening) {
    unseen = 0;
    tab?.classList.remove("flash");
    refresh();
  }
}

/** Redraws the badge and, when open, the panel. */
export function refresh() {
  if (!tab || !panel || !store) return;
  const hidden = store.state.settings.notify.hideTab;
  tab.hidden = hidden;
  if (hidden) close();
  if (badge) {
    badge.textContent = unseen ? String(unseen) : "";
    badge.hidden = !unseen;
  }
  if (panel.classList.contains("open")) replace(panel, ...renderPanel().filter(Boolean));
}

export function setTabLabel(text: string) {
  label = text;
  const span = tab?.querySelector(".side-tab-label");
  if (span) span.textContent = label;
}

/** EDCH-NOTIFICATIONS-V148: neutralize legacy CSS rotations in the actual WebKitGTK DOM. */
function forceReadableSideTab() {
  if (!tab) return;
  const orient = (element: HTMLElement) => {
    element.setAttribute("dir", "ltr");
    element.style.setProperty("direction", "ltr", "important");
    element.style.setProperty("writing-mode", "horizontal-tb", "important");
    element.style.setProperty("text-orientation", "mixed", "important");
    element.style.setProperty("transform", "none", "important");
    element.style.setProperty("unicode-bidi", "isolate", "important");
  };
  orient(tab);
  tab.style.setProperty("flex-direction", "row", "important");
  // Never force display: the [hidden] / focus-mode rules must keep working.
  const label = tab.querySelector<HTMLElement>(".side-tab-label");
  if (label) {
    orient(label);
    label.style.setProperty("white-space", "nowrap", "important");
  }
  const counter = tab.querySelector<HTMLElement>(".side-tab-badge");
  if (counter) orient(counter);
  tab.dataset.edchNotificationsFix = "v148";
}

/** Mounts the side tab once; `render` builds the panel's content each time it opens or refreshes. */
export function mountSideTab(s: Store, render: () => (Node | null)[]) {
  store = s;
  renderPanel = render;
  badge = h("span.side-tab-badge", { hidden: true });
  tab = h(
    "button.side-tab",
    { title: t("notifier.overview"), onclick: toggle },
    h("span.side-tab-label", null, label),
    badge,
  );
  panel = h("div.side-panel", { onclick: (e: Event) => e.stopPropagation() });
  document.body.append(tab, panel);
  forceReadableSideTab();
  document.addEventListener("click", close);
  document.addEventListener("keydown", (e) => e.key === "Escape" && close());
  refresh();
}
