/** EDCH BGS v1.6.8.1 — Resolve an event's system only from ordered journal evidence.
 * This never claims the redemption system is the system where a bounty was earned.
 */
export type SystemEvidenceSource = "journal" | "context";
export interface SystemEvidence {
  accepted: boolean;
  system?: string;
  source?: SystemEvidenceSource;
}
const MAX_CONTEXT_MS = 24 * 60 * 60 * 1000;
const text = (v: unknown, max = 180): string | undefined =>
  typeof v === "string" && v.trim().length > 0 && v.trim().length <= max ? v.trim() : undefined;
const timestampMs = (v: unknown): number | undefined => {
  if (typeof v !== "string" || v.length > 45) return undefined;
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : undefined;
};
const equals = (a: string, b: string): boolean => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/**
 * A single sequential journal stream. Instantiate once for the feed, and reset on a full replay.
 * Never use the Store's final current location for earlier events within a journal batch.
 */
export class JournalSystemTracker {
  private owner?: string;
  private session?: string;
  private last?: { system: string; at: number };

  reset(): void {
    this.owner = undefined;
    this.session = undefined;
    this.last = undefined;
  }

  consume(event: Readonly<Record<string, unknown>>, commander: string): SystemEvidence {
    const owner = text(commander, 90);
    if (!owner) return { accepted: false };
    if (!this.owner || !equals(this.owner, owner)) {
      this.owner = owner;
      this.session = undefined;
      this.last = undefined;
    }
    const eventKind = text(event.event, 90);
    if (eventKind === "LoadGame" || eventKind === "Commander") {
      this.session = text(eventKind === "LoadGame" ? event.Commander : event.Name, 90);
      this.last = undefined;
    }
    if (this.session && !equals(this.session, owner)) return { accepted: false };
    if (eventKind === "Shutdown") this.last = undefined;
    if (eventKind === "StartJump" && event.JumpType === "Hyperspace") this.last = undefined;

    const at = timestampMs(event.timestamp);
    const system = text(event.StarSystem, 180);
    if (system && at !== undefined &&
        (eventKind === "Location" || eventKind === "FSDJump" || eventKind === "CarrierJump" || eventKind === "Docked")) {
      this.last = { system, at };
    }
    if (system) return { accepted: true, system, source: "journal" };
    if (at === undefined || !this.last || at < this.last.at || at - this.last.at > MAX_CONTEXT_MS)
      return { accepted: true };
    return { accepted: true, system: this.last.system, source: "context" };
  }
}
