// Safe, offline mission commands: translate a player's request into advice only.
// This module never calls the game, the network, the filesystem, or an AI provider.
import type { BgsState } from "../bgs/core.js";
import type { PatrolRoute } from "../bgs/routes.js";

export type PilotIntent = "next" | "route" | "status" | "help";

export interface PilotReply {
  intent: PilotIntent;
  message: string;
  /** Only an existing route waypoint; copying it requires a separate player click. */
  destination?: string;
}

export function pilotIntent(input: string): PilotIntent {
  if (typeof input !== "string" || input.length > 120) return "help";
  const text = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/\b(prochain|prochaine|cible|destination|next)\b/.test(text)) return "next";
  if (/\b(route|patrouille|itineraire|etapes)\b/.test(text)) return "route";
  if (/\b(statut|etat|bilan|status|situation)\b/.test(text)) return "status";
  return "help";
}

function safeDestination(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.trim();
  if (!name || name.length > 160 || /[\x00-\x1f\x7f]/.test(name)) return undefined;
  return name;
}

export function pilotReply(input: string, state: BgsState, route: PatrolRoute): PilotReply {
  const intent = pilotIntent(input);
  if (intent === "help") {
    return { intent, message: "Commandes : prochaine cible, itinéraire, statut. Le copilote prépare seulement des conseils." };
  }
  if (intent === "status") {
    const controlled = state.systems.filter((system) => system.controls === true).length;
    return {
      intent,
      message: "Faction : " + state.faction + " · " + state.systems.length +
        " systèmes relevés · " + controlled + " contrôlés confirmés · " +
        route.legs.length + " étapes proposées" + (state.partial ? " · données partielles" : "") + ".",
    };
  }
  if (route.origin === "unknown") {
    return {
      intent,
      message: "Départ non déterminé : rejoindre un système en jeu ou définir un ancrage BGS avec coordonnées.",
    };
  }
  if (route.legs.length === 0) {
    return { intent, message: "Aucune étape atteignable dans les limites de la patrouille actuelle." };
  }
  if (intent === "route") {
    const names = route.legs.slice(0, 5).map((leg) => safeDestination(leg.system.name)).filter(Boolean);
    return {
      intent,
      message: "Départ : " + route.originName + " · premières étapes : " + names.join(" → ") +
        (route.isPartial ? " · itinéraire partiel" : "") + ".",
    };
  }
  const destination = safeDestination(route.legs[0]?.system.name);
  if (!destination) return { intent, message: "Destination non valide dans les données BGS." };
  return {
    intent,
    destination,
    message: "Prochaine cible proposée : " + destination +
      ". Vérifie la carte galactique et confirme toi-même le tracé dans Elite Dangerous.",
  };
}
