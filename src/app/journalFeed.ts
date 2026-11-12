// EDCH-BGS-v1.1
// Journal feed (PC): starts reading the game's journal and applies what arrives to the store:
// journal lines, the journal's status, and the companion files (Status, Market, Cargo,
// ShipLocker). Live events also go to the data sharing services and to the live features.

import { readAuxFile, startJournal, defaultJournalDir, onJournal, type WatchStatus } from "../platform/bridge.js";
import { backendMessage, t } from "../platform/i18n.js";
import { eventDetail, log } from "../platform/logger.js";
import { applyCargoFile, applyMarketFile, applyStatus } from "../game/journal/companionFiles.js";
import { applyLines, applyLocker } from "../game/journal/events.js";
import { emptyState, type Json } from "../game/journal/state.js";
import type { Store } from "../state/store.js";
import { clearAlert, goTo, inStartup, startupAlert } from "../ui/alerts.js";
import type { Uploaders } from "../services/sync/index.js";
import { loadHistory, onLiveEvents } from "../features/missions/live.js";
import { recordLiveArrivals } from "../features/bgs/live.js";
import { resetCommanderJournalContext } from "../features/bgs/commander.js";
import { startBgsTickMonitor } from "../features/bgs/monitor.js";
// EDCH-COG-AGENT-JOURNAL-v1.5.0
import { enqueueAgentEvents } from "../features/agent/runtime.js";

/** Material capacity by id (from the game data), for the journal's material events. */
type CapacityOf = (id: string) => number | undefined;

let replaying = true;

/** Rebuilds the commander's state from the journal (start-up, or after a folder change). */
export function replayJournal(store: Store) {
  resetCommanderJournalContext();
  store.state.cmdr = emptyState();
  replaying = true;
  store.notify();
  void loadHistory(store.state.settings.journalDir);
}

/** Shows the journal's status, with a banner when it can't be read. */
export function setWatch(store: Store, status: WatchStatus) {
  // The backend sends codes ("noJournalFiles"): shown in the app's language.
  const w = status.message ? { ...status, message: backendMessage(status.message) } : status;
  store.state.watch = w;
  if (w.state === "live") clearAlert("journal");
  else if (w.state === "error")
    startupAlert("journal", t("main.gameJournalUnreadable"), w.message ?? "", goTo("settings", t("common.settings")));
  else if (w.state === "waiting" && inStartup())
    startupAlert(
      "journal",
      t("main.noGameJournalFound"),
      w.message ?? t("main.checkJournalFolderSettings"),
      goTo("settings", t("common.settings")),
    );
  if (w.state === "live" || w.state === "waiting") {
    replaying = false;
    store.persistCmdr();
  }
  store.notify();
}

/** Reads a companion file and applies it; a half-written file is ignored (the next write fixes it). */
function readCompanionFile(store: Store, name: string, apply: (json: Json) => boolean) {
  const dir = store.state.settings.journalDir;
  if (!dir) return;
  readAuxFile(dir, name)
    .then((text) => {
      if (apply(JSON.parse(text))) store.notify();
    })
    .catch(() => undefined);
}

/** Starts the journal feed. */
export async function startJournalFeed(store: Store, sync: Uploaders, capacityOf: CapacityOf) {
  const watch = (w: WatchStatus) => setWatch(store, w);
  let saveTimer: number | undefined;
  let uploads = Promise.resolve();
  sync.start();
  startBgsTickMonitor();
  await onJournal({
    batch: (b) => {
      const { changed, events } = applyLines(store.state.cmdr, b.lines, capacityOf);
      // Time-ordered journal correlation: historical batches repair saved rows only.
      recordLiveArrivals(events, store.state.cmdr.commander, Boolean(b.replay));
      if (!b.replay) {
        // Never count replayed historical journals as fresh BGS patrol visits.
        onLiveEvents(events);
        enqueueAgentEvents(events); // live events only; no replay, no raw I/O
        if (log.debugOn && events.length) {
          log.debug("journal", `Events: ${events.map((e) => e.event).join(", ")}`);
          for (const e of events) {
            const d = eventDetail(e);
            if (d) log.debug("journal", d);
          }
        }
      }
      // Uploads run in order; nothing from the startup replay is ever sent.
      uploads = uploads.then(async () => {
        for (const ev of events) await sync.handle(ev, !b.replay);
      });
      // Cargo events often only give the total: the hold's content is in Cargo.json.
      if (!b.replay && events.some((e) => e.event === "Cargo" && !e.Inventory && (e.Vessel ?? "Ship") === "Ship")) {
        readCompanionFile(store, "Cargo.json", (json) => applyCargoFile(store.state.cmdr, json));
      }
      // The Market event's goods are in Market.json: read it at once (a carrier's market is live data).
      if (!b.replay && events.some((e) => e.event === "Market")) {
        readCompanionFile(store, "Market.json", (json) => applyMarketFile(store.state.cmdr, json));
      }
      // ShipLocker events often only say "look at ShipLocker.json".
      if (events.some((e) => e.event === "ShipLocker" && !e.Items)) {
        readCompanionFile(store, "ShipLocker.json", (json) => applyLocker(store.state.cmdr, json));
      }
      if (changed) {
        store.notify();
        if (!replaying) {
          window.clearTimeout(saveTimer);
          saveTimer = window.setTimeout(() => store.persistCmdr(), 2000);
        }
      }
    },
    status: watch,
    aux: (a) => {
      try {
        if (a.name === "Status.json") {
          if (applyStatus(store.state.cmdr, JSON.parse(a.content))) store.notify();
          return;
        }
        if (a.name === "Market.json") {
          if (applyMarketFile(store.state.cmdr, JSON.parse(a.content))) {
            log.debug("carrier", "Carrier market read from Market.json");
            store.notify();
          }
          return;
        }
        if (a.name === "Cargo.json") {
          if (applyCargoFile(store.state.cmdr, JSON.parse(a.content))) store.notify();
          return;
        }
        if (a.name !== "ShipLocker.json") return;
        if (applyLocker(store.state.cmdr, JSON.parse(a.content))) store.notify();
      } catch {
        /* half-written file: the next change will fix it */
      }
    },
  });

  let dir = store.state.settings.journalDir;
  if (!dir) {
    dir = (await defaultJournalDir()) ?? "";
    if (dir) store.updateSettings({ journalDir: dir });
  }
  if (dir) {
    replayJournal(store);
    startJournal(dir).catch((e) => watch({ state: "error", message: String(e) }));
  } else {
    watch({ state: "error", message: t("main.setJournalFolderSettings") });
  }
}
