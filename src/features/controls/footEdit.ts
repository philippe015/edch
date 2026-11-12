// EDCH-ONFOOT-EDIT-v1.4.4: Keyboard capture and staging only. No game file writes here.
import { type Bind, type BindsMeta, groupOf } from "./binds.js";

export interface FootChange {
  action: string;
  slot: "primary" | "secondary";
  key: string; // "" clears one slot
  modifiers: string[];
}
export interface KeyCapture {
  key: string;
  modifiers: string[];
  label: string;
}

/** Only the on-foot button actions, never ship/SRV or analog axes. */
export function footActions(meta: BindsMeta): string[] {
  return Object.keys(meta.controls)
    .filter((action) => {
      const group = groupOf(meta, action);
      return (
        group === "OnFoot" &&
        (action.startsWith("Humanoid") || action.endsWith("_Humanoid")) &&
        !/Axis|Sensitivity|Mode|ToggleOn|Deadzone/i.test(action)
      );
    })
    .sort((a, b) => (meta.controls[a]?.n ?? a).localeCompare(meta.controls[b]?.n ?? b, "fr"));
}

const SIMPLE_CODES: Record<string, string> = {
  Space: "Space",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "UpArrow",
  ArrowDown: "DownArrow",
  ArrowLeft: "LeftArrow",
  ArrowRight: "RightArrow",
  Escape: "Escape",
  ShiftLeft: "LeftShift",
  ShiftRight: "RightShift",
  ControlLeft: "LeftControl",
  ControlRight: "RightControl",
  AltLeft: "LeftAlt",
  AltRight: "RightAlt",
};

/** event.key for AZERTY letters, event.code for digit row/physical function keys. */
export function captureFootKey(
  e: Pick<KeyboardEvent, "code" | "key" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey" | "repeat">,
): KeyCapture | null {
  if (e.repeat || e.metaKey || e.key === "Dead" || e.key === "Process" || e.key === "AltGraph") return null;
  let key = "";
  if (/^[a-z]$/i.test(e.key)) key = `Key_${e.key.toUpperCase()}`;
  else if (/^Digit[0-9]$/.test(e.code)) key = `Key_${e.code.slice(-1)}`;
  else if (/^Numpad[0-9]$/.test(e.code)) key = `Key_Numpad_${e.code.slice(-1)}`;
  else if (/^F(?:[1-9]|1[0-2])$/.test(e.code)) key = `Key_${e.code}`;
  else if (SIMPLE_CODES[e.code]) key = `Key_${SIMPLE_CODES[e.code]}`;
  if (!key) return null; // avoid guessing punctuation/key layout in Odyssey
  const mods = [
    e.ctrlKey ? "Key_LeftControl" : "",
    e.altKey ? "Key_LeftAlt" : "",
    e.shiftKey ? "Key_LeftShift" : "",
  ].filter(Boolean);
  // A modifier can be used alone; do not duplicate it as its own modifier.
  const modifiers = mods.filter((m) => m !== key);
  if (new Set(modifiers).size > 2) return null;
  const label = [...modifiers.map((m) => m.replace(/^Key_/, "")), key.replace(/^Key_/, "")].join(" + ");
  return { key, modifiers, label };
}

export function conflictsForFoot(changes: readonly FootChange[], binds: readonly Bind[], meta: BindsMeta): string[] {
  const overridden = new Set(changes.map((c) => `${c.action}|${c.slot}`));
  const records = binds
    .filter(
      (b) =>
        groupOf(meta, b.action) === "OnFoot" && b.device === "Keyboard" && !overridden.has(`${b.action}|${b.slot}`),
    )
    .map((b) => ({
      action: b.action,
      key: b.key,
      modifiers: b.modifiers
        .map((m) => m.key)
        .sort()
        .join("+"),
    }));
  const result: string[] = [];
  for (const c of changes) {
    if (!c.key) continue;
    const combo = c.modifiers.slice().sort().join("+");
    const other = records.concat(
      changes
        .filter((x) => x !== c && x.key)
        .map((x) => ({ action: x.action, key: x.key, modifiers: x.modifiers.slice().sort().join("+") })),
    );
    const duplicate = other.filter((x) => x.key === c.key && x.modifiers === combo && x.action !== c.action);
    for (const d of duplicate) {
      const pair = [c.action, d.action].sort().join(" / ");
      if (!result.includes(pair)) result.push(pair);
    }
  }
  return result;
}
