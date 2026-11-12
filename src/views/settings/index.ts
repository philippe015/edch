// Settings page: the tabs (General, Game and search, Display, Notifications, Advanced) and the
// cards that are not in cards/ (language, updates, journal folder, Spansh search).

import { defaultJournalDir, isRemote, isTauri, logsOpen, startJournal, updateMode } from "../../platform/bridge.js";
import { t } from "../../platform/i18n.js";
import { setDebugLog } from "../../platform/logger.js";
import type { Ctx, View } from "../../state/context.js";
import type { Settings } from "../../state/store.js";
import { h, replace, toast } from "../../ui/dom.js";
import { appearanceCard, pagesCard } from "./cards/display.js";
import { engineersCard, launchCard, navigationCard } from "./cards/game.js";
import { appCard } from "./cards/general.js";
import { updatesCard } from "./cards/updates.js";
import { StorageCard } from "./cards/storage.js";
import { buildSiteCard, keyboardCard, languageCard, pageDefaultsCard } from "./cards/preferences.js";
import { notifyCard } from "./cards/notifications.js";

const TABS: [string, string][] = [
  ["general", t("settings.general")],
  ["preferences", t("settings.preferences")],
  ["game", t("settings.gameSearch")],
  ["display", t("settings.display")],
  ["notifications", t("common.notifications")],
  ["advanced", t("settings.advanced")],
];

let currentTab = (() => {
  try {
    return localStorage.getItem("edc.settingsTab") ?? "general";
  } catch {
    return "general";
  }
})();

/** Opens Settings on a given tab (links from other pages). */
export function openSettingsTab(store: { setView(view: string): void }, tab: string) {
  currentTab = tab;
  store.setView("settings");
}

export class SettingsView implements View {
  private root?: HTMLElement;
  constructor(
    private ctx: Ctx,
    private restart: () => void,
  ) {}

  private mode = "installer";
  private storageCard = new StorageCard();
  private debugPath: string | null = null;

  mount(root: HTMLElement) {
    this.root = root;
    this.render();
    void updateMode().then((m) => {
      if (m !== this.mode) {
        this.mode = m;
        this.render();
      }
    });
    if (this.ctx.store.state.settings.debugLog) {
      void setDebugLog(true).then((path) => {
        this.debugPath = path;
        this.render();
      });
    }
  }

  // Inputs keep focus: only re-render on mount.
  update() {
    const status = this.root?.querySelector(".watch-status");
    if (status) status.textContent = this.statusText();
  }

  private statusText(): string {
    const w = this.ctx.store.state.watch;
    if (w.state === "live") return t("settings.readingLive", { file: w.file ?? "" });
    if (w.state === "waiting") return w.message ?? t("settings.waitingGame");
    if (w.state === "error") return t("settings.error", { message: w.message ?? "" });
    if (w.state === "demo") return t("settings.demoModeBrowserSampleJournal");
    return t("settings.readingStopped");
  }

  private render() {
    if (!this.root) return;
    const s = this.ctx.store.state.settings;
    const set = (patch: Partial<Settings>) => this.ctx.store.updateSettings(patch);
    const number = (
      label: string,
      value: number,
      key: keyof Settings,
      help: string,
      attrs: Record<string, string> = {},
    ) =>
      h(
        "label.field",
        null,
        h("span", null, label),
        h("input", {
          type: "number",
          value: String(value),
          ...attrs,
          onchange: (e: Event) => set({ [key]: Number((e.target as HTMLInputElement).value) } as Partial<Settings>),
        }),
        h("small", null, help),
      );

    const dir = h("input", {
      type: "text",
      value: s.journalDir,
      placeholder: "C:\\Users\\…\\Saved Games\\Frontier Developments\\Elite Dangerous",
      spellcheck: false,
    });

    const body = h(
      "div.settings",
      null,
      languageCard(this.ctx),
      pageDefaultsCard(this.ctx),
      keyboardCard(this.ctx),
      buildSiteCard(this.ctx),
      isTauri() ? updatesCard(this.ctx, this.mode) : null,
      isTauri() && !isRemote() ? appCard(this.ctx, () => this.render()) : null,
      isTauri() && !isRemote() ? launchCard(this.ctx, () => this.render()) : null,
      h(
        "section.card",
        { "data-tab": "game" },
        h("h3", null, t("settings.gameJournal")),
        h("p.sub.watch-status", null, this.statusText()),
        h("label.field.wide", null, h("span", null, t("settings.journalFolder")), dir),
        h(
          "div.row",
          null,
          h(
            "button.ghost",
            {
              disabled: !isTauri(),
              onclick: async () => {
                const found = await defaultJournalDir();
                if (found) dir.value = found;
              },
            },
            t("settings.detect"),
          ),
          h(
            "button.primary",
            {
              disabled: !isTauri(),
              onclick: async () => {
                set({ journalDir: dir.value.trim() });
                try {
                  this.restart();
                  await startJournal(dir.value.trim());
                  toast(t("settings.journalReadingStarted"));
                } catch (e) {
                  toast(String(e));
                }
              },
            },
            t("settings.saveRead"),
          ),
        ),
      ),
      h(
        "section.card",
        { "data-tab": "preferences" },
        h("h3", null, t("settings.systemSearchSpansh")),
        number(t("settings.maxDistanceLy"), s.maxDistance, "maxDistance", t("settings.searchRadiusAroundLocation"), {
          min: "10",
          max: "5000",
          step: "10",
        }),
        number(
          t("settings.minPopulationHighGradeEmissions"),
          s.hgeMinPopulation,
          "hgeMinPopulation",
          t("settings.highPopulation1000000Default"),
          { min: "0", step: "100000" },
        ),
        number(
          t("settings.maxBgsDataAgeDays"),
          s.maxAgeDays,
          "maxAgeDays",
          t("settings.ignoresOlderFactionStatesBoomWar"),
          { min: "0", max: "60" },
        ),
        h(
          "label.field",
          null,
          h("span", null, t("settings.fallbackSystem")),
          h("input", {
            type: "text",
            value: s.fallbackSystem,
            onchange: (e: Event) => set({ fallbackSystem: (e.target as HTMLInputElement).value.trim() || "Sol" }),
          }),
          h("small", null, t("settings.usedUntilGameReportsLocation")),
        ),
        h(
          "label.check",
          null,
          h("input", {
            type: "checkbox",
            checked: s.largePadOnly,
            onchange: (e: Event) => set({ largePadOnly: (e.target as HTMLInputElement).checked }),
          }),
          " " + t("settings.tradersLPadOnly"),
        ),
        h(
          "label.check",
          null,
          h("input", {
            type: "checkbox",
            checked: s.copyOnPhone,
            onchange: (e: Event) => set({ copyOnPhone: (e.target as HTMLInputElement).checked }),
          }),
          " " + t("settings.fromPhoneAlsoCopyPhoneS"),
        ),
      ),
      navigationCard(this.ctx, () => this.render()),
      engineersCard(this.ctx, () => this.render()),
      notifyCard(this.ctx, () => this.render()),
      pagesCard(this.ctx, () => this.render()),
      appearanceCard(this.ctx, () => this.render()),
      isTauri() && !isRemote() ? this.storageCard.render() : null,
      isTauri() && !isRemote() ? this.logsCard() : null,
    );
    // Tabs: each card says which tab it belongs to (data-tab).
    const cards = [...body.children] as HTMLElement[];
    const tabOf = (card: HTMLElement) => card.dataset.tab ?? "general";
    const tabs = TABS.filter(([id]) => cards.some((c) => tabOf(c) === id));
    if (!tabs.some(([id]) => id === currentTab)) currentTab = tabs[0]?.[0] ?? "general";
    for (const c of cards) c.hidden = tabOf(c) !== currentTab;
    replace(
      this.root,
      h(
        "header.view-head",
        null,
        h("h1", null, t("common.settings")),
        h(
          "div.segmented.settings-tabs",
          null,
          tabs.map(([id, label]) =>
            h("button", { class: id === currentTab ? "active" : "", onclick: () => this.showTab(id) }, label),
          ),
        ),
      ),
      body,
    );
  }

  private showTab(id: string) {
    currentTab = id;
    try {
      localStorage.setItem("edc.settingsTab", id);
    } catch {
      /* not kept: fine */
    }
    this.render();
    this.root?.scrollTo?.({ top: 0 });
  }

  private logsCard(): HTMLElement {
    const on = this.ctx.store.state.settings.debugLog;
    return h(
      "section.card",
      { "data-tab": "advanced" },
      h("h3", null, t("settings.applicationLogs")),
      h("p.sub", null, t("settings.edchAlwaysRecordsWhatDoesStandard")),
      h(
        "label.check",
        null,
        h("input", {
          type: "checkbox",
          checked: on,
          onchange: async (e: Event) => {
            const value = (e.target as HTMLInputElement).checked;
            this.ctx.store.updateSettings({ debugLog: value });
            this.debugPath = await setDebugLog(value);
            this.render();
          },
        }),
        " " + t("settings.debugModeAlsoWritesDetailedLog"),
      ),
      h("p.sub", null, t("settings.debugLogContainsEverythingStandardLog")),
      on && this.debugPath ? h("p.sub", { "data-no-tr": "" }, this.debugPath) : null,
      h(
        "div.row",
        null,
        h(
          "button.ghost",
          {
            onclick: () => logsOpen().catch((e) => toast(t("common.canTOpenFolder", { e }))),
          },
          t("common.openLogsFolder"),
        ),
      ),
    );
  }
}
