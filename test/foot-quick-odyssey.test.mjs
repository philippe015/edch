import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FOOT_CATEGORIES, footQuickActions, footQuickGroup, planFootAzerty,
} from "../dist/js/features/controls/footQuick.js";
import { captureFootKey, conflictsForFoot } from "../dist/js/features/controls/footEdit.js";

const meta = JSON.parse(readFileSync(new URL("../public/data/binds.json", import.meta.url), "utf8"));
const label = (action) => ({
  HumanoidJumpButton: "Sauter",
  HumanoidReloadButton: "Recharger",
  HumanoidCrouchButton: "S'accroupir",
})[action] ?? meta.controls[action]?.n ?? action;

test("Odyssey quick categories come from the real bindings catalog", () => {
  assert.equal(FOOT_CATEGORIES.length, 6);
  const essential = footQuickActions(meta, "essential", "", label);
  assert.ok(essential.some((entry) => entry.action === "HumanoidJumpButton"));
  assert.ok(essential.some((entry) => entry.action === "HumanoidPrimaryInteractButton"));
  assert.ok(!essential.some((entry) => entry.action === "YawLeftButton"));
  assert.equal(footQuickGroup("HumanoidReloadButton"), "combat");
  assert.ok(footQuickActions(meta, "all", "", label).length >= 50);
});

test("French query is accent-insensitive and displays only on-foot actions", () => {
  const rows = footQuickActions(meta, "combat", "RECHARGER", label);
  assert.ok(footQuickActions(meta, "all", "RECHARGER", label).some((r) => r.action === "HumanoidReloadButton"));
  assert.ok(rows.some((entry) => entry.action === "HumanoidReloadButton"));
  assert.ok(rows.every((entry) => entry.category === "combat"));
  assert.ok(footQuickActions(meta, "essential", "sauté", () => "Sauter").some((r) => r.action === "HumanoidJumpButton"));
});

test("AZERTY suggestion never changes a mouse, HOTAS, or used keyboard slot", () => {
  const existing = [
    { action: "HumanoidPrimaryInteractButton", slot: "primary", device: "Mouse", key: "Mouse_1", modifiers: [] },
    { action: "HumanoidBackwardButton", slot: "primary", device: "X52Pro", key: "Joy_4", modifiers: [] },
    { action: "HumanoidMeleeButton", slot: "secondary", device: "Keyboard", key: "Key_Z", modifiers: [] },
  ];
  const plan = planFootAzerty(meta, existing, []);
  assert.ok(plan.skipped.some((x) => x.action === "HumanoidPrimaryInteractButton" && x.reason.includes("HOTAS")));
  assert.ok(plan.skipped.some((x) => x.action === "HumanoidBackwardButton"));
  assert.ok(plan.skipped.some((x) => x.action === "HumanoidForwardButton" && x.reason.includes("utilisée")));
  assert.ok(!plan.changes.some((x) => x.action === "HumanoidForwardButton"));
  assert.ok(plan.changes.every((x) => x.slot === "primary" && x.modifiers.length === 0));
});

test("AZERTY never overwrites existing staged edits, and honors already configured keys", () => {
  const staged = [{ action: "HumanoidReloadButton", slot: "primary", key: "Key_T", modifiers: [] }];
  const binds = [{ action: "HumanoidJumpButton", slot: "primary", device: "Keyboard", key: "Key_Space", modifiers: [] }];
  const plan = planFootAzerty(meta, binds, staged);
  assert.ok(plan.alreadyConfigured >= 1);
  assert.ok(plan.skipped.some((x) => x.action === "HumanoidReloadButton"));
  assert.ok(!plan.changes.some((x) => x.action === "HumanoidReloadButton"));
});

test("Capturing an AZERTY letter remains a keyboard-only assignment", () => {
  const captured = captureFootKey({
    code: "KeyQ", key: "a", ctrlKey: false, altKey: false,
    shiftKey: false, metaKey: false, repeat: false,
  });
  assert.deepEqual(captured?.key, "Key_A");
  assert.equal(captured?.modifiers.length, 0);
  assert.equal(captureFootKey({
    code: "KeyA", key: "Dead", ctrlKey: false, altKey: false,
    shiftKey: false, metaKey: false, repeat: false,
  }), null);
});

test("Overlapping quick edits are detected before saving a profile", () => {
  const draft = [
    { action: "HumanoidReloadButton", slot: "primary", key: "Key_X", modifiers: [] },
    { action: "HumanoidJumpButton", slot: "primary", key: "Key_X", modifiers: [] },
  ];
  assert.ok(conflictsForFoot(draft, [], meta).length >= 1);
});

test("Only the foot editor can call foot_save_preset, with explicit player confirmation", () => {
  const editor = readFileSync(new URL("../src/views/controls/footEditor.ts", import.meta.url), "utf8");
  const root = readFileSync(new URL("../src/views/controls/index.ts", import.meta.url), "utf8");
  const native = readFileSync(new URL("../src-tauri/src/foot_binds.rs", import.meta.url), "utf8");
  assert.match(editor, /window\.confirm\(/);
  assert.match(editor, /footSavePreset\(source, this\.draft\)/);
  assert.match(editor, /planFootAzerty/);
  assert.match(root, /this\.mode === "foot"/);
  assert.match(native, /create_new\(true\)/);
  assert.match(native, /crate::app::game_running/);
});
