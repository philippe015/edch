/** Player-verified CZ log. FactionKillBond is evidence of combat, NOT CZ completion.
 * Never edits the existing per-CMDR journal history, BGS SQLite or game controls.
 */
import { isRemote } from "../../platform/bridge.js";
import { h, replace } from "../../ui/dom.js";
import {
  addCombatZone, combatZoneCsv, combatZoneSummary, deleteCombatZone,
  readCombatZones, type CzGrade, type CzKind, type CzOutcome,
} from "./combatZones.js";

const LABELS: Record<CzKind, string> = { ship: "Vaisseau", "on-foot": "Au sol (Odyssey)" };
const GRADES: Record<CzGrade, string> = {
  low: "Faible", medium: "Moyenne", high: "Élevée", unknown: "Inconnue",
};
const OUTCOMES: Record<CzOutcome, string> = {
  win: "Victoire", loss: "Défaite", unknown: "Terminée (résultat non précisé)",
};

function choice<T extends string>(items: Record<T, string>, selected: T): HTMLSelectElement {
  return h("select", { value: selected }, ...Object.entries(items).map(([value, label]) =>
    h("option", { value, selected: value === selected }, String(label)),
  ));
}

function exportLocal(filename: string, body: string, mime: string) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const anchor = h("a", { href: url, download: filename });
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function mountCombatZonesPanel(commander: string, selectedFaction: string, currentSystem?: string): HTMLElement {
  const root = h("section.card.bgs-panel.cyberpunk-cz-panel", null);
  root.appendChild(h("h3", null, "CZ effectuées · compteur personnel"));
  root.appendChild(h(
    "p.sub",
    null,
    "Une prime de faction prouve un combat mais PAS une CZ gagnée ou terminée. Le journal Elite Dangerous ne confirme pas le résultat d'une CZ : saisis ici uniquement les CZ que tu as réellement terminées. Aucune estimation d'influence BGS.",
  ));
  if (isRemote()) {
    root.appendChild(h("p.sub", null, "Enregistrement des CZ disponible sur le PC uniquement."));
    return root;
  }

  const faction = h("input", {
    type: "text", maxLength: 160, value: selectedFaction,
    placeholder: "Faction soutenue", "aria-label": "Faction soutenue dans la CZ",
  });
  const system = h("input", {
    type: "text", maxLength: 180, value: currentSystem ?? "",
    placeholder: "Système de la CZ", "aria-label": "Système de la CZ",
  });
  const kind = choice<CzKind>(LABELS, "ship");
  const grade = choice<CzGrade>(GRADES, "unknown");
  const outcome = choice<CzOutcome>(OUTCOMES, "unknown");
  const count = h("input", {
    type: "number", min: 1, max: 50, step: 1, value: "1",
    "aria-label": "Nombre de CZ terminées",
  });
  const stats = h("div.bgs-stats");
  const entries = h("div.bgs-table-scroll");
  const status = h("p", { role: "status", class: "sub" });

  const refresh = () => {
    const data = readCombatZones(commander);
    if (data.error) {
      replace(stats, h("p.error", null, "Historique CZ non lisible : " + data.error +
        " · Aucune donnée ne sera remplacée."));
      entries.replaceChildren();
      return;
    }
    const total = combatZoneSummary(data.records, faction.value.trim());
    const cards: [string, number][] = [
      ["CZ effectuées · total", total.total],
      ["CZ · 30 derniers jours", total.last30],
      ["Pour la faction indiquée", total.faction],
      ["Victoires déclarées", total.wins],
      ["Défaites déclarées", total.losses],
      ["CZ en vaisseau", total.ship],
      ["CZ au sol", total.onFoot],
    ];
    replace(stats, ...cards.map(([label, value]) =>
      h("div.card.bgs-stat", null, h("strong", null, String(value)), h("small", null, label)),
    ));
    const latest = [...data.records].reverse().slice(0, 20);
    replace(entries, latest.length
      ? h("table.bgs-table", null,
          h("thead", null, h("tr", null, ...[
            "Date", "Système", "Faction", "Type", "Niveau", "Résultat", "Nombre", "Action",
          ].map((label) => h("th", null, label)))),
          h("tbody", null, ...latest.map((record) =>
            h("tr", null,
              h("td", null, new Date(record.at).toLocaleString("fr-FR")),
              h("td", null, record.system ?? "Non précisé"),
              h("td", null, record.faction),
              h("td", null, LABELS[record.kind]),
              h("td", null, GRADES[record.grade]),
              h("td", null, OUTCOMES[record.outcome]),
              h("td", null, String(record.count)),
              h("td", null, h("button.ghost.small", {
                type: "button",
                onclick: () => {
                  if (!window.confirm("Supprimer cette déclaration de CZ ? Les autres entrées seront conservées.")) return;
                  try {
                    deleteCombatZone(commander, record.id);
                    status.textContent = "Déclaration CZ supprimée.";
                    refresh();
                  } catch (error) {
                    status.textContent = "Suppression impossible : " + String(error);
                  }
                },
              }, "Supprimer")),
            ),
          )))
      : h("p.sub", null, "Aucune CZ déclarée. Les obligations de combat déjà enregistrées dans le journal ne sont pas automatiquement converties en CZ."),
    );
  };
  faction.addEventListener("change", refresh);
  const button = h("button", {
    type: "button",
    onclick: () => {
      try {
        const n = Number(count.value);
        if (!Number.isSafeInteger(n) || n < 1 || n > 50) throw new Error("Saisis un entier entre 1 et 50.");
        addCombatZone(commander, {
          faction: faction.value.trim(), system: system.value.trim(),
          kind: kind.value as CzKind, grade: grade.value as CzGrade,
          outcome: outcome.value as CzOutcome, count: n,
        });
        status.textContent = n + " CZ terminée(s) ajoutée(s) à l'historique personnel du CMDR " + commander + ".";
        count.value = "1";
        refresh();
      } catch (error) {
        status.textContent = "Enregistrement impossible : " + String(error);
      }
    },
  }, "Enregistrer CZ effectuée(s)");

  root.appendChild(h(
    "div.bgs-actions", null,
    h("label", null, "Faction ", faction),
    h("label", null, "Système ", system),
    h("label", null, "Type ", kind),
    h("label", null, "Niveau ", grade),
    h("label", null, "Résultat ", outcome),
    h("label", null, "Nombre ", count),
    button,
  ));
  root.appendChild(status);
  root.appendChild(stats);
  root.appendChild(h(
    "div.bgs-actions", null,
    h("button.ghost.small", { type: "button", onclick: () => {
      const data = readCombatZones(commander);
      if (data.error) { status.textContent = data.error; return; }
      exportLocal("Cyberpunk-Philou-CZ-" + encodeURIComponent(commander) + ".csv",
        "\ufeff" + combatZoneCsv(commander, data.records), "text/csv;charset=utf-8");
    } }, "Exporter CZ CSV"),
    h("button.ghost.small", { type: "button", onclick: () => {
      const data = readCombatZones(commander);
      if (data.error) { status.textContent = data.error; return; }
      exportLocal("Cyberpunk-Philou-CZ-" + encodeURIComponent(commander) + ".json",
        JSON.stringify({ version: 1, commander, records: data.records }, null, 2), "application/json;charset=utf-8");
    } }, "Sauvegarder CZ JSON"),
  ));
  root.appendChild(entries);
  root.appendChild(h("p.sub", null,
    "Ces chiffres sont déclaratifs, indépendants des primes de combat, des missions et des événements du journal. Le niveau et le résultat sont choisis par le joueur. Sauvegarde JSON conseillée avant de changer d'installation.",
  ));
  refresh();
  return root;
}
