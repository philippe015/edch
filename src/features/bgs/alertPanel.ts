/** EDCH-BGS-ALERTS-v1.6.3 — accessible local rules UI, no generative AI or remote calls. */
import type { BgsState } from "./core.js";
import {
  buildBgsAlerts,
  type AlertKind,
  type AlertSettings,
  type BgsAlert,
} from "./alertRules.js";
import {
  captureNewAlerts,
  clearMutedAlerts,
  loadAlertState,
  muteAlert,
  saveAlertState,
  validAlertScope,
  type AlertScope,
  type AlertLocalState,
} from "./alertStore.js";
import { h } from "../../ui/dom.js";
import { alertScopeKey } from "./alertStore.js";
import { DEFAULT_ALERT_QUERY, exportAlertCsv, selectAlertPage, summarizeAlertPriorities, type AlertQuery } from "./alertView.js";

/** Session-only search/page preferences, never persisted with BGS evidence or alert settings. */
const viewCache = new Map<string, AlertQuery>();
function viewPreferences(key: string): AlertQuery {
  if (!viewCache.has(key) && viewCache.size >= 24) viewCache.delete(viewCache.keys().next().value!);
  return viewCache.get(key) ?? { ...DEFAULT_ALERT_QUERY };
}
import { notify } from "../../ui/notifier.js";

const TYPES: { id: AlertKind; label: string }[] = [
  { id: "influence", label: "Baisses d'influence" },
  { id: "control", label: "Changements de contrôle" },
  { id: "conflict", label: "Conflits et états" },
  { id: "patrol", label: "Visites anciennes" },
  { id: "stale", label: "Données anciennes" },
  { id: "unvisited", label: "Visite non enregistrée" },
];
const LEVEL: Record<BgsAlert["severity"], string> = {
  critical: "Priorité élevée", warning: "À vérifier", info: "Suivi",
};
function formatTime(timestamp?: string): string {
  if (!timestamp) return "Date non disponible";
  const n = Date.parse(timestamp);
  return Number.isFinite(n) ? new Date(n).toLocaleString("fr-FR") : "Date non disponible";
}
/** Read-only summary of the BGS snapshot. Original BGS state is never mutated. */
export function mountBgsAlertPanel(state: BgsState, scope: AlertScope): HTMLElement {
  if (!validAlertScope(scope)) return h(
    "section.card.bgs-panel", null,
    h("h2", null, "Alertes BGS · v1.6.3"),
    h("p.sub", { role: "status" }, "Sélectionne une faction et connecte un CMDR pour configurer des alertes locales distinctes."),
  );
  const loaded = loadAlertState(scope);
  let local: AlertLocalState = loaded.state;
  let persistent = loaded.persistent;
  let alerts = buildBgsAlerts(state, local.settings);
  const captured = captureNewAlerts(local, alerts);
  local = captured.state;
  persistent = saveAlertState(scope, local) && persistent;
  // Notifications are opt-in; first evaluation is always quiet. At most two for one refresh.
  for (const alert of captured.toNotify) {
    notify(`BGS · ${alert.system} : ${alert.text}`, { sound: local.settings.sound });
  }
  const muted = new Set(local.muted);
  const visible = alerts.filter((item) => !muted.has(item.id));
  const mutedCount = alerts.length - visible.length;
  const priorities = summarizeAlertPriorities(visible);
  const viewKey = alertScopeKey(scope);
  let view = viewPreferences(viewKey);
  const panel = h("section.card.bgs-panel.edch-bgs-alert-panel", null);
  const rerender = (): void => { panel.replaceWith(mountBgsAlertPanel(state, scope)); };
  function storeSettings(settings: AlertSettings): void {
    local.settings = settings;
    // Changing a filter only refreshes the baseline; it must not generate surprise notifications.
    const silent = captureNewAlerts({ ...local, settings: { ...settings, notifications: false } }, buildBgsAlerts(state, settings));
    local = { ...silent.state, settings };
    saveAlertState(scope, local);
    rerender();
  }
  const toggle = (key: AlertKind, label: string): HTMLElement => h("label", null,
    h("input", {
      type: "checkbox", checked: local.settings[key],
      onchange: (e: Event) => storeSettings({ ...local.settings, [key]: (e.target as HTMLInputElement).checked }),
    }), ` ${label}`);
  const numeric = (key: "influenceDropPoints" | "overdueDays" | "staleDays", title: string, min: number, max: number): HTMLElement =>
    h("label", null, `${title} `, h("input", {
      type: "number", min, max, step: 1, value: local.settings[key],
      style: { width: "70px" },
      onchange: (e: Event) => {
        const value = Number((e.target as HTMLInputElement).value);
        if (!Number.isFinite(value)) return;
        storeSettings({ ...local.settings, [key]: Math.round(Math.min(max, Math.max(min, value))) });
      },
    }));
  const body = h("tbody", null);
  const resultsStatus = h("span", { role: "status", "aria-live": "polite" }, "");
  const previous = h("button", { type: "button", onclick: () => { view = { ...view, page: view.page - 1 }; renderPage(); } }, "Page précédente");
  const next = h("button", { type: "button", onclick: () => { view = { ...view, page: view.page + 1 }; renderPage(); } }, "Page suivante");
  const exportButton = h("button", { type: "button", onclick: () => {
    const selected = selectAlertPage(visible, view);
    if (!selected.total) return;
    const url = URL.createObjectURL(new Blob([exportAlertCsv(selected.filtered)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "EDCH-BGS-alertes-filtrees.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } }, "Exporter les résultats CSV");
  function renderPage(): void {
    const selection = selectAlertPage(visible, view);
    view = { ...view, page: selection.page };
    viewCache.set(viewKey, view);
    body.replaceChildren(...(selection.rows.length ? selection.rows.map((alert) => h("tr", null,
      h("td", null, LEVEL[alert.severity]),
      h("td", null, alert.system),
      h("td", null, alert.text),
      h("td", null, formatTime(alert.evidenceAt)),
      h("td", null, h("button", { type: "button", onclick: () => {
        local = muteAlert(local, alert.id);
        saveAlertState(scope, local);
        rerender();
      } }, "Masquer")),
    )) : [h("tr", null, h("td", { colSpan: 5 }, "Aucune alerte pour cette recherche."))]));
    resultsStatus.textContent = `${selection.from}–${selection.to} sur ${selection.total} alertes filtrées · page ${selection.page}/${selection.pages}`;
    previous.disabled = selection.page <= 1;
    next.disabled = selection.page >= selection.pages;
    exportButton.disabled = selection.total === 0;
  }
  const filterControls = h("div.bgs-actions.edch-bgs-alert-filters", null,
    h("label", null, "Rechercher un système ", h("input", {
      type: "search", maxLength: 120, placeholder: "Nom ou observation", value: view.query,
      oninput: (event: Event) => {
        view = { ...view, query: (event.target as HTMLInputElement).value, page: 1 };
        renderPage();
      },
    })),
    h("label", null, "Priorité ", h("select", { value: view.severity,
      onchange: (event: Event) => { view = { ...view, severity: (event.target as HTMLSelectElement).value as AlertQuery["severity"], page: 1 }; renderPage(); },
    },
    h("option", { value: "all", selected: view.severity === "all" }, "Toutes"),
    h("option", { value: "critical", selected: view.severity === "critical" }, "Élevée"),
    h("option", { value: "warning", selected: view.severity === "warning" }, "À vérifier"),
    h("option", { value: "info", selected: view.severity === "info" }, "Suivi"))),
    h("label", null, "Type ", h("select", {
      onchange: (event: Event) => { view = { ...view, kind: (event.target as HTMLSelectElement).value as AlertQuery["kind"], page: 1 }; renderPage(); },
    },
    h("option", { value: "all", selected: view.kind === "all" }, "Tous les types"),
    ...TYPES.map((item) => h("option", { value: item.id, selected: view.kind === item.id }, item.label)))),
    h("label", null, "Par page ", h("select", {
      onchange: (event: Event) => { view = { ...view, pageSize: Number((event.target as HTMLSelectElement).value), page: 1 }; renderPage(); },
    }, ...[20, 40, 80].map((size) => h("option", { value: String(size), selected: view.pageSize === size }, String(size))))),
  );
  panel.append(
    h("h2", null, "Alertes BGS · v1.6.3"),
    h("p.sub", null,
      "Règles locales fondées sur les observations Spansh et les visites enregistrées dans EDCH. Les variations ne prouvent pas un tick ; les alertes ne commandent jamais le jeu. Aucun Mistral."),
    h("p.sub", null, `Périmètre : CMDR ${scope.commander} · Faction ${scope.faction}`),
    h("p.sub", { role: "status" },
      `${priorities.total} alertes actives${alerts.length >= 500 ? " (limite de calcul atteinte)" : ""} · ${mutedCount} masquée(s) · ${captured.newlyObserved} nouvelle(s) à cette analyse · ${persistent ? "réglages enregistrés localement" : "stockage inaccessible : réglages temporaires"}`),
    h("div.bgs-actions", null, ...TYPES.map((type) => toggle(type.id, type.label))),
    h("div.bgs-actions", null,
      numeric("influenceDropPoints", "Baisse minimale (points)", 1, 30),
      numeric("overdueDays", "Visite après (jours)", 3, 60),
      numeric("staleDays", "Donnée ancienne (jours)", 3, 60),
    ),
    h("div.bgs-actions", null,
      h("label", null, h("input", { type: "checkbox", checked: local.settings.notifications,
        onchange: (e: Event) => storeSettings({ ...local.settings, notifications: (e.target as HTMLInputElement).checked }),
      }), " Notifications EDCH pour nouveaux changements observés"),
      h("label", null, h("input", { type: "checkbox", checked: local.settings.sound,
        onchange: (e: Event) => storeSettings({ ...local.settings, sound: (e.target as HTMLInputElement).checked }),
      }), " Son lors des notifications"),
    ),
    h("p.sub", null, "Notifications désactivées par défaut. Elles concernent seulement de nouvelles observations après la première analyse, pas les alertes anciennes ni le simple passage du temps."),
    h("div.bgs-actions", null,
      h("button", { type: "button", onclick: rerender }, "Actualiser les alertes"),
      h("button", { type: "button", disabled: mutedCount === 0, onclick: () => {
        local = clearMutedAlerts(local); saveAlertState(scope, local); rerender();
      } }, "Réactiver les alertes masquées"),
    ),
    h("div.bgs-actions.edch-bgs-alert-overview", { role: "group", "aria-label": "Répartition des alertes actives" },
      h("strong", null, `Priorité élevée : ${priorities.critical}`),
      h("span", null, `À vérifier : ${priorities.warning}`),
      h("span", null, `Suivi : ${priorities.info}`),
    ),
    h("p.sub", null,
      "Les alertes de suivi (visites et données anciennes) ne sont pas des urgences confirmées. Le compteur « Variations récentes à vérifier » en haut concerne un autre indicateur : les changements récents détectés dans les tendances. Un relevé communautaire ne prouve pas un tick."),
    filterControls,
    h("div.bgs-actions", null,
      h("button", { type: "button", onclick: () => {
        viewCache.set(viewKey, { ...DEFAULT_ALERT_QUERY });
        rerender();
      } }, "Réinitialiser recherche et filtres"),
    ),
    h("div.bgs-table-scroll", null,
      h("table.bgs-table", null,
        h("thead", null, h("tr", null, ...["Priorité", "Système", "Observation", "Date", "Action"].map((x) => h("th", null, x)))),
        body,
      ),
    ),
    h("div.bgs-actions.edch-bgs-alert-pagination", null, previous, resultsStatus, next, exportButton),
    alerts.length >= 500 ? h("p.sub", null, "L'analyse est limitée à 500 alertes. Actualise les relevés et ajuste les catégories si nécessaire.") : h("span", { hidden: true }),
  );
  renderPage();
  return panel;
}
