// EDCH-BGS-CUSTOM-v1
// The side menu: the pages, the order the player chose ("-" is a separating line), and About and
// Settings, which are always shown and pinned at the bottom, outside the order the player edits.

import { t } from "../../platform/i18n.js";
export const NAV: { id: string; label: string; icon: string }[] = [
  { id: "materials", label: t("nav.materials"), icon: "M4 7l8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4" },
  { id: "odyssey", label: t("common.odyssey"), icon: "M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM5 21c0-4 3-7 7-7s7 3 7 7" },
  { id: "engineering", label: t("common.engineering"), icon: "M14 6l4 4-9 9H5v-4zM16 4l4 4" },
  {
    id: "wishlist",
    label: t("common.wishlist"),
    icon: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z",
  },
  { id: "engineers", label: t("common.engineers"), icon: "M4 20h16M6 20V9l6-5 6 5v11M10 20v-6h4v6" },
  { id: "search", label: t("common.search2"), icon: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20" },
  { id: "bgs", label: "BGS · Patrouilles", icon: "M4 19h16M4 15l4-5 4 3 4-7 4 5" },
  { id: "navigation", label: t("common.navigation"), icon: "M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" },
  { id: "-", label: "", icon: "" },
  { id: "missions", label: t("common.missions"), icon: "M9 4h6v3H9zM7 5H5v16h14V5h-2M8 11h8M8 15h6" },
  { id: "colonisation", label: t("common.colonisation"), icon: "M5 21V4M5 4h11l-2 4 2 4H5" },
  {
    id: "goals",
    label: t("common.communityGoals"),
    icon: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8",
  },
  {
    id: "exploration",
    label: t("common.exploration"),
    icon: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM3 15c3 2 15-4 18-8",
  },
  { id: "mining", label: t("common.mining"), icon: "M14 4l6 6M4 20l9-9M11 6c3-2 6-1 7 0M18 13c2-3 1-6 0-7" },
  { id: "powerplay", label: t("common.powerplay"), icon: "M13 2L4 14h7l-1 8 9-12h-7z" },
  {
    id: "thargoids",
    label: t("nav.thargoids"),
    icon: "M12 2l8.5 5v10L12 22l-8.5-5V7zM12 8v8M8.5 10l7 4M15.5 10l-7 4",
  },
  { id: "session", label: t("nav.session"), icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2" },
  { id: "-", label: "", icon: "" },
  {
    id: "controls",
    label: t("nav.controls"),
    icon: "M6 9h12a4 4 0 0 1 4 4v2a3 3 0 0 1-5.4 1.8L15 15H9l-1.6 1.8A3 3 0 0 1 2 15v-2a4 4 0 0 1 4-4zM7 11v3M5.5 12.5h3M15.5 12h.01M17.5 13.5h.01",
  },
  {
    id: "mobile",
    label: t("common.remoteAccess"),
    icon: "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
  },
  { id: "sync", label: t("common.sync"), icon: "M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4" },
  { id: "about", label: t("nav.about"), icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01" },
  {
    id: "settings",
    label: t("common.settings"),
    icon: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12l2-1-1-3-2 .2-1.5-1.5L16.7 4 13.8 3 13 5h-2l-.8-2-2.9 1 .2 2.7L6 8.2 4 8 3 11l2 1v0l-2 1 1 3 2-.2 1.5 1.5L7.3 20l2.9 1 .8-2h2l.8 2 2.9-1-.2-2.7 1.5-1.5 2 .2 1-3z",
  },
];

/** Always shown, pinned at the bottom of the menu, not part of the editable order. */
export const PINNED_BOTTOM = ["about", "settings"];
export const ALWAYS_SHOWN = new Set(PINNED_BOTTOM);

/** Pages that never show on a phone (they manage the PC itself). */
export const NEVER_ON_PHONE = new Set(["mobile", "sync", "settings", "about"]);

/** Default order, by use in game; "-" draws a line between groups. */
export const DEFAULT_ORDER = [
  "missions",
  "navigation",
  "search",
  "bgs",
  "-",
  "colonisation",
  "mining",
  "exploration",
  "powerplay",
  "goals",
  "thargoids",
  "session",
  "-",
  "wishlist",
  "engineers",
  "materials",
  "engineering",
  "odyssey",
  "-",
  "controls",
  "mobile",
  "sync",
];

const byId = new Map(NAV.filter((n) => n.id !== "-").map((n) => [n.id, n]));
const SEP = { id: "-", label: "", icon: "" };

/**
 * The editable menu order: the one chosen in the menu's edit mode, else the default. Pages added in
 * a newer EDCH (not in a saved order yet) take their default place. Lines are kept as saved, even
 * at the ends or side by side (the edit mode shows them; the menu itself leaves those out).
 */
export function menuOrder(saved: string[] | undefined): string[] {
  let order = saved?.length ? [...saved] : [...DEFAULT_ORDER];
  // Orders saved before About and Settings were pinned: drop them and the line that preceded them.
  if (order.some((id) => PINNED_BOTTOM.includes(id))) {
    const first = order.findIndex((id) => PINNED_BOTTOM.includes(id));
    if (order[first - 1] === "-") order.splice(first - 1, 1);
  }
  order = order.filter((id) => id === "-" || (byId.has(id) && !PINNED_BOTTOM.includes(id)));
  for (const id of DEFAULT_ORDER) {
    if (id === "-" || order.includes(id)) continue;
    const before = DEFAULT_ORDER.slice(0, DEFAULT_ORDER.indexOf(id))
      .reverse()
      .find((x) => x !== "-" && order.includes(x));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id);
  }
  return order;
}

export const navItem = (id: string) => (id === "-" ? SEP : byId.get(id));

/** Drops lines at either end and lines side by side. */
function tidyLines(items: typeof NAV): typeof NAV {
  return items.filter(
    (n, i) =>
      n.id !== "-" ||
      (i > 0 && items[i - 1].id !== "-" && i < items.length - 1 && items.slice(i + 1).some((x) => x.id !== "-")),
  );
}

/** Pages shown here: not hidden by the player (About and Settings can't be) nor left out here. */
const shownHere = (hidden: string[], extraHidden: string[]) => (n: { id: string }) =>
  n.id === "-" || ((ALWAYS_SHOWN.has(n.id) || !hidden.includes(n.id)) && !extraHidden.includes(n.id));

/** The editable part of the menu, as shown (`extraHidden`: pages left out here, e.g. on a phone). */
export function customNav(hidden: string[], extraHidden: string[] = [], saved?: string[]): typeof NAV {
  return tidyLines(
    menuOrder(saved)
      .map((id) => navItem(id)!)
      .filter(shownHere(hidden, extraHidden)),
  );
}

/** About and Settings, as shown here (a phone leaves them out). */
export function pinnedNav(extraHidden: string[] = []): typeof NAV {
  return PINNED_BOTTOM.map((id) => navItem(id)!).filter(shownHere([], extraHidden));
}

/** Every page shown here, in menu order (the editable part, then the pinned pages). */
export function visibleNav(hidden: string[], extraHidden: string[] = [], saved?: string[]): typeof NAV {
  return [...customNav(hidden, extraHidden, saved), ...pinnedNav(extraHidden)];
}

/** Pages a phone does not show: always the PC-only ones, plus those switched off in the menu's edit mode. */
export const phoneHiddenPages = (phoneHidden: string[] = []) => [...NEVER_ON_PHONE, ...phoneHidden];
