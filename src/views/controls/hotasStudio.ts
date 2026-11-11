/** EDCH v1.6.7 HOTAS Studio. Physical joystick capture via Linux joydev, opt-in only.
 * Shows raw Linux indices, NEVER assumes they equal Elite Dangerous button IDs.
 * Candidate matches must exist in the user's .binds and be clicked explicitly.
 */
import type { Bind } from "../../features/controls/binds.js";
import {
  gameJoystickCandidates, isX52Device, x52BindingSummary,
  type CandidateMapping, type PhysicalHotasDevice, type PhysicalHotasEvent,
} from "../../features/controls/hotasMapping.js";
import { hotasCapture, hotasDevices, isRemote, isTauri } from "../../platform/bridge.js";
import { h } from "../../ui/dom.js";

export class HotasStudio {
  private host?: HTMLElement;
  private scanned = false;
  private scanning = false;
  private capturing = false;
  private devices: PhysicalHotasDevice[] = [];
  private chosen = "";
  private message = "";
  private last?: PhysicalHotasEvent;
  private context?: { binds: Bind[]; onPick: (b: Bind) => void };

  render(binds: Bind[], onPick: (b: Bind) => void): HTMLElement {
    this.context = { binds, onPick };
    const enabled = isTauri() && !isRemote();
    if (enabled && !this.scanned && !this.scanning) void this.scan();
    const x52 = this.devices.filter(isX52Device);
    if (this.devices.length && !this.devices.some(d => d.id === this.chosen)) this.chosen = x52[0]?.id ?? this.devices[0].id;
    const device = this.devices.find(d => d.id === this.chosen);
    const summary = x52BindingSummary(binds);
    const matches: CandidateMapping[] = this.last && device ? gameJoystickCandidates(this.last, binds, device) : [];
    const btn = (title: string, onClick: () => void, disabled = false) =>
      h("button.edch-c166-btn", { type: "button", onclick: onClick, disabled }, title);
    const label = (txt: string) => h("p.edch-c166-muted", null, txt);
    const deviceList = h("label.edch-hotas-device", null, "Périphérique Linux détecté",
      h("select", { value: this.chosen, disabled: this.scanning || this.capturing, onchange: (e: Event) => {
        this.chosen = (e.target as HTMLSelectElement).value;
        this.last = undefined;
        this.repaint();
      } }, ...this.devices.map(d => h("option", { value: d.id, selected: d.id === this.chosen },
        `${d.name} · ${d.id}${d.readable ? "" : " · accès limité"}`))));
    const layout = h("div.edch-hotas-visuals", null,
      h("div.edch-hotas-hardware", null,
        h("div.edch-hotas-stick", { "aria-hidden": "true" },
          h("span.edch-hotas-stick-handle"), h("span.edch-hotas-stick-base")),
        h("strong", null, "Joystick X52 Pro"),
        h("small", null, `${summary.buttons} bouton(s) identifié(s) dans le .binds`)),
      h("div.edch-hotas-hardware", null,
        h("div.edch-hotas-throttle", { "aria-hidden": "true" },
          h("span.edch-hotas-throttle-lever"), h("span.edch-hotas-throttle-base")),
        h("strong", null, "Manette des gaz"),
        h("small", null, `${summary.axes} axe(s) présent(s) dans le .binds`)),
    );
    const captures = h("div.edch-hotas-capture", null,
      btn("Rechercher le HOTAS", () => { void this.scan(); }, !enabled || this.scanning || this.capturing),
      btn(this.capturing ? "Capture en cours…" : "Capturer un bouton", () => { void this.capture("button"); },
        !enabled || !device?.readable || this.scanning || this.capturing),
      btn("Observer un axe", () => { void this.capture("axis"); },
        !enabled || !device?.readable || this.scanning || this.capturing));
    const candidateRows = matches.map(candidate => h("div.edch-hotas-candidate", null,
      h("span", null, candidate.label),
      btn("Choisir cette touche", () => {
        this.context?.onPick(candidate.binding);
        this.message = "Touche candidate sélectionnée. Vérifie l'action et ajoute-la au brouillon avant de créer un profil.";
        this.repaint();
      }),
    ));
    const observation = this.last ? h("div.edch-hotas-result", null,
      h("strong", null, this.last.kind === "button"
        ? `Bouton physique Linux n° ${this.last.inputIndex} (index démarrant à 0)`
        : `Axe physique Linux n° ${this.last.inputIndex} · valeur ${this.last.value}`),
      this.last.kind === "axis" ? label("L'axe est identifié pour diagnostic seulement : son affectation analogique n'est pas modifiée.") :
        matches.length ? h("div", null,
          label("Correspondances candidates dans le profil du jeu. Linux et Proton peuvent numéroter différemment : vérifie le bouton avant d'utiliser une proposition."),
          ...candidateRows,
        ) : label("Aucune correspondance X52 Pro vérifiable dans le .binds source : aucune touche n'est choisie automatiquement."),
    ) : null;
    this.host = h("section.card.edch-hotas-v167", null,
      h("div.edch-hotas-heading", null,
        h("div", null, h("p.edch-c166-eyebrow", null, "PÉRIPHÉRIQUE PHYSIQUE · MANJARO"),
          h("h3", null, "HOTAS Studio · v1.6.7")),
        h("span.edch-c166-chip", null, x52.length ? "X52 Pro repéré" : this.scanning ? "Recherche…" : "X52 Pro non confirmé")),
      layout,
      label("Schéma indicatif : les zones joystick/manette des gaz et les nombres proviennent du profil, pas d'un relevé détaillé des boutons physiques."),
      enabled ? (this.devices.length ? deviceList : label("Aucun /dev/input/jsN détecté. Vérifie la connexion USB et le module Linux joydev."))
        : label("Capture matérielle disponible uniquement dans EDCH installé sur Linux ; indisponible en mode démo/remote."),
      captures,
      this.message ? h("p.edch-hotas-message", { role: "status" }, this.message) : null,
      observation,
      label("Une pression détectée n'écrit jamais dans le jeu. Le profil source reste intact ; l'enregistrement nécessite une validation explicite dans l'éditeur Commandes."),
    );
    return this.host;
  }

  private repaint(): void {
    const c = this.context;
    if (!c || !this.host?.isConnected) return;
    this.host.replaceWith(this.render(c.binds, c.onPick));
  }

  private async scan(): Promise<void> {
    if (this.scanning || this.capturing) return;
    this.scanning = true;
    this.message = "Recherche des joysticks Linux…";
    this.repaint();
    try {
      this.devices = await hotasDevices();
      this.scanned = true;
      this.message = this.devices.length ? `${this.devices.length} périphérique(s) joystick trouvé(s).` :
        "Aucun joystick /dev/input/jsN visible. L'application ne modifie pas les pilotes Linux.";
    } catch (e) {
      this.scanned = true;
      this.message = `Détection indisponible : ${String(e)}`;
    } finally { this.scanning = false; this.repaint(); }
  }

  private async capture(kind: "button" | "axis"): Promise<void> {
    if (this.capturing || this.scanning || !this.chosen) return;
    this.capturing = true; this.last = undefined;
    const device = this.chosen;
    this.message = kind === "button" ? "Appuie sur un bouton du HOTAS (10 secondes)…" : "Déplace un axe du HOTAS (10 secondes)…";
    this.repaint();
    try {
      const result = await hotasCapture(device, kind, 10_000);
      if (this.chosen === device) {
        this.last = result;
        this.message = kind === "button" ? "Événement physique reçu. Les correspondances possibles sont présentées ci-dessous." :
          "Mouvement d'axe capturé : diagnostic uniquement.";
      }
    } catch (e) { this.message = `Capture impossible : ${String(e)}`; }
    finally { this.capturing = false; this.repaint(); }
  }
}
