// Theme settings: the colours chosen in Settings → Display (saved with the other settings and
// sent to the phones). Applying them to the page is ui/theme.ts.

import { t } from "../platform/i18n.js";

export interface ThemeSettings {
  /** Preset id, or "custom" once a colour was picked by hand. */
  preset: string;
  accent: string;
  cyan: string;
  bg: string;
  /** Pure black background and panels (OLED screens). */
  oled: boolean;
}

export const PRESETS: { id: string; label: string; accent: string; cyan: string; bg: string }[] = [
  { id: "cyberpunk", label: "Cyberpunk Philou", accent: "#ff36c7", cyan: "#00e5ff", bg: "#070817" },
  { id: "elite", label: t("theme.eliteOriginal"), accent: "#ff7a18", cyan: "#5cc8e8", bg: "#0a0c0f" },
  { id: "blue", label: t("theme.blue"), accent: "#4da3ff", cyan: "#7fe0d2", bg: "#090c12" },
  { id: "green", label: t("theme.green"), accent: "#3ddc84", cyan: "#5cc8e8", bg: "#090d0b" },
  { id: "purple", label: t("theme.purple"), accent: "#b07cff", cyan: "#ff7ad9", bg: "#0c0a10" },
  { id: "red", label: t("theme.red"), accent: "#ff4d4d", cyan: "#ffb347", bg: "#0f0909" },
  { id: "contrast", label: t("theme.highContrast"), accent: "#ffd400", cyan: "#00e5ff", bg: "#000000" },
  { id: "day", label: t("theme.dayLight"), accent: "#d35f00", cyan: "#0a78a6", bg: "#eef1f5" },
];

export const DEFAULT_THEME: ThemeSettings = {
  preset: "cyberpunk",
  accent: "#ff36c7",
  cyan: "#00e5ff",
  bg: "#070817",
  oled: false,
};
