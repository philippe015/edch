// Colour themes: a few presets (one light, "day"), free colour pickers and a global OLED (pure
// black) mode. A light background switches the whole interface to dark text, and the accent
// colours are darkened (or lightened) by themselves until text written with them stays readable.
// Applied as CSS variables on <html>; the phone receives the same settings from the PC.

import { DEFAULT_THEME, type ThemeSettings } from "../state/themeSettings.js";

const HEX = /^#[0-9a-f]{6}$/i;
const safe = (c: string, fallback: string) => (HEX.test(c) ? c : fallback);

let last = "";

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const toHex = (c: Rgb) =>
  `#${c
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
/** WCAG relative luminance (0 black … 1 white). */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
/** `color`, darkened on a light background (lightened on a dark one) until it reads well on `bg`. */
export function readable(color: string, bg: string, min = 4.5): string {
  const target: Rgb = luminance(bg) > 0.4 ? [0, 0, 0] : [255, 255, 255];
  const from = rgb(color);
  for (let step = 0; step <= 1.0001; step += 0.05) {
    const c = toHex(from.map((v, i) => v + (target[i] - v) * step) as Rgb);
    if (contrast(c, bg) >= min) return c;
  }
  return toHex(target);
}

export function applyTheme(theme: ThemeSettings) {
  const key = JSON.stringify(theme);
  if (key === last) return;
  last = key;
  const bg = theme.oled ? "#000000" : safe(theme.bg, DEFAULT_THEME.bg);
  const light = luminance(bg) > 0.4;
  // Panels are a little lighter than the background in both modes; text written in the accent
  // colours sits on those panels, so readability is checked against them.
  const panelBg = light ? toHex(rgb(bg).map((v) => v + (255 - v) * 0.6) as Rgb) : bg;
  const accent = readable(safe(theme.accent, DEFAULT_THEME.accent), panelBg, light ? 4.5 : 3);
  const cyan = readable(safe(theme.cyan, DEFAULT_THEME.cyan), panelBg, 4.5);
  const mix = light
    ? (pct: number) => `color-mix(in srgb, ${bg}, #ffffff ${pct}%)`
    : (pct: number) => `color-mix(in srgb, ${bg}, #9fb4cc ${pct}%)`;
  const line = light ? (pct: number) => `color-mix(in srgb, ${bg}, #23344a ${pct}%)` : mix;
  const vars: Record<string, string> = {
    "--accent": accent,
    "--accent-dim": `color-mix(in srgb, ${accent} ${light ? 12 : 14}%, transparent)`,
    "--accent-line": `color-mix(in srgb, ${accent} 42%, transparent)`,
    "--accent-soft": light
      ? `color-mix(in srgb, ${accent} 75%, #000000)`
      : `color-mix(in srgb, ${accent} 62%, #ffffff)`,
    // Text on an accent background: black or white, whichever reads better.
    "--on-accent": contrast(accent, "#000000") >= contrast(accent, "#ffffff") ? "#140a00" : "#ffffff",
    "--cyan": cyan,
    "--cyan-dim": `color-mix(in srgb, ${cyan} 12%, transparent)`,
    "--bg": bg,
    "--panel": theme.oled ? "#000000" : light ? mix(60) : mix(5),
    "--panel-inset": theme.oled ? "#000000" : light ? mix(35) : mix(3),
    "--panel-2": theme.oled ? "#07080a" : light ? mix(80) : mix(8),
    "--line": theme.oled ? "#1a1e24" : light ? line(14) : mix(14),
    "--line-2": theme.oled ? "#252b33" : light ? line(22) : mix(19),
    "--text": light ? "#1b2129" : "#e7e9ec",
    "--muted": light ? "#5b6573" : "#8a94a2",
    "--text-soft": light ? "#39424d" : "#c6ccd4",
    "--bad": light ? "#d32f2f" : "#ff5d5d",
    "--bad-text": light ? "#c62828" : "#ff8b8b",
    "--ok": light ? "#1f8f55" : "#4fd18b",
    "--ok-text": light ? "#1b7a4a" : "#8be3b2",
    "--dim-text": light ? "#8a929c" : "#66707d",
    "--warn-text": light ? "#8a6100" : "#e4c27a",
    "--sell-text": light ? "#1f6fc4" : "#6fb6ff",
  };
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.style.setProperty("color-scheme", light ? "light" : "dark");
  root.classList.toggle("oled", theme.oled);
  root.classList.toggle("cyberpunk-philou", theme.preset === "cyberpunk");
  root.classList.toggle("light", light);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
}
