import { localizedActionLabel, localizedComboLabel, localizedKeyLabel } from "../../features/controls/actionLabels.js";
// The keyboard picture: each key with the actions bound to it, in the chosen layout (QWERTY,
// AZERTY, QWERTZ) and format (ISO, ANSI), with the switches to change them.

import { type Bind, type BindsMeta, groupOf } from "../../features/controls/binds.js";
import { lang, t } from "../../platform/i18n.js";
import type { Ctx } from "../../state/context.js";
import { h } from "../../ui/dom.js";
import { groupClass, legendTable } from "./deviceBoard.js";
import { type Family, type Id, KEY_CAPS, KEY_IDS, layoutFamily } from "./keyLayouts.js";

/** The keyboard to draw: chosen in EDCH, or guessed from the bindings file. */
export function keyboardChoice(ctx: Ctx): { layout: Family; format: "iso" | "ansi" } {
  const s = ctx.store.state.settings;
  // Until one is chosen here: the usual keyboard for the app's language.
  const code = lang().code;
  const layout = s.kbLayout === "auto" ? (code === "fr" ? "azerty" : code === "de" ? "qwertz" : "qwerty") : s.kbLayout;
  // ANSI is the US keyboard (most English-speaking players); the rest of the world mostly uses ISO.
  const format = s.kbFormat === "auto" ? (code === "en" ? "ansi" : "iso") : s.kbFormat;
  return { layout, format };
}

export function keyboardSwitches(ctx: Ctx, layout: string, rerender: () => void): HTMLElement {
  const kb = keyboardChoice(ctx);
  const seg = <T extends string>(value: T, options: [T, string][], set: (v: T) => void) =>
    h(
      "div.segmented.small",
      null,
      options.map(([v, l]) =>
        h("button", { class: value === v ? "active" : "", onclick: () => (set(v), rerender()) }, l),
      ),
    );
  return h(
    "div.kb-switches",
    null,
    h("span.sub", null, t("controls.myKeyboard")),
    seg(
      kb.layout,
      [
        ["azerty", "AZERTY"],
        ["qwerty", "QWERTY"],
        ["qwertz", "QWERTZ"],
      ],
      (v) => ctx.store.updateSettings({ kbLayout: v }),
    ),
    seg(
      kb.format,
      [
        ["iso", "ISO"],
        ["ansi", "ANSI"],
      ],
      (v) => ctx.store.updateSettings({ kbFormat: v }),
    ),
    h(
      "span.sub",
      { title: t("controls.isoLShapedEnterKeyOne") },
      t("controls.bindingsSavedKeyboard", { layout: layout }),
    ),
  );
}

export function keyboard(
  meta: BindsMeta,
  ctx: Ctx,
  layout: string,
  legendKey: () => HTMLElement,
  rerender: () => void,
  binds: Bind[],
): HTMLElement {
  const byKey = new Map<string, Bind[]>();
  for (const b of binds) byKey.set(b.key, [...(byKey.get(b.key) ?? []), b]);
  // Modifier keys used in combos are highlighted too.
  const modKeys = new Set(binds.flatMap((b) => b.modifiers.filter((m) => m.device === "Keyboard").map((m) => m.key)));
  const drawn = new Set<string>();
  /** A key; `ids` are the names the game may give it (the first that is bound wins the colour). */
  const key = (ids: string | string[], label: string, w = 1, tail = false): HTMLElement => {
    const all = Array.isArray(ids) ? ids : [ids];
    for (const id of all) drawn.add(id);
    const list = all.flatMap((id) => byKey.get(id) ?? []);
    const g = list[0] ? groupOf(meta, list[0].action) : "";
    return h(
      `div.kb-key${list.length ? `.bound.${groupClass(g)}` : ""}${all.some((id) => modKeys.has(id)) ? ".modkey" : ""}${tail ? ".enter-tail" : ""}`,
      {
        style: { flexGrow: String(w), flexBasis: `${w * 44}px` },
        title: list.length
          ? list.map((b) => `${localizedComboLabel(meta, b)} → ${localizedActionLabel(meta, b.action)}`).join("\n")
          : label,
      },
      tail ? null : h("span.kb-cap", null, label),
      list.length && !tail ? h("span.kb-act", null, localizedActionLabel(meta, list[0].action)) : null,
      list.length > 1 && !tail ? h("span.kb-more", null, `+${list.length - 1}`) : null,
    );
  };
  const gap = () => h("div.kb-gap");
  // Where each key is: the game names keys after the layout written in the bindings file;
  // the labels are those of the keyboard chosen here (by default, the same one).
  const ids = KEY_IDS[layoutFamily(layout)];
  const kb = keyboardChoice(ctx);
  const caps = KEY_CAPS[kb.layout];
  const iso = kb.format === "iso";
  const at = (row: Id[], cap: string[]) => row.map((id, i) => key(id, cap[i] ?? ""));
  const rows: HTMLElement[][] = [
    [
      key("Key_Escape", t("controls.esc")),
      gap(),
      ...[1, 2, 3, 4].map((n) => key(`Key_F${n}`, `F${n}`)),
      gap(),
      ...[5, 6, 7, 8].map((n) => key(`Key_F${n}`, `F${n}`)),
      gap(),
      ...[9, 10, 11, 12].map((n) => key(`Key_F${n}`, `F${n}`)),
    ],
    [...at(ids.num, caps.num), key("Key_Backspace", "⌫", 2)],
    iso
      ? [key("Key_Tab", "Tab", 1.5), ...at(ids.r1, caps.r1), key("Key_Enter", t("controls.enter"), 1.5)]
      : [key("Key_Tab", "Tab", 1.5), ...at(ids.r1, caps.r1), key(ids.extra, caps.extra, 1.5)],
    iso
      ? [
          key("Key_CapsLock", t("controls.capsLock"), 1.75),
          ...at(ids.r2, caps.r2),
          key(ids.extra, caps.extra),
          key("Key_Enter", "", 1.25, true),
        ]
      : [
          key("Key_CapsLock", t("controls.capsLock"), 1.75),
          ...at(ids.r2, caps.r2),
          key("Key_Enter", t("controls.enter"), 2.25),
        ],
    iso
      ? [
          key("Key_LeftShift", t("controls.lShift"), 1.25),
          key(ids.iso, caps.iso),
          ...at(ids.r3, caps.r3),
          key("Key_RightShift", t("controls.rShift"), 2.75),
        ]
      : [
          key("Key_LeftShift", t("controls.lShift"), 2.25),
          ...at(ids.r3, caps.r3),
          key("Key_RightShift", t("controls.rShift"), 2.75),
        ],
    [
      key("Key_LeftControl", t("controls.lCtrl"), 1.5),
      key("Key_LeftWin", "Win", 1.25),
      key("Key_LeftAlt", "Alt", 1.25),
      key("Key_Space", t("controls.space"), 6.25),
      key("Key_RightAlt", "Alt Gr", 1.25),
      key("Key_Apps", "Menu", 1.25),
      key("Key_RightControl", t("controls.rCtrl"), 1.5),
    ],
  ];
  const nav: HTMLElement[][] = [
    [
      key("Key_PrintScreen", t("controls.prtsc")),
      key("Key_ScrollLock", t("controls.scrollLock")),
      key("Key_Pause", "Pause"),
    ],
    [key("Key_Insert", t("controls.ins")), key("Key_Home", t("controls.home")), key("Key_PageUp", "Pg ↑")],
    [key("Key_Delete", t("controls.del")), key("Key_End", t("common.end")), key("Key_PageDown", "Pg ↓")],
    [h("div.kb-key.blank"), h("div.kb-key.blank"), h("div.kb-key.blank")],
    [h("div.kb-key.blank"), key("Key_UpArrow", "↑"), h("div.kb-key.blank")],
    [key("Key_LeftArrow", "←"), key("Key_DownArrow", "↓"), key("Key_RightArrow", "→")],
  ];
  const pad: HTMLElement[][] = [
    [h("div.kb-key.blank"), h("div.kb-key.blank"), h("div.kb-key.blank"), h("div.kb-key.blank")],
    [
      key("Key_NumLock", t("controls.numLock")),
      key("Key_Numpad_Divide", "/"),
      key("Key_Numpad_Multiply", "*"),
      key("Key_Numpad_Subtract", "-"),
    ],
    [key("Key_Numpad_7", "7"), key("Key_Numpad_8", "8"), key("Key_Numpad_9", "9"), key("Key_Numpad_Add", "+")],
    [key("Key_Numpad_4", "4"), key("Key_Numpad_5", "5"), key("Key_Numpad_6", "6"), h("div.kb-key.blank")],
    [
      key("Key_Numpad_1", "1"),
      key("Key_Numpad_2", "2"),
      key("Key_Numpad_3", "3"),
      key("Key_Numpad_Enter", t("controls.enter")),
    ],
    [key("Key_Numpad_0", "0", 2), key("Key_Numpad_Decimal", ".")],
  ];
  const block = (rs: HTMLElement[][], cls: string) =>
    h(
      `div.kb-block.${cls}`,
      null,
      rs.map((r) => h("div.kb-row", null, r)),
    );
  const others = binds.filter((b) => !drawn.has(b.key));
  return h(
    "div",
    null,
    keyboardSwitches(ctx, layout, rerender),
    h("div.kb", null, block(rows, "main"), block(nav, "nav"), block(pad, "numpad")),
    legendKey(),
    others.length
      ? h(
          "p.sub",
          null,
          t("controls.keysNotDiagram", {
            value: [...new Set(others.map((b) => localizedKeyLabel(meta, b.key)))].join(", "),
          }),
        )
      : null,
    legendTable(meta, binds),
  );
}

// EDCH-BINDS-FR-v1.3.1 — traduction des commandes et des touches.
