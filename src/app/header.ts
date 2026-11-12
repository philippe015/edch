// Top bar: the commander and ship, the current system (click to copy it) with its security,
// allegiance and faction states, the game's state, the focus buttons and the journal status.

import { t } from "../platform/i18n.js";
import type { Ctx } from "../state/context.js";
import { gameBadge } from "../ui/desktop.js";
import { h, icon, replace } from "../ui/dom.js";
import { openSystem } from "../views/shared/links.js";
import { focusButtons, toggleNav } from "./focus.js";

/** Journal values → labels shown. */
const SECURITY_LABELS: Record<string, string> = {
  High: t("common.highSecurity"),
  Medium: t("common.mediumSecurity"),
  Low: t("common.lowSecurity"),
  Anarchy: t("common.anarchy"),
};
const ALLEGIANCE_LABELS: Record<string, string> = {
  Independent: t("main.independent"),
  Federation: t("main.federation"),
  Empire: "Empire",
  Alliance: "Alliance",
  Thargoid: "Thargoid",
  Guardian: t("main.guardian"),
  PilotsFederation: "Pilots Federation",
};

/** Draws the top bar into `el` from the current state. */
export function renderHeader(el: HTMLElement, ctx: Ctx) {
  const { cmdr, watch } = ctx.store.state;
  const location = cmdr.location;
  const statusLabel: Record<string, string> = {
    live: t("main.live"),
    waiting: t("main.waitingGame"),
    error: t("common.error"),
    demo: t("main.demo"),
    idle: t("main.stopped"),
    remote: t("main.connectedPc"),
    offline: t("common.pcUnreachable"),
  };
  const states = new Set<string>();
  for (const f of location?.factions ?? []) {
    if (f.name === location?.controllingFaction && f.state && f.state !== "None") states.add(f.state);
    for (const a of f.active) if (a !== "None") states.add(a);
  }
  replace(
    el,
    h(
      "button.brand",
      { title: t("main.hideShowMenu"), onclick: () => toggleNav() },
      h("strong.cp-mark", { "aria-hidden": "true" }, "CP"),
      h("span", null, "Cyberpunk Philou"),
    ),
    h(
      "div.cmdr",
      null,
      h("strong", null, cmdr.commander ? `CMDR ${cmdr.commander}` : "CMDR —"),
      cmdr.ship ? h("span.sub", null, `${cmdr.ship.type}${cmdr.ship.name ? ` · ${cmdr.ship.name}` : ""}`) : null,
    ),
    location
      ? h(
          "div.where",
          null,
          h(
            "button.sys",
            { title: t("main.copySystemName"), onclick: () => openSystem(location.system, { navigate: false }) },
            icon("pin"),
            h("span", null, location.system),
          ),
          location.station ? h("span.sub", null, location.station) : null,
          [
            location.security ? (SECURITY_LABELS[location.security] ?? location.security) : undefined,
            location.allegiance ? (ALLEGIANCE_LABELS[location.allegiance] ?? location.allegiance) : undefined,
          ]
            .filter(Boolean)
            .map((label) => h("span.badge.muted", null, label!)),
          [...states].slice(0, 4).map((state) => h("span.badge.hit", null, state)),
        )
      : h("div.where.sub", null, t("common.unknownLocation")),
    gameBadge(ctx.store.state.game),
    focusButtons(),
    h(
      "div.live",
      { class: watch.state, title: watch.message ?? watch.file ?? "" },
      h("span.dot"),
      statusLabel[watch.state] ?? watch.state,
    ),
  );
}
