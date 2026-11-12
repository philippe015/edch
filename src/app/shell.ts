// EDCH-BGS-CUSTOM-v1
// The window's layout (top bar, menu, page, detail panel), the pages, and which one is shown.
// Each page draws in its own container, so a page you left never redraws over the current one.

import type { Ctx, View } from "../state/context.js";
import { h, replace } from "../ui/dom.js";
import { excludedHere, renderMenu } from "../ui/menu/editMenu.js";
import { NAV, visibleNav } from "../ui/menu/pages.js";
import { applyTheme } from "../ui/theme.js";
import { AboutView } from "../views/about/index.js";
import { BgsView } from "../views/bgs/index.js";
import { ColonisationView } from "../views/colonisation/index.js";
import { ControlsView } from "../views/controls/index.js";
import { DetailPanel } from "../views/detail/index.js";
import { EngineeringView } from "../views/engineering/index.js";
import { EngineersView } from "../views/engineers/index.js";
import { ExplorationView } from "../views/exploration/index.js";
import { GoalsView } from "../views/goals/index.js";
import { RemoteGuideView } from "../views/guide/index.js";
import { MaterialsView } from "../views/materials/index.js";
import { MiningView } from "../views/mining/index.js";
import { MissionsView } from "../views/missions/index.js";
import { MobileView } from "../views/mobile/index.js";
import { NavigationView } from "../views/navigation/index.js";
import { OdysseyView } from "../views/odyssey/index.js";
import { PowerplayView } from "../views/powerplay/index.js";
import { SearchView } from "../views/search/index.js";
import { SessionView } from "../views/session/index.js";
import { ThargoidsView } from "../views/thargoids/index.js";
import { SettingsView } from "../views/settings/index.js";
import { SyncView } from "../views/sync/index.js";
import { WishlistView } from "../views/wishlist/index.js";
import { openedAsSinglePage } from "./focus.js";
import { renderHeader } from "./header.js";

/** A menu icon from an SVG path. */
function navIcon(d: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icon");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", d);
  svg.appendChild(p);
  return svg;
}

/** Every page, by id (the ids of ui/menu/pages.ts). */
function createViews(ctx: Ctx, replayJournal: () => void): Record<string, View> {
  return {
    materials: new MaterialsView(ctx),
    odyssey: new OdysseyView(ctx),
    engineering: new EngineeringView(ctx),
    wishlist: new WishlistView(ctx),
    engineers: new EngineersView(ctx),
    search: new SearchView(ctx),
    bgs: new BgsView(ctx),
    navigation: new NavigationView(ctx),
    sync: new SyncView(ctx),
    controls: new ControlsView(ctx),
    mobile: new MobileView(ctx),
    about: new AboutView(ctx),
    "guide-remote": new RemoteGuideView(ctx),
    missions: new MissionsView(ctx),
    colonisation: new ColonisationView(ctx),
    goals: new GoalsView(ctx),
    exploration: new ExplorationView(ctx),
    mining: new MiningView(ctx),
    powerplay: new PowerplayView(ctx),
    thargoids: new ThargoidsView(ctx),
    session: new SessionView(ctx),
    settings: new SettingsView(ctx, replayJournal),
  };
}

/**
 * Builds the layout inside `app` and keeps it drawn: the page in the state's `view`, or the first
 * page shown when that one is hidden here. `remoteMode`: this is a paired phone.
 */
export function startShell(app: HTMLElement, ctx: Ctx, remoteMode: "paired" | null, replayJournal: () => void) {
  const store = ctx.store;
  const header = h("header.topbar");
  const nav = h("nav.sidebar");
  const main = h("main.content");
  const aside = h("aside.detail");
  replace(app, header, h("div.shell", null, nav, main, aside));

  const views = createViews(ctx, replayJournal);
  const detail = new DetailPanel(ctx);
  detail.mount(aside);

  let mounted = "";
  const render = () => {
    const state = store.state;
    renderHeader(header, ctx);
    const menu = { remote: Boolean(remoteMode), everything: openedAsSinglePage(), navIcon };
    renderMenu(nav, store, menu);
    // A page hidden in Settings, switched off for the phone, or from an older menu falls back to
    // the first page shown.
    const shown = visibleNav(state.settings.hiddenViews ?? [], excludedHere(store, menu), state.settings.navOrder);
    const hiddenNow = NAV.some((n) => n.id === state.view) && !shown.some((n) => n.id === state.view);
    const view =
      (remoteMode && state.view === "mobile" ? null : hiddenNow ? null : views[state.view]) ??
      views[shown.find((n) => n.id !== "-")?.id ?? "materials"] ??
      views.materials;
    if (mounted !== state.view) {
      mounted = state.view;
      const host = h("div.view-host");
      replace(main, host);
      view.mount(host);
      main.scrollTop = 0;
    } else {
      view.update();
    }
    detail.update();
  };
  applyTheme(store.state.settings.theme);
  store.subscribe((st) => applyTheme(st.settings.theme));
  // Interface size (PC and phone).
  let scale = 0;
  const applyScale = () => {
    const wanted = Math.min(150, Math.max(70, Number(store.state.settings.uiScale) || 100));
    if (wanted === scale) return;
    scale = wanted;
    (document.documentElement.style as CSSStyleDeclaration & { zoom: string }).zoom =
      wanted === 100 ? "" : `${wanted}%`;
  };
  applyScale();
  store.subscribe(applyScale);
  // Page at start-up.
  const start = store.state.settings.startView;
  if (start && start !== store.state.view && views[start]) store.state.view = start;
  store.subscribe(render);
  render();

  // Escape closes the detail panel; Ctrl+F goes to the page's search box.
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && store.state.selected) store.select(undefined);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      const input = main.querySelector<HTMLInputElement>("input.search");
      if (input) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    }
  });
}
