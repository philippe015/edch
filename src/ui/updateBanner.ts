// Automatic updates: compares this build with the latest GitHub release, offers it in a
// banner, downloads the installer on demand and restarts EDCH through it.

import {
  isRemote,
  isTauri,
  updateMode,
  onUpdateProgress,
  openUrl,
  updateCheck,
  updateDownload,
  updateInstall,
  type UpdateInfo,
} from "../platform/bridge.js";
import { h, replace, toast } from "./dom.js";
import { locale, t } from "../platform/i18n.js";
import { log } from "../platform/logger.js";
import { notify } from "./notifier.js";
import type { Store } from "../state/store.js";
import { buildTag } from "../platform/version.js";

const EVERY = 6 * 60 * 60 * 1000;

type Phase =
  | { kind: "hidden" }
  | { kind: "available"; info: UpdateInfo }
  | { kind: "downloading"; info: UpdateInfo; done: number; total: number }
  | { kind: "ready"; info: UpdateInfo; path: string }
  | { kind: "failed"; info: UpdateInfo; message: string };

let phase: Phase = { kind: "hidden" };
/** No installer (portable exe, Linux, macOS): "Update" opens the latest release page. */
let mode = "installer";
const selfInstall = () => mode === "installer";
let showNotes = false;

/** The release notes (CHANGELOG section, in English): bullet points before the install line. */
function notesList(notes: string): HTMLElement | null {
  const items = notes
    .split(/\n---/)[0]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*] /.test(l))
    .map((l) => l.slice(2).replace(/\*\*/g, "").replace(/`/g, ""));
  if (!items.length) return null;
  return h(
    "ul.update-notes",
    { "data-no-tr": "" },
    items.map((note) => h("li", null, note)),
  );
}
let bar: HTMLElement | null = null;
let store: Store | null = null;

const megabytes = (n: number) => (n / 1048576).toLocaleString(locale(), { maximumFractionDigits: 1 });

function render() {
  if (!bar) {
    bar = h("div#update-bar", { role: "status" });
    document.body.append(bar);
  }
  if (phase.kind === "hidden") {
    bar.classList.remove("show");
    return;
  }
  bar.classList.add("show");
  const p = phase;
  const close = h("button.ghost.small", { title: t("updater.later"), onclick: () => later() }, t("updater.later"));
  if (p.kind === "available") {
    replace(
      bar,
      h(
        "div.update-text",
        null,
        h("strong", null, t("updater.edchAvailable", { version: p.info.version })),
        h("span.sub", null, t("common.installedVersion", { current: p.info.current })),
        showNotes ? notesList(p.info.notes) : null,
        showNotes && p.info.page
          ? h("button.inline-link", { onclick: () => openUrl(p.info.page) }, t("updater.viewGithub"))
          : null,
      ),
      h(
        "div.row",
        null,
        h(
          "button.ghost.small",
          { onclick: () => ((showNotes = !showNotes), render()) },
          showNotes ? t("updater.hideWhatSNew") : t("updater.whatSNew"),
        ),
        close,
        selfInstall()
          ? h("button.primary.small", { onclick: () => download(p.info) }, t("updater.update"))
          : h(
              "button.primary.small",
              { onclick: () => openUrl(p.info.page || "https://github.com/philippe015/edch/releases/latest") },
              mode === "portable" ? t("updater.downloadPortableVersion") : t("updater.downloadNewVersion"),
            ),
      ),
    );
  } else if (p.kind === "downloading") {
    const pct = p.total > 0 ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0;
    replace(
      bar,
      h(
        "div.update-text",
        null,
        h("strong", null, t("updater.downloadingEdch", { version: p.info.version })),
        h(
          "span.sub",
          null,
          p.total > 0
            ? t("updater.mb", { pct, mb: megabytes(p.done), mb2: megabytes(p.total) })
            : t("updater.mb2", { mb: megabytes(p.done) }),
        ),
        h("div.update-progress", null, h("span", { style: { width: `${pct}%` } })),
      ),
    );
  } else if (p.kind === "ready") {
    replace(
      bar,
      h(
        "div.update-text",
        null,
        h("strong", null, t("updater.edchReady", { version: p.info.version })),
        h("span.sub", null, t("updater.restartAppFinishUpdateWillReopen")),
      ),
      h("div.row", null, close, h("button.primary.small", { onclick: () => install(p) }, t("updater.restartNow"))),
    );
  } else {
    replace(
      bar,
      h("div.update-text", null, h("strong", null, t("updater.updateFailed")), h("span.sub", null, p.message)),
      h("div.row", null, close, h("button.primary.small", { onclick: () => download(p.info) }, t("common.retry"))),
    );
  }
}

function later() {
  if (phase.kind === "hidden") return;
  // "Later" on an offer skips this version; a downloaded one is kept for the next start.
  if (phase.kind === "available" && store) store.updateSettings({ skippedVersion: phase.info.version });
  phase = { kind: "hidden" };
  render();
}

async function download(info: UpdateInfo) {
  log.info("update", `Downloading ${info.version}`);
  phase = { kind: "downloading", info, done: 0, total: info.size };
  render();
  const stop = await onUpdateProgress((done, total) => {
    if (phase.kind !== "downloading") return;
    phase = { ...phase, done, total };
    render();
  });
  try {
    const path = await updateDownload(info);
    phase = { kind: "ready", info, path };
  } catch (e) {
    phase = { kind: "failed", info, message: String((e as Error)?.message ?? e) };
    log.warn("update", `Download failed: ${phase.message}`);
  } finally {
    stop();
  }
  render();
}

/**
 * The tag this build was installed from by the updater ("v0.10.8-pre.64"): a pre-release build
 * has the version of its release (0.10.8), this tells which pre-release it is.
 */
const INSTALLED_KEY = "edch.installedTag";
function installedTag(): string | null {
  try {
    return localStorage.getItem(INSTALLED_KEY);
  } catch {
    return null;
  }
}

async function install(p: { info: UpdateInfo; path: string }) {
  try {
    try {
      localStorage.setItem(INSTALLED_KEY, `v${p.info.version}`);
    } catch {
      /* the next check takes this build for the release */
    }
    await updateInstall(p.path);
  } catch (e) {
    phase = { kind: "failed", info: p.info, message: String((e as Error)?.message ?? e) };
    render();
  }
}

/** Last answer of `findUpdate`, kept a few minutes so reopening Settings doesn't ask GitHub again. */
let lastFound: { at: number; preReleases: boolean; info: UpdateInfo | null } | null = null;
const FOUND_KEPT_MS = 10 * 60_000;

/**
 * The update GitHub offers this build (null: up to date), without showing anything. Throws on a
 * network or GitHub error.
 */
export async function findUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri() || isRemote() || !store) return null;
  const preReleases = store.state.settings.updatePreReleases;
  if (lastFound && lastFound.preReleases === preReleases && Date.now() - lastFound.at < FOUND_KEPT_MS)
    return lastFound.info;
  // The tag CI wrote into this build, else the one the updater installed (builds before 0.10.11).
  const installed = (await buildTag()) ?? installedTag();
  const info = await updateCheck(preReleases, installed);
  lastFound = { at: Date.now(), preReleases, info };
  return info;
}

/** Shows the update banner for `info` (Settings → "Update available"). */
export function offerUpdate(info: UpdateInfo) {
  if (phase.kind === "downloading" || phase.kind === "ready") {
    render();
    return;
  }
  phase = { kind: "available", info };
  render();
}

/** Checks GitHub now. `manual`: also report "up to date" and errors, and ignore a skipped version. */
export async function checkForUpdate(manual = false): Promise<void> {
  if (!isTauri() || isRemote() || !store) return;
  if (phase.kind === "downloading" || phase.kind === "ready") {
    if (manual) render();
    return;
  }
  try {
    const info = await findUpdate();
    if (!info) {
      if (manual) toast(t("updater.edchUpDate"));
      return;
    }
    log.info("update", `Version ${info.version} available (installed ${info.current})`);
    if (!manual && info.version === store.state.settings.skippedVersion) return;
    phase = { kind: "available", info };
    if (!manual) notify(t("updater.edchAvailable", { version: info.version }), { sound: false });
    render();
  } catch (e) {
    log.warn("update", `Check failed: ${String((e as Error)?.message ?? e)}`);
    if (manual) toast(t("updater.couldnTCheck", { message: String((e as Error)?.message ?? e) }));
  }
}

/** At start-up (a few seconds in) and every 6 hours, when enabled in Settings. */
export function startUpdateChecks(s: Store) {
  store = s;
  if (!isTauri()) return;
  void updateMode().then((m) => (mode = m));
  const tick = () => {
    if (store?.state.settings.autoUpdate) void checkForUpdate(false);
  };
  window.setTimeout(tick, 5000);
  window.setInterval(tick, EVERY);
}
