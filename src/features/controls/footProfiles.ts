/** EDCH v1.6.9 — deterministic, opt-in AZERTY profiles for Odyssey OnFoot.
 * Generate a REVIEWABLE keyboard-only draft from actions actually present in the
 * chosen source .binds. No automatic input, no game writes, no HOTAS changes.
 */
import { type Bind, type BindsMeta, groupOf, parseXml } from "./binds.js";
import { conflictsForFoot, footActions, type FootChange } from "./footEdit.js";

export type FootProfileId = "azerty" | "combat" | "exploration" | "confort";
interface FootRule { action: string; key: string }
export interface FootProfile {
  id: FootProfileId;
  name: string;
  description: string;
  rules: readonly FootRule[];
}
export interface FootProfileSkip { action: string; reason: string }
export interface FootProfilePlan {
  id: FootProfileId;
  name: string;
  description: string;
  changes: FootChange[];
  alreadyCorrect: number;
  skipped: FootProfileSkip[];
  conflicts: string[];
}

const MOVE: readonly FootRule[] = [
  { action: "HumanoidForwardButton", key: "Key_Z" },
  { action: "HumanoidBackwardButton", key: "Key_S" },
  { action: "HumanoidStrafeLeftButton", key: "Key_Q" },
  { action: "HumanoidStrafeRightButton", key: "Key_D" },
  { action: "HumanoidJumpButton", key: "Key_Space" },
  { action: "HumanoidSprintButton", key: "Key_LeftShift" },
  { action: "HumanoidCrouchButton", key: "Key_LeftControl" },
];

export const FOOT_PROFILES: readonly FootProfile[] = [
  {
    id: "azerty",
    name: "AZERTY essentiel · ZQSD",
    description: "Déplacements ZQSD, saut, course, accroupissement, interaction et rechargement.",
    rules: [...MOVE,
      { action: "HumanoidPrimaryInteractButton", key: "Key_E" },
      { action: "HumanoidReloadButton", key: "Key_R" },
      { action: "HumanoidToggleFlashlightButton", key: "Key_F" },
    ],
  },
  {
    id: "combat",
    name: "Combat Odyssey · AZERTY",
    description: "Mobilité ZQSD, rechargement, mêlée, grenade, bouclier et changement d'arme.",
    rules: [...MOVE,
      { action: "HumanoidPrimaryInteractButton", key: "Key_E" },
      { action: "HumanoidReloadButton", key: "Key_R" },
      { action: "HumanoidMeleeButton", key: "Key_V" },
      { action: "HumanoidThrowGrenadeButton", key: "Key_G" },
      { action: "HumanoidToggleShieldsButton", key: "Key_H" },
      { action: "HumanoidSelectPrimaryWeaponButton", key: "Key_1" },
      { action: "HumanoidSelectSecondaryWeaponButton", key: "Key_2" },
    ],
  },
  {
    id: "exploration",
    name: "Exploration et exobiologie",
    description: "Parcours ZQSD, scanner, outils de combinaison, lampe et vision nocturne.",
    rules: [...MOVE,
      { action: "HumanoidPrimaryInteractButton", key: "Key_E" },
      { action: "HumanoidPulseScanButton", key: "Key_V" },
      { action: "HumanoidOpenAccessPanelButton", key: "Key_T" },
      { action: "HumanoidToggleFlashlightButton", key: "Key_F" },
      { action: "HumanoidToggleNightVisionButton", key: "Key_N" },
      { action: "HumanoidSwitchToCompAnalyser", key: "Key_C" },
      { action: "HumanoidSwitchToSuitTool", key: "Key_X" },
    ],
  },
  {
    id: "confort",
    name: "Confort · commandes proches",
    description: "Actions courantes autour de ZQSD, sans raccourcis multi-touches ajoutés.",
    rules: [...MOVE,
      { action: "HumanoidPrimaryInteractButton", key: "Key_E" },
      { action: "HumanoidReloadButton", key: "Key_R" },
      { action: "HumanoidToggleFlashlightButton", key: "Key_F" },
      { action: "HumanoidOpenAccessPanelButton", key: "Key_T" },
      { action: "HumanoidSwitchWeapon", key: "Key_X" },
      { action: "HumanoidItemWheelButton", key: "Key_Tab" },
    ],
  },
];

/** The XML action must exist with a writable Primary/Secondary tag. */
export function footActionsInSource(xml: string, meta: BindsMeta): string[] {
  const root = parseXml(xml).children.find((n) => n.tag === "Root");
  if (!root) return [];
  const allowed = new Set(footActions(meta));
  return root.children
    .filter((node) => allowed.has(node.tag) &&
      node.children.some((child) => child.tag === "Primary" || child.tag === "Secondary"))
    .map((node) => node.tag);
}

/** New profile never changes the original file, the HOTAS or non-OnFoot actions.
 * A proposed key is omitted whenever an unchanged OnFoot binding still owns it.
 * Existing keyboard bindings can be replaced ONLY in the staged NEW preset,
 * after the application's explicit confirmation.
 */
export function planFootProfile(
  id: FootProfileId,
  availableActions: readonly string[],
  binds: readonly Bind[],
  meta: BindsMeta,
): FootProfilePlan {
  const profile = FOOT_PROFILES.find((p) => p.id === id);
  if (!profile) throw new Error("Profil AZERTY inconnu");
  const available = new Set(availableActions.filter((action) => footActions(meta).includes(action)));
  const skipped: FootProfileSkip[] = [];
  let alreadyCorrect = 0;
  let candidates: FootChange[] = [];
  const uniqueKeys = new Set<string>();
  for (const rule of profile.rules) {
    if (!available.has(rule.action)) {
      skipped.push({ action: rule.action, reason: "Action absente du préréglage Odyssey." });
      continue;
    }
    if (uniqueKeys.has(rule.key)) {
      skipped.push({ action: rule.action, reason: "Touche déjà proposée dans le profil." });
      continue;
    }
    uniqueKeys.add(rule.key);
    const original = binds.filter((b) => b.action === rule.action && (b.slot === "primary" || b.slot === "secondary"));
    if (original.some((b) => b.device === "Keyboard" && b.key === rule.key && !b.modifiers.length)) {
      alreadyCorrect++;
      continue;
    }
    const primary = original.find((b) => b.slot === "primary");
    const secondary = original.find((b) => b.slot === "secondary");
    const slot: FootChange["slot"] | null = !primary || primary.device === "Keyboard"
      ? "primary" : !secondary || secondary.device === "Keyboard" ? "secondary" : null;
    if (!slot) {
      skipped.push({ action: rule.action, reason: "Emplacements occupés par des périphériques non clavier : conservés." });
      continue;
    }
    candidates.push({ action: rule.action, slot, key: rule.key, modifiers: [] });
  }

  // Recompute until stable: if a proposal is removed, its former key remains occupied
  // and may block another. This avoids false assurances on cascaded collisions.
  let changed = true;
  while (changed) {
    changed = false;
    const overwritten = new Set(candidates.map((c) => `${c.action}|${c.slot}`));
    const survivors: FootChange[] = [];
    for (const candidate of candidates) {
      const blocker = binds.find((b) =>
        groupOf(meta, b.action) === "OnFoot" &&
        b.device === "Keyboard" && b.slot !== "axis" &&
        b.key === candidate.key && b.modifiers.length === 0 &&
        b.action !== candidate.action &&
        !overwritten.has(`${b.action}|${b.slot}`));
      if (blocker) {
        skipped.push({ action: candidate.action, reason: `Touche occupée par ${blocker.action} : affectation ignorée.` });
        changed = true;
      } else {
        survivors.push(candidate);
      }
    }
    candidates = survivors;
  }
  const conflicts = conflictsForFoot(candidates, binds, meta);
  return { id, name: profile.name, description: profile.description,
    changes: candidates, alreadyCorrect, skipped, conflicts };
}
