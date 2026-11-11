/** EDCH Commandes PRO v1.6.4 — read-only .binds audit, comparison and local exports. */
import type { Bind, BindsMeta } from "../../features/controls/binds.js";
import { deviceInfo, groupOf, parseBinds } from "../../features/controls/binds.js";
import { englishActionLabel, frenchFriendlyLabel, localizedActionLabel } from "../../features/controls/actionLabels.js";
import {
  auditDevices, auditFrenchReferences, compareBindProfiles, comparisonCsv,
  essentialChecks, findInputOverlaps, type ProfileDifference,
} from "../../features/controls/controlsPro.js";
import { buildControlsPdf } from "../../features/controls/controlsPdf.js";
import { readOptionFile, type OptionFile } from "../../platform/bridge.js";
import { h } from "../../ui/dom.js";

function download(bytes: BlobPart, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

/** Never writes .binds, game settings, SQLite, IndexedDB or localStorage. */
export class ControlsProPanel {
  private left = "";
  private right = "";
  private comparing = false;
  private comparison?: ProfileDifference[];
  private comparedProfiles?: [string, string];
  private error = "";
  private current?: { meta: BindsMeta; binds: Bind[]; files: OptionFile[]; label: string };
  private host?: HTMLElement;

  render(meta: BindsMeta, binds: Bind[], optionFiles: OptionFile[], label: string): HTMLElement {
    this.current = { meta, binds, files: optionFiles, label };
    const audit = auditDevices(binds, meta);
    const overlap = findInputOverlaps(binds, (id) => groupOf(meta, id));
    const essentials = essentialChecks(binds, meta);
    const translation = auditFrenchReferences(binds, (id) => englishActionLabel(meta, id), frenchFriendlyLabel);
    const files = optionFiles.filter((f) => f.folder === "Bindings" && f.name.toLowerCase().endsWith(".binds"));
    if (this.left && !files.some((x) => x.name === this.left)) this.left = "";
    if (this.right && !files.some((x) => x.name === this.right)) this.right = "";
    if (!this.left) this.left = files[0]?.name ?? "";
    if (!this.right) this.right = files[1]?.name ?? files[0]?.name ?? "";
    const selectFile = (slot: "left" | "right", title: string) => h(
      "label", null, title, " ",
      h("select", { value: this[slot], disabled: this.comparing,
        onchange: (event: Event) => {
          this[slot] = (event.target as HTMLSelectElement).value;
          this.comparison = undefined;
          this.comparedProfiles = undefined;
          this.repaint();
        },
      }, ...files.map((f) => h("option", { value: f.name, selected: this[slot] === f.name }, f.name))),
    );
    const button = (label: string, cb: () => void, disabled=false) => h("button.ghost.small", { type: "button", onclick: cb, disabled }, label);
    const row = (head: string, info: string) => h("div.legend-row", null, h("strong", null, head), h("span", null, info));
    const summary = h("section", null,
      h("h4", null, "Bilan des affectations"),
      h("p.sub", null, `${audit.length} périphérique(s) dans le profil · ${binds.length} affectation(s) · ${overlap.length} touche(s) partagée(s) à examiner.`),
      h("p.sub", null, "Analyse des fichiers .binds uniquement : elle ne prouve pas que le X52 Pro est physiquement branché."),
      h("div.legend-grid", null, ...audit.map((d) => row(
        deviceInfo(meta, d.device).label,
        `${d.assigned} affectations · ${d.actions} actions · ${d.distinctInputs} entrées distinctes · ${d.axes} axes · ${d.sharedInputs} touches partagées${d.catalogued ? "" : " · identifiant absent du catalogue"}`,
      ))),
    );
    const diagnostics = h("section", null,
      h("h4", null, "Diagnostic des commandes"),
      h("p.sub", null, "Une combinaison utilisée pour plusieurs actions du même groupe est à examiner dans Elite Dangerous ; elle n'est pas forcément un conflit."),
      ...overlap.slice(0, 20).map((v) => row(
        `${deviceInfo(meta, v.device).label} · ${v.key}${v.modifiers ? " + " + v.modifiers : ""} · ${v.group}`,
        v.actions.map((id) => localizedActionLabel(meta, id)).join(" / "),
      )),
      overlap.length > 20 ? h("p.sub", null, `${overlap.length - 20} autre(s) combinaison(s) partagée(s).`) : null,
      essentials.length ? h("p.sub", null, `Commandes conseillées du référentiel : ${essentials.filter((e) => e.bound).length}/${essentials.length} affectée(s). Les absences ne sont pas forcément des erreurs.`) : null,
      ...essentials.filter((e) => !e.bound).slice(0, 12).map((e) => row("Non affectée (à vérifier)", `${localizedActionLabel(meta, e.action)} · ${e.action}`)),
      h("h4", null, "Vérification du vocabulaire français"),
      h("p.sub", null, `${translation.referenceFrench}/${translation.boundActions} action(s) possèdent une traduction explicite du référentiel. Les autres peuvent disposer de traductions génériques.`),
      ...translation.toReview.slice(0, 12).map((id) => row("Libellé à relire", `${localizedActionLabel(meta, id)} · ${id}`)),
      translation.toReview.length > 12 ? h("p.sub", null, `${translation.toReview.length - 12} autres libellés à relire.`) : null,
    );
    const compare = h("section", null,
      h("h4", null, "Comparer deux profils .binds"),
      h("p.sub", null, "Lecture seule. Le comparateur ne touche pas aux fichiers du jeu, aux touches X52 Pro ni au profil actif."),
      h("div.row", null,
        selectFile("left", "Ancien profil"), selectFile("right", "Nouveau profil"),
        button(this.comparing ? "Comparaison…" : "Comparer", () => { void this.compare(); },
          this.comparing || !this.left || !this.right),
      ),
      this.error ? h("p.error", { role:"alert" }, this.error) : null,
      this.comparison ? h("div", null,
        h("p.sub", null, `${this.comparison.length} différence(s) entre ${this.comparedProfiles?.[0]} et ${this.comparedProfiles?.[1]}.`),
        h("div.row", null,
          button("Exporter les différences CSV", () => download(
            comparisonCsv(this.comparison!, (id) => localizedActionLabel(meta,id)),
            "text/csv;charset=utf-8", "EDCH-Commandes-PRO-comparaison.csv"), !this.comparison.length),
        ),
        h("div.legend-grid", null,
          ...this.comparison.slice(0,100).map((d) => row(
            `${d.status === "added" ? "Ajout" : d.status === "removed" ? "Retrait" : "Modification"} · ${localizedActionLabel(meta,d.action)} (${d.slot})`,
            `${d.before.join(" | ") || "aucune"} → ${d.after.join(" | ") || "aucune"}`,
          )),
        ),
        this.comparison.length > 100 ? h("p.sub", null, "Seules les 100 premières différences sont visibles ; utiliser le CSV pour la liste complète (maximum 1 500).") : null,
      ) : null,
    );
    const report = h("div.row", null,
      button("Télécharger le diagnostic PDF", () => {
        try {
          const pdf=buildControlsPdf({devices:audit,overlaps:overlap,essentials,translations:translation,preset:label});
          download(new Uint8Array(pdf), "application/pdf", "EDCH-Commandes-PRO-diagnostic-v164.pdf");
        } catch (e) { this.error=String(e); this.repaint(); }
      }),
    );
    this.host = h("section.card.controls-pro-v164", null,
      h("h3", null, "Commandes PRO · v1.6.4"),
      h("p.sub", null, "Audit local, comparaison de profils et rapport PDF. Original EDCH : CMDR MDLuffy · contribution : Cyberpunk Philou."),
      summary, diagnostics, compare, report,
    );
    return this.host;
  }

  private repaint(): void {
    if (!this.current || !this.host?.isConnected) return;
    this.host.replaceWith(this.render(this.current.meta,this.current.binds,this.current.files,this.current.label));
  }
  private async compare(): Promise<void> {
    if (this.comparing || !this.left || !this.right) return;
    const current=this.current;
    if (!current) return;
    const from=this.left, to=this.right;
    this.comparing=true;
    this.error="";
    this.comparison=undefined;
    this.repaint();
    try {
      const [a,b]=await Promise.all([readOptionFile("Bindings",from),readOptionFile("Bindings",to)]);
      // Both profiles are parsed with the application's existing verified reader.
      const before=parseBinds(a).binds;
      const after=parseBinds(b).binds;
      if (this.left!==from || this.right!==to) return;
      this.comparison=compareBindProfiles(before,after);
      this.comparedProfiles=[from,to];
    } catch(e) {
      this.error=`Comparaison impossible : ${String((e as Error)?.message ?? e)}`;
    } finally {
      this.comparing=false;
      this.repaint();
    }
  }
}
