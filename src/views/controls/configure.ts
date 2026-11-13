// Controls page, "Configure": edits copies of the presets the game uses. EDCH copies each active
// preset to "<preset>_EDCH" (the game's own presets are never written), then a click on a control
// (or a press on it) opens a dialog to give it a function. A control already used is reported
// first; the function takes its first free slot; each change is saved at once in the copy.

import {
  actionName,
  englishActionName,
  type Bind,
  type BindsMeta,
  groupOf,
  keyLabel,
  parseBinds,
  presetLineFor,
} from "../../features/controls/binds.js";
import {
  assignControl,
  bindingsOn,
  buttonActions,
  type ButtonSlot,
  clearSlot,
  type ControlKey,
  copyPresetXml,
  edchPresetName,
  firstFreeSlot,
  isEdchPreset,
} from "../../features/controls/bindsEditor.js";
import { readOptionFile, saveEdchPreset } from "../../platform/bridge.js";
import { fold, gameText, t } from "../../platform/i18n.js";
import { log } from "../../platform/logger.js";
import { dialog } from "../../ui/dialog.js";
import { h } from "../../ui/dom.js";
import { GROUP_LABELS, groupClass } from "./deviceBoard.js";

/** A preset the game uses, as read: its file in the Bindings folder (none for a default preset). */
export interface PresetSource {
  preset: string;
  file?: string;
  xml: string;
}

/** EDCH's copy of a preset, being edited. */
interface PresetCopy {
  preset: string;
  file: string;
  xml: string;
}

/** The copy's file name: "<copy>.<MajorVersion>.<MinorVersion>.binds", as the game names its own. */
function copyFileName(copyPreset: string, xml: string): string {
  const major = /<Root\b[^>]*\bMajorVersion="(\d+)"/.exec(xml)?.[1];
  const minor = /<Root\b[^>]*\bMinorVersion="(\d+)"/.exec(xml)?.[1];
  return major && minor ? `${copyPreset}.${major}.${minor}.binds` : `${copyPreset}.binds`;
}

/** A control's key as this device's bindings write it ("Pad_A" or "GamePad_FaceDown" style). */
function writableKey(key: string, deviceBinds: Bind[]): string {
  if (!key.startsWith("Pad_") || !deviceBinds.some((bind) => bind.key.startsWith("GamePad_"))) return key;
  const faces: Record<string, string> = { A: "FaceDown", B: "FaceRight", X: "FaceLeft", Y: "FaceUp" };
  const name = key.slice("Pad_".length);
  return `GamePad_${faces[name] ?? name}`;
}

/** One editing session: the copies of the presets the game uses, by original preset name. */
export class ConfigureSession {
  private copies = new Map<string, PresetCopy>();

  constructor(
    private meta: BindsMeta,
    /** The StartPreset lines (general, ship, SRV, on foot). */
    private lines: string[],
  ) {}

  /** The presets edited, as the game will list them. */
  copyNames(): string[] {
    return [...new Set([...this.copies.values()].map((copy) => copy.preset))];
  }

  /** The text to show for `preset` while editing: its copy's. */
  xmlFor(preset: string): string | undefined {
    return this.copies.get(preset)?.xml;
  }

  /**
   * Makes (or takes back) the copies of `sources`. A copy left by an earlier session is offered
   * to be resumed or replaced. Returns false when the user cancelled.
   */
  async start(sources: PresetSource[], existingFiles: string[]): Promise<boolean> {
    for (const source of sources) {
      // Already EDCH's own copy (chosen in the game): edited as it is.
      if (isEdchPreset(source.preset) && source.file) {
        this.copies.set(source.preset, { preset: source.preset, file: source.file, xml: source.xml });
        continue;
      }
      const preset = edchPresetName(source.preset);
      const file = copyFileName(preset, source.xml);
      const fresh = copyPresetXml(source.xml, preset);
      if (existingFiles.includes(file)) {
        const choice = await dialog(
          t("controls.copyExistsTitle"),
          [h("p", null, t("controls.copyExists", { copy: preset, preset: source.preset }))],
          [
            { label: t("controls.copyResume"), value: "resume", primary: true },
            { label: t("controls.copyReplace"), value: "replace" },
          ],
        );
        if (!choice) return false;
        if (choice === "resume") {
          this.copies.set(source.preset, { preset, file, xml: await readOptionFile("Bindings", file) });
          continue;
        }
        await saveEdchPreset(file, fresh, false);
      } else await saveEdchPreset(file, fresh, true);
      log.info("controls", `Bindings copy made for editing (${source.preset})`);
      this.copies.set(source.preset, { preset, file, xml: fresh });
    }
    return true;
  }

  /** The copy that holds `action` (the preset of the StartPreset line of its group). */
  private copyFor(action: string): PresetCopy | undefined {
    const line = presetLineFor(groupOf(this.meta, action));
    return this.copies.get(this.lines[line] ?? this.lines[0]);
  }

  /** The bindings of every copy (what the page shows while editing). */
  private allBinds(): Bind[] {
    return [...this.copies.values()].flatMap((copy) => parseBinds(copy.xml).binds);
  }

  private async save(copy: PresetCopy, xml: string) {
    copy.xml = xml;
    await saveEdchPreset(copy.file, xml, false);
  }

  /** Empties the slot `bind` uses, in its copy. */
  async remove(bind: Bind) {
    if (bind.slot === "axis") return;
    const copy = this.copyFor(bind.action);
    if (copy) await this.save(copy, clearSlot(copy.xml, bind.action, bind.slot));
  }

  /**
   * Asks which function `control` should do, then saves it. Returns true when something changed.
   */
  async configure(control: ControlKey, controlName: string): Promise<boolean> {
    const binds = this.allBinds();
    const current = bindingsOn(binds, control);
    const action = await this.pickAction(control, controlName, current);
    if (!action) return false;
    if (action.startsWith("remove:")) {
      const bind = current[Number(action.slice("remove:".length))];
      if (bind) await this.remove(bind);
      return Boolean(bind);
    }
    const copy = this.copyFor(action);
    if (!copy) return false;
    // Already used by other functions: replace them, or keep both.
    const others = current.filter((bind) => bind.action !== action);
    if (others.length) {
      const choice = await dialog(
        t("controls.controlUsedTitle", { control: controlName }),
        [
          h("p", null, t("controls.controlUsed")),
          h(
            "ul",
            null,
            others.map((bind) => h("li", null, gameText(actionName(this.meta, bind.action)))),
          ),
          h("p.sub", null, t("controls.controlUsedHelp")),
        ],
        [
          { label: t("controls.replaceThem"), value: "replace" },
          { label: t("controls.keepBoth"), value: "keep", primary: true },
        ],
      );
      if (!choice) return false;
      if (choice === "replace") for (const bind of others) await this.remove(bind);
    }
    const actionBinds = parseBinds(copy.xml).binds.filter((bind) => bind.action === action);
    let slot: ButtonSlot | undefined = firstFreeSlot(actionBinds, action);
    if (!slot) {
      const slotLabel = (which: ButtonSlot) => {
        const bind = actionBinds.find((b) => b.slot === which);
        return `${which === "primary" ? t("controls.primarySlot") : t("controls.secondarySlot")} : ${bind ? keyLabel(this.meta, bind.key) : "—"}`;
      };
      const choice = await dialog(
        t("controls.bothSlotsTakenTitle"),
        [h("p", null, t("controls.bothSlotsTaken", { action: gameText(actionName(this.meta, action)) }))],
        [
          { label: slotLabel("primary"), value: "primary", primary: true },
          { label: slotLabel("secondary"), value: "secondary" },
        ],
      );
      if (choice !== "primary" && choice !== "secondary") return false;
      slot = choice;
    }
    const deviceBinds = binds.filter((bind) => bind.device === control.device);
    const written = { device: control.device, key: writableKey(control.key, deviceBinds) };
    await this.save(copy, assignControl(copy.xml, action, slot, written));
    return true;
  }

  /** The function picker: what the control does now (to remove), and every function, searchable. */
  private pickAction(control: ControlKey, controlName: string, current: Bind[]): Promise<string | null> {
    const actions = [...new Set([...this.copies.values()].flatMap((copy) => buttonActions(copy.xml)))].sort(
      (a, b) => (this.meta.controls[a]?.o ?? 999) - (this.meta.controls[b]?.o ?? 999),
    );
    return dialog(
      t("controls.configureControlTitle", { control: controlName }),
      (close) => {
        const list = h("div.action-pick-list");
        const draw = (query: string) => {
          const wanted = fold(query);
          list.replaceChildren(
            ...actions
              .filter((action) => {
                if (!wanted) return true;
                const name = actionName(this.meta, action);
                return [name, englishActionName(this.meta, action), gameText(name), action].some((text) => fold(text).includes(wanted));
              })
              .map((action) => {
                const group = groupOf(this.meta, action);
                return h(
                  `button.action-pick.${groupClass(group)}`,
                  { onclick: () => close(action) },
                  h("span", null, gameText(actionName(this.meta, action))),
                  h("small.sub", null, GROUP_LABELS[group] ?? group),
                );
              }),
          );
        };
        draw("");
        const search = h("input.search", {
          type: "search",
          placeholder: t("controls.searchControl"),
          oninput: (e: Event) => draw((e.target as HTMLInputElement).value),
        });
        window.setTimeout(() => search.focus(), 0);
        return [
          h("p.sub", null, `${control.device} · ${control.key}`),
          current.length
            ? h(
                "div.action-current",
                null,
                h("strong", null, t("controls.controlDoesNow")),
                current.map((bind, index) =>
                  h(
                    "div.action-current-row",
                    null,
                    h("span", null, gameText(actionName(this.meta, bind.action))),
                    h("button.ghost.small", { onclick: () => close(`remove:${index}`) }, t("controls.removeFunction")),
                  ),
                ),
              )
            : h("p.sub", null, t("controls.controlFree")),
          search,
          list,
        ];
      },
      [],
    );
  }
}
