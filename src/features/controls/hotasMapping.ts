/** EDCH v1.6.7: compare physical joydev observations to existing .binds keys.
 * IMPORTANT: Linux joydev numbering and Elite Dangerous/Proton mapping are not guaranteed equal.
 * We only return candidates already present in the original game profile, never an automatic mapping.
 */
import type { Bind } from "./binds.js";

export interface PhysicalHotasDevice {
  id: string;
  name: string;
  vendor?: string | null;
  product?: string | null;
  readable: boolean;
}
export interface PhysicalHotasEvent {
  deviceId: string;
  kind: "button" | "axis";
  inputIndex: number;
  value: number;
}
export interface CandidateMapping {
  binding: Bind;
  offset: 0 | 1;
  /** This is only a user-verifiable candidate, not proof of button identity. */
  label: string;
}

export function isX52Device(device: Pick<PhysicalHotasDevice, "name">): boolean {
  return /\bx\s*-?\s*52\b/i.test(device.name);
}
/** Both families are recognized, but Linux button indices are still unverified. */
export function isSupportedHotasDevice(device: Pick<PhysicalHotasDevice, "name">): boolean {
  return /\bx\s*-?\s*(?:52|56)\b/i.test(device.name);
}

export function gameJoystickCandidates(
  event: PhysicalHotasEvent,
  binds: readonly Bind[],
  physical: PhysicalHotasDevice,
): CandidateMapping[] {
  if (event.kind !== "button" || event.value !== 1 || event.deviceId !== physical.id || !isSupportedHotasDevice(physical)) return [];
  if (!Number.isSafeInteger(event.inputIndex) || event.inputIndex < 0 || event.inputIndex > 255) return [];
  const possibilities: { key: string; offset: 0 | 1 }[] = [
    { key: `Joy_${event.inputIndex}`, offset: 0 },
    { key: `Joy_${event.inputIndex + 1}`, offset: 1 },
  ];
  const seen = new Set<string>();
  const out: CandidateMapping[] = [];
  for (const candidate of possibilities) {
    for (const binding of binds) {
      if (!/x52|x56|saitek|logitech/i.test(binding.device) || binding.key !== candidate.key || binding.slot === "axis" || binding.modifiers.length) continue;
      const unique = JSON.stringify([binding.device, binding.key]);
      if (seen.has(unique)) continue;
      seen.add(unique);
      out.push({ binding, offset: candidate.offset, label: `${binding.device} · ${binding.key} (hypothèse ${candidate.offset ? "+1" : "directe"})` });
    }
  }
  return out.sort((a, b) => a.offset - b.offset || a.label.localeCompare(b.label, "fr"));
}

export function x52BindingSummary(binds: readonly Bind[]): { buttons: number; axes: number; actions: number } {
  const entries = binds.filter(b => /x52|x56|saitek/i.test(b.device));
  return {
    buttons: new Set(entries.filter(b => b.slot !== "axis" && !/axis/i.test(b.key)).map(b => `${b.device}:${b.key}`)).size,
    axes: new Set(entries.filter(b => b.slot === "axis" || /axis/i.test(b.key)).map(b => `${b.device}:${b.key}`)).size,
    actions: new Set(entries.map(b => b.action)).size,
  };
}
