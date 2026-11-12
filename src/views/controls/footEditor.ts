// EDCH-ONFOOT-EDIT-v1.4.4 — opt-in editor for Odyssey "On Foot" keyboard bindings.
// Stages changes in EDCH and saves a NEW .binds preset; never overwrites the source.
import { type Bind, type BindsMeta, fileForPreset } from "../../features/controls/binds.js";
import { captureFootKey, conflictsForFoot, footActions, type FootChange } from "../../features/controls/footEdit.js";
import { localizedActionLabel } from "../../features/controls/actionLabels.js";
import {
  footSavePreset,
  gameRunning,
  isRemote,
  isTauri,
  type FootPresetResult,
  type OptionFile,
} from "../../platform/bridge.js";
import { h, icon, replace, toast } from "../../ui/dom.js";
import { localizedKeyLabel } from "../../features/controls/actionLabels.js";
import {
  FOOT_CATEGORIES, footQuickActions, planFootAzerty, type FootQuickCategory,
} from "../../features/controls/footQuick.js";

export class OnFootEditor {
  private action = "";
  private slot: "primary" | "secondary" = "primary";
  private listening = false;
  private draft: FootChange[] = [];
  private message = "";
  private busy = false;
  private quickCategory: FootQuickCategory = "essential";
  private quickSearch = "";
  private draftSource = "";

  render(
    meta: BindsMeta,
    binds: Bind[],
    files: OptionFile[],
    presets: string[],
    chosen: string,
    redraw: () => void,
    reload: (file: string) => Promise<void>,
  ): HTMLElement {
    const actions = footActions(meta);
    if (!actions.includes(this.action)) this.action = actions[0] ?? "";
    const source =
      chosen ||
      fileForPreset(
        presets[3] ?? "",
        files.map((f) => f.name),
      ) ||
      "";
    // Changing the source never silently carries a draft over to another .binds profile.
    if (this.draftSource !== source) {
      if (this.draft.length) this.message = "Changement de profil : ancien brouillon annulé pour éviter une mauvaise attribution.";
      this.draft = [];
      this.listening = false;
      this.draftSource = source;
    }
    const selected = this.action;
    const current = binds.find((b) => b.action === selected && b.slot === this.slot);
    const staged = this.draft.find((c) => c.action === selected && c.slot === this.slot);
    const conflicts = conflictsForFoot(this.draft, binds, meta);
    const editable = isTauri() && !isRemote() && !!source && !!actions.length;
    const slotProtected = (action: string, slot: "primary" | "secondary") => {
      const existing = binds.find((b) => b.action === action && b.slot === slot);
      return existing !== undefined && existing.device !== "Keyboard";
    };
    const preview = (action: string, slot: "primary" | "secondary"): string => {
      const candidate = this.draft.find((d) => d.action === action && d.slot === slot);
      if (candidate) {
        return candidate.key
          ? "Brouillon : " + [...candidate.modifiers, candidate.key].map((k) => localizedKeyLabel(meta, k)).join(" + ")
          : "Brouillon : effacé";
      }
      const existing = binds.find((b) => b.action === action && b.slot === slot);
      return existing
        ? existing.device + " · " + [...existing.modifiers.map((m) => m.key), existing.key]
          .map((key) => localizedKeyLabel(meta, key)).join(" + ")
        : "Libre";
    };
    const captureQuick = (action: string, slot: "primary" | "secondary"): HTMLButtonElement => {
      const occupied = slotProtected(action, slot);
      let button: HTMLButtonElement;
      button = h("button.ghost.small", {
        type: "button",
        disabled: !editable || this.busy || occupied,
        title: occupied ? "Emplacement souris/HOTAS protégé : utilise un emplacement libre." : "Cliquer puis appuyer sur la touche souhaitée",
        onclick: () => {
          this.action = action;
          this.slot = slot;
          this.listening = true;
          button.textContent = "Appuie sur une touche · Échap annule";
          button.focus();
        },
        onkeydown: (event: KeyboardEvent) => {
          if (!this.listening || this.action !== action || this.slot !== slot) return;
          event.preventDefault();
          event.stopPropagation();
          if (event.code === "Escape") {
            this.listening = false;
            redraw();
            return;
          }
          const pressed = captureFootKey(event);
          this.listening = false;
          if (!pressed) {
            this.message = "Touche non reconnue : utilise une lettre, un chiffre, une flèche ou F1–F12.";
          } else {
            this.draft = this.draft.filter((d) => d.action !== action || d.slot !== slot);
            this.draft.push({ action, slot, key: pressed.key, modifiers: pressed.modifiers });
            this.message = localizedActionLabel(meta, action) + " : " + pressed.label + " ajouté au brouillon.";
          }
          redraw();
        },
      }, slot === "primary" ? "Changer P" : "Changer S");
      return button;
    };
    const quickList = h("div.foot-quick-list");
    const quickCount = h("span.sub");
    const refreshQuick = () => {
      const rows = footQuickActions(meta, this.quickCategory, this.quickSearch, (action) => localizedActionLabel(meta, action));
      quickCount.textContent = rows.length + " commandes";
      replace(quickList, ...rows.map((row) =>
        h("div.foot-quick-row", null,
          h("div.foot-quick-action", null,
            h("strong", null, row.label),
            h("small", null, row.action),
            h("span.sub", null, "P : " + preview(row.action, "primary") + " · S : " + preview(row.action, "secondary")),
          ),
          h("div.foot-quick-row-buttons", null,
            captureQuick(row.action, "primary"),
            captureQuick(row.action, "secondary"),
          ),
        ),
      ));
      if (!rows.length) quickList.appendChild(h("p.sub", null, "Aucune commande trouvée dans cette catégorie."));
    };
    refreshQuick();
    const quickPanel = h("section.foot-quick", null,
      h("h4", null, "Réglage rapide · commandes à pied"),
      h("p.sub", null, "Choisis une commande, clique sur Changer P ou S, puis appuie directement sur la touche. Le profil original n'est pas modifié."),
      h("div.foot-quick-tabs", null, ...FOOT_CATEGORIES.map((cat) =>
        h("button.ghost.small", {
          type: "button",
          class: this.quickCategory === cat.id ? "active" : "",
          onclick: () => { this.quickCategory = cat.id; redraw(); },
        }, cat.label),
      )),
      h("label.foot-quick-search", null, "Rechercher une action : ",
        h("input", {
          type: "search",
          maxLength: 120,
          value: this.quickSearch,
          placeholder: "Sauter, courir, recharger, interagir…",
          oninput: (event: Event) => {
            this.quickSearch = (event.target as HTMLInputElement).value;
            refreshQuick();
          },
        }),
      ),
      quickCount,
      quickList,
      h("div.row", { style: { flexWrap: "wrap", gap: "8px", marginTop: "10px" } },
        h("button.ghost", {
          type: "button",
          disabled: !editable || this.busy,
          onclick: () => {
            const plan = planFootAzerty(meta, binds, this.draft);
            this.draft.push(...plan.changes);
            const summary = plan.skipped.slice(0, 3)
              .map((item) => localizedActionLabel(meta, item.action) + " (" + item.reason + ")")
              .join(" · ");
            this.message = "Suggestion AZERTY : " + plan.changes.length + " ajout(s), " +
              plan.alreadyConfigured + " déjà configurée(s), " + plan.skipped.length + " ignorée(s)." +
              (summary ? " " + summary : "");
            redraw();
          },
        }, "Préparer des touches AZERTY (sans enregistrer)"),
      ),
      h("p.sub", null, "Les suggestions AZERTY évitent les touches déjà occupées et les emplacements réservés à la souris/HOTAS. Elles restent un brouillon jusqu'à la création du nouveau profil."),
    );

    const capture = h(
      "button.ghost.small",
      {
        disabled: !editable || this.busy || slotProtected(this.action, this.slot),
        onclick: () => {
          this.listening = true;
          capture.textContent = "Appuie sur une touche… (Échap pour annuler)";
          capture.focus();
        },
        onkeydown: (e: KeyboardEvent) => {
          if (!this.listening) return;
          e.preventDefault();
          e.stopPropagation();
          if (e.code === "Escape") {
            this.listening = false;
            redraw();
            return;
          }
          const pressed = captureFootKey(e);
          if (!pressed) {
            this.message =
              "Touche non reconnue : utilise une lettre, un chiffre, F1–F12, une flèche ou une touche standard.";
            return redraw();
          }
          this.listening = false;
          this.draft = this.draft.filter((c) => c.action !== this.action || c.slot !== this.slot);
          this.draft.push({ action: this.action, slot: this.slot, key: pressed.key, modifiers: pressed.modifiers });
          this.message = `Brouillon : ${localizedActionLabel(meta, this.action)} → ${pressed.label}`;
          redraw();
        },
      },
      "Appuyer pour attribuer une touche",
    );

    const save = async () => {
      if (!editable || this.busy || !this.draft.length) return;
      if (this.draft.some((d) => slotProtected(d.action, d.slot))) {
        this.message = "Une touche appartient à la souris/HOTAS : cette modification est interdite.";
        redraw();
        return;
      }
      this.busy = true;
      try {
        const running = await gameRunning();
        if (running === "game") throw new Error("Ferme Elite Dangerous avant d'enregistrer le profil.");
        const warning = conflicts.length
          ? `\n\nAttention : ${conflicts.length} collision(s) possibles dans les commandes à pied.`
          : "";
        if (
          !window.confirm(
            `Créer un nouveau préréglage EDCHFoot à partir de ${source} ?\n${this.draft.length} modification(s).\n\n` +
              "Le fichier original et les commandes HOTAS resteront intacts." +
              warning,
          )
        )
          return;
        const result: FootPresetResult = await footSavePreset(source, this.draft);
        this.draft = [];
        this.message = `Préréglage créé : ${result.path}. Dans Elite Dangerous : Options → Commandes → À pied → Préréglage : ${result.preset}.`;
        await reload(result.filename);
        toast("Préréglage EDCHFoot créé : redémarre le jeu et sélectionne-le dans À pied.");
      } catch (error) {
        this.message = `Échec de l'enregistrement : ${String((error as Error)?.message ?? error)}`;
      } finally {
        this.busy = false;
        redraw();
      }
    };

    return h(
      "section.card",
      { style: { marginTop: "12px", marginBottom: "12px", padding: "16px" } },
      h("h3", null, "Éditeur clavier · À pied (Odyssey)"),
      h(
        "p.sub",
        null,
        "Attribue une touche à une action. Enregistrer crée un nouveau profil EDCHFoot, sans modifier Custom, les fichiers .binds existants ni le X52 Pro.",
      ),
      !isTauri() || isRemote()
        ? h("p.notice", null, icon("warn"), " Édition disponible uniquement sur EDCH installé sur le PC.")
        : null,
      !source
        ? h(
            "p.notice",
            null,
            icon("warn"),
            " Aucun fichier .binds personnel disponible pour « À pied ». Dans le jeu, modifie et enregistre une touche pour créer un profil Custom, puis clique sur Actualiser les commandes.",
          )
        : null,
      source
        ? h("p.sub", null, "Préréglage de départ : ", h("code", null, source), " — L'original ne sera jamais écrasé.")
        : null,
      quickPanel,
      h("details.foot-quick-advanced", null,
        h("summary", null, "Mode avancé : sélectionner parmi toutes les actions Odyssey"),
      h(
        "div.row",
        { style: { flexWrap: "wrap", gap: "8px", alignItems: "center" } },
        h(
          "label",
          null,
          "Action : ",
          h(
            "select",
            {
              disabled: !editable || this.busy,
              onchange: (e: Event) => {
                this.action = (e.target as HTMLSelectElement).value;
                redraw();
              },
            },
            actions.map((a) => h("option", { value: a, selected: a === selected }, localizedActionLabel(meta, a))),
          ),
        ),
        h(
          "label",
          null,
          "Emplacement : ",
          h(
            "select",
            {
              disabled: !editable || this.busy,
              onchange: (e: Event) => {
                this.slot = (e.target as HTMLSelectElement).value as "primary" | "secondary";
                redraw();
              },
            },
            h("option", { value: "primary", selected: this.slot === "primary" }, "Principal"),
            h("option", { value: "secondary", selected: this.slot === "secondary" }, "Secondaire"),
          ),
        ),
        capture,
        h(
          "button.ghost.small",
          {
            disabled: !editable || this.busy || slotProtected(this.action, this.slot),
            onclick: () => {
              this.draft = this.draft.filter((c) => c.action !== this.action || c.slot !== this.slot);
              this.draft.push({ action: this.action, slot: this.slot, key: "", modifiers: [] });
              this.message = "Effacement de cet emplacement préparé (non encore enregistré).";
              redraw();
            },
          },
          "Effacer cette touche",
        ),
      ),
      ),
      h(
        "p.sub",
        null,
        "Actuellement : ",
        current ? `${current.device} — ${current.key}` : "non attribué",
        staged
          ? ` | Brouillon : ${staged.key || "vide"}${staged.modifiers.length ? ` (${staged.modifiers.join(" + ")})` : ""}`
          : "",
      ),
      conflicts.length
        ? h(
            "p.notice",
            null,
            icon("warn"),
            ` ${conflicts.length} chevauchement(s) : ${conflicts
              .slice(0, 4)
              .map((c) =>
                c
                  .split(" / ")
                  .map((a) => localizedActionLabel(meta, a))
                  .join(" / "),
              )
              .join(" ; ")}`,
          )
        : null,
      this.draft.length
        ? h(
            "div",
            null,
            h("p", null, `${this.draft.length} modification(s) à enregistrer :`),
            ...this.draft.map((d) =>
              h(
                "div.row",
                { style: { gap: "10px" } },
                h(
                  "span",
                  null,
                  `${localizedActionLabel(meta, d.action)} (${d.slot === "primary" ? "Principal" : "Secondaire"}) : ${d.modifiers.join(" + ")}${d.modifiers.length ? " + " : ""}${d.key || "Effacer"}`,
                ),
                h(
                  "button.ghost.small",
                  {
                    onclick: () => {
                      this.draft = this.draft.filter((x) => x !== d);
                      redraw();
                    },
                  },
                  "Retirer",
                ),
              ),
            ),
          )
        : null,
      h(
        "div.row",
        { style: { gap: "8px", marginTop: "8px" } },
        h(
          "button.primary",
          {
            disabled: !editable || !this.draft.length || this.busy,
            onclick: () => {
              void save();
            },
          },
          this.busy ? "Enregistrement…" : `Créer le profil EDCHFoot (${this.draft.length})`,
        ),
        h(
          "button.ghost.small",
          {
            disabled: !this.draft.length || this.busy,
            onclick: () => {
              this.draft = [];
              this.message = "Brouillon annulé.";
              redraw();
            },
          },
          "Annuler le brouillon",
        ),
      ),
      this.message ? h("p.notice", null, this.message) : null,
      h(
        "p.sub",
        null,
        "Après enregistrement : fermer ou redémarrer Elite Dangerous → Options → Commandes → À pied → sélectionner EDCHFoot… → Appliquer. Les commandes du vaisseau et du SRV ne changent pas.",
      ),
    );
  }
}
