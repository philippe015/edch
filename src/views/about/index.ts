// About page: version, credits and licences of the data and tools EDCH uses, how to report a bug
// (with what a debug log contains and never contains), and a word from the author.

import { isRemote, isTauri, logsOpen, openUrl, updateMode } from "../../platform/bridge.js";
import { missingDataCard } from "./missingDataCard.js";
import { h, icon, replace, toast } from "../../ui/dom.js";
import { SOFTWARE_VERSION } from "../../platform/version.js";
import { showChangelog } from "../../ui/changelog.js";
import type { Ctx, View } from "../../state/context.js";
import { t } from "../../platform/i18n.js";

const REPO = "https://github.com/BKNadir/edch";

/** The projects EDCH relies on: name, what they bring, links (site first, then repository). */
const PROJECTS: { name: string; what: string; links: [string, string][] }[] = [
  {
    name: "Spansh",
    what: t("about.everySystemStationCommoditySearchRoutes"),
    links: [["spansh.co.uk", "https://spansh.co.uk"]],
  },
  {
    name: "EDDN (EDCD)",
    what: t("about.networkSharesGameDataBetweenPlayers"),
    links: [["github.com/EDCD/EDDN", "https://github.com/EDCD/EDDN"]],
  },
  {
    name: "EDCD / FDevIDs",
    what: t("about.gameSOfficialIdentifiersNames"),
    links: [["github.com/EDCD/FDevIDs", "https://github.com/EDCD/FDevIDs"]],
  },
  { name: "EDSM", what: t("about.syncingFlightLogWhatCommunityKnows"), links: [["edsm.net", "https://www.edsm.net"]] },
  { name: "Inara", what: t("about.syncingCommanderProfile"), links: [["inara.cz", "https://inara.cz"]] },
  {
    name: "EDEngineer (msarilar)",
    what: t("about.engineeringRecipesMaterialOriginsPartTranslation"),
    links: [["github.com/msarilar/EDEngineer", "https://github.com/msarilar/EDEngineer"]],
  },
  {
    name: "d47 (dseelinger)",
    what: t("about.edengineerSEngineersDataGatheredCorrected"),
    links: [["github.com/dseelinger/d47", "https://github.com/dseelinger/d47"]],
  },
  {
    name: "Elite Dangerous Almanac",
    what: t("about.gameSOfficialTranslatedNamesMaterials"),
    links: [
      ["github.com/Elite-Dangerous-Almanac/Almanac-Core", "https://github.com/Elite-Dangerous-Almanac/Almanac-Core"],
    ],
  },
  {
    name: "EDDI (EDCD)",
    what: t("about.eddiTranslatedRanksStates"),
    links: [["github.com/EDCD/EDDI", "https://github.com/EDCD/EDDI"]],
  },
  {
    name: "EDR (lekeno)",
    what: t("about.exobiologySpeciesNamesJournalWritesThem"),
    links: [["github.com/lekeno/edr", "https://github.com/lekeno/edr"]],
  },
  {
    name: "ntfy.sh",
    what: t("about.freeRelayCarriesWingSEncrypted"),
    links: [
      ["ntfy.sh", "https://ntfy.sh"],
      ["github.com/binwiederhier/ntfy", "https://github.com/binwiederhier/ntfy"],
    ],
  },
  {
    name: "EDRefCard (Richard Buckle)",
    what: t("about.controlNamesPicturesHotasJoysticksPads"),
    links: [["github.com/richardbuckle/EDRefCard", "https://github.com/richardbuckle/EDRefCard"]],
  },
  {
    name: "EDSY",
    what: t("about.buildExportFormatImportedIntoWishlist"),
    links: [
      ["edsy.org", "https://edsy.org"],
      ["github.com/taleden/EDSY", "https://github.com/taleden/EDSY"],
    ],
  },
  {
    name: "Coriolis (EDCD)",
    what: t("about.buildExportFormatImportedIntoWishlist2"),
    links: [
      ["coriolis.io", "https://coriolis.io"],
      ["github.com/EDCD/coriolis", "https://github.com/EDCD/coriolis"],
      ["github.com/EDCD/coriolis-data", "https://github.com/EDCD/coriolis-data"],
    ],
  },
  {
    name: "EDMarketConnector (EDCD)",
    what: t("about.inspirationEddnEdsmInaraSync"),
    links: [["github.com/EDCD/EDMarketConnector", "https://github.com/EDCD/EDMarketConnector"]],
  },
  {
    name: "Odyssey Materials Helper (Jixxed)",
    what: t("about.originalInspirationEdch"),
    links: [["github.com/jixxed/ed-odyssey-materials-helper", "https://github.com/jixxed/ed-odyssey-materials-helper"]],
  },
  {
    name: "Tauri",
    what: t("about.frameworkRunsAppWindows"),
    links: [
      ["tauri.app", "https://tauri.app"],
      ["github.com/tauri-apps/tauri", "https://github.com/tauri-apps/tauri"],
    ],
  },
];

const link = (label: string, url: string) =>
  h("button.inline-link", { "data-no-tr": "", onclick: () => openUrl(url) }, label);

export class AboutView implements View {
  constructor(private ctx: Ctx) {}

  mount(root: HTMLElement) {
    void this.ctx;
    replace(
      root,
      h(
        "header.view-head",
        null,
        h(
          "div",
          null,
          h("h1", null, t("about.aboutEdch")),
          h("p.sub", null, t("about.version", { SOFTWAREVERSION: SOFTWARE_VERSION })),
        ),
      ),
      h(
        "div.about",
        null,
        h(
          "section.card",
          null,
          h("h3", null, "EDCH — Elite Dangerous Companion Helper"),
          h("p", null, t("about.lightweightCompanionEliteDangerousLiveInventory")),
        ),
        h(
          "section.card.about-author",
          null,
          h("h3", null, t("about.author")),
          h("p", null, t("about.dreamtUpFlown") + " ", h("strong", { "data-no-tr": "" }, "CMDR MDLuffy"), "."),
          h("p.sub", null, t("about.thanksUsingEdchIfCrossPaths")),
        ),
        h(
          "section.card.about-community-contribution",
          null,
          h("h3", null, t("about.communityContributorTitle")),
          h(
            "p",
            null,
            h("strong", { "data-no-tr": "" }, "Cyberpunk Philou"),
            " — ",
            t("about.communityContributorDescription"),
          ),
        ),
        supportCard(),
        h(
          "section.card",
          null,
          h("h3", null, t("about.usefulLinks")),
          h(
            "ul.about-links",
            null,
            h("li", null, "📦 ", h("span", null, t("about.sourceCode")), " ", link("github.com/BKNadir/edch", REPO)),
            h(
              "li",
              null,
              "💡 ",
              h("span", null, t("about.suggestIdea")),
              " ",
              h("button.inline-link", { onclick: () => openUrl(`${REPO}/issues/new`) }, t("about.openIssue")),
            ),
            h(
              "li",
              null,
              "📝 ",
              h("span", null, t("about.whatSNewEachVersion")),
              " ",
              h("button.inline-link", { onclick: () => showChangelog() }, t("about.version2")),
              " · ",
              h("button.inline-link", { onclick: () => openUrl(`${REPO}/releases`) }, "Releases"),
            ),
          ),
        ),
        this.bugCard(),
        missingDataCard(),
        h(
          "section.card",
          null,
          h("h3", null, t("about.goodKnow")),
          h(
            "ul.notes",
            null,
            h("li", null, t("about.edchNotReplacementCommunitySOther")),
            h("li", null, t("about.wasLargelyWrittenAiClaudeAnthropic")),
            h("li", null, t("about.freeUnofficialNonCommercialCommunityTool")),
          ),
        ),
        h(
          "section.card",
          null,
          h("h3", null, t("about.thank")),
          h("p", null, t("about.edchWouldNotWorkWithoutThese")),
          h(
            "div.thanks",
            null,
            PROJECTS.map((p) =>
              h(
                "div.thanks-row",
                null,
                h("strong", { "data-no-tr": "" }, p.name),
                h("span.sub", null, p.what),
                h(
                  "span.thanks-links",
                  null,
                  p.links.flatMap(([label, url], i) => (i ? [" · ", link(label, url)] : [link(label, url)])),
                ),
              ),
            ),
          ),
        ),
        h(
          "section.card",
          null,
          h("p.sub", null, t("about.eliteDangerousTrademarkFrontierDevelopmentsPlc")),
          h("p.sub", null, t("about.licencesDetails") + " ", link("NOTICE", `${REPO}/blob/main/NOTICE`)),
        ),
      ),
    );
  }

  /** How to report a bug: a GitHub issue with the debug log, and what that log contains. */
  private bugCard(): HTMLElement {
    const app = isTauri() && !isRemote();
    const newIssue = async () => {
      const mode = await updateMode();
      const kind =
        mode === "installer"
          ? "Windows, installed"
          : mode === "portable"
            ? "Windows, portable"
            : mode === "linux"
              ? "Linux"
              : mode;
      const body = [
        `**EDCH version:** ${SOFTWARE_VERSION} (${kind})`,
        "",
        "**What I was doing**",
        "",
        "",
        "**What happened (and what I expected)**",
        "",
        "",
        "**Debug log**",
        "(drag the newest edch-debug_….log here, and edch-error_….log if there is one)",
      ].join("\n");
      void openUrl(
        `${REPO}/issues/new?labels=bug&title=${encodeURIComponent("[Bug] ")}&body=${encodeURIComponent(body)}`,
      );
    };
    return h(
      "section.card.bug-card",
      null,
      h("h3", null, t("about.reportBug")),
      h("p", null, t("about.bugsAreReportedGithubDebugLog")),
      h(
        "ol.steps",
        null,
        h("li", null, t("about.settingsApplicationLogsTickDebugMode")),
        h("li", null, t("about.doThingGoesWrongAgain")),
        h("li", null, t("about.openLogsFolderTakeNewestEdch")),
        h("li", null, t("about.openIssueGithubExplainWhatWere")),
        h("li", null, t("about.thenUntickDebugModeFileGrows")),
      ),
      h(
        "div.row",
        null,
        app
          ? h(
              "button.ghost",
              { onclick: () => logsOpen().catch((e) => toast(t("common.canTOpenFolder", { e }))) },
              t("common.openLogsFolder"),
            )
          : null,
        h("button.primary", { onclick: newIssue }, icon("link"), " " + t("about.openIssueGithub")),
      ),
      h(
        "div.privacy",
        null,
        h("strong", null, t("about.whatLogContainsNeverContains")),
        h(
          "ul.notes",
          null,
          h("li", null, t("about.neverApiKeysEdsmInaraQr")),
          h("li", null, t("about.yesEdchSVersionPagesOpened")),
          h("li", null, t("about.logPlainTextFileCanRead")),
        ),
      ),
    );
  }

  update() {
    /* static page */
  }
}

/** Ko-fi page of the author: support is voluntary, nothing in EDCH depends on it. */
const SUPPORT_URL = "https://ko-fi.com/bknadir";

/** "Support EDCH": why support helps, and a button that opens the Ko-fi page in the browser. */
function supportCard(): HTMLElement {
  return h(
    "section.card.about-support",
    null,
    h("h3", null, t("support.title")),
    h("p", null, t("support.intro")),
    h("p", null, t("support.helps")),
    h(
      "ul.support-reasons",
      null,
      h("li", null, t("support.reasonTools")),
      h("li", null, t("support.reasonTime")),
      h("li", null, t("support.reasonSigning")),
    ),
    h("p.sub", null, t("support.thanks")),
    h("div.row", null, h("button.primary", { onclick: () => void openUrl(SUPPORT_URL) }, "☕ " + t("support.button"))),
  );
}
