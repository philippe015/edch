/** EDCH-BGS-v1.3 — reports generated from parsed bindings, never writes the game's .binds. */
import { actionName, comboLabel, groupOf, type Bind, type BindsMeta } from "./binds.js";
import { quoteCsv } from "../bgs/csv.js";

export interface RepeatedAssignment {
  group: string;
  combo: string;
  actions: string[];
}

/**
 * Same physical input in the same group, pointing to distinct actions.
 * This is a review hint, NOT proof of a conflict: Elite can have contextual controls.
 */
export function repeatedAssignments(meta: BindsMeta, binds: readonly Bind[]): RepeatedAssignment[] {
  const byInput = new Map<string, { group: string; combo: string; actions: Set<string> }>();
  for (const binding of binds) {
    const group = groupOf(meta, binding.action);
    const modifiers = binding.modifiers
      .map((m) => `${m.device}:${m.key}`)
      .sort()
      .join("+");
    const signature = JSON.stringify([binding.device, binding.key, modifiers, group]);
    let entry = byInput.get(signature);
    if (!entry) {
      entry = { group, combo: comboLabel(meta, binding), actions: new Set<string>() };
      byInput.set(signature, entry);
    }
    entry.actions.add(binding.action);
  }
  return [...byInput.values()]
    .filter((entry) => entry.actions.size >= 2)
    .map((entry) => ({ group: entry.group, combo: entry.combo, actions: [...entry.actions].sort() }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.combo.localeCompare(b.combo));
}

/** Semicolon CSV for LibreOffice; includes original technical ID and French/original labels. */
export function bindingsCsv(
  meta: BindsMeta,
  binds: readonly Bind[],
  displayed: (meta: BindsMeta, action: string) => string,
): string {
  const header = [
    "Périphérique",
    "Groupe",
    "Commande affichée",
    "Commande EDRefCard",
    "Identifiant Elite",
    "Touche",
    "Code touche",
    "Modificateurs",
    "Type",
    "Inversé",
  ];
  const rows = binds.map((binding) => [
    binding.device,
    groupOf(meta, binding.action),
    displayed(meta, binding.action),
    actionName(meta, binding.action),
    binding.action,
    comboLabel(meta, binding),
    binding.key,
    binding.modifiers.map((m) => `${m.device}:${m.key}`).join(" + "),
    binding.slot,
    binding.inverted ? "oui" : "non",
  ]);
  return [header, ...rows].map((row) => row.map(quoteCsv).join(";")).join("\n");
}
