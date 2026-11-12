/** EDCH-BGS-WORKSPACE-v1.5.1
 * Unifies the existing BGS view without rebuilding its business logic or touching storage.
 * The original DOM nodes (and their event listeners) are MOVED into tab panels.
 */
import {
  agentStatus,
  agentQueueHealth,
  requestAgentPing,
  retryAgentQueue,
  clearAgentPendingQueue,
} from "../../features/agent/runtime.js"; // EDCH-COG-DURABLE-v1.5.2
import {
  appendConsoleEntry,
  consoleSummary,
  type ConsoleEntry,
} from "../../features/agent/consoleModel.js";
import { mountBgsAlertPanel } from "../../features/bgs/alertPanel.js"; // EDCH-BGS-ALERTS-v1.5.4
import { mountMultiAgentPanel } from "../../features/agent/multiAgentPanel.js"; // EDCH-COG-MULTI-v1.6.0
import type { BgsState } from "../../features/bgs/core.js";
import { h } from "../../ui/dom.js";
import { checkedMemoryAction, memoryAdd, memoryDelete, memoryList, validMemoryScope, memoryBackup, memoryBackups, memoryRestore, memoryDiagnostic, type MemoryScope } from "../../features/agent/memory.js"; // EDCH-COG-MEMORY-v1.6.1

type Tab = "systems" | "patrols" | "influence" | "agent";
const TABS: { id: Tab; label: string }[] = [
  { id: "systems", label: "Systèmes" },
  { id: "patrols", label: "Patrouilles" },
  { id: "influence", label: "Influence" },
  { id: "agent", label: "Agent COG" },
];
let selectedTab: Tab = "systems";
let history: ConsoleEntry[] = [];
let listenersReady = false;
let feedReceived = 0;
let feedEligible = 0;
let feedSeenAt = "";
let host: HTMLElement | null = null;
let repaintScheduled = false;
let memoryScope: MemoryScope | null = null;
let memoryGeneration = 0;
let memoryError = "";
let memoryBusy = false;

function refreshMemories() {
  const box = host?.querySelector<HTMLElement>("#edch-cog-memory-entries");
  const status = host?.querySelector<HTMLElement>("#edch-cog-memory-status");
  if (!box || !status) return;
  const scope = memoryScope;
  const gen = ++memoryGeneration;
  if (!scope || !validMemoryScope(scope)) {
    status.textContent = "Mémoire inactive : aucun commandant ou aucune faction sélectionnée.";
    box.replaceChildren();
    return;
  }
  status.textContent = `Mémoire locale : ${scope.commander} / ${scope.faction}${memoryError ? ` · ${memoryError}` : ""}`;
  void memoryList(scope).then((records) => {
    if (gen !== memoryGeneration || !box.isConnected) return;
    box.replaceChildren(...(records.length ? records.map((record) =>
      h("tr", null,
        h("td", null, new Date(record.createdAt).toLocaleString("fr-FR")),
        h("td", null, record.category),
        h("td", null, record.text),
        h("td", null, h("button", { type: "button", disabled: memoryBusy, onclick: () => {
          if (!window.confirm("Supprimer cette entrée de mémoire ?")) return;
          memoryBusy = true;
          void memoryDelete(scope, record.id).then(() => { memoryError = ""; })
            .catch((e: unknown) => { memoryError = String(e); })
            .finally(() => { memoryBusy = false; refreshMemories(); });
        } }, "Supprimer")),
      )
    ) : [h("tr", null, h("td", { colSpan: 4 }, "Aucune entrée pour ce CMDR et cette faction."))]));
  }).catch((e: unknown) => {
    if (gen !== memoryGeneration) return;
    memoryError = `Erreur SQLite : ${String(e)}`;
    status.textContent = memoryError;
  });
}


function scheduleConsoleRefresh() {
  if (repaintScheduled || selectedTab !== "agent") return;
  repaintScheduled = true;
  window.requestAnimationFrame(() => {
    repaintScheduled = false;
    refreshConsole();
  });
}

function refreshConsole() {
  if (!host?.isConnected || selectedTab !== "agent") return;
  const status = host.querySelector<HTMLElement>("#edch-cog-console-status");
  if (status) status.textContent = agentStatus();
  const health = agentQueueHealth();
  const queueDetails = host.querySelector<HTMLElement>("#edch-cog-queue-details");
  if (queueDetails) {
    const mode =
      health.mode === "indexeddb"
        ? "IndexedDB · persistante"
        : health.mode === "volatile"
          ? "Mémoire temporaire · non récupérable après fermeture"
          : "Initialisation";
    queueDetails.textContent = `File : ${health.pending} en attente · ${health.inFlight} en cours · ${health.outbox} à afficher · ${health.seen} déjà traités · ${health.duplicate} doublons évités · ${health.overflow} refusés (file pleine) · ${health.retries} tentatives de reprise · ${mode}`;
  }
  const body = host.querySelector<HTMLElement>("#edch-cog-console-entries");
  if (!body) return;
  const summary = host.querySelector<HTMLElement>("#edch-cog-console-summary");
  if (summary) {
    const counts = consoleSummary(history);
    const categories = Object.entries(counts).map(([type, count]) => `${type} : ${count}`);
    summary.textContent = `${feedReceived} événements du journal reçus · ${feedEligible} reconnus par le protocole · ${Math.max(0, feedReceived - feedEligible)} filtrés${feedSeenAt ? ` · Dernier lot : ${feedSeenAt}` : ""} · ${history.length} actions affichées${categories.length ? ` · ${categories.join(" · ")}` : ""}`;
  }
  body.replaceChildren(
    ...(history.length
      ? history.map((item) =>
          h(
            "tr",
            null,
            h("td", null, new Date(item.at).toLocaleTimeString("fr-FR")),
            h("td", null, item.category),
            h("td", null, item.message),
            h("td", null, item.source),
          ),
        )
      : [h("tr", null, h("td", { colSpan: 4 }, "En attente d'un événement reconnu du journal…"))]),
  );
}

function setupListeners() {
  if (listenersReady) return;
  listenersReady = true;
  window.addEventListener("edch-agent-action", (event: Event) => {
    const action = (event as CustomEvent<unknown>).detail;
    history = appendConsoleEntry(history, action);
    // Only verified, bounded actions are recorded, in the explicitly selected scope.
    const safe = checkedMemoryAction(action);
    const scope = memoryScope;
    if (safe && scope && validMemoryScope(scope)) {
      void memoryAdd(scope, "event", safe.text, safe.eventKey)
        .then(() => { memoryError = ""; if (selectedTab === "agent") refreshMemories(); })
        .catch((e: unknown) => { memoryError = String(e); if (selectedTab === "agent") refreshMemories(); });
    }
    scheduleConsoleRefresh();
  });
  window.addEventListener("edch-agent-feed", (event: Event) => {
    const detail = (event as CustomEvent<{ received?: number; eligible?: number }>).detail;
    const received = Number(detail?.received);
    const eligible = Number(detail?.eligible);
    if (!Number.isSafeInteger(received) || !Number.isSafeInteger(eligible)) return;
    if (received < 0 || eligible < 0 || eligible > received) return;
    feedReceived += received;
    feedEligible += eligible;
    feedSeenAt = new Date().toLocaleTimeString("fr-FR");
    scheduleConsoleRefresh();
  });
  window.addEventListener("edch-agent-status", scheduleConsoleRefresh);
  window.addEventListener("edch-agent-queue", scheduleConsoleRefresh);
  window.addEventListener("edch-agent-pong", () => {
    const node = host?.querySelector<HTMLElement>("#edch-cog-test-result");
    if (node) node.textContent = `Réponse du Worker reçue à ${new Date().toLocaleTimeString("fr-FR")}.`;
    scheduleConsoleRefresh();
  });
}

function makeAgentConsole(existingButton: HTMLElement | null, existingStatus: HTMLElement | null): HTMLElement {
  const actionRow = h(
    "div.bgs-actions",
    null,
    existingButton ?? h("span.sub", null, "Agent v1.5.0 non installé : bouton indisponible."),
    existingStatus,
    h(
      "button",
      {
        type: "button",
        onclick: () => {
          const ok = requestAgentPing();
          const node = host?.querySelector<HTMLElement>("#edch-cog-test-result");
          if (node) node.textContent = ok ? "Test envoyé au Worker : en attente de réponse…" : "Active l'agent avant le test.";
        },
      },
      "Tester le Worker",
    ),
    h(
      "button",
      {
        type: "button",
        onclick: () => {
          history = [];
          refreshConsole();
        },
      },
      "Vider la console",
    ),
  );
  return h(
    "section.card.bgs-panel.bgs-agent-console",
    null,
    h("h2", null, "Agent COG · Console en direct"),
    h(
      "p.sub",
      null,
      "Analyse locale à règles, sans Mistral. Les compteurs indiquent les événements reçus et filtrés. La table affiche seulement les actions vérifiées, sans conserver de lignes brutes.",
    ),
    actionRow,
    h(
      "section.card.bgs-panel",
      null,
      h("h3", null, "File asynchrone et reprise · v1.5.2"),
      h("p#edch-cog-queue-details.sub", { role: "status" }, "Chargement des compteurs de file…"),
      h(
        "div.bgs-actions",
        null,
        h(
          "button",
          { type: "button", onclick: () => retryAgentQueue() },
          "Relancer le traitement",
        ),
        h(
          "button",
          {
            type: "button",
            onclick: () => {
              if (!window.confirm("Supprimer les événements non traités de la file ? Cette action est irréversible.")) return;
              void clearAgentPendingQueue()
                .then((count) => {
                  const status = host?.querySelector<HTMLElement>("#edch-cog-queue-operation");
                  if (status) status.textContent = `${count} événement(s) en attente supprimé(s).`;
                  scheduleConsoleRefresh();
                })
                .catch((error: unknown) => {
                  const status = host?.querySelector<HTMLElement>("#edch-cog-queue-operation");
                  if (status) status.textContent = `Purge refusée : ${String(error)}`;
                });
            },
          },
          "Vider la file en attente…",
        ),
      ),
      h("p#edch-cog-queue-operation.sub", { role: "status" }),
      h(
        "p.sub",
        null,
        "La file IndexedDB conserve les événements non acquittés. Les notifications sont retirées de la boîte de sortie avant affichage pour éviter les doublons ; en cas de fermeture pendant cet intervalle, une notification peut être manquée. Les reçus restent enregistrés. Aucun appel IA ni commande système.",
      ),
    ),
    h("section.card.bgs-panel.edch-cog-memory", null,
      h("h3", null, "Mémoire SQLite locale · v1.5.3"),
      h("p.sub", null, "Historique séparé par CMDR et faction. Seules les actions COG validées et les notes que tu ajoutes sont enregistrées. Aucun envoi à une API externe."),
      h("p#edch-cog-memory-status.sub", { role: "status" }, "Chargement de la mémoire…"),
      h("div.bgs-actions", null,
        h("input#edch-cog-memory-note", { type: "text", maxLength: 1800, placeholder: "Note BGS locale (1800 caractères maximum)" }),
        h("button", { type: "button", onclick: () => {
          const input = host?.querySelector<HTMLInputElement>("#edch-cog-memory-note");
          const scope = memoryScope;
          if (!input || !scope || !validMemoryScope(scope) || memoryBusy) return;
          const text = input.value.trim();
          if (!text) return;
          memoryBusy = true;
          void memoryAdd(scope, "note", text).then(() => { input.value = ""; memoryError = ""; })
            .catch((e: unknown) => { memoryError = String(e); })
            .finally(() => { memoryBusy = false; refreshMemories(); });
        } }, "Enregistrer une note"),
        h("button", { type: "button", onclick: refreshMemories }, "Actualiser la mémoire"),
      ),
      h("div.bgs-actions", null,
        h("button", { type: "button", onclick: () => {
          if (memoryBusy) return;
          memoryBusy = true;
          const info = host?.querySelector<HTMLElement>("#edch-cog-backup-status");
          if (info) info.textContent = "Création de la sauvegarde SQLite cohérente…";
          void memoryBackup().then((saved) => {
            if (info) info.textContent = `Sauvegarde locale créée : ${saved.name} (${saved.bytes} octets).`;
          }).catch((error: unknown) => {
            if (info) info.textContent = `Sauvegarde impossible : ${String(error)}`;
          }).finally(() => { memoryBusy = false; });
        } }, "Sauvegarder SQLite"),
        h("button", { type: "button", onclick: () => {
          const selector = host?.querySelector<HTMLSelectElement>("#edch-cog-backups");
          const info = host?.querySelector<HTMLElement>("#edch-cog-backup-status");
          void Promise.all([memoryBackups(), memoryDiagnostic()]).then(([items, diagnostic]) => {
            selector?.replaceChildren(...items.map((item) => h("option", { value: item.name }, `${item.name} (${item.bytes} octets)`)));
            if (info) info.textContent = `SQLite : ${diagnostic.healthy ? "intègre" : "erreur"} · ${diagnostic.items} entrées · ${diagnostic.backups} sauvegarde(s).`;
          }).catch((error: unknown) => {
            if (info) info.textContent = `Diagnostic SQLite impossible : ${String(error)}`;
          });
        } }, "Diagnostic + sauvegardes"),
        h("select#edch-cog-backups", { "aria-label": "Sauvegarde SQLite à restaurer" }),
        h("button", { type: "button", onclick: () => {
          const selector = host?.querySelector<HTMLSelectElement>("#edch-cog-backups");
          const info = host?.querySelector<HTMLElement>("#edch-cog-backup-status");
          if (!selector?.value || memoryBusy) return;
          if (!window.confirm("Restaurer toute la mémoire des commandants et factions depuis cette sauvegarde ? Une sauvegarde actuelle sera d'abord créée automatiquement.")) return;
          memoryBusy = true;
          void memoryRestore(selector.value).then((count) => {
            if (info) info.textContent = `Mémoire restaurée : ${count} entrée(s). Une copie d'avant restauration a été conservée.`;
            refreshMemories();
          }).catch((error: unknown) => {
            if (info) info.textContent = `Restauration refusée : ${String(error)}`;
          }).finally(() => { memoryBusy = false; });
        } }, "Restaurer la mémoire…"),
      ),
      h("p#edch-cog-backup-status.sub", { role: "status" }, "Sauvegardes locales cohérentes avec le mode WAL, aucune donnée envoyée sur Internet."),
      h("div.bgs-table-scroll", null,
        h("table.bgs-table", null,
          h("thead", null, h("tr", null, ...["Date", "Type", "Contenu", "Action"].map((t) => h("th", null, t)))),
          h("tbody#edch-cog-memory-entries", null),
        ),
      ),
    ),
    h("p#edch-cog-console-status.sub", { role: "status" }, agentStatus()),
    h("p#edch-cog-test-result.sub", { role: "status" }, "Test disponible sans lancer Elite Dangerous."),
    h("p#edch-cog-console-summary.sub", null),
    h(
      "div.bgs-table-scroll",
      null,
      h(
        "table.bgs-table.bgs-agent-table",
        null,
        h("thead", null, h("tr", null, ...["Heure", "Action", "Description en français", "Source"].map((s) => h("th", null, s)))),
        h("tbody#edch-cog-console-entries", null),
      ),
    ),
    h("p.sub", null, "Historique temporaire limité à 100 entrées, effacé au redémarrage ; aucune commande système exécutée."),
  );
}

function sectionTitle(node: Element): string {
  return (node.querySelector(":scope > h2")?.textContent ?? "").trim();
}

/** Called at the end of the original BgsView.render(), after the async inner panels are filled. */
export function mountBgsWorkspace(root: HTMLElement, commanderName?: string, factionName?: string, bgsState?: BgsState): void {
  const incoming: MemoryScope = { commander: commanderName ?? "", faction: factionName ?? "" };
  const previous = memoryScope;
  memoryScope = validMemoryScope(incoming) ? incoming : null;
  if (previous?.commander !== memoryScope?.commander || previous?.faction !== memoryScope?.faction) {
    memoryGeneration++;
    memoryError = "";
  }
  setupListeners();
  const original = Array.from(root.children) as HTMLElement[];
  const commander = original.find((node) => node.id === "bgs-cmdr-overview");
  const systems = original.find((node) => node.id === "bgs-my-faction-systems");
  const heading = original.find((node) => node.matches("header.view-head"));
  const faction = original.find((node) => sectionTitle(node) === "Faction suivie");
  const stats = original.find((node) => node.matches(".bgs-stats"));
  const used = new Set<HTMLElement>();
  for (const node of [commander, systems, heading, faction, stats]) if (node) used.add(node);

  const byTitle = (title: string): HTMLElement | undefined =>
    original.find((node) => sectionTitle(node) === title);
  const influence = [byTitle("Variations observées"), byTitle("Historique de l'influence")].filter(
    (node): node is HTMLElement => !!node,
  );
  const patrols = [byTitle("Itinéraire de patrouille (indicatif)"), byTitle("Patrouille prioritaire")].filter(
    (node): node is HTMLElement => !!node,
  );
  for (const node of [...influence, ...patrols]) used.add(node);

  const agentStatusNode = root.querySelector<HTMLElement>("#edch-agent-status");
  const agentToggle = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((node) =>
    /(?:Activer|Arrêter) agent journal/.test(node.textContent ?? ""),
  );

  const navbar = h("nav.bgs-workspace-tabs", { role: "tablist", "aria-label": "Sections BGS" });
  const panes = new Map<Tab, HTMLElement>();
  for (const tab of TABS) {
    const pane = h("div.bgs-workspace-pane", {
      id: `edch-bgs-pane-${tab.id}`,
      role: "tabpanel",
      "aria-labelledby": `edch-bgs-tab-${tab.id}`,
    });
    panes.set(tab.id, pane);
  }
  const buttons = new Map<Tab, HTMLButtonElement>();
  function switchTab(tab: Tab) {
    selectedTab = tab;
    for (const entry of TABS) {
      const active = entry.id === tab;
      const button = buttons.get(entry.id);
      const pane = panes.get(entry.id);
      if (button) {
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
      }
      if (pane) pane.hidden = !active;
    }
    if (tab === "agent") { refreshConsole(); refreshMemories(); }
  }
  for (const tab of TABS) {
    const button = h(
      "button",
      {
        type: "button",
        role: "tab",
        id: `edch-bgs-tab-${tab.id}`,
        "aria-controls": `edch-bgs-pane-${tab.id}`,
        onclick: () => switchTab(tab.id),
        onkeydown: (event: Event) => {
          const keyboard = event as KeyboardEvent;
          if (keyboard.key !== "ArrowRight" && keyboard.key !== "ArrowLeft") return;
          keyboard.preventDefault();
          const index = TABS.findIndex((item) => item.id === tab.id);
          const delta = keyboard.key === "ArrowRight" ? 1 : -1;
          const next = TABS[(index + delta + TABS.length) % TABS.length].id;
          switchTab(next);
          buttons.get(next)?.focus();
        },
      },
      tab.label,
    );
    buttons.set(tab.id, button);
    navbar.appendChild(button);
  }
  const systemPane = panes.get("systems")!;
  if (commander) systemPane.appendChild(commander);
  if (systems) systemPane.appendChild(systems);
  const patrolPane = panes.get("patrols")!;
  for (const node of patrols) patrolPane.appendChild(node);
  const influencePane = panes.get("influence")!;
  for (const node of influence) influencePane.appendChild(node);
  const agentPane = panes.get("agent")!;
  agentPane.appendChild(mountMultiAgentPanel());
  agentPane.appendChild(makeAgentConsole(agentToggle ?? null, agentStatusNode));
  if (bgsState) agentPane.prepend(mountBgsAlertPanel(bgsState, { commander: commanderName ?? "", faction: factionName ?? "" }));

  // Unknown future sections are preserved rather than discarded during an upstream update.
  for (const node of original) if (!used.has(node)) systemPane.appendChild(node);

  root.replaceChildren(...[heading, faction, stats].filter((node): node is HTMLElement => !!node), navbar, ...TABS.map((tab) => panes.get(tab.id)!));
  host = agentPane;
  switchTab(selectedTab);
  refreshConsole();
  if (selectedTab === "agent") refreshMemories();
}
