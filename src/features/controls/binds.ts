// Reads Elite Dangerous .binds files (XML) into a flat list of bindings, and names
// devices and keys for display. No DOM needed, so it is unit-testable in Node.

import { t } from "../../platform/i18n.js";
export interface DeviceTemplate {
  name: string;
  image: string;
  size: [number, number];
  /** key → [x, y, width, height] of its legend box on the picture. */
  boxes: Record<string, [number, number, number, number]>;
}

export interface BindsMeta {
  templates: Record<string, DeviceTemplate>;
  templateBase: string;
  controls: Record<string, { g: string; c: string; n: string; o: number }>;
  keymap: Record<string, string>;
  devices: Record<string, DeviceName>;
  vidpid: Record<string, string>;
  vendors: Record<string, string>;
}

/** A device's name in data/binds.json: a brand name, or a translation key for generic devices. */
export interface DeviceName {
  label: string;
  kind: DeviceKind;
  /** "binds.<nameKey>" names it in the app's language (keyboard, mouse, gamepads). */
  nameKey?: string;
  /** One half of a stick + throttle pair. */
  part?: "stick" | "throttle";
}

/** The device's name as shown, in the app's language. */
export function deviceLabel(d: DeviceName): string {
  const name = d.nameKey ? t(`binds.${d.nameKey}`) : d.label;
  return d.part ? t(d.part === "stick" ? "binds.stickOf" : "binds.throttleOf", { name }) : name;
}

export type DeviceKind = "keyboard" | "mouse" | "gamepad" | "joystick" | "vr";

export interface Modifier {
  device: string;
  key: string;
}

export interface Bind {
  action: string;
  slot: "primary" | "secondary" | "axis";
  device: string;
  key: string;
  modifiers: Modifier[];
  /** "Hold" style toggle off (ToggleOn Value=0) or axis inverted. */
  inverted?: boolean;
}

export interface BindsFile {
  preset: string;
  keyboardLayout: string;
  binds: Bind[];
}

// ---------------- tiny XML reader (enough for .binds) ----------------

export interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const unescape = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

export function parseXml(src: string): XmlNode {
  const root: XmlNode = { tag: "#doc", attrs: {}, children: [], text: "" };
  const stack: XmlNode[] = [root];
  const re =
    /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2]) {
      if (stack.length > 1) stack.pop();
    } else if (m[3]) {
      const attrs: Record<string, string> = {};
      const ar = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let a: RegExpExecArray | null;
      while ((a = ar.exec(m[4] ?? ""))) attrs[a[1]] = unescape(a[2] ?? a[3] ?? "");
      const node: XmlNode = { tag: m[3], attrs, children: [], text: "" };
      top.children.push(node);
      if (!m[5]) stack.push(node);
    } else if (m[6] !== undefined) top.text += unescape(m[6]);
  }
  return root;
}

// ---------------- .binds → bindings ----------------

const NO_DEVICE = "{NoDevice}";

function readSlot(action: string, node: XmlNode, slot: Bind["slot"]): Bind | null {
  const device = node.attrs.Device ?? NO_DEVICE;
  const key = node.attrs.Key ?? "";
  if (device === NO_DEVICE || !key) return null;
  const modifiers = node.children
    .filter((c) => c.tag === "Modifier")
    .map((c) => ({ device: c.attrs.Device ?? "", key: c.attrs.Key ?? "" }));
  return { action, slot, device, key, modifiers };
}

export function parseBinds(xml: string): BindsFile {
  const doc = parseXml(xml.replace(/^﻿/, ""));
  const root = doc.children.find((c) => c.tag === "Root");
  if (!root) throw new Error(t("binds.notBindsFile"));
  const binds: Bind[] = [];
  let keyboardLayout = "en-US";
  for (const el of root.children) {
    if (el.tag === "KeyboardLayout") {
      keyboardLayout = el.text.trim() || keyboardLayout;
      continue;
    }
    for (const child of el.children) {
      if (child.tag === "Primary" || child.tag === "Secondary") {
        const b = readSlot(el.tag, child, child.tag === "Primary" ? "primary" : "secondary");
        if (b) binds.push(b);
      } else if (child.tag === "Binding") {
        const b = readSlot(el.tag, child, "axis");
        if (b) {
          const inv = el.children.find((c) => c.tag === "Inverted");
          if (inv?.attrs.Value === "1") b.inverted = true;
          binds.push(b);
        }
      }
    }
  }
  return { preset: root.attrs.PresetName ?? "", keyboardLayout, binds };
}

/** StartPreset(.4).start: one preset name per line (general, ship, SRV, on foot). */
export function parseStartPreset(text: string): string[] {
  return text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Which StartPreset line applies to a group of controls. */
export function presetLineFor(group: string): number {
  if (group === "OnFoot" || group === "Holo-Me") return 3;
  if (group === "SRV") return 2;
  if (group === "Ship" || group === "Fighter" || group === "Scanners" || group === "Multicrew") return 1;
  return 0;
}

/** Newest file for a preset: Custom.4.2.binds beats Custom.4.1.binds and Custom.binds. */
export function fileForPreset(preset: string, files: string[]): string | undefined {
  const mine = files.filter(
    (f) => f.toLowerCase().endsWith(".binds") && (f === `${preset}.binds` || f.startsWith(`${preset}.`)),
  );
  const version = (f: string) =>
    f
      .slice(preset.length)
      .replace(/\.binds$/i, "")
      .split(".")
      .filter(Boolean)
      .map(Number);
  return mine.sort((a, b) => {
    const va = version(a),
      vb = version(b);
    for (let i = 0; i < Math.max(va.length, vb.length); i++) {
      const d = (vb[i] ?? -1) - (va[i] ?? -1);
      if (d) return d;
    }
    return 0;
  })[0];
}

// ---------------- names ----------------

export function groupOf(meta: BindsMeta, action: string): string {
  return (
    meta.controls[action]?.g ?? (action.endsWith("_Buggy") ? "SRV" : action.startsWith("Humanoid") ? "OnFoot" : "Misc")
  );
}

/** Original EDRefCard name, used for a bilingual search and fallback. */
export function englishActionName(meta: BindsMeta, action: string): string {
  return meta.controls[action]?.n ?? action.replace(/(?<=[a-z0-9])(?=[A-Z])/g, " ").replace(/_/g, " ");
}

let actionLanguage: "en" | "fr" = "en";
let frenchActionNames: Readonly<Record<string, string>> = {};

/** Changes display labels only: XML action identifiers and saved bindings remain unchanged. */
export function setActionLanguage(language: "en" | "fr", frenchNames: Readonly<Record<string, string>> = {}): void {
  actionLanguage = language;
  frenchActionNames = frenchNames;
}

/** Localized controls label with an English fallback for unknown actions. */
export function actionName(meta: BindsMeta, action: string): string {
  return (actionLanguage === "fr" ? frenchActionNames[action] : undefined) ?? englishActionName(meta, action);
}

export function deviceInfo(meta: BindsMeta, id: string): { label: string; kind: DeviceKind } {
  const tpl = meta.templates?.[id];
  const known = meta.devices[id];
  if (tpl && !known)
    return { label: tpl.name, kind: /pad|ds4|dualshock|710|xb360/i.test(id + tpl.image) ? "gamepad" : "joystick" };
  if (known) return { label: deviceLabel(known), kind: known.kind };
  const mapped = meta.vidpid[id.toUpperCase()];
  if (mapped && meta.devices[mapped])
    return { label: deviceLabel(meta.devices[mapped]), kind: meta.devices[mapped].kind };
  if (/^[0-9A-F]{8}$/i.test(id)) {
    const vendor = meta.vendors[id.slice(0, 4).toUpperCase()];
    return {
      label: vendor ? `${vendor} ${id.toUpperCase()}` : t("binds.deviceId", { id: id.toUpperCase() }),
      kind: "joystick",
    };
  }
  return { label: id, kind: "joystick" };
}

/** Canonical gamepad control for both "Pad_*" (XInput) and "GamePad_*" names, and DS4 buttons. */
export function padControl(device: string, key: string): string | null {
  const k = key.replace(/^(Pos|Neg)_/, "");
  const sign = key.startsWith("Neg_") ? "-" : key.startsWith("Pos_") ? "+" : "";
  const face: Record<string, string> = { FaceDown: "A", FaceRight: "B", FaceLeft: "X", FaceUp: "Y" };
  let m = /^(?:Pad|GamePad)_(.+)$/.exec(k);
  if (m) {
    let c = face[m[1]] ?? m[1];
    c = c.replace(/^LStick/, "LStick").replace(/^RStick/, "RStick");
    return c + (sign && /Stick|Trigger/.test(c) && !/Trigger/.test(c) ? sign : "");
  }
  if (device === "DualShock4" || device === "Playstation3Controller") {
    const ds4: Record<string, string> = {
      Joy_1: "X",
      Joy_2: "A",
      Joy_3: "B",
      Joy_4: "Y",
      Joy_5: "LBumper",
      Joy_6: "RBumper",
      Joy_7: "LTrigger",
      Joy_8: "RTrigger",
      Joy_9: "Back",
      Joy_10: "Start",
      Joy_11: "LThumb",
      Joy_12: "RThumb",
      Joy_13: "Guide",
      Joy_14: "Touchpad",
    };
    m = /^Joy_POV1(Up|Down|Left|Right)$/.exec(k);
    if (m) return `DPad${m[1]}`;
    const axes: Record<string, string> = {
      Joy_XAxis: "LStickX",
      Joy_YAxis: "LStickY",
      Joy_ZAxis: "RStickX",
      Joy_RZAxis: "RStickY",
      Joy_RXAxis: "LTrigger",
      Joy_RYAxis: "RTrigger",
    };
    return ds4[k] ?? (axes[k] ? axes[k] + sign : null);
  }
  return null;
}

const MOUSE: Record<string, string> = {
  Mouse_1: t("binds.leftClick"),
  Mouse_2: t("binds.rightClick"),
  Mouse_3: t("binds.wheelClick"),
  Mouse_4: t("binds.button", { number: 4 }),
  Mouse_5: t("binds.button", { number: 5 }),
  Mouse_XAxis: t("binds.axis", { name: "X" }),
  Mouse_YAxis: t("binds.axis", { name: "Y" }),
  Mouse_ZAxis: t("binds.wheel"),
};

export function keyLabel(meta: BindsMeta, key: string): string {
  if (meta.keymap[key]) return meta.keymap[key];
  const sign = key.startsWith("Pos_") ? " +" : key.startsWith("Neg_") ? " −" : "";
  const k = key.replace(/^(Pos|Neg)_/, "");
  if (MOUSE[k])
    return k === "Mouse_ZAxis"
      ? sign === " +"
        ? t("binds.wheelUp")
        : sign
          ? t("binds.wheelDown")
          : t("binds.wheel")
      : MOUSE[k] + sign;
  let m = /^Key_(.+)$/.exec(k);
  if (m)
    return m[1]
      .replace(/Numpad_/, "Num ")
      .replace(/Arrow$/, "")
      .replace(/(?<=[a-z])(?=[A-Z])/g, " ");
  m = /^Joy_(\d+)$/.exec(k);
  if (m) return t("binds.button", { number: m[1] });
  m = /^Joy_POV(\d)(Up|Down|Left|Right)$/.exec(k);
  if (m) return t("binds.hat", { number: m[1], direction: { Up: "↑", Down: "↓", Left: "←", Right: "→" }[m[2]] });
  m = /^Joy_(R?[XYZ]|U|V)Axis$/.exec(k);
  if (m) return t("binds.axis", { name: m[1] }) + sign;
  const pad = padControl("GamePad", key);
  if (pad) return pad;
  return k.replace(/_/g, " ") + sign;
}

/** "Shift gauche + K" style label including modifiers. */
export function comboLabel(meta: BindsMeta, b: Bind): string {
  const mods = b.modifiers.map((m) => keyLabel(meta, m.key));
  return [...mods, keyLabel(meta, b.key)].join(" + ");
}

/** Box on a template for a binding key (exact, without Pos_/Neg_, or by gamepad equivalence). */
export function templateBox(tpl: DeviceTemplate, device: string, key: string): string | undefined {
  if (tpl.boxes[key]) return key;
  const bare = key.replace(/^(Pos|Neg)_/, "");
  if (tpl.boxes[bare]) return bare;
  const canon = padControl(device, key)?.replace(/[+-]$/, "");
  if (!canon) return undefined;
  return Object.keys(tpl.boxes).find((k) => padControl(device, k)?.replace(/[+-]$/, "") === canon);
}
