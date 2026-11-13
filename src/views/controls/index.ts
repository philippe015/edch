// Controls page: reads the game's bindings (.binds) and shows, per device, what each key, button
// and axis does (keyboard, gamepad, joystick and mouse pictures), with search, filters and backup.

import {
  actionName,
  englishActionName,
  setActionLanguage,
  type Bind,
  type BindsMeta,
  comboLabel,
  deviceInfo,
  type DeviceTemplate,
  fileForPreset,
  groupOf,
  keyLabel,
  padControl,
  parseBinds,
  parseStartPreset,
  presetLineFor,
  templateBox,
} from "../../features/controls/binds.js";
import { DEMO_BINDS } from "../../game/demo.js";
import {
  exportConfig,
  importConfig,
  isTauri,
  listBuiltinPresets,
  listOptionFiles,
  type OptionFile,
  readBuiltinPreset,
  readOptionFile,
  revealPath,
} from "../../platform/bridge.js";
import { fold, gameText, lang, LANGS, t } from "../../platform/i18n.js";
import type { Ctx, View } from "../../state/context.js";
import { dialog } from "../../ui/dialog.js";
import { h, icon, replace, toast } from "../../ui/dom.js";
import { keepPicture, keptPictureName, keptPictureUrl } from "../../services/controllerPictures.js";
import { board, gamepad, GROUP_LABELS, groupClass, legendTable } from "./deviceBoard.js";
import { keyboard } from "./keyboard.js";
import { ConfigureSession, type PresetSource } from "./configure.js";
import { controlOf, type ControlPress, watchPresses } from "./inputCapture.js";

const MODES: [string, string, string[] | null][] = [
  ["all", t("controls.all"), null],
  ["ship", t("common.ship"), ["Ship", "Fighter", "Scanners", "Multicrew"]],
  ["srv", "SRV", ["SRV"]],
  ["foot", t("common.foot"), ["OnFoot", "Holo-Me"]],
  ["ui", t("controls.mapsUi"), ["Galaxy map", "UI", "Camera", "Head look", "Misc"]],
];

/** How long a pressed control stays shown and highlighted. */
const PRESS_SHOWN_MS = 4000;

let metaPromise: Promise<BindsMeta> | undefined;

const loadMeta = () =>
  (metaPromise ??= fetch("data/binds.json").then((r) => {
    if (!r.ok) throw new Error(`binds.json: HTTP ${r.status}`);
    return r.json();
  }));

/** Local preference for command names; independent of EDCH's interface language. */
const ACTION_LANGUAGE_KEY = "edch.controls.language";

function preferredActionLanguage(): "en" | "fr" {
  try {
    const saved = localStorage.getItem(ACTION_LANGUAGE_KEY);
    if (saved === "en" || saved === "fr") return saved;
  } catch {
    // The interface language remains a safe default if local storage is unavailable.
  }
  return lang().code === "fr" ? "fr" : "en";
}

let frenchNamesPromise: Promise<Record<string, string>> | undefined;

/** Loads the optional local dictionary; no network host or additional dependency. */
function loadFrenchNames(): Promise<Record<string, string>> {
  return (frenchNamesPromise ??= fetch("data/binds.fr.json")
    .then((response) => {
      if (!response.ok) throw new Error("French controls labels unavailable");
      return response.json() as Promise<Record<string, string>>;
    })
    .catch(() => ({})));
}

export class ControlsView implements View {
  private meta?: BindsMeta;
  private files: OptionFile[] = [];
  private presets: string[] = [];
  private chosen = ""; // "" = active presets, else a file name
  private binds: Bind[] = [];
  private layout = "en-US";
  private note = "";
  private device = "";
  /** The presets the game uses, as read (to copy them for "Configure"). */
  private sources: PresetSource[] = [];
  /** The game's default presets found in its installation ("KeyboardMouseOnly.binds"…). */
  private builtinFiles: string[] = [];
  /** "Configure": the copies being edited, else undefined. */
  private session?: ConfigureSession;
  /** A dialog of "Configure" is open: presses don't open another one. */
  private configuring = false;
  /** The control last pressed (shown and highlighted for a few seconds). */
  private pressed?: { device: string; key: string; at: number };
  private stopWatching?: () => void;
  /** Per device: chosen template id ("" = none / simple diagram). */
  private tplChoice: Record<string, string> = (() => {
    try {
      return JSON.parse(localStorage.getItem("edch.templates") ?? "{}");
    } catch {
      return {};
    }
  })();
  private actionLanguage: "en" | "fr" = preferredActionLanguage();
  private mode = "all";
  private query = "";
  private body = h("div.controls-body");
  private backupOut = h("div.backup-out");

  constructor(private ctx: Ctx) {}

  async mount(root: HTMLElement) {
    replace(
      root,
      h("header.view-head", null, h("h1", null, t("controls.controlsDevices"))),
      this.backupCard(),
      this.body,
    );
    replace(this.body, h("p.sub", null, h("span.spinner"), " " + t("controls.readingBindings")));
    this.body.onclick = (event) => this.onDiagramClick(event);
    try {
      const meta = await loadMeta();
      this.meta = meta;
      await this.applyActionLanguage();
      await this.load();
      this.stopWatching ??= watchPresses(
        meta,
        () => this.layout,
        (press) => this.onPress(press),
      );
    } catch (e) {
      replace(this.body, h("p.error", null, icon("warn"), ` ${String((e as Error).message ?? e)}`));
    }
  }

  update() {
    /* bindings only change on import or reload */
  }

  /** Apply the chosen display language without changing .binds files. */
  private async applyActionLanguage(): Promise<void> {
    const requested = this.actionLanguage;
    const names = requested === "fr" ? await loadFrenchNames() : {};
    if (requested === this.actionLanguage) setActionLanguage(requested, names);
  }

  private changeActionLanguage(value: string): void {
    if (value !== "fr" && value !== "en") return;
    this.actionLanguage = value;
    try {
      localStorage.setItem(ACTION_LANGUAGE_KEY, value);
    } catch {
      // A session-only selection still works without local storage.
    }
    void this.applyActionLanguage().then(() => this.render());
  }

  // ---------------- loading ----------------

  private async load() {
    const meta = this.meta!;
    this.note = "";
    if (!isTauri()) {
      const f = parseBinds(DEMO_BINDS);
      this.binds = f.binds;
      this.layout = f.keyboardLayout;
      this.presets = [f.preset];
      this.note = t("controls.demoModeSampleBindings");
      return this.render();
    }
    this.files = (await listOptionFiles()).filter((f) => f.folder === "Bindings");
    const names = this.files.map((f) => f.name);
    if (this.chosen) {
      const f = parseBinds(await readOptionFile("Bindings", this.chosen));
      this.binds = f.binds;
      this.layout = f.keyboardLayout;
      this.presets = [f.preset];
      return this.render();
    }
    const startName =
      names.find((n) => n.toLowerCase() === "startpreset.4.start") ??
      names.find((n) => n.toLowerCase().startsWith("startpreset") && n.endsWith(".start"));
    const lines = startName ? parseStartPreset(await readOptionFile("Bindings", startName)) : [];
    this.presets = lines;
    // The game's default presets aren't in the Bindings folder: read them (read-only) from its
    // installation's ControlSchemes folder.
    const launcherPath = this.ctx.store.state.settings.gameLaunch?.path ?? "";
    this.builtinFiles = await listBuiltinPresets(launcherPath).catch(() => []);
    const parsed = new Map<string, ReturnType<typeof parseBinds> | null>();
    this.sources = [];
    for (const p of new Set(lines)) {
      const file = fileForPreset(p, names);
      const builtin = this.builtinFiles.find((name) => name.toLowerCase() === `${p}.binds`.toLowerCase());
      let xml: string | undefined;
      if (file) xml = await readOptionFile("Bindings", file);
      else if (builtin) xml = await readBuiltinPreset(builtin, launcherPath).catch(() => undefined);
      if (xml !== undefined) this.sources.push({ preset: p, file, xml });
      // While configuring, the page shows the copies being edited.
      const shown = this.session?.xmlFor(p) ?? xml;
      parsed.set(p, shown !== undefined ? parseBinds(shown) : null);
    }
    const missing = [...parsed.entries()].filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) this.note = t("controls.builtGamePresetSNotCopied", { value: missing.join(", ") });
    this.binds = [];
    for (const [preset, f] of parsed) {
      if (!f) continue;
      this.layout = f.keyboardLayout;
      for (const b of f.binds) {
        const line = presetLineFor(groupOf(meta, b.action));
        if ((lines[line] ?? lines[0]) === preset) this.binds.push(b);
      }
    }
    if (!lines.length && names.some((n) => n.endsWith(".binds"))) {
      this.note = t("controls.noActivePresetFoundStartpresetPick");
    }
    this.render();
  }

  // ---------------- backup card ----------------

  private backupCard(): HTMLElement {
    const doExport = async (graphics: boolean) => {
      try {
        const path = await exportConfig(graphics);
        replace(
          this.backupOut,
          h(
            "p",
            null,
            icon("check"),
            " " + t("controls.exported") + " ",
            h("code", null, path),
            " ",
            h("button.ghost.small", { onclick: () => revealPath(path) }, t("controls.showExplorer")),
          ),
        );
      } catch (e) {
        replace(this.backupOut, h("p.error", null, icon("warn"), ` ${String((e as Error).message ?? e)}`));
      }
    };
    const file = h("input", {
      type: "file",
      accept: ".zip,application/zip",
      onchange: async (e: Event) => {
        const input = e.target as HTMLInputElement;
        const f = input.files?.[0];
        input.value = "";
        if (!f) return;
        try {
          const report = await importConfig(new Uint8Array(await f.arrayBuffer()));
          replace(
            this.backupOut,
            h(
              "p",
              null,
              icon("check"),
              " " + t("controls.filesRestored", { count: report.written.length }) + " ",
              h("code", null, report.backup),
              " ",
              h("button.ghost.small", { onclick: () => revealPath(report.backup) }, t("controls.show")),
            ),
            h("p.sub", null, report.written.join(" · ")),
            report.skipped.length
              ? h("p.sub", null, t("controls.skipped", { value: report.skipped.join(", ") }))
              : null,
            h("p.notice", null, icon("warn"), " " + t("controls.restartEliteDangerousOpenOptionsControls")),
          );
          toast(t("controls.configurationImported"));
          this.chosen = "";
          await this.load();
        } catch (err) {
          replace(this.backupOut, h("p.error", null, icon("warn"), ` ${String((err as Error).message ?? err)}`));
        }
      },
    });
    return h(
      "section.card.backup",
      null,
      h(
        "div",
        null,
        h("h3", null, t("controls.backUpRestoreConfiguration")),
        h("p.sub", null, t("controls.exportsBindingsGraphicsSettingsZipDocuments")),
      ),
      h(
        "div.row",
        null,
        h("button.primary", { onclick: () => doExport(false) }, t("controls.exportBindings")),
        h("button.ghost", { onclick: () => doExport(true) }, t("controls.bindingsGraphics")),
        h("label.file-btn", null, t("controls.importZip"), file),
      ),
      this.backupOut,
    );
  }

  // ---------------- main render ----------------

  private visible(): Bind[] {
    const meta = this.meta!;
    const groups = MODES.find(([m]) => m === this.mode)?.[2];
    // Searched in English and in the language shown, accents and case ignored.
    const q = fold(this.query);
    return this.binds.filter((b) => {
      const g = groupOf(meta, b.action);
      if (groups && !groups.includes(g)) return false;
      if (!q) return true;
      const name = actionName(meta, b.action);
      const combo = comboLabel(meta, b);
      return [name, englishActionName(meta, b.action), gameText(name), combo, gameText(combo), b.action, GROUP_LABELS[g] ?? g].some((candidate) =>
        fold(candidate).includes(q),
      );
    });
  }

  private render() {
    const meta = this.meta!;
    const devices = [...new Set(this.binds.map((b) => b.device))].sort((a, b) => rank(meta, a) - rank(meta, b));
    if (!devices.includes(this.device)) this.device = devices[0] ?? "";
    const binds = this.visible();
    const mine = binds.filter((b) => b.device === this.device);

    const fileSelect = this.files.length
      ? h(
          "select",
          { onchange: (e: Event) => ((this.chosen = (e.target as HTMLSelectElement).value), this.load()) },
          h("option", { value: "", selected: !this.chosen }, t("controls.activePreset")),
          this.files
            .filter((f) => f.name.endsWith(".binds"))
            .map((f) => h("option", { value: f.name, selected: f.name === this.chosen }, f.name)),
        )
      : null;

    replace(
      this.body,
      h(
        "div.controls-bar",
        null,
        h(
          "div",
          null,
          h("strong", null, this.presets.length ? [...new Set(this.presets)].join(" / ") : "—"),
          h("span.sub", null, " " + t("controls.bindingsKeyboard", { count: this.binds.length, layout: this.layout })),
        ),
        fileSelect,
        h(
          "label.controls-language",
          null,
          h("span.sub", null, t("controls.actionNamesLanguage")),
          h(
            "select",
            { onchange: (event: Event) => this.changeActionLanguage((event.target as HTMLSelectElement).value) },
            LANGS.filter((language) => language.code === "fr" || language.code === "en").map((language) =>
              h("option", { value: language.code, selected: this.actionLanguage === language.code }, language.label),
            ),
          ),
        ),
        h(
          "div.segmented",
          null,
          MODES.map(([m, l]) =>
            h("button", { class: this.mode === m ? "active" : "", onclick: () => ((this.mode = m), this.render()) }, l),
          ),
        ),
        h(
          "label.search-wrap",
          null,
          icon("search"),
          h("input.search", {
            type: "search",
            placeholder: t("controls.searchControl"),
            value: this.query,
            oninput: (e: Event) => ((this.query = (e.target as HTMLInputElement).value), this.renderDebounced()),
          }),
        ),
        h("button.ghost", { onclick: () => window.print() }, t("controls.printSheet")),
        this.session
          ? h(
              "button.primary",
              { onclick: () => this.stopConfigure() },
              icon("check"),
              " " + t("controls.configureDone"),
            )
          : h(
              "button.primary",
              {
                disabled: !this.configurable(),
                title: this.configurable() ? t("controls.configureHelp") : t("controls.configureOnlyActive"),
                onclick: () => void this.startConfigure(),
              },
              t("controls.configure"),
            ),
      ),
      this.note ? h("p.notice", null, icon("warn"), ` ${this.note}`) : null,
      this.session
        ? h(
            "div.callout.info.configure-banner",
            { role: "note" },
            h("strong", null, t("controls.configuringTitle", { presets: this.session.copyNames().join(" / ") })),
            h("p", null, t("controls.configuringHelp")),
            h("p.sub", null, t("controls.configuringInGame", { presets: this.session.copyNames().join(" / ") })),
          )
        : null,
      this.pressedBanner(),
      devices.length
        ? h(
            "div.device-tabs",
            null,
            devices.map((d) => {
              const info = deviceInfo(meta, d);
              const count = binds.filter((b) => b.device === d).length;
              return h(
                "button",
                { class: d === this.device ? "active" : "", onclick: () => ((this.device = d), this.render()) },
                h("span", null, info.label),
                h("small", null, ` ${count}`),
              );
            }),
          )
        : h("p.empty", null, t("controls.noBindingsFound")),
      this.device ? this.diagram(this.device, mine) : null,
      h("p.sub.credits", null, t("controls.credits")),
    );
    this.body.classList.toggle("configuring", Boolean(this.session));
    this.highlightPressed();
  }

  // ---------------- configure ----------------

  /** "Configure" works on the presets the game uses now (not on another file picked in the list). */
  private configurable(): boolean {
    return isTauri() && !this.chosen && this.presets.length > 0 && this.sources.length === new Set(this.presets).size;
  }

  private async startConfigure() {
    if (!this.configurable() || this.configuring) return;
    this.configuring = true;
    try {
      const ok = await dialog(
        t("controls.configureTitle"),
        [h("p", null, t("controls.configureIntro")), h("p.sub", null, t("controls.configureSafety"))],
        [
          { label: t("controls.cancel"), value: "" },
          { label: t("controls.configureStart"), value: "go", primary: true },
        ],
      );
      if (ok !== "go") return;
      const session = new ConfigureSession(this.meta!, this.presets);
      if (
        !(await session.start(
          this.sources,
          this.files.map((f) => f.name),
        ))
      )
        return;
      this.session = session;
      toast(t("controls.configureCopyMade", { presets: session.copyNames().join(" / ") }));
      await this.load();
    } catch (e) {
      toast(String((e as Error)?.message ?? e));
    } finally {
      this.configuring = false;
    }
  }

  private async stopConfigure() {
    this.session = undefined;
    await this.load();
  }

  /** Configure mode: a click on a control of the drawing opens its dialog. */
  private onDiagramClick(event: Event) {
    if (!this.session) return;
    const element = (event.target as HTMLElement).closest<HTMLElement>("[data-control-key]");
    const key = element?.dataset.controlKey;
    if (key) void this.configureControl({ device: this.device, key });
  }

  private async configureControl(control: { device: string; key: string }) {
    if (!this.session || this.configuring) return;
    if (/Axis$/.test(control.key)) {
      toast(t("controls.axesNotConfigurable"));
      return;
    }
    this.configuring = true;
    try {
      const name = `${deviceInfo(this.meta!, control.device).label} · ${keyLabel(this.meta!, control.key)}`;
      if (await this.session.configure(control, name)) {
        toast(t("controls.configureSaved"));
        await this.load();
      }
    } catch (e) {
      toast(String((e as Error)?.message ?? e));
    } finally {
      this.configuring = false;
    }
  }

  // ---------------- pressed controls ----------------

  /** A control was pressed (EDCH focused): configure it, or show what it does. */
  private onPress(press: ControlPress) {
    if (!this.body.isConnected || !this.meta || this.configuring) return;
    const devicesInUse = [...new Set(this.binds.map((b) => b.device))];
    const control = controlOf(press, devicesInUse);
    if (this.session) {
      void this.configureControl(control);
      return;
    }
    this.pressed = { ...control, at: Date.now() };
    if (devicesInUse.includes(control.device)) this.device = control.device;
    this.render();
    // The banner and highlight go away after a while.
    window.setTimeout(() => {
      if (this.pressed && Date.now() - this.pressed.at >= PRESS_SHOWN_MS - 50) {
        this.pressed = undefined;
        this.render();
      }
    }, PRESS_SHOWN_MS);
  }

  /** Does `key` (as drawn) name the same control as the pressed `pressedKey` on `device`? */
  private sameControl(device: string, key: string, pressedKey: string): boolean {
    if (key === pressedKey || key.replace(/^(Pos|Neg)_/, "") === pressedKey) return true;
    const pad = padControl(device, pressedKey);
    return Boolean(pad && padControl(device, key) === pad);
  }

  /** What the pressed control does, above the drawing. */
  private pressedBanner(): HTMLElement | null {
    if (!this.pressed || !this.meta) return null;
    const { device, key } = this.pressed;
    const functions = this.binds.filter((b) => b.device === device && this.sameControl(device, b.key, key));
    const name = `${deviceInfo(this.meta, device).label} · ${keyLabel(this.meta, key)}`;
    return h(
      "div.pressed-banner",
      { role: "status" },
      h("strong", null, name),
      functions.length
        ? h(
            "span",
            null,
            functions
              .map(
                (b) =>
                  `${b.modifiers.length ? `${comboLabel(this.meta!, b)} → ` : ""}${gameText(actionName(this.meta!, b.action))}`,
              )
              .join(" · "),
          )
        : h("span.sub", null, t("controls.controlFree")),
    );
  }

  /** Highlights the pressed control on the drawing. */
  private highlightPressed() {
    if (!this.pressed || this.pressed.device !== this.device) return;
    const { device, key } = this.pressed;
    for (const element of this.body.querySelectorAll<HTMLElement>("[data-control-key]")) {
      if (this.sameControl(device, element.dataset.controlKey ?? "", key)) {
        element.classList.add("pressed");
        element.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
  }

  private debounce?: number;
  private renderDebounced() {
    window.clearTimeout(this.debounce);
    this.debounce = window.setTimeout(() => {
      this.render();
      const input = this.body.querySelector<HTMLInputElement>("input.search");
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 200);
  }

  private diagram(device: string, binds: Bind[]): HTMLElement {
    const meta = this.meta!;
    const info = deviceInfo(meta, device);
    const tplId = device in this.tplChoice ? this.tplChoice[device] : meta.templates[device] ? device : "";
    const tpl = tplId ? meta.templates[tplId] : undefined;
    const choose = (id: string) => {
      this.tplChoice[device] = id;
      try {
        localStorage.setItem("edch.templates", JSON.stringify(this.tplChoice));
      } catch {
        /* per-viewer convenience only */
      }
      this.render();
    };
    const options = Object.entries(meta.templates)
      .filter(
        ([id, template], i, all) =>
          all.findIndex(([, u]) => u.image === template.image && u.name === template.name) === i && id,
      )
      .sort(([, a], [, b]) => a.name.localeCompare(b.name));
    const picker =
      info.kind === "keyboard" || info.kind === "mouse"
        ? null
        : h(
            "label.tpl-picker",
            { title: t("controls.modelIsnTRecognisedPickClosest") },
            t("controls.template") + " ",
            h(
              "select",
              { onchange: (e: Event) => choose((e.target as HTMLSelectElement).value) },
              h("option", { value: "", selected: !tplId }, t("controls.simpleDiagramNoPicture")),
              options.map(([id, template]) => h("option", { value: id, selected: id === tplId }, template.name)),
            ),
          );
    const title = h(
      "div.device-title",
      null,
      h("h2", null, tpl && !meta.devices[device] ? tpl.name : info.label),
      h("span.sub", null, device !== info.label ? device : ""),
      picker,
    );
    let drawing: HTMLElement;
    if (info.kind === "keyboard")
      drawing = keyboard(
        this.meta!,
        this.ctx,
        this.layout,
        () => this.legendKey(),
        () => this.render(),
        binds,
      );
    else if (tpl) drawing = this.templateView(device, tpl, binds, info.kind === "gamepad");
    else if (info.kind === "gamepad") drawing = gamepad(this.meta!, () => this.legendKey(), device, binds);
    else drawing = board(this.meta!, () => this.legendKey(), binds, info.kind === "mouse");
    return h("section.card.diagram", null, title, drawing);
  }

  /** EDRefCard picture of the device with each control's actions written in its box. */
  private templateView(device: string, tpl: DeviceTemplate, binds: Bind[], isGamepad: boolean): HTMLElement {
    const meta = this.meta!;
    const [w, hgt] = tpl.size;
    const placed = new Map<string, Bind[]>();
    const unplaced: Bind[] = [];
    for (const b of binds) {
      const box = templateBox(tpl, device, b.key);
      if (box) placed.set(box, [...(placed.get(box) ?? []), b]);
      else unplaced.push(b);
    }
    const fallback = () =>
      isGamepad
        ? gamepad(this.meta!, () => this.legendKey(), device, binds)
        : board(this.meta!, () => this.legendKey(), binds, false);
    // The picture kept on the PC when there is one (instant, offline too); else GitHub's, kept for next time.
    const pictureUrl = `${meta.templateBase}${tpl.image}.jpg`;
    const img = h("img.tpl-img", {
      alt: tpl.name,
      draggable: false,
      onerror: () => {
        stage.replaceWith(
          h(
            "div",
            null,
            h("p.notice", null, icon("warn"), " " + t("controls.templatePictureUnavailableOfflineShowingSimple")),
            fallback(),
          ),
        );
      },
    });
    const keptName = keptPictureName(meta.templateBase, tpl.image);
    void keptPictureUrl(keptName).then((kept) => {
      img.src = kept ?? pictureUrl;
      if (!kept) void keepPicture(keptName, pictureUrl);
    });
    // Configuring: every box of the picture, the empty ones too, so any control can be clicked.
    const boxKeys = this.session ? Object.keys(tpl.boxes).filter((key) => !/Axis$/.test(key)) : [...placed.keys()];
    const boxes = boxKeys.map((key) => {
      const list = placed.get(key) ?? [];
      const [x, y, bw, bh] = tpl.boxes[key];
      const g = list[0] ? groupOf(meta, list[0].action) : "";
      const text = list
        .map(
          (b) =>
            `${b.modifiers.length ? `${b.modifiers.map((m) => keyLabel(meta, m.key)).join("+")}+` : ""}${actionName(meta, b.action)}${b.inverted ? " (inv.)" : ""}`,
        )
        .join(" · ");
      return h(
        `div.tpl-box${list.length ? `.${groupClass(g)}` : ".empty"}`,
        {
          "data-control-key": list[0]?.key ?? key,
          title: `${keyLabel(meta, key)} : ${text}`,
          style: {
            left: `${(x / w) * 100}%`,
            top: `${(y / hgt) * 100}%`,
            width: `${(bw / w) * 100}%`,
            height: `${(bh / hgt) * 100}%`,
            fontSize: `${Math.min(0.95, (bh / w) * 100 * (list.length > 1 ? 0.4 : 0.62))}cqw`,
          },
        },
        text,
      );
    });
    const stage = h("div.tpl-stage", { style: { aspectRatio: `${w} / ${hgt}` } }, img, boxes);
    const scroller = h("div.tpl-scroll", null, stage);
    // Zoomed in, the picture scrolls both ways, and can be dragged around with the mouse.
    let drag: { x: number; y: number; left: number; top: number } | undefined;
    scroller.addEventListener("pointerdown", (e: PointerEvent) => {
      if (!scroller.classList.contains("zoom") || e.button !== 0) return;
      // No native drag of the picture: the mouse moves the view.
      e.preventDefault();
      drag = { x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
      scroller.setPointerCapture(e.pointerId);
      scroller.classList.add("dragging");
    });
    scroller.addEventListener("pointermove", (e: PointerEvent) => {
      if (!drag) return;
      scroller.scrollLeft = drag.left - (e.clientX - drag.x);
      scroller.scrollTop = drag.top - (e.clientY - drag.y);
    });
    const endDrag = () => {
      drag = undefined;
      scroller.classList.remove("dragging");
    };
    scroller.addEventListener("pointerup", endDrag);
    scroller.addEventListener("pointercancel", endDrag);
    return h(
      "div",
      null,
      h(
        "div.row",
        null,
        h(
          "button.ghost.small",
          {
            onclick: () => {
              // Keep the middle of what is shown in the middle after zooming in or out.
              const middleX = (scroller.scrollLeft + scroller.clientWidth / 2) / scroller.scrollWidth;
              const middleY = (scroller.scrollTop + scroller.clientHeight / 2) / scroller.scrollHeight;
              scroller.classList.toggle("zoom");
              scroller.scrollLeft = middleX * scroller.scrollWidth - scroller.clientWidth / 2;
              scroller.scrollTop = middleY * scroller.scrollHeight - scroller.clientHeight / 2;
            },
          },
          icon("search"),
          " " + t("controls.zoomOut"),
        ),
      ),
      scroller,
      h("p.sub.credits", null, t("controls.edrefcardTemplateMitPictureLoadedFrom")),
      this.legendKey(),
      unplaced.length
        ? h("div", null, h("h4.sub", null, t("controls.noBoxTemplate")), legendTable(this.meta!, unplaced))
        : null,
    );
  }

  // ---------------- legend helpers ----------------

  private legendKey(): HTMLElement {
    const used = new Set(this.visible().map((b) => groupOf(this.meta!, b.action)));
    return h(
      "div.legend-key",
      null,
      [...used].map((g) => h(`span.act.${groupClass(g)}`, null, GROUP_LABELS[g] ?? g)),
    );
  }

  // ---------------- keyboard ----------------

  // ---------------- gamepad ----------------

  // ---------------- joystick / HOTAS / mouse ----------------
}

function rank(meta: BindsMeta, device: string): number {
  const kind = deviceInfo(meta, device).kind;
  return { joystick: 0, gamepad: 1, keyboard: 2, mouse: 3, vr: 4 }[kind];
}
