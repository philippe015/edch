// EDCH-BGS-v1.2: influence history, conservative route planner and report export
// BGS & Patrols extension for EDCH 0.10.11. Only public Spansh/EDCD requests; private data stays local.
import { bgsSaveJson, bgsSavePdf, isRemote, isTauri, spanshPost } from "../../platform/bridge.js";
import { diagnoseBgsReliability, verifyBgsSnapshot } from "../../features/bgs/reliability.js"; // EDCH-BGS-RELIABILITY-v1.4.9
import { buildBgsReportPdf } from "../../features/bgs/reportPdf.js";
import { currentTick, refreshTick, type TickResult } from "../../features/bgs/monitor.js";
import { withVisits } from "../../features/bgs/utils.js";
import {
  commanderCsv,
  commanderKey,
  commanderSummary,
  readCommanderLog,
  setCommanderFaction,
} from "../../features/bgs/commander.js";
import {
  factionSystemCounts,
  factionSystemRows,
  factionSystemStatus,
  factionSystemsCsv,
  type FactionSystemFilter,
} from "../../features/bgs/factionSystems.js";
// EDCH-BGS-v1.4.2
// EDCH-BGS-v1.4.1
import { parseBgsBackup } from "../../features/bgs/importSafety.js";
// EDCH-BGS-v1.4
import { planPatrolRoute, routeCsv } from "../../features/bgs/routes.js";
import { sparklinePath, trendAlerts, trendCsv, trendOf, trendsSummary } from "../../features/bgs/trends.js";
import { notify } from "../../ui/notifier.js";
// EDCH-COG-AGENT-JOURNAL-v1.5.0
import { agentEnabled, agentStatus, setAgentEnabled } from "../../features/agent/runtime.js";
// EDCH-BGS-WORKSPACE-v1.5.1
import { mountBgsWorkspace } from "./workspace.js";
import { localSqlite, readBgs, recordVisitDb, sqliteHealth, writeBgs } from "../../features/bgs/sqlite.js";
import { clipboardWrite } from "../../platform/bridge.js";
import type { Ctx, View } from "../../state/context.js";
import { referenceOf } from "../../state/context.js";
import { h, replace } from "../../ui/dom.js";
import {
  ageDays,
  csvOf,
  defaultBgs,
  fetchFactionPages,
  keyOf,
  mergeSearch,
  patrolCategory,
  patrolOrder,
  patrolScore,
  type BgsState,
  type BgsSystem,
} from "../../features/bgs/core.js";

import {
  cleanFactionName,
  rememberedFactions,
  sameFactionName,
  validFactionSnapshot,
} from "../../features/bgs/factionChoice.js"; // EDCH-BGS-FACTION-SWITCH-v1.4.9.2

const KEY = "edch.bgs.custom.v1";
const MAX_IMPORT_BYTES = 2_000_000;
function load(): BgsState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw && typeof raw.faction === "string" && Array.isArray(raw.systems) && Array.isArray(raw.history))
      return raw as BgsState;
  } catch {
    /* localStorage disabled */
  }
  return defaultBgs();
}
function store(value: BgsState) {
  try {
    const encoded = JSON.stringify(value);
    localStorage.setItem(KEY, encoded);
    localStorage.setItem(`${KEY}.faction.${encodeURIComponent(value.faction.trim().toLocaleLowerCase())}`, encoded);
    return true;
  } catch {
    return false;
  }
}
function loadFaction(faction: string): BgsState {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(`${KEY}.faction.${encodeURIComponent(faction.toLocaleLowerCase())}`) ?? "null",
    );
    if (validFactionSnapshot(parsed, faction)) return parsed;
  } catch {
    /* no previous data */
  }
  return { ...defaultBgs(), faction };
}
function download(filename: string, text: string, contentType: string) {
  const url = URL.createObjectURL(new Blob([text], { type: contentType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
const date = (value?: string): string => (value ? new Date(value).toLocaleString("fr-FR") : "Inconnue");
const percent = (x?: number) => (x === undefined ? "?" : `${x.toFixed(1)} %`);
const viewAge = (dt?: string) => {
  const days = ageDays(dt);
  return days === undefined ? "inconnue" : `${days.toFixed(1)} j`;
};
const field = (placeholder: string, initial = "", onInput?: (value: string) => void) =>
  h("input", {
    type: "text",
    placeholder,
    value: initial,
    oninput: (e: Event) => onInput?.((e.target as HTMLInputElement).value),
  });
const btn = (label: string, onClick: () => void, disabled = false) =>
  h("button.ghost.small", { onclick: onClick, disabled }, label);
function refOf(ctx: Ctx): Record<string, unknown> {
  const ref = referenceOf(ctx);
  return ref.coords
    ? { reference_coords: { x: ref.coords[0], y: ref.coords[1], z: ref.coords[2] } }
    : { reference_system: ref.system || "Sol" };
}

export class BgsView implements View {
  private root?: HTMLElement;
  private state: BgsState = load();
  private factionInput = this.state.faction;
  private busy = false;
  private importing = false;
  private progress = "";
  private message = "";
  private selected = "all";
  private search = "";
  private run = 0;
  private loadRun = 0;
  private loading = false;
  private queue: Promise<void> = Promise.resolve();
  private sqliteError = "";
  private routeMaxLy = 15;
  private routeStops = 15;
  private myFactionSearch = "";
  private myFactionFilter: FactionSystemFilter = "all";
  private myFactionPage = 0;
  private myFactionAutoKey = "";
  private trendSystem = "";
  constructor(private ctx: Ctx) {
    window.addEventListener("edch-agent-status", () => {
      const node = this.root?.querySelector("#edch-agent-status");
      if (node) node.textContent = agentStatus();
    });
    window.addEventListener("edch-bgs-cmdr-event", () => this.renderCommanderOverview());
    window.addEventListener("edch-bgs-visit", (ev: Event) => {
      const visit = (ev as CustomEvent<{ system: string; at: string }>).detail;
      if (!visit || !this.state.systems.some((s) => s.name.toLowerCase() === visit.system.toLowerCase())) return;
      this.state.systems = this.state.systems.map((s) =>
        s.name.toLowerCase() === visit.system.toLowerCase() && (!s.lastVisitedAt || visit.at > s.lastVisitedAt)
          ? { ...s, lastVisitedAt: visit.at }
          : s,
      );
      this.changed();
    });
    window.addEventListener("edch-bgs-tick", (ev: Event) => {
      const tick = (ev as CustomEvent<TickResult>).detail;
      if (!tick || (this.state.tickAt && tick.tickAt < this.state.tickAt)) return;
      this.state.tickAt = tick.tickAt;
      this.state.tickCheckedAt = tick.checkedAt;
      if (tick.changed) {
        this.message = "Nouveau tick détecté : actualisez Spansh lorsque ses données auront été publiées.";
        notify("BGS : nouveau tick communautaire signalé par EDCD (actualisation Spansh conseillée).");
      }
      this.changed();
    });
  }
  mount(root: HTMLElement) {
    this.root = root;
    this.render();
    void this.loadFromSqlite(this.state.faction).then(() => this.loadCommanderFactionOnOpen());
  }
  /** SQLite is authoritative when it exists; v1.0 localStorage is migrated on first launch. */
  private async loadFromSqlite(faction: string) {
    const id = ++this.loadRun;
    if (!localSqlite()) return;
    this.loading = true;
    this.render();
    try {
      const saved = await readBgs(faction);
      if (id !== this.loadRun) return;
      let state = this.state;
      if (saved.snapshot) {
        const parsed: unknown = JSON.parse(saved.snapshot);
        if (
          parsed &&
          typeof parsed === "object" &&
          "faction" in parsed &&
          "systems" in parsed &&
          "history" in parsed &&
          typeof parsed.faction === "string" &&
          parsed.faction.toLowerCase() === faction.toLowerCase() &&
          Array.isArray(parsed.systems) &&
          Array.isArray(parsed.history)
        )
          state = parsed as BgsState;
      }
      this.state = withVisits(state, saved.visits);
      const lastTick = currentTick();
      if (lastTick && (!this.state.tickAt || this.state.tickAt < lastTick)) this.state.tickAt = lastTick;
      this.sqliteError = "";
      this.changed(); // also migrates the former v1.0 localStorage snapshot
    } catch (error) {
      this.sqliteError = "SQLite indisponible : " + String((error as Error)?.message ?? error);
      this.render(); // keep the localStorage backup intact
    } finally {
      if (id === this.loadRun) {
        this.loading = false;
        this.render();
      }
    }
  }
  // Update ONLY the CMDR section when the journal changes; preserve search/filter inputs.
  update() {
    this.renderCommanderOverview();
    this.renderFactionSystems();
    this.loadCommanderFactionOnOpen();
  }
  private changed() {
    if (!store(this.state)) this.message = "Sauvegarde navigateur indisponible : exporter régulièrement les données.";
    if (localSqlite()) {
      const copy = JSON.parse(JSON.stringify(this.state)) as BgsState;
      // One write at a time, never replace a newer state with an older pending request.
      this.queue = this.queue
        .then(() => writeBgs(copy))
        .catch((error) => {
          this.sqliteError = "Écriture SQLite : " + String((error as Error)?.message ?? error);
          if (this.root?.isConnected) this.render();
        });
    }
    this.render();
  }
  // EDCH-BGS-FACTION-SWITCH-v1.4.9.2: change the monitored faction without deleting history.
  private async switchFaction() {
    const faction = cleanFactionName(this.factionInput);
    if (!faction) {
      this.message = "Nom de faction invalide (1 à 160 caractères).";
      this.render();
      return;
    }
    if (this.busy || this.loading || isRemote()) return;
    if (sameFactionName(faction, this.state.faction)) {
      this.factionInput = this.state.faction;
      this.message = `Faction déjà sélectionnée : ${this.state.faction}`;
      this.render();
      return;
    }
    this.busy = true;
    this.message = `Chargement local de ${faction}…`;
    this.render();
    try {
      await this.queue; // Previous faction's SQLite writes must finish first.
      if (!store(this.state) && !localSqlite()) throw new Error("Sauvegarde de l'ancienne faction indisponible");
      let next = loadFaction(faction);
      if (localSqlite()) {
        const saved = await readBgs(faction);
        if (saved.snapshot) {
          const parsed: unknown = JSON.parse(saved.snapshot);
          if (!validFactionSnapshot(parsed, faction)) throw new Error("Snapshot SQLite incohérent : autre faction");
          next = parsed;
        }
        next = withVisits(next, saved.visits);
      }
      const who = this.ctx.store.state.cmdr.commander?.trim();
      if (who && !setCommanderFaction(who, faction))
        throw new Error("Impossible d'associer la nouvelle faction au CMDR ; changement annulé");
      this.state = next;
      this.factionInput = this.state.faction;
      this.myFactionAutoKey = who ? who.toLocaleLowerCase() + "|" + faction.toLocaleLowerCase() : "";
      this.myFactionPage = 0;
      this.myFactionSearch = "";
      this.trendSystem = "";
      this.message = `Faction active : ${this.state.faction}. Données précédentes conservées séparément. Cliquez sur Actualiser Spansh pour rechercher les systèmes.`;
      this.changed();
    } catch (error) {
      this.message = `Changement refusé, faction initiale conservée : ${String((error as Error)?.message ?? error)}`;
      this.factionInput = this.state.faction;
      this.render();
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async retrieve() {
    const faction = this.factionInput.trim();
    if (!faction || this.busy) return;
    if (!sameFactionName(faction, this.state.faction)) {
      await this.switchFaction();
      if (!sameFactionName(faction, this.state.faction)) return; // Never request the wrong faction.
    }
    this.busy = true;
    this.message = "";
    this.progress = "Interrogation de Spansh…";
    this.render();
    const id = ++this.run;
    try {
      const result = await fetchFactionPages(faction, refOf(this.ctx), spanshPost, {
        pageSize: 100,
        maxPages: 30,
        onPage: (found, total) => {
          if (id === this.run) {
            this.progress = `${found} systèmes récupérés / ${total || "?"}`;
            this.render();
          }
        },
      });
      if (id !== this.run) return;
      if (result.systems.length === 0) this.message = "Aucune donnée de cette faction sur Spansh (vérifier le nom).";
      else {
        this.state = mergeSearch(this.state, result);
        this.message = result.partial
          ? `Recherche partielle : ${result.systems.length} systèmes. Les autres résultats restent possibles.`
          : `${result.systems.length} systèmes chargés depuis Spansh, ${result.pages} page(s).`;
      }
    } catch (e) {
      this.message = `Recherche interrompue : ${String((e as Error)?.message ?? e)}. Anciennes données conservées.`;
    } finally {
      this.busy = false;
      this.progress = "";
      this.changed();
    }
  }
  private async tick() {
    if (this.busy) return;
    this.busy = true;
    this.message = "";
    this.render();
    try {
      const tick = await refreshTick();
      this.state.tickAt = tick.tickAt;
      this.state.tickCheckedAt = tick.checkedAt;
      this.message = tick.changed
        ? "Nouveau tick communautaire : pensez à actualiser Spansh."
        : "Dernier tick communautaire à jour ; données indicatives.";
    } catch (e) {
      this.message = `Tick non disponible : ${String((e as Error)?.message ?? e)}`;
    } finally {
      this.busy = false;
      this.changed();
    }
  }
  private async diagnostic() {
    if (this.busy) return;
    this.busy = true;
    this.message = "Diagnostic SQLite, EDCD et Spansh…";
    this.render();
    const checks = await Promise.allSettled([
      sqliteHealth(),
      refreshTick(),
      spanshPost("systems/search", {
        filters: { name: { value: ["Sol"] } },
        reference_system: "Sol",
        size: 1,
        page: 0,
      }),
    ]);
    const labels = ["SQLite", "Tick EDCD", "Spansh"];
    this.message = checks
      .map(
        (check, i) => `${labels[i]} : ${check.status === "fulfilled" ? "OK" : "échec (" + String(check.reason) + ")"}`,
      )
      .join(" · ");
    this.busy = false;
    this.changed();
  }
  private updateSystem(key: string, patch: Partial<BgsSystem>) {
    this.state.systems = this.state.systems.map((s) => (keyOf(s) === key ? { ...s, ...patch } : s));
    this.changed();
  }
  private addSystem() {
    const value = window.prompt("Nom exact du système à surveiller (ajout manuel) :")?.trim();
    if (!value || this.state.systems.some((s) => s.name.toLocaleLowerCase() === value.toLocaleLowerCase())) return;
    this.state.systems.push({ name: value, states: [], retrievedAt: new Date().toISOString(), source: "manual" });
    this.changed();
  }
  // EDCH-BGS-RELIABILITY-v1.4.9: never replace BGS data until a native backup succeeds.
  private async importData(file: File) {
    if (this.importing) return;
    if (file.size > MAX_IMPORT_BYTES) {
      this.message = "Fichier trop volumineux (maximum 2 Mo).";
      this.render();
      return;
    }
    this.importing = true;
    try {
      const input = parseBgsBackup(await file.text());
      const hasData = this.state.systems.length > 0 || this.state.history.length > 0;
      let confirmation = "";
      if (hasData) {
        const existing = verifyBgsSnapshot(this.state);
        if (isTauri() && !isRemote()) {
          confirmation = await bgsSaveJson(existing.json);
          if (!confirmation) throw new Error("Chemin de sauvegarde BGS non confirmé");
        } else {
          // Web browsers cannot confirm that the user actually kept the downloaded file.
          const stamp = new Date().toISOString().replace(/[:.]/g, "-");
          download(`EDCH-BGS-avant-import-${stamp}.json`, existing.json, "application/json;charset=utf-8");
          if (
            !window.confirm(
              "Une sauvegarde JSON a été proposée au téléchargement. Vérifie qu'elle existe avant de remplacer les données BGS. Continuer ?",
            )
          ) {
            this.message = "Import annulé. Données BGS conservées.";
            return;
          }
        }
      }
      this.state = input;
      this.factionInput = input.faction;
      this.message = confirmation
        ? `Import validé ; sauvegarde précédente conservée : ${confirmation}`
        : "Import validé. Aucun historique précédent à sauvegarder ou confirmation utilisateur obtenue.";
      this.changed();
    } catch (e) {
      this.message = `Import refusé, données BGS conservées : ${String((e as Error)?.message ?? e)}`;
    } finally {
      this.importing = false;
      this.render();
    }
  }
  private async exportJson() {
    try {
      const backup = verifyBgsSnapshot(this.state);
      if (isTauri() && !isRemote()) {
        const path = await bgsSaveJson(backup.json);
        this.message = `Sauvegarde BGS JSON enregistrée : ${path}`;
      } else {
        download("EDCH-BGS-sauvegarde.json", backup.json, "application/json;charset=utf-8");
        this.message = "Téléchargement JSON demandé. Vérifie le fichier dans le navigateur.";
      }
    } catch (e) {
      this.message = `Échec sauvegarde BGS JSON : ${String((e as Error)?.message ?? e)}`;
    }
    this.render();
  }
  private diagnosticExport() {
    try {
      this.message = diagnoseBgsReliability(this.state, this.ctx.store.state.cmdr.commander).message;
    } catch (e) {
      this.message = `Diagnostic BGS/PDF : ${String((e as Error)?.message ?? e)}`;
    }
    this.render();
  }
  private exportCsv() {
    download("EDCH-BGS-patrouille.csv", "\ufeff" + csvOf(patrolOrder(this.filtered())), "text/csv;charset=utf-8");
  }
  private exportTrends() {
    download("EDCH-BGS-variations.csv", "\ufeff" + trendCsv(this.state), "text/csv;charset=utf-8");
  }
  private exportRoute() {
    download("EDCH-BGS-itineraire.csv", "\ufeff" + routeCsv(this.plannedRoute()), "text/csv;charset=utf-8");
  }
  private plannedRoute() {
    const ref = referenceOf(this.ctx);
    const current = ref.coords ? { name: ref.system ?? ref.label, coords: ref.coords } : undefined;
    return planPatrolRoute(this.filtered(), current, { maxLegLy: this.routeMaxLy, maxStops: this.routeStops });
  }
  // EDCH-BGS-PDF-v1.4.3: genuine PDF, saved by Rust on desktop (no WebKit blob download).
  private async exportReport() {
    try {
      const bytes = buildBgsReportPdf(this.state, { commander: this.ctx.store.state.cmdr.commander });
      if (isTauri() && !isRemote()) {
        const path = await bgsSavePdf(bytes);
        this.message = `Rapport PDF enregistré : ${path}`;
      } else {
        // Browser / remote mode: ordinary download, without needing a Tauri backend.
        const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
        try {
          const a = document.createElement("a");
          a.href = url;
          a.download = "EDCH-BGS-rapport.pdf";
          document.body.appendChild(a);
          a.click();
          a.remove();
          this.message = "Téléchargement PDF demandé au navigateur.";
        } finally {
          window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
        }
      }
    } catch (error) {
      this.message = `Échec export PDF : ${String((error as Error)?.message ?? error)}`;
    }
    this.render();
  }
  private renderTrendChart(system: BgsSystem): HTMLElement {
    const trend = trendOf(this.state, system);
    const chart = h("div.bgs-chart", null);
    if (trend.samples.length < 2)
      return h("p.sub", null, "Au moins deux observations datées distinctes sont nécessaires pour tracer l'influence.");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 240 60");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Historique de l'influence de ${system.name}, échelle de 0 à 100 %`);
    svg.setAttribute("class", "bgs-sparkline");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", sparklinePath(trend.samples));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#52b7e9");
    path.setAttribute("stroke-width", "2");
    svg.appendChild(path);
    chart.appendChild(svg);
    chart.appendChild(
      h(
        "p.sub",
        null,
        `Ancien : ${percent(trend.samples.at(-2)?.influence)} (${date(trend.earlierAt)}) · Récent : ${percent(trend.samples.at(-1)?.influence)} (${date(trend.latestAt)}) · Variation : ${trend.delta?.toFixed(2) ?? "?"} points`,
      ),
    );
    return chart;
  }
  private filtered(): BgsSystem[] {
    return this.state.systems.filter(
      (s) =>
        (this.selected === "all" || patrolCategory(s) === this.selected || (this.selected === "anchor" && s.anchor)) &&
        s.name.toLocaleLowerCase().includes(this.search.toLocaleLowerCase()),
    );
  }
  /** Personal CMDR page: journal facts and private local activity, not an influence predictor. */
  private renderCommanderOverview() {
    const box = this.root?.querySelector("#bgs-cmdr-overview");
    if (!box) return;
    const cmdr = this.ctx.store.state.cmdr;
    const who = cmdr.commander?.trim();
    if (!who) {
      replace(
        box,
        h(
          "section.card.bgs-panel",
          null,
          h("h2", null, "Mon CMDR · BGS"),
          h(
            "p.sub",
            null,
            "CMDR inconnu : lance Elite Dangerous et vérifie la lecture du journal dans EDCH. Aucune activité personnelle n'est attribuée sans identité vérifiée.",
          ),
        ),
      );
      return;
    }
    const profile = readCommanderLog(who);
    const preferred = profile.followedFaction ?? this.state.faction;
    const sameFaction = preferred.trim().toLocaleLowerCase() === this.state.faction.trim().toLocaleLowerCase();
    const location = cmdr.location;
    const present = location?.factions?.find((f) => f.name.toLocaleLowerCase() === preferred.toLocaleLowerCase());
    const controlledHere =
      !!location?.controllingFaction &&
      location.controllingFaction.toLocaleLowerCase() === preferred.toLocaleLowerCase();
    const summary = commanderSummary(profile, preferred, sameFaction ? this.state.systems.map((s) => s.name) : []);
    const displayDate = (d?: string) => (d ? new Date(d).toLocaleString("fr-FR") : "inconnue");
    const kindLabels: Record<string, string> = {
      jump: "Saut FSD",
      mission: "Mission terminée",
      "mission-accepted": "Mission acceptée",
      voucher: "Bon encaissé",
      "kill-bond": "Prime de faction",
      trade: "Vente commerciale",
      bounty: "Prime reçue",
      exploration: "Exploration vendue",
    };
    const recent = profile.entries.slice(-20).reverse();
    const stats = [
      ["Événements (30 j)", summary.entries30],
      ["Sauts FSD (30 j)", summary.jumps],
      ["Sauts en systèmes suivis (30 j)", summary.trackedJumps],
      ["Missions terminées (faction citée)", summary.missionForFaction],
      ["Événements liés à la faction", summary.linkedEvents],
      ["Activités sans faction identifiée", summary.unattributed],
    ];
    const statsEl = h(
      "div.bgs-stats",
      null,
      ...stats.map(([label, value]) =>
        h("div.card.bgs-stat", null, h("strong", null, String(value)), h("small", null, String(label))),
      ),
    );
    const around = (location?.factions ?? []).slice(0, 30);
    replace(
      box,
      h(
        "section.card.bgs-panel",
        null,
        h("h2", null, "Mon CMDR · Tableau BGS personnel"),
        h(
          "p.sub",
          null,
          "Profil issu du journal du jeu ; historique local propre à chaque CMDR. La faction suivie n'est pas une preuve d'appartenance à cette faction.",
        ),
        h(
          "div.bgs-actions",
          null,
          h("strong", null, "CMDR " + who),
          h("span", null, "Faction suivie : " + preferred),
          btn(
            "Associer la faction affichée à ce CMDR",
            () => {
              if (setCommanderFaction(who, this.state.faction)) {
                this.renderCommanderOverview();
                this.renderFactionSystems();
              }
            },
            profile.followedFaction === this.state.faction,
          ),
          btn(
            "Charger ma faction",
            () => {
              this.factionInput = preferred;
              void this.retrieve();
            },
            sameFaction || this.busy,
          ),
        ),
        h(
          "p",
          null,
          `Vaisseau : ${cmdr.ship?.name ?? cmdr.ship?.type ?? "inconnu"} · Version du jeu : ${cmdr.gameVersion ?? "inconnue"}`,
        ),
        h(
          "p",
          null,
          `Système actuel : ${location?.system ?? "inconnu"} · Station : ${location?.station ?? "inconnue"} · Dernier relevé du journal : ${displayDate(location?.seenAt)}`,
        ),
        h(
          "p.sub",
          null,
          `Coordonnées : ${location?.pos?.map((n) => n.toFixed(2)).join(" / ") ?? "non disponibles"} · Factions déjà rencontrées dans le journal : ${cmdr.knownFactions?.length ?? 0}`,
        ),
        h(
          "p",
          null,
          `BGS communautaire (${this.state.faction}) : ${this.state.systems.length} systèmes suivis, ${this.state.systems.filter((s) => s.controls).length} sous contrôle, dernier relevé ${displayDate(this.state.lastFetchedAt)}, tick EDCD ${displayDate(this.state.tickAt)}${this.state.partial ? " · résultats partiels" : ""}.`,
        ),
        h(
          "p",
          null,
          `Faction au pouvoir dans ce système : ${location?.controllingFaction ?? "inconnue"} · Faction suivie présente : ${present ? "oui" : "non attestée dans le journal"} · Contrôle : ${present ? (controlledHere ? "oui" : "non") : "non vérifié"}`,
        ),
        present
          ? h(
              "p",
              null,
              `Influence locale (journal) : ${present.influence === undefined ? "inconnue" : (present.influence <= 1 ? present.influence * 100 : present.influence).toFixed(2) + " %"} · État : ${present.state ?? "inconnu"} · États actifs : ${present.active.join(", ") || "aucun communiqué"}`,
            )
          : null,
        h(
          "p.sub",
          null,
          `Informations du système : ${location?.government ?? "gouvernement ?"} · ${location?.economy ?? "économie ?"} · Sécurité : ${location?.security ?? "?"} · Population : ${location?.population?.toLocaleString("fr-FR") ?? "?"}`,
        ),
        cmdr.knownFactions?.length
          ? h(
              "details",
              null,
              h("summary", null, `Factions rencontrées dans le journal (${cmdr.knownFactions.length})`),
              h("p.sub", null, "Leur présence dans cet historique ne signifie pas que le CMDR leur appartient."),
              h("ul", null, ...cmdr.knownFactions.slice(0, 100).map((f) => h("li", null, f))),
            )
          : null,
        around.length
          ? h(
              "details",
              null,
              h("summary", null, `Factions présentes dans le système (${around.length})`),
              h(
                "ul",
                null,
                ...around.map((f) =>
                  h(
                    "li",
                    null,
                    `${f.name} · Influence ${f.influence === undefined ? "?" : (f.influence <= 1 ? f.influence * 100 : f.influence).toFixed(1) + " %"} · État ${f.state ?? "?"}`,
                  ),
                ),
              ),
            )
          : null,
        !sameFaction
          ? h(
              "p.error",
              null,
              "Ce CMDR suit une autre faction que celle chargée dans l'onglet BGS : les totaux de systèmes suivis ne sont pas attribués à ce profil.",
            )
          : null,
        h("h3", null, "Activités confirmées par le journal · 30 derniers jours"),
        statsEl,
        h(
          "p.sub",
          null,
          "Les sauts et missions sont des activités observées, PAS des points d'influence gagnés. Une faction n'est attribuée à un événement que si son nom figure explicitement dans le journal. Le nombre d'événements conservés est limité à 1 200 par CMDR.",
        ),
        h(
          "div.bgs-actions",
          null,
          btn("Exporter activités CMDR CSV", () =>
            download(
              "EDCH-BGS-CMDR-activites.csv",
              "\ufeff" + commanderCsv(readCommanderLog(who)),
              "text/csv;charset=utf-8",
            ),
          ),
          btn("Sauvegarde activités CMDR JSON", () =>
            download(
              "EDCH-BGS-CMDR-sauvegarde.json",
              JSON.stringify(readCommanderLog(who), null, 2),
              "application/json;charset=utf-8",
            ),
          ),
          btn(
            "Effacer mon historique CMDR",
            () => {
              if (window.confirm("Supprimer uniquement l'historique BGS de ce CMDR enregistré dans EDCH ?")) {
                const key = commanderKey(who);
                if (key)
                  try {
                    localStorage.removeItem(key);
                  } catch {
                    /* readonly remote */
                  }
                this.renderCommanderOverview();
              }
            },
            profile.entries.length === 0,
          ),
        ),
        recent.length
          ? h(
              "div.bgs-table-scroll",
              null,
              h(
                "table.bgs-table",
                null,
                h(
                  "thead",
                  null,
                  h(
                    "tr",
                    null,
                    ...["Date", "Activité", "Système", "Faction(s) nommée(s)", "Crédits"].map((s) => h("th", null, s)),
                  ),
                ),
                h(
                  "tbody",
                  null,
                  ...recent.map((e) =>
                    h(
                      "tr",
                      null,
                      h("td", null, displayDate(e.at)),
                      h("td", null, kindLabels[e.kind] ?? e.kind),
                      h("td", null, e.system ?? "non indiqué"),
                      h("td", null, e.factions.join(" / ") || "non attribuée"),
                      h("td", null, e.amount === undefined ? "—" : e.amount.toLocaleString("fr-FR")),
                    ),
                  ),
                ),
              ),
            )
          : h(
              "p.sub",
              null,
              "Aucune activité enregistrée en direct pour ce CMDR. Les journaux historiques ne sont pas comptés rétroactivement.",
            ),
      ),
    );
  }

  /** Auto-load only a faction explicitly associated with the current CMDR. */
  private loadCommanderFactionOnOpen() {
    if (!this.root?.isConnected || this.busy || this.loading || isRemote()) return;
    const who = this.ctx.store.state.cmdr.commander?.trim();
    if (!who) return;
    const faction = readCommanderLog(who).followedFaction?.trim();
    if (!faction) return;
    const key = who.toLocaleLowerCase() + "|" + faction.toLocaleLowerCase();
    if (key === this.myFactionAutoKey) return;
    // Reuse cached faction data; otherwise load it from local SQLite + Spansh.
    this.myFactionAutoKey = key;
    if (faction.toLocaleLowerCase() === this.state.faction.toLocaleLowerCase() && this.state.systems.length) return;
    this.factionInput = faction;
    void this.retrieve();
  }

  /** Every Spansh page is displayed through paging, not just the first 500 rows. */
  private renderFactionSystems() {
    const box = this.root?.querySelector("#bgs-my-faction-systems");
    if (!box) return;
    const who = this.ctx.store.state.cmdr.commander?.trim();
    if (!who) {
      replace(
        box,
        h(
          "section.card.bgs-panel",
          null,
          h("h2", null, "Systèmes de ma faction"),
          h(
            "p.sub",
            null,
            "CMDR inconnu : connecte-toi dans Elite Dangerous pour associer une faction. Les systèmes BGS déjà recherchés restent accessibles plus bas.",
          ),
        ),
      );
      return;
    }
    const linkedFaction = readCommanderLog(who).followedFaction?.trim();
    const faction = linkedFaction || this.state.faction.trim();
    if (!faction) {
      replace(
        box,
        h(
          "section.card.bgs-panel",
          null,
          h("h2", null, "Systèmes de ma faction"),
          h("p.sub", null, "Aucune faction sélectionnée."),
        ),
      );
      return;
    }
    const sameFaction = faction.toLocaleLowerCase() === this.state.faction.trim().toLocaleLowerCase();
    const all = sameFaction ? this.state.systems : [];
    const totals = factionSystemCounts(all);
    const filtered = factionSystemRows(all, this.myFactionFilter, this.myFactionSearch);
    const pageSize = 100;
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    this.myFactionPage = Math.min(this.myFactionPage, pages - 1);
    const page = filtered.slice(this.myFactionPage * pageSize, (this.myFactionPage + 1) * pageSize);
    const category = (s: (typeof all)[number]) => {
      const kind = factionSystemStatus(s);
      return kind === "controlled" ? "Contrôlé" : kind === "present" ? "Présente" : "Non vérifié (manuel)";
    };
    const fetchMyFaction = () => {
      this.factionInput = faction;
      void this.retrieve();
    };
    const summaryText = linkedFaction
      ? `Faction associée à CMDR ${who} : ${faction}`
      : `Faction recherchée : ${faction} (non encore associée à CMDR ${who})`;
    const statuses = [
      ["all", "Tous"],
      ["controlled", "Contrôlés"],
      ["present", "Présence"],
      ["unverified", "Non vérifiés"],
    ] as const;
    replace(
      box,
      h(
        "section.card.bgs-panel",
        null,
        h("h2", null, "Systèmes de ma faction"),
        h("p.sub", null, summaryText),
        !linkedFaction
          ? h(
              "p.sub",
              null,
              "Tu peux associer cette faction à ton CMDR avec le bouton du tableau personnel situé juste au-dessus.",
            )
          : null,
        !sameFaction
          ? h(
              "p.error",
              null,
              "Une autre faction est actuellement chargée. Ses systèmes ne sont pas attribués à ce CMDR.",
            )
          : null,
        h(
          "div.bgs-actions",
          null,
          btn(
            this.busy ? "Recherche en cours…" : "Charger / actualiser mes systèmes",
            fetchMyFaction,
            this.busy || this.loading || isRemote(),
          ),
          sameFaction && totals.total
            ? btn("Exporter toute ma faction CSV", () => {
                download(
                  "EDCH-BGS-systemes-faction.csv",
                  "\ufeff" + factionSystemsCsv(faction, all),
                  "text/csv;charset=utf-8",
                );
              })
            : null,
        ),
        h(
          "div.bgs-stats",
          null,
          ...[
            ["Systèmes relevés", totals.total],
            ["Contrôlés", totals.controlled],
            ["Présente sans contrôle confirmé", totals.present],
            ["Non vérifiés", totals.unverified],
          ].map(([name, number]) =>
            h("div.card.bgs-stat", null, h("strong", null, String(number)), h("small", null, String(name))),
          ),
        ),
        h(
          "p.sub",
          null,
          `Dernière recherche : ${date(sameFaction ? this.state.lastFetchedAt : undefined)} · ` +
            (sameFaction && this.state.partial
              ? `Liste partielle : ${totals.total} résultats reçus sur ${this.state.reportedTotal ?? "?"} annoncés.`
              : sameFaction && this.state.lastFetchedAt
                ? "Résultats de la recherche enregistrée ; données communautaires susceptibles d'évoluer."
                : "Aucune recherche enregistrée pour cette faction."),
        ),
        sameFaction && totals.total
          ? h(
              "div.bgs-actions",
              null,
              h(
                "select",
                {
                  value: this.myFactionFilter,
                  onchange: (e: Event) => {
                    this.myFactionFilter = (e.target as HTMLSelectElement).value as FactionSystemFilter;
                    this.myFactionPage = 0;
                    this.renderFactionSystems();
                  },
                },
                ...statuses.map(([id, label]) =>
                  h("option", { value: id, selected: id === this.myFactionFilter }, label),
                ),
              ),
              h("input", {
                type: "search",
                placeholder: "Rechercher un système",
                value: this.myFactionSearch,
                onchange: (e: Event) => {
                  this.myFactionSearch = (e.target as HTMLInputElement).value;
                  this.myFactionPage = 0;
                  this.renderFactionSystems();
                },
              }),
              h("span.sub", null, `${filtered.length} affichables · page ${this.myFactionPage + 1}/${pages}`),
              btn(
                "Précédent",
                () => {
                  this.myFactionPage--;
                  this.renderFactionSystems();
                },
                this.myFactionPage === 0,
              ),
              btn(
                "Suivant",
                () => {
                  this.myFactionPage++;
                  this.renderFactionSystems();
                },
                this.myFactionPage >= pages - 1,
              ),
            )
          : null,
        sameFaction && totals.total
          ? h(
              "div.bgs-table-scroll",
              null,
              h(
                "table.bgs-table",
                null,
                h(
                  "thead",
                  null,
                  h(
                    "tr",
                    null,
                    ...[
                      "Système",
                      "Présence / contrôle",
                      "Influence",
                      "États",
                      "Distance",
                      "MAJ des données",
                      "Dernière visite",
                      "Action",
                    ].map((s) => h("th", null, s)),
                  ),
                ),
                h(
                  "tbody",
                  null,
                  ...page.map((s) =>
                    h(
                      "tr",
                      null,
                      h("td", null, h("strong", null, s.name)),
                      h("td", null, category(s)),
                      h("td", null, percent(s.influence)),
                      h("td", null, s.states.join(" / ") || "non précisés"),
                      h("td", null, s.distance === undefined ? "?" : s.distance.toFixed(1) + " AL"),
                      h("td", null, date(s.updatedAt)),
                      h("td", null, date(s.lastVisitedAt)),
                      h(
                        "td",
                        null,
                        btn("Copier", () => {
                          void clipboardWrite(s.name).catch(() => navigator.clipboard?.writeText(s.name));
                        }),
                      ),
                    ),
                  ),
                ),
              ),
            )
          : h(
              "p.sub",
              null,
              this.busy
                ? "Chargement des systèmes…"
                : sameFaction
                  ? "Aucun système chargé pour cette faction. Utilise « Charger / actualiser mes systèmes »."
                  : "Charge la faction associée au CMDR pour voir ses systèmes.",
            ),
        h(
          "p.sub",
          null,
          "Seuls les systèmes présents dans les relevés Spansh sont attestés. Les ajouts manuels restent « non vérifiés ». Influence et contrôle peuvent être obsolètes ; une recherche partielle ne signifie pas que la faction est absente des autres systèmes.",
        ),
      ),
    );
  }

  private render() {
    const root = this.root;
    if (!root) return;
    const systems = patrolOrder(this.filtered()).slice(0, 500);
    const total = this.state.systems.length;
    const stale = this.state.systems.filter((s) => (ageDays(s.updatedAt) ?? Infinity) >= 7).length;
    const alerts = trendAlerts(this.state);
    const summary = trendsSummary(this.state);
    const route = this.plannedRoute();
    const controls = this.state.systems.filter((s) => s.controls).length;
    const fieldFaction = field("Nom de la faction", this.factionInput, (value) => {
      this.factionInput = value;
    });
    fieldFaction.setAttribute("list", "edch-bgs-saved-factions");
    const factionsList = h(
      "datalist",
      { id: "edch-bgs-saved-factions" },
      ...rememberedFactions(
        localStorage,
        this.state.faction,
        this.ctx.store.state.cmdr.commander
          ? readCommanderLog(this.ctx.store.state.cmdr.commander).followedFaction
          : undefined,
      ).map((name) => h("option", { value: name })),
    );
    const selection =
      this.state.systems.find((s) => s.name === this.trendSystem) ??
      this.state.systems.find((s) => trendOf(this.state, s).samples.length >= 2) ??
      this.state.systems[0];
    if (selection && !this.trendSystem) this.trendSystem = selection.name;
    const controlsBar = h(
      "div.bgs-actions",
      null,
      fieldFaction,
      factionsList,
      btn("Changer de faction", () => void this.switchFaction(), this.busy || this.loading || isRemote()),
      btn(
        this.busy ? "Recherche en cours" : "Actualiser Spansh",
        () => void this.retrieve(),
        this.busy || this.loading || isRemote(),
      ),
      btn("Rafraîchir tick", () => void this.tick(), this.busy || isRemote()),
      btn("Diagnostic", () => void this.diagnostic(), this.busy || this.loading || isRemote()),
      btn(agentEnabled() ? "Arrêter agent journal" : "Activer agent journal", () => {
        setAgentEnabled(!agentEnabled());
        this.render();
      }, isRemote()),
      h("span#edch-agent-status.sub", null, agentStatus()),
      btn("+ Système", () => this.addSystem()),
    );
    const filterSelect = h(
      "select",
      {
        onchange: (e: Event) => {
          this.selected = (e.target as HTMLSelectElement).value;
          this.render();
        },
      },
      ...[
        ["all", "Tous"],
        ["unknown", "Visite inconnue"],
        ["over3", "> 3 jours"],
        ["over7", "> 7 jours"],
        ["anchor", "Ancrages"],
      ].map(([value, text]) => h("option", { value, selected: this.selected === value }, text)),
    );
    const searchInput = field("Filtrer les systèmes", this.search, (value) => {
      this.search = value;
    });
    searchInput.addEventListener("change", () => this.render());
    const rows = systems.map((s) => {
      const key = keyOf(s);
      return h(
        "tr",
        null,
        h(
          "td",
          null,
          h("strong", null, s.name),
          s.anchor ? " · Ancrage" : "",
          h("div.sub", null, s.states.join(", ") || "États inconnus"),
        ),
        h("td", null, percent(s.influence)),
        h("td", null, s.controls ? "Oui" : s.controls === false ? "Non" : "?"),
        h("td", null, viewAge(s.updatedAt), h("div.sub", null, s.source)),
        h("td", null, viewAge(s.lastVisitedAt)),
        h("td", null, String(patrolScore(s))),
        h(
          "td",
          null,
          btn("Copier", () => {
            void clipboardWrite(s.name).catch(() => navigator.clipboard?.writeText(s.name));
          }),
          btn("Visité", () => {
            const at = new Date().toISOString();
            this.updateSystem(key, { lastVisitedAt: at });
            if (localSqlite())
              void recordVisitDb(s.name, at).catch((e) => {
                this.sqliteError = String(e);
                this.render();
              });
          }),
          btn(s.anchor ? "Désancrer" : "Ancrer", () => this.updateSystem(key, { anchor: !s.anchor })),
          btn("Note", () => {
            const note = window.prompt("Note pour " + s.name, s.note ?? "");
            if (note !== null) this.updateSystem(key, { note: note.slice(0, 500) });
          }),
        ),
      );
    });
    const actions = h(
      "div.bgs-actions",
      null,
      filterSelect,
      searchInput,
      btn("Exporter CSV", () => this.exportCsv()),
      btn("Sauvegarde JSON", () => {
        void this.exportJson();
      }),
      btn("Diagnostic BGS / PDF", () => this.diagnosticExport()),
      h(
        "label.bgs-import",
        null,
        "Importer JSON",
        h("input", {
          type: "file",
          accept: ".json,application/json",
          onchange: (e: Event) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) this.importData(f);
          },
        }),
      ),
    );
    replace(
      root,
      h("div#bgs-cmdr-overview", null),
      h("div#bgs-my-faction-systems", null),
      h(
        "header.view-head",
        null,
        h(
          "div",
          null,
          h("h1", null, "BGS · Suivi & patrouilles"),
          h(
            "p.sub",
            null,
            "Données communautaires indicatives. Aucune estimation d'influence n'est présentée comme un fait.",
          ),
        ),
      ),
      h(
        "section.card.bgs-panel",
        null,
        h("h2", null, "Faction suivie"),
        controlsBar,
        h(
          "p.sub",
          null,
          `Relevé : ${date(this.state.lastFetchedAt)} · Dernier tick EDCD : ${date(this.state.tickAt)} · ${this.state.partial ? "Recherche incomplète" : "Recherche complète ou non effectuée"}`,
        ),
        this.progress ? h("p.sub", null, this.progress) : null,
        this.message ? h("p", { role: "status" }, this.message) : null,
        this.loading ? h("p.sub", null, "Chargement de la base SQLite…") : null,
        this.sqliteError ? h("p.error", null, this.sqliteError) : null,
      ),
      h(
        "div.bgs-stats",
        null,
        ...[
          ["Systèmes", total],
          ["Contrôlés", controls],
          ["Données > 7 j / inconnues", stale],
          ["Variations récentes à vérifier", alerts.length],
          ["Influence en hausse", summary.rising],
          ["Influence en baisse", summary.falling],
        ].map(([label, value]) =>
          h("div.card.bgs-stat", null, h("strong", null, String(value)), h("small", null, String(label))),
        ),
      ),
      alerts.length
        ? h(
            "section.card.bgs-panel",
            null,
            h("h2", null, "Variations observées"),
            ...alerts.slice(0, 20).map((a) => h("p", null, `${a.system} : ${a.text}`)),
          )
        : null,
      h(
        "section.card.bgs-panel",
        null,
        h("h2", null, "Historique de l'influence"),
        h("p.sub", null, "Deux observations réelles au minimum. Le graphique utilise une échelle absolue 0–100 %."),
        h(
          "div.bgs-actions",
          null,
          h(
            "select",
            {
              onchange: (e: Event) => {
                this.trendSystem = (e.target as HTMLSelectElement).value;
                this.render();
              },
            },
            ...this.state.systems.map((s) =>
              h("option", { value: s.name, selected: s.name === selection?.name }, s.name),
            ),
          ),
          btn("Exporter les variations CSV", () => this.exportTrends()),
          btn("Télécharger le rapport PDF", () => {
            void this.exportReport();
          }),
        ),
        selection ? this.renderTrendChart(selection) : h("p.sub", null, "Aucun système suivi."),
      ),
      h(
        "section.card.bgs-panel",
        null,
        h("h2", null, "Itinéraire de patrouille (indicatif)"),
        h(
          "p.sub",
          null,
          "Chaque étape est vérifiée à vol d'oiseau. Aucun saut non accessible n'est inventé. Ce n'est pas un calculateur FSD ou carburant.",
        ),
        h(
          "div.bgs-actions",
          null,
          h(
            "label",
            null,
            "Distance maximale (AL) ",
            h("input", {
              type: "number",
              min: 1,
              max: 100,
              step: 1,
              value: String(this.routeMaxLy),
              onchange: (e: Event) => {
                const n = Number((e.target as HTMLInputElement).value);
                if (Number.isFinite(n)) {
                  this.routeMaxLy = Math.max(1, Math.min(100, n));
                  this.render();
                }
              },
            }),
          ),
          h(
            "label",
            null,
            "Arrêts ",
            h("input", {
              type: "number",
              min: 1,
              max: 50,
              step: 1,
              value: String(this.routeStops),
              onchange: (e: Event) => {
                const n = Number((e.target as HTMLInputElement).value);
                if (Number.isFinite(n)) {
                  this.routeStops = Math.max(1, Math.min(50, Math.trunc(n)));
                  this.render();
                }
              },
            }),
          ),
          btn(
            "Copier la liste",
            () => {
              const value = route.legs.map((x) => x.system.name).join("\n");
              if (value) void clipboardWrite(value).catch(() => navigator.clipboard?.writeText(value));
            },
            route.legs.length === 0,
          ),
          btn("Exporter itinéraire CSV", () => this.exportRoute(), route.legs.length === 0),
        ),
        h(
          "p.sub",
          null,
          `Départ : ${route.originName} (${route.origin === "position" ? "position du jeu" : route.origin === "anchor" ? "ancrage choisi" : "aucune référence"}) · ${route.legs.length} arrêt(s) · ${route.totalLy.toFixed(1)} AL cumulées`,
        ),
        route.origin === "unknown"
          ? h(
              "p.error",
              null,
              "Pas de coordonnées de départ : rejoindre un système en jeu ou définir un ancrage possédant des coordonnées.",
            )
          : null,
        route.legs.length
          ? h(
              "ol.bgs-route",
              null,
              ...route.legs.map((x) =>
                h("li", null, `${x.system.name} — ${x.ly.toFixed(2)} AL depuis ${x.from}, score ${x.score}`),
              ),
            )
          : null,
        route.isPartial
          ? h(
              "p.sub",
              null,
              `${route.disconnected.length} systèmes hors chaîne accessible ou hors limite d'arrêts · ${route.excludedNoCoords.length} systèmes sans coordonnées. Plan volontairement incomplet.`,
            )
          : null,
      ),
      h(
        "section.card.bgs-panel",
        null,
        h("h2", null, "Patrouille prioritaire"),
        h(
          "p.sub",
          null,
          "Score explicable : ancrages, retard de visite, ancienneté des données, états, faible influence. L'ordre n'est pas un itinéraire de sauts calculé.",
        ),
        actions,
        h(
          "div.bgs-table-scroll",
          null,
          h(
            "table.bgs-table",
            null,
            h(
              "thead",
              null,
              h(
                "tr",
                null,
                ...["Système", "Influence", "Contrôle", "MAJ", "Visite", "Score", "Actions"].map((t) =>
                  h("th", null, t),
                ),
              ),
            ),
            h(
              "tbody",
              null,
              rows.length
                ? rows
                : h(
                    "tr",
                    null,
                    h("td", { colSpan: 7 }, "Aucun système. Recherche une faction ou ajoute un système manuellement."),
                  ),
            ),
          ),
        ),
        total > 500
          ? h("p.sub", null, "Affichage limité à 500 systèmes ; l'export conserve toutes les données du filtre.")
          : null,
      ),
      h(
        "p.sub",
        null,
        "Les observations sont basées sur la date de mise à jour Spansh, pas sur une preuve de tick. Les visites FSDJump sont détectées en direct et sauvées dans SQLite ; les anciens journaux ne les modifient pas.",
      ),
    );
    this.renderFactionSystems();
    this.renderCommanderOverview();
    mountBgsWorkspace(root, this.ctx.store.state.cmdr.commander, this.state.faction, this.state); // EDCH-COG-MEMORY-v1.5.3 EDCH-BGS-ALERTS-v1.5.4
  }
}
