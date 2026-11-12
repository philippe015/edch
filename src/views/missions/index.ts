// Missions page: active missions with their progress, massacre stacks, where to source the
// commodities asked, and missions shared with the wing.

import { openSettingsTab } from "../settings/index.js";
import { massacreStacks } from "../../game/activity/missions.js";
import { type Mission } from "../../game/activity/state.js";
import { isRemote } from "../../platform/bridge.js";
import { callout, fmt, h, icon, replace, toast } from "../../ui/dom.js";
import {
  activeMissions,
  hasManualReceived,
  isShared,
  setManualReceived,
  setShared,
  syncWing,
  wingView,
} from "../../features/missions/live.js"; // EDCH-BGS-WING-RECEIPTS-v1.4.9.1
import { wingScope } from "../../features/missions/wingManual.js";
import { isActive, type LeaveReason, type WingMember } from "../../services/wing.js";
import { newWingCode, type WingSettings } from "../../state/store.js";
import { credits, hoursLeft, relTime } from "../../ui/format.js";
import type { Ctx, View } from "../../state/context.js";
import {
  findHotspots,
  findSupply,
  HOTSPOT_NAMES,
  type Hotspot,
  type Offer,
} from "../../features/materials/sourcing.js";
import { gameName, t } from "../../platform/i18n.js";
import { commodityLink, systemLink } from "../shared/links.js";

/** Missions where the commander has to get the goods: sourcing, mining, donations. */
export const needsSourcing = (m: Mission) =>
  Boolean(m.commodityId) && !/delivery|courier|passenger|sightseeing/i.test(m.name);

interface Sourcing {
  loading: boolean;
  error?: string;
  offers?: Offer[];
  hotspots?: Hotspot[];
}

function kindOf(m: Mission): string {
  const n = m.name.toLowerCase();
  if (m.killCount || n.includes("massacre")) return t("missions.massacre");
  if (n.includes("assassin")) return t("missions.assassination");
  if (n.includes("courier")) return t("missions.courier");
  if (n.includes("mining")) return t("common.mining");
  if (n.includes("collect") || n.includes("altruism")) return t("missions.sourcing");
  if (n.includes("delivery")) return t("missions.delivery");
  if (n.includes("passenger") || n.includes("sightseeing") || m.passengers) return t("missions.passengers");
  if (n.includes("salvage")) return t("missions.salvage");
  if (n.includes("onfoot") || n.includes("on_foot")) return t("common.foot");
  return t("common.mission");
}

function progressOf(m: Mission): HTMLElement | null {
  if (m.killCount) {
    const pct = Math.min(100, (m.kills / m.killCount) * 100);
    return h(
      "div.mission-progress",
      null,
      h("div.bar", null, h("span", { style: { width: `${pct}%` } })),
      h("span.sub", null, t("missions.kills", { kills: m.kills, killCount: m.killCount })),
    );
  }
  if (m.total) {
    const done = m.delivered ?? 0;
    return h(
      "div.mission-progress",
      null,
      h("div.bar", null, h("span", { style: { width: `${Math.min(100, (done / m.total) * 100)}%` } })),
      h("span.sub", null, t("missions.delivered", { done: fmt(done), total: fmt(m.total) })),
    );
  }
  return null;
}

/** A field being typed in: don't redraw under the user's fingers. */
export function busy(root?: HTMLElement): boolean {
  const a = document.activeElement;
  return Boolean(root && a && root.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName));
}

export const sys = (name?: string) => systemLink(name);

const LEFT_LABEL: Record<LeaveReason, string> = {
  closed: t("missions.edchClosed"),
  wing: t("missions.leftWing"),
  off: t("missions.sharingStopped"),
};

/** Members to show: active ones, and those who left or went quiet less than 10 minutes ago. */
function shownMembers(members: WingMember[]): WingMember[] {
  const now = Date.now();
  return members.filter((m) =>
    isActive(m, now) ? true : now - Date.parse(m.at) < 10 * 60 * 1000 + (m.left ? 0 : 45 * 60 * 1000),
  );
}

export class MissionsView implements View {
  private root?: HTMLElement;
  private sourcing = new Map<number, Sourcing>();
  constructor(private ctx: Ctx) {}

  mount(root: HTMLElement) {
    this.root = root;
    this.render();
  }

  update() {
    if (!busy(this.root)) this.render();
  }

  private render() {
    if (!this.root) return;
    const missions = activeMissions();
    const wingCount = missions.filter((m) => m.wing).length;
    replace(
      this.root,
      h(
        "header.view-head",
        null,
        h(
          "div",
          null,
          h("h1", null, t("common.missions")),
          h("p.sub", null, t("missions.activeMissionsWing", { count: missions.length, wingCount })),
        ),
      ),
      callout("info", t("missions.wingTrackingTitle"), t("missions.notEveryFeatureFullyWorkingYet")),
      this.massacre(missions),
      this.list(missions),
      this.wing(),
    );
  }

  private list(missions: Mission[]): HTMLElement {
    if (!missions.length)
      return h("section.card", null, h("p.empty", null, t("missions.noActiveMissionsMissionsAcceptGame")));
    return h(
      "div.mission-grid",
      null,
      missions.map((m) => {
        const left = hoursLeft(m.expiry);
        return h(
          "article.card.mission",
          { class: m.status === "redirected" ? "redirected" : "" },
          h(
            "div.mission-head",
            null,
            h("h3", null, m.title),
            h(
              "div.badges",
              null,
              h("span.badge", null, kindOf(m)),
              m.wing ? h("span.badge.hit", null, t("common.wing")) : null,
              m.status === "redirected" ? h("span.badge.ok", null, t("missions.objectiveDone")) : null,
            ),
          ),
          h("p.sub", null, m.faction),
          m.status === "redirected"
            ? h(
                "p.mission-dest",
                null,
                h("span", null, t("missions.return") + " "),
                m.destStation ? h("strong", null, m.destStation) : null,
                m.destStation && m.destSystem ? " · " : null,
                sys(m.destSystem),
              )
            : m.destSystem || m.destStation
              ? h(
                  "p.mission-dest",
                  null,
                  h("span", null, t("missions.destination") + " "),
                  m.destStation ? h("strong", null, m.destStation) : null,
                  m.destStation && m.destSystem ? " · " : null,
                  sys(m.destSystem),
                )
              : null,
          m.killCount && m.targetFaction
            ? h("p.sub", null, t("missions.target", { targetFaction: m.targetFaction }))
            : null,
          m.commodity && m.count
            ? h("p.sub", null, `${fmt(m.count)} × `, commodityLink(m.commodity, m.commodity))
            : null,
          progressOf(m),
          needsSourcing(m) ? this.sourcingBlock(m) : null,
          h(
            "div.mission-foot",
            null,
            m.expiry
              ? h("span", { class: left < 6 ? "warn" : "" }, t("missions.expires2", { relTime: relTime(m.expiry) }))
              : null,
            m.reward ? h("span", null, `${credits(m.reward)} Cr`) : null,
            m.influence ? h("span.sub", null, t("missions.influence", { influence: m.influence })) : null,
          ),
          this.shareControl(m),
        );
      }),
    );
  }

  private commodityName(m: Mission): string {
    return this.ctx.game.data.commodities.find((c) => c.id === m.commodityId)?.name ?? m.commodity ?? "";
  }

  private async loadSourcing(m: Mission) {
    const name = this.commodityName(m);
    const need = Math.max(
      1,
      (m.count ?? 1) - (m.delivered ?? 0) - (this.ctx.store.state.cmdr.cargo[m.commodityId ?? ""] ?? 0),
    );
    const state: Sourcing = { loading: true };
    this.sourcing.set(m.id, state);
    this.render();
    try {
      const hot = HOTSPOT_NAMES[m.commodityId ?? ""];
      state.offers = await findSupply(this.ctx, name, Math.min(need, 1000));
      if (hot && /mining/i.test(m.name)) state.hotspots = await findHotspots(this.ctx, hot);
    } catch (e) {
      state.error = String((e as Error)?.message ?? e);
    }
    state.loading = false;
    this.render();
  }

  private sourcingBlock(m: Mission): HTMLElement {
    const st = this.sourcing.get(m.id);
    const tagLabel: Record<string, string> = {
      best: t("missions.bestOverall"),
      cheapest: t("missions.cheapest"),
      nearest: t("missions.nearest"),
      freshest: t("missions.freshestPrice"),
    };
    const need = Math.max(0, (m.count ?? 0) - (m.delivered ?? 0));
    if (!st)
      return h(
        "div.mission-source",
        null,
        h(
          "button.ghost.small",
          { onclick: () => this.loadSourcing(m) },
          icon("search"),
          /mining/i.test(m.name) ? " " + t("missions.whereGetBuyMine") : " " + t("common.whereBuy"),
        ),
      );
    if (st.loading) return h("div.mission-source", null, h("span.spinner"), " " + t("common.searchingSpansh"));
    return h(
      "div.mission-source",
      null,
      st.error ? h("p.error", null, st.error) : null,
      st.offers?.length
        ? h(
            "ul.offers",
            null,
            st.offers.map((o) => {
              const profit = m.reward && need ? m.reward - o.price * need : null;
              return h(
                "li",
                { class: o.tags.includes("best") ? "best" : "" },
                h(
                  "div.offer-head",
                  null,
                  h("strong", null, o.station),
                  " · ",
                  sys(o.system),
                  o.largePad ? h("span.badge.muted", null, "L") : null,
                  ...o.tags.map((tag) => h("span.badge.hit", null, tagLabel[tag])),
                ),
                h(
                  "div.offer-line",
                  null,
                  h("span", null, t("missions.crT", { price: fmt(o.price) })),
                  h("span.sub", null, t("missions.stock", { supply: fmt(o.supply) })),
                  h("span.sub", null, t("common.ly", { locale: fmt(Math.round(o.distance)) })),
                  o.arrival ? h("span.sub", null, t("common.ls", { locale: fmt(Math.round(o.arrival)) })) : null,
                  o.updated
                    ? h(
                        "span.sub",
                        null,
                        t("missions.price", {
                          relTime: relTime(new Date(Date.now() - o.ageDays * 86400000).toISOString()),
                        }),
                      )
                    : null,
                  profit !== null
                    ? h(
                        "span",
                        { class: profit > 0 ? "ok" : "warn" },
                        t("missions.profitCr", { profit: credits(profit) }),
                      )
                    : null,
                ),
              );
            }),
          )
        : !st.error
          ? h(
              "p.sub",
              null,
              t("missions.noStationSellsWithinChosenRadius", { commodityName: gameName(this.commodityName(m)) }),
            )
          : null,
      st.hotspots?.length
        ? h(
            "div",
            null,
            h("h4", null, t("missions.nearestMiningHotspots")),
            h(
              "ul.offers",
              null,
              st.hotspots.map((x) =>
                h(
                  "li",
                  null,
                  h(
                    "div.offer-head",
                    null,
                    h("strong", null, x.ring),
                    " · ",
                    sys(x.system),
                    h(
                      "span.sub",
                      null,
                      " " + t("missions.distanceHotspots", { distance: fmt(Math.round(x.distance)), count: x.count }),
                    ),
                  ),
                ),
              ),
            ),
          )
        : null,
      h("button.ghost.small", { onclick: () => this.loadSourcing(m) }, t("common.refresh")),
    );
  }

  /** Share / stop sharing with the wing (only when the wing link is on, on the PC). */
  private shareControl(m: Mission): HTMLElement | null {
    const w = this.ctx.store.state.settings.wing;
    if (isRemote() || !w.enabled || !wingView()) return null;
    const shared = isShared(m);
    const manual = w.shared.includes(m.id);
    const auto = shared && !manual;
    return h(
      "div.mission-share",
      null,
      shared
        ? h(
            "span.badge.ok",
            null,
            auto
              ? w.autoShare && m.wing
                ? t("missions.sharedAutomatically")
                : t("missions.sharedWingSMission")
              : t("missions.sharedWing2"),
          )
        : null,
      manual
        ? h("button.ghost.small", { onclick: () => (setShared(m.id, false), this.render()) }, t("missions.stopSharing"))
        : !shared
          ? h("button.ghost.small", { onclick: () => (setShared(m.id, true), this.render()) }, t("missions.shareWing"))
          : null,
    );
  }

  private massacre(missions: Mission[]): HTMLElement | null {
    const stacks = massacreStacks(missions);
    if (!stacks.length) return null;
    return h(
      "section.card",
      null,
      h("h3", null, t("missions.stackedMassacreMissions")),
      h("p.sub", null, t("missions.eachKillCountsOneMissionPer")),
      stacks.map((s) =>
        h(
          "div.stack",
          null,
          h(
            "div.stack-head",
            null,
            h("strong", null, s.target),
            h("span", null, t("missions.kills", { kills: s.done, killCount: s.needed })),
            h("div.bar", null, h("span", { style: { width: `${s.needed ? (s.done / s.needed) * 100 : 0}%` } })),
          ),
          h(
            "table.table",
            null,
            h(
              "thead",
              null,
              h(
                "tr",
                null,
                h("th", null, t("missions.issuingFaction")),
                h("th", null, t("common.missions")),
                h("th", null, t("missions.kills2")),
                h("th", null, t("missions.reward")),
              ),
            ),
            h(
              "tbody",
              null,
              s.issuers.map((i) =>
                h(
                  "tr",
                  null,
                  h("td", null, i.faction),
                  h("td", null, String(i.missions)),
                  h("td", null, `${i.kills} / ${i.total}`),
                  h("td", null, `${credits(i.reward)} Cr`),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  private wing(): HTMLElement {
    const store = this.ctx.store;
    const s = store.state.settings.wing;
    const set = (patch: Partial<WingSettings>) => {
      store.updateSettings({ wing: { ...store.state.settings.wing, ...patch } });
      void syncWing();
    };
    const view = wingView();
    const parts: (HTMLElement | null)[] = [h("h3", null, t("missions.sharedWing"))];
    if (!isRemote()) {
      const code = h("input", {
        type: "text",
        value: s.code,
        placeholder: "XXXX-XXXX-XXXX-XXXX",
        spellcheck: false,
        autocomplete: "off",
      }) as HTMLInputElement;
      parts.push(
        h("p.sub", null, t("missions.everyWingMemberUsingEdchEnters")),
        h(
          "div.wing-form",
          null,
          h(
            "label.check",
            null,
            h("input", {
              type: "checkbox",
              checked: s.enabled,
              onchange: (e: Event) => set({ enabled: (e.target as HTMLInputElement).checked }),
            }),
            " " + t("missions.enableSharing"),
          ),
          h(
            "label.field",
            null,
            h("span", null, t("missions.wingCode")),
            h(
              "div.row",
              null,
              code,
              h("button.ghost", { onclick: () => set({ code: code.value.trim() }) }, t("missions.save")),
              h(
                "button.ghost",
                {
                  onclick: () => {
                    const c = newWingCode();
                    set({ code: c });
                    toast(t("missions.newCodeCreatedGiveOtherMembers"));
                    this.render();
                  },
                },
                t("missions.createCode"),
              ),
            ),
          ),
          h(
            "label.field",
            null,
            h("span", null, t("missions.displayName")),
            h("input", {
              type: "text",
              value: s.name,
              placeholder: store.state.cmdr.commander ?? "CMDR",
              onchange: (e: Event) => set({ name: (e.target as HTMLInputElement).value }),
            }),
          ),
          h(
            "p.sub",
            null,
            t("missions.whatNotifiesNewMissionAcceptanceMember") + " ",
            h(
              "button.inline-link",
              { onclick: () => openSettingsTab(store, "notifications") },
              t("common.settingsNotifications"),
            ),
            ".",
          ),
          h(
            "label.check",
            null,
            h("input", {
              type: "checkbox",
              checked: s.autoShare,
              onchange: (e: Event) => set({ autoShare: (e.target as HTMLInputElement).checked }),
            }),
            " " + t("missions.shareAllMyWingMissionsAutomatically"),
          ),
          h("p.sub", null, t("missions.otherwiseShareEachMissionShareWing")),
          h("p.sub", null, t("missions.manualConfirmationHelp")),
        ),
      );
    }
    if (view) {
      const names = new Map<string, string>([
        [view.me.id, view.me.name],
        ...view.members.map((m) => [m.id, m.name] as [string, string]),
      ]);
      const status =
        view.status === "ok"
          ? h("span.badge.ok", null, t("common.connected"))
          : view.status === "error"
            ? h("span.badge.warn", null, view.error || t("common.error"))
            : h("span.badge", null, t("missions.connecting"));
      parts.push(
        h(
          "div.wing-members",
          null,
          status,
          h("span.badge.hit", null, view.me.name, " " + t("missions.you")),
          shownMembers(view.members).map((m) =>
            h(
              `span.badge${m.left || !isActive(m) ? ".muted" : ""}`,
              null,
              m.name,
              m.left
                ? [" (", h("span", null, LEFT_LABEL[m.reason ?? "off"]), ")"]
                : !isActive(m)
                  ? [" (", h("span", null, t("missions.inactive")), ")"]
                  : null,
              ` · ${relTime(m.at)}`,
            ),
          ),
        ),
        view.rows.length
          ? h(
              "table.table.wing-table",
              null,
              h(
                "thead",
                null,
                h(
                  "tr",
                  null,
                  h("th", null, t("common.mission")),
                  h("th", null, t("common.destination")),
                  h("th", null, t("missions.expires")),
                  h("th", null, t("missions.accepted")),
                  h("th", null, t("missions.manualAction")),
                ),
              ),
              h(
                "tbody",
                null,
                view.rows.map((r) =>
                  h(
                    "tr",
                    { class: r.mine ? "" : "not-mine" },
                    h(
                      "td",
                      null,
                      h("strong", null, r.mission.title),
                      h("div.sub", null, r.mission.faction),
                      r.mission.total
                        ? h(
                            "div.mission-progress",
                            null,
                            h(
                              "div.bar",
                              null,
                              h("span", {
                                style: {
                                  width: `${Math.min(100, ((r.mission.delivered ?? 0) / r.mission.total) * 100)}%`,
                                },
                              }),
                            ),
                            h(
                              "span.sub",
                              null,
                              t("missions.delivered", {
                                done: fmt(r.mission.delivered ?? 0),
                                total: fmt(r.mission.total),
                              }),
                            ),
                          )
                        : null,
                    ),
                    h(
                      "td",
                      null,
                      r.mission.destStation ? `${r.mission.destStation} · ` : "",
                      sys(r.mission.destSystem),
                    ),
                    h("td", null, relTime(r.mission.expiry)),
                    h(
                      "td",
                      null,
                      r.holders.map((id) =>
                        h(
                          "span.badge.ok",
                          null,
                          `✓ ${names.get(id) ?? "?"}`,
                          (r.manualHolders ?? []).includes(id) ? ` (${t("missions.manualConfirmation")})` : "",
                        ),
                      ),
                      r.missing.map((id) => h("span.badge.muted", null, `✗ ${names.get(id) ?? "?"}`)),
                    ),
                    h(
                      "td",
                      null,
                      !isRemote() && hasManualReceived(r.mission.id)
                        ? h(
                            "button.ghost.small",
                            {
                              onclick: () => {
                                if (!setManualReceived(r.mission.id, false)) toast(t("missions.manualError"));
                                this.render();
                              },
                            },
                            t("missions.undoManualConfirmation"),
                          )
                        : !isRemote() && !r.mine && r.missing.includes(view.me.id)
                          ? h(
                              "button.ghost.small",
                              {
                                onclick: () => {
                                  if (!setManualReceived(r.mission.id, true)) toast(t("missions.manualError"));
                                  this.render();
                                },
                              },
                              t("missions.confirmReceivedMission"),
                            )
                          : null,
                    ),
                  ),
                ),
              ),
            )
          : h("p.empty", null, t("missions.noSharedWingMissionsYet")),
      );
    } else if (s.enabled && !isRemote()) {
      parts.push(h("p.sub", null, t("missions.enterCreateCodeLeast8Characters")));
    }
    if (!isRemote() && s.enabled) {
      const scope = wingScope(s.code);
      const pending = (s.manualReceived ?? []).filter(
        (receipt) => receipt.code === scope && !view?.rows.some((row) => row.mission.id === receipt.id),
      );
      if (pending.length) {
        parts.push(
          h(
            "div.wing-manual-offline",
            null,
            h("p.sub", null, t("missions.savedOfflineConfirmations")),
            pending.slice(0, 20).map((receipt) =>
              h(
                "div.row",
                null,
                h("span.sub", null, `#${receipt.id}`),
                h(
                  "button.ghost.small",
                  {
                    onclick: () => {
                      setManualReceived(receipt.id, false);
                      this.render();
                    },
                  },
                  t("missions.undoManualConfirmation"),
                ),
              ),
            ),
          ),
        );
      }
    }
    return h("section.card.wing", null, parts);
  }
}
