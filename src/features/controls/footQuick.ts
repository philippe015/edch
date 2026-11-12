/** Cyberpunk Philou — a small, testable discovery and suggestion layer for Odyssey.
 * Identifiers come from Elite .binds metadata; neither this module nor its suggestions write game files.
 */
import { type Bind, type BindsMeta } from "./binds.js";
import { footActions, type FootChange } from "./footEdit.js";

export type FootQuickCategory = "essential" | "all" | "movement" | "combat" | "equipment" | "other";
export const FOOT_CATEGORIES: { id: FootQuickCategory; label: string }[] = [
  { id: "essential", label: "Essentielles" },
  { id: "all", label: "Toutes les commandes" },
  { id: "movement", label: "Déplacement" },
  { id: "combat", label: "Combat" },
  { id: "equipment", label: "Équipement" },
  { id: "other", label: "Autres" },
];

const GROUPS: { id: Exclude<FootQuickCategory, "essential" | "all">; label: string; actions: string[] }[] = [
  {
    id: "movement",
    label: "Déplacement",
    actions: [
      "HumanoidForwardButton", "HumanoidBackwardButton", "HumanoidStrafeLeftButton",
      "HumanoidStrafeRightButton", "HumanoidJumpButton", "HumanoidSprintButton",
      "HumanoidCrouchButton", "HumanoidToggleJumpAssistModuleButton",
      "GalaxyMapOpen_Humanoid", "SystemMapOpen_Humanoid",
    ],
  },
  {
    id: "combat",
    label: "Combat",
    actions: [
      "HumanoidPrimaryFireButton", "HumanoidZoomButton", "HumanoidReloadButton",
      "HumanoidMeleeButton", "HumanoidHideWeaponButton",
      "HumanoidSelectPrimaryWeaponButton", "HumanoidSelectSecondaryWeaponButton",
      "HumanoidSwitchWeapon", "HumanoidThrowGrenadeButton",
      "HumanoidToggleShieldsButton", "HumanoidToggleShieldBoosterModuleButton",
    ],
  },
  {
    id: "equipment",
    label: "Équipement & interactions",
    actions: [
      "HumanoidPrimaryInteractButton", "HumanoidSecondaryInteractButton",
      "HumanoidToggleFlashlightButton", "HumanoidToggleNightVisionButton",
      "HumanoidItemWheelButton", "HumanoidSwitchToSuitTool", "HumanoidSwitchToRechargeTool",
      "HumanoidPulseScanButton", "HumanoidOpenAccessPanelButton",
      "HumanoidActivateSuitAbilityButton", "HumanoidToggleMissionHelpPanelButton",
    ],
  },
];
const ESSENTIAL = [
  "HumanoidForwardButton", "HumanoidBackwardButton", "HumanoidStrafeLeftButton",
  "HumanoidStrafeRightButton", "HumanoidJumpButton", "HumanoidSprintButton",
  "HumanoidCrouchButton", "HumanoidPrimaryInteractButton", "HumanoidReloadButton",
  "HumanoidHideWeaponButton", "HumanoidToggleFlashlightButton",
  "HumanoidItemWheelButton", "HumanoidToggleShieldsButton",
];

export function footQuickGroup(action: string): Exclude<FootQuickCategory, "essential" | "all"> {
  return GROUPS.find((group) => group.actions.includes(action))?.id ?? "other";
}

const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();

export interface FootQuickAction {
  action: string;
  category: Exclude<FootQuickCategory, "essential" | "all">;
  label: string;
}

export function footQuickActions(
  meta: BindsMeta,
  category: FootQuickCategory,
  query: string,
  label: (action: string) => string,
): FootQuickAction[] {
  const allowed = new Set(footActions(meta));
  const term = fold(query.slice(0, 120));
  const actions = category === "essential"
    ? ESSENTIAL.filter((action) => allowed.has(action))
    : [...allowed].filter((action) => category === "all" || footQuickGroup(action) === category);
  return actions
    .map((action) => ({ action, category: footQuickGroup(action), label: label(action) }))
    .filter((row) => !term || fold(row.label).includes(term) || fold(row.action).includes(term))
    .sort((a, b) => category === "essential" ? 0 : a.label.localeCompare(b.label, "fr"));
}

const AZERTY_KEYS = [
  ["HumanoidForwardButton", "Key_Z"],
  ["HumanoidBackwardButton", "Key_S"],
  ["HumanoidStrafeLeftButton", "Key_Q"],
  ["HumanoidStrafeRightButton", "Key_D"],
  ["HumanoidJumpButton", "Key_Space"],
  ["HumanoidSprintButton", "Key_LeftShift"],
  ["HumanoidCrouchButton", "Key_C"],
  ["HumanoidPrimaryInteractButton", "Key_E"],
  ["HumanoidReloadButton", "Key_R"],
  ["HumanoidToggleFlashlightButton", "Key_L"],
] as const;

export interface FootAzertyPlan {
  changes: FootChange[];
  alreadyConfigured: number;
  skipped: { action: string; reason: string }[];
}

const slotId = (action: string, slot: string) => action + "|" + slot;

export function planFootAzerty(
  meta: BindsMeta,
  binds: readonly Bind[],
  staged: readonly FootChange[],
): FootAzertyPlan {
  const supported = new Set(footActions(meta));
  const changes: FootChange[] = [];
  const skipped: FootAzertyPlan["skipped"] = [];
  let alreadyConfigured = 0;
  const pending = new Set(staged.map((change) => slotId(change.action, change.slot)));
  const effective = binds
    .filter((bind) => bind.device === "Keyboard" && !pending.has(slotId(bind.action, bind.slot)))
    .map((bind) => ({ action: bind.action, key: bind.key, mods: bind.modifiers.map((m) => m.key).sort().join("+") }));
  for (const change of staged) {
    if (change.key) effective.push({ action: change.action, key: change.key, mods: change.modifiers.slice().sort().join("+") });
  }
  for (const [action, key] of AZERTY_KEYS) {
    if (!supported.has(action)) {
      skipped.push({ action, reason: "Action absente du profil" });
      continue;
    }
    if (pending.has(slotId(action, "primary"))) {
      skipped.push({ action, reason: "Emplacement déjà modifié dans le brouillon" });
      continue;
    }
    const current = binds.find((bind) => bind.action === action && bind.slot === "primary");
    if (current && current.device !== "Keyboard") {
      skipped.push({ action, reason: "Emplacement réservé à la souris ou au HOTAS" });
      continue;
    }
    if (current?.key === key && current.modifiers.length === 0) {
      alreadyConfigured++;
      continue;
    }
    if (effective.some((entry) => entry.key === key && entry.mods === "" && entry.action !== action)) {
      skipped.push({ action, reason: "Touche utilisée par une autre commande" });
      continue;
    }
    changes.push({ action, slot: "primary", key, modifiers: [] });
    const oldIndex = effective.findIndex((entry) => entry.action === action && entry.key === current?.key);
    if (oldIndex >= 0) effective.splice(oldIndex, 1);
    effective.push({ action, key, mods: "" });
  }
  return { changes, alreadyConfigured, skipped };
}
