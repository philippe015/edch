// Cyberpunk Philou mission control: an explicitly supervised route hand-off.
import { clipboardWrite, isRemote } from "../../platform/bridge.js";
import type { BgsState } from "../bgs/core.js";
import type { PatrolRoute } from "../bgs/routes.js";
import { h } from "../../ui/dom.js";
import { pilotReply } from "./missionControl.js";

export function mountMissionControlPanel(state: BgsState, route: PatrolRoute): HTMLElement {
  let prepared: string | undefined;
  const message = h("p", { role: "status" }, "Conseils locaux disponibles.");
  const copy = h("button", {
    type: "button",
    disabled: true,
    onclick: () => {
      const destination = prepared;
      if (!destination) return;
      void clipboardWrite(destination)
        .catch(() => navigator.clipboard.writeText(destination))
        .then(() => { message.textContent = "Destination copiée : " + destination + ". Ouvre la carte galactique et colle le nom toi-même."; })
        .catch((error: unknown) => { message.textContent = "Presse-papiers indisponible : " + String(error); });
    },
  }, "Copier la destination");
  const command = h("input", {
    type: "text",
    maxLength: 120,
    placeholder: "Prochaine cible, patrouille, statut...",
    "aria-label": "Commande du copilote",
  });
  const run = (input: string) => {
    const reply = pilotReply(input, state, route);
    prepared = reply.destination;
    copy.disabled = !prepared || isRemote();
    message.textContent = reply.message;
  };
  command.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    run(command.value);
  });
  const root = h(
    "section.card.bgs-panel.philou-mission-control",
    null,
    h("h2", null, "CYBERPUNK PHILOU · Copilote BGS"),
    h(
      "p.sub",
      null,
      "Commande locale assistée, sans modèle IA connecté pour le moment. Lecture des itinéraires existants uniquement : aucune touche, saut ou action en jeu n'est exécuté automatiquement.",
    ),
    h("div.bgs-actions", null,
      command,
      h("button", { type: "button", onclick: () => run(command.value) }, "Analyser"),
      h("button", { type: "button", onclick: () => run("prochaine cible") }, "Prochaine cible"),
      h("button", { type: "button", onclick: () => run("itinéraire") }, "Patrouille"),
      h("button", { type: "button", onclick: () => run("statut") }, "Statut"),
      copy,
    ),
    message,
    h("p.sub", null, "La destination doit être vérifiée puis confirmée dans la carte du jeu par le commandant."),
  );
  run("statut");
  return root;
}
