import { localizedActionLabel, localizedComboLabel, localizedKeyLabel } from "../../features/controls/actionLabels.js";
// Drawings of a device's bindings: action chips, the gamepad picture, and the generic board
// (axes, hats, buttons) used for joysticks and mice without an EDRefCard template.

import { type Bind, type BindsMeta, groupOf, padControl } from "../../features/controls/binds.js";
import { t } from "../../platform/i18n.js";
import { h } from "../../ui/dom.js";

export const GROUP_LABELS: Record<string, string> = {
  Ship: t("common.ship"),
  Fighter: t("controls.fighter"),
  Scanners: t("common.scanners"),
  Multicrew: t("controls.multicrew"),
  SRV: "SRV",
  OnFoot: t("common.foot"),
  "Holo-Me": "Holo-Me",
  "Galaxy map": t("controls.galaxyMap"),
  UI: t("controls.interface"),
  Camera: t("controls.camera"),
  "Head look": t("controls.headLook"),
  Misc: t("controls.misc"),
};

export const groupClass = (g: string) => `g-${g.toLowerCase().replace(/[^a-z]/g, "")}`;

export function chips(meta: BindsMeta, list: Bind[]): HTMLElement[] {
  return list.map((b) => {
    const g = groupOf(meta, b.action);
    const mod = b.modifiers.length ? `${b.modifiers.map((m) => localizedKeyLabel(meta, m.key)).join(" + ")} + ` : "";
    return h(
      `span.act.${groupClass(g)}`,
      {
        title: `${GROUP_LABELS[g] ?? g} · ${b.action}${b.slot === "secondary" ? ` (${t("controls.secondary")})` : ""}`,
      },
      mod ? h("em", null, mod) : null,
      localizedActionLabel(meta, b.action),
      b.inverted ? h("small", null, " " + t("controls.inverted")) : null,
    );
  });
}

export function legendTable(meta: BindsMeta, binds: Bind[]): HTMLElement {
  const byCombo = new Map<string, Bind[]>();
  for (const b of binds) {
    const k = localizedComboLabel(meta, b);
    byCombo.set(k, [...(byCombo.get(k) ?? []), b]);
  }
  const rows = [...byCombo.entries()].sort(([a], [b]) => a.localeCompare(b, "fr", { numeric: true }));
  return h(
    "div.legend-grid",
    null,
    rows.map(([combo, list]) =>
      h("div.legend-row", null, h("kbd", null, combo), h("div.acts", null, chips(meta, list))),
    ),
  );
}

export function gamepad(meta: BindsMeta, legendKey: () => HTMLElement, device: string, binds: Bind[]): HTMLElement {
  const ps = device === "DualShock4" || device === "Playstation3Controller";
  const label: Record<string, string> = ps
    ? {
        A: "✕",
        B: "○",
        X: "□",
        Y: "△",
        LBumper: "L1",
        RBumper: "R1",
        LTrigger: "L2",
        RTrigger: "R2",
        Back: "Share",
        Start: "Options",
        LThumb: "L3",
        RThumb: "R3",
        Guide: "PS",
        Touchpad: t("controls.touchpad"),
      }
    : {
        A: "A",
        B: "B",
        X: "X",
        Y: "Y",
        LBumper: "LB",
        RBumper: "RB",
        LTrigger: "LT",
        RTrigger: "RT",
        Back: "View / Back",
        Start: "Menu / Start",
        LThumb: t("controls.l3LeftStickClick"),
        RThumb: t("controls.r3RightStickClick"),
        Guide: "Guide",
        Touchpad: t("controls.pad"),
      };
  Object.assign(label, {
    DPadUp: t("controls.dPad2"),
    DPadDown: t("controls.dPad4"),
    DPadLeft: t("controls.dPad"),
    DPadRight: t("controls.dPad3"),
    LStickX: t("controls.leftStick"),
    LStickY: t("controls.leftStick2"),
    RStickX: t("controls.rightStick"),
    RStickY: t("controls.rightStick2"),
  });
  const POS: Record<string, [number, number]> = {
    LTrigger: [200, 38],
    RTrigger: [560, 38],
    LBumper: [200, 82],
    RBumper: [560, 82],
    LStickX: [178, 170],
    LStickY: [230, 222],
    LThumb: [230, 170],
    RStickX: [408, 250],
    RStickY: [460, 302],
    RThumb: [460, 250],
    DPadUp: [300, 220],
    DPadDown: [300, 280],
    DPadLeft: [270, 250],
    DPadRight: [330, 250],
    Y: [540, 132],
    X: [503, 170],
    B: [577, 170],
    A: [540, 208],
    Back: [335, 150],
    Start: [425, 150],
    Guide: [380, 118],
    Touchpad: [380, 185],
  };
  const byControl = new Map<string, Bind[]>();
  const unknown: Bind[] = [];
  for (const b of binds) {
    const c = padControl(device, b.key)?.replace(/[+-]$/, "");
    if (c && POS[c]) byControl.set(c, [...(byControl.get(c) ?? []), b]);
    else unknown.push(b);
  }
  const order = Object.keys(POS).filter((c) => byControl.has(c));
  const num = new Map(order.map((c, i) => [c, i + 1]));

  const NS = "http://www.w3.org/2000/svg";
  const el = (tag: string, attrs: Record<string, string | number>, text?: string) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const svg = el("svg", {
    viewBox: "0 0 760 380",
    class: "pad-svg",
    role: "img",
    "aria-label": t("controls.gamepadDiagram"),
  });
  // Body.
  svg.append(
    el("path", {
      class: "pad-body",
      d: "M210 95 Q380 70 550 95 Q640 105 670 190 L700 300 Q712 352 660 360 Q615 366 585 320 L545 270 Q380 262 215 270 L175 320 Q145 366 100 360 Q48 352 60 300 L90 190 Q120 105 210 95 Z",
    }),
    el("rect", { class: "pad-part", x: 165, y: 26, width: 70, height: 26, rx: 10 }),
    el("rect", { class: "pad-part", x: 525, y: 26, width: 70, height: 26, rx: 10 }),
    el("rect", { class: "pad-part", x: 160, y: 72, width: 80, height: 20, rx: 9 }),
    el("rect", { class: "pad-part", x: 520, y: 72, width: 80, height: 20, rx: 9 }),
    el("circle", { class: "pad-part", cx: 230, cy: 170, r: 36 }),
    el("circle", { class: "pad-part", cx: 460, cy: 250, r: 36 }),
    el("path", { class: "pad-part", d: "M288 208h24v30h30v24h-30v30h-24v-30h-30v-24h30z" }),
    ...["Y", "X", "B", "A"].map((k) => el("circle", { class: "pad-part", cx: POS[k][0], cy: POS[k][1], r: 17 })),
    el("rect", { class: "pad-part", x: 320, y: 140, width: 30, height: 20, rx: 8 }),
    el("rect", { class: "pad-part", x: 410, y: 140, width: 30, height: 20, rx: 8 }),
    el("circle", { class: "pad-part", cx: 380, cy: 118, r: 14 }),
  );
  for (const k of ["Y", "X", "B", "A"])
    svg.append(el("text", { class: "pad-face", x: POS[k][0], y: POS[k][1] + 5 }, label[k]));
  for (const c of order) {
    const [x, y] = POS[c];
    const g = groupOf(meta, byControl.get(c)![0].action);
    svg.append(
      el("circle", { class: `pad-marker ${groupClass(g)}`, cx: x, cy: y, r: 13 }),
      el("text", { class: "pad-num", x, y: y + 4.5 }, String(num.get(c))),
    );
  }
  return h(
    "div",
    null,
    h("div.pad-wrap", null, svg),
    legendKey(),
    h(
      "div.legend-grid",
      null,
      order.map((c) =>
        h(
          "div.legend-row",
          null,
          h("kbd.num", null, h("b", null, String(num.get(c))), ` ${label[c] ?? c}`),
          h("div.acts", null, chips(meta, byControl.get(c)!)),
        ),
      ),
      unknown.length
        ? h("div.legend-row", null, h("kbd", null, t("controls.other")), h("div.acts", null, chips(meta, unknown)))
        : null,
    ),
  );
}

export function board(meta: BindsMeta, legendKey: () => HTMLElement, binds: Bind[], mouse: boolean): HTMLElement {
  const axes = new Map<string, Bind[]>();
  const hats = new Map<string, Map<string, Bind[]>>();
  const buttons = new Map<string, Bind[]>();
  for (const b of binds) {
    const k = b.key.replace(/^(Pos|Neg)_/, "");
    const pov = /^Joy_POV(\d)(Up|Down|Left|Right)$/.exec(k);
    if (pov) {
      const m = hats.get(pov[1]) ?? new Map<string, Bind[]>();
      m.set(pov[2], [...(m.get(pov[2]) ?? []), b]);
      hats.set(pov[1], m);
    } else if (/Axis$/.test(k)) axes.set(k, [...(axes.get(k) ?? []), b]);
    else buttons.set(b.key, [...(buttons.get(b.key) ?? []), b]);
  }
  const n = (k: string) => Number(/(\d+)$/.exec(k)?.[1] ?? 999);
  const tile = (label: string, list: Bind[]) => {
    const g = groupOf(meta, list[0].action);
    return h(
      `div.btn-tile.${groupClass(g)}`,
      null,
      h("span.btn-label", null, label),
      h("div.acts", null, chips(meta, list)),
    );
  };
  return h(
    "div",
    null,
    legendKey(),
    axes.size
      ? h(
          "div.board-section",
          null,
          h("h4", null, mouse ? t("controls.axesWheel") : t("controls.axes")),
          h(
            "div.axis-list",
            null,
            [...axes.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, list]) =>
                h(
                  "div.axis-row",
                  null,
                  h("span.axis-name", null, localizedKeyLabel(meta, k)),
                  h("span.axis-bar", null, h("span")),
                  h("div.acts", null, chips(meta, list)),
                ),
              ),
          ),
        )
      : null,
    hats.size
      ? h(
          "div.board-section",
          null,
          h("h4", null, t("controls.hatsPov")),
          h(
            "div.hat-list",
            null,
            [...hats.entries()].map(([id, dirs]) => {
              const cell = (d: string, arrow: string) => {
                const list = dirs.get(d);
                return h(
                  `div.hat-cell.${d.toLowerCase()}${list ? ".bound" : ""}`,
                  null,
                  h("span.btn-label", null, arrow),
                  list ? h("div.acts", null, chips(meta, list)) : null,
                );
              };
              return h(
                "div.hat",
                null,
                h("span.hat-title", null, t("controls.hat", { id })),
                cell("Up", "↑"),
                cell("Left", "←"),
                h("div.hat-center"),
                cell("Right", "→"),
                cell("Down", "↓"),
              );
            }),
          ),
        )
      : null,
    buttons.size
      ? h(
          "div.board-section",
          null,
          h("h4", null, t("controls.buttons")),
          h(
            "div.btn-grid",
            null,
            [...buttons.entries()]
              .sort(([a], [b]) => n(a) - n(b))
              .map(([k, list]) => tile(localizedKeyLabel(meta, k), list)),
          ),
        )
      : null,
  );
}

// EDCH-BINDS-FR-v1.3.1 — traduction des commandes et des touches.
