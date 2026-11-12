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
import { h, icon, toast } from "../../ui/dom.js";

export class OnFootEditor {
  private action = "";
  private slot: "primary" | "secondary" = "primary";
  private listening = false;
  private draft: FootChange[] = [];
  private message = "";
  private busy = false;

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
    const selected = this.action;
    const current = binds.find((b) => b.action === selected && b.slot === this.slot);
    const staged = this.draft.find((c) => c.action === selected && c.slot === this.slot);
    const conflicts = conflictsForFoot(this.draft, binds, meta);
    const editable = isTauri() && !isRemote() && !!source && !!actions.length;

    const capture = h(
      "button.ghost.small",
      {
        disabled: !editable || this.busy,
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
            disabled: !editable || this.busy,
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
