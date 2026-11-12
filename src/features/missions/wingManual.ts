// EDCH BGS v1.4.9.1 — explicit manual confirmation of missions received from a wingmate.
// The Elite Dangerous journal cannot be treated as proof of another CMDR's invitation.
// Only known, currently published missions can be confirmed: no invented journal events.
import type { WingMission } from "../../services/wing.js";

export interface ManualWingReceipt {
  /** Frontier mission id, as broadcast by the mission owner. */
  id: number;
  /** Normalised wing code to prevent acknowledgements leaking between wings. */
  code: string;
  /** When this CMDR explicitly confirmed accepting this mission in-game. */
  at: string;
}

export const wingScope = (code: string): string => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function manualWingCopies(
  receipts: ManualWingReceipt[],
  code: string,
  known: WingMission[],
  mine: WingMission[],
  now = Date.now(),
): WingMission[] {
  if (!Array.isArray(receipts)) return [];
  const scope = wingScope(code);
  if (scope.length < 8) return [];
  const used = new Set(mine.map((m) => m.id));
  const copies: WingMission[] = [];
  for (const receipt of receipts) {
    if (!receipt || receipt.code !== scope || !Number.isSafeInteger(receipt.id) || receipt.id <= 0) continue;
    if (used.has(receipt.id)) continue;
    const owner = known.find((mission) => mission.id === receipt.id && !mission.manualConfirmed);
    if (!owner) continue; // Do not echo a forwarded manual confirmation as the owner.
    if (owner.expiry && Number.isFinite(Date.parse(owner.expiry)) && Date.parse(owner.expiry) <= now) continue;
    const age = now - Date.parse(receipt.at);
    if (!Number.isFinite(age) || age < -60_000 || age > 30 * 86_400_000) continue;
    used.add(receipt.id);
    copies.push({ ...owner, manualConfirmed: true });
    if (mine.length + copies.length >= 20) break; // ntfy packet stays within EDCH's existing limit.
  }
  return copies;
}
