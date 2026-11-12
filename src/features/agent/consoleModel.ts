/** Local-only, bounded diagnostic history for the EDCH Agent COG console. */
import { verifyAction, type AgentAction } from "./protocol.js";

export interface ConsoleEntry {
  at: string;
  category: string;
  message: string;
  source: "journal";
}

export const CONSOLE_LIMIT = 100;

export function consoleEntry(value: unknown): ConsoleEntry | null {
  if (!verifyAction(value)) return null;
  const action: AgentAction = value;
  return {
    at: action.at,
    category: action.type,
    message: action.text,
    source: "journal",
  };
}

/** Keeps an in-memory ring of recent verified events, never raw journal lines. */
export function appendConsoleEntry(
  history: readonly ConsoleEntry[],
  value: unknown,
  limit = CONSOLE_LIMIT,
): ConsoleEntry[] {
  const entry = consoleEntry(value);
  if (!entry) return [...history];
  const cap = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, CONSOLE_LIMIT) : CONSOLE_LIMIT;
  return [entry, ...history].slice(0, cap);
}

export function consoleSummary(history: readonly ConsoleEntry[]): Record<string, number> {
  const out: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const entry of history) out[entry.category] = (out[entry.category] ?? 0) + 1;
  return out;
}
