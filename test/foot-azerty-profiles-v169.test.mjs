import test from "node:test";
import assert from "node:assert/strict";
import { FOOT_PROFILES, footActionsInSource, planFootProfile } from "../dist/js/features/controls/footProfiles.js";
import { conflictsForFoot } from "../dist/js/features/controls/footEdit.js";

const ids = [
  "HumanoidForwardButton","HumanoidBackwardButton","HumanoidStrafeLeftButton",
  "HumanoidStrafeRightButton","HumanoidJumpButton","HumanoidSprintButton",
  "HumanoidCrouchButton","HumanoidPrimaryInteractButton","HumanoidReloadButton",
  "HumanoidToggleFlashlightButton","HumanoidMeleeButton","HumanoidThrowGrenadeButton",
  "HumanoidToggleShieldsButton","HumanoidSelectPrimaryWeaponButton",
  "HumanoidSelectSecondaryWeaponButton","HumanoidPulseScanButton",
  "HumanoidOpenAccessPanelButton","HumanoidToggleNightVisionButton",
  "HumanoidSwitchToCompAnalyser","HumanoidSwitchToSuitTool",
  "HumanoidSwitchWeapon","HumanoidItemWheelButton",
];
const meta = {
  controls: Object.fromEntries([...ids.map((a) => [a, { g: "OnFoot", n: a }]),
    ["YawLeftButton", { g: "Ship", n: "Yaw" }]]),
  templates: {}, templateBase: "", keymap: {}, devices: {}, vidpid: {}, vendors: {},
};
const binding = (action, key, device = "Keyboard", slot = "primary", modifiers = []) =>
  ({ action, slot, device, key, modifiers });

test("AZERTY essential uses game-facing printed ZQSD, not QWERTY physical codes", () => {
  const p = planFootProfile("azerty", ids, [], meta);
  const map = Object.fromEntries(p.changes.map((c) => [c.action, c.key]));
  assert.equal(map.HumanoidForwardButton, "Key_Z");
  assert.equal(map.HumanoidBackwardButton, "Key_S");
  assert.equal(map.HumanoidStrafeLeftButton, "Key_Q");
  assert.equal(map.HumanoidStrafeRightButton, "Key_D");
  assert.equal(map.HumanoidJumpButton, "Key_Space");
  assert.ok(p.changes.every((c) => c.modifiers.length === 0));
  assert.deepEqual(p.conflicts, []);
});

test("already-correct keyboard bindings are preserved", () => {
  const b = [binding("HumanoidForwardButton", "Key_Z"), binding("HumanoidJumpButton", "Key_Space")];
  const saved = JSON.stringify(b);
  const p = planFootProfile("azerty", ids, b, meta);
  assert.equal(p.alreadyCorrect, 2);
  assert.ok(!p.changes.some((c) => c.action === "HumanoidForwardButton"));
  assert.ok(!p.changes.some((c) => c.action === "HumanoidJumpButton"));
  assert.equal(JSON.stringify(b), saved);
});

test("never replace a HOTAS or mouse input; keyboard secondary may be staged", () => {
  const b = [
    binding("HumanoidForwardButton", "Joy_1", "SaitekX52Pro", "primary"),
    binding("HumanoidForwardButton", "Key_W", "Keyboard", "secondary"),
    binding("HumanoidBackwardButton", "Joy_2", "SaitekX52Pro", "primary"),
    binding("HumanoidBackwardButton", "Mouse_4", "Mouse", "secondary"),
  ];
  const p = planFootProfile("azerty", ids, b, meta);
  assert.deepEqual(p.changes.find((c) => c.action === "HumanoidForwardButton"),
    { action: "HumanoidForwardButton", slot: "secondary", key: "Key_Z", modifiers: [] });
  assert.ok(!p.changes.some((c) => c.action === "HumanoidBackwardButton"));
  assert.ok(p.skipped.some((s) => s.action === "HumanoidBackwardButton"));
  assert.equal(b[0].key, "Joy_1");
});

test("an unchanged OnFoot action holding Z blocks the new forward binding", () => {
  const b = [
    binding("HumanoidForwardButton", "Key_W"),
    binding("HumanoidMeleeButton", "Key_Z"),
    binding("YawLeftButton", "Key_Q"),
  ];
  const p = planFootProfile("azerty", ids, b, meta);
  assert.ok(!p.changes.some((c) => c.action === "HumanoidForwardButton"));
  assert.ok(p.skipped.some((s) => s.action === "HumanoidForwardButton" && /occupée/.test(s.reason)));
  assert.ok(p.changes.some((c) => c.action === "HumanoidStrafeLeftButton" && c.key === "Key_Q"),
    "ship bindings may reuse a key in a separate game context");
});

test("cascaded keyboard replacement releases a key in the same proposal", () => {
  const b = [
    binding("HumanoidForwardButton", "Key_W"),
    binding("HumanoidReloadButton", "Key_Z"),
  ];
  const p = planFootProfile("azerty", ids, b, meta);
  assert.ok(p.changes.some((c) => c.action === "HumanoidForwardButton" && c.key === "Key_Z"));
  assert.ok(p.changes.some((c) => c.action === "HumanoidReloadButton" && c.key === "Key_R"));
  assert.deepEqual(conflictsForFoot(p.changes, b, meta), []);
});

test("profile contains no duplicate targets or non-OnFoot edits", () => {
  const original = [binding("YawLeftButton", "Key_Z")];
  for (const def of FOOT_PROFILES) {
    const p = planFootProfile(def.id, ids, original, meta);
    assert.equal(p.conflicts.length, 0);
    assert.equal(new Set(p.changes.map((c) => c.key)).size, p.changes.length);
    assert.ok(p.changes.every((c) => ids.includes(c.action)));
  }
});

test("source inspection allows only existing Odyssey on-foot actions with editable slots", () => {
  const xml = `<Root PresetName="Custom" MajorVersion="4" MinorVersion="2">
<HumanoidForwardButton><Primary Device="Keyboard" Key="Key_W" /></HumanoidForwardButton>
<HumanoidReloadButton><Secondary Device="{NoDevice}" Key="" /></HumanoidReloadButton>
<HumanoidJumpButton><Binding Device="Keyboard" Key="Key_Space" /></HumanoidJumpButton>
<YawLeftButton><Primary Device="Keyboard" Key="Key_Z" /></YawLeftButton></Root>`;
  assert.deepEqual(footActionsInSource(xml, meta),
    ["HumanoidForwardButton", "HumanoidReloadButton"]);
  const p = planFootProfile("azerty", footActionsInSource(xml, meta), [], meta);
  assert.deepEqual(p.changes.map((c) => c.action),
    ["HumanoidForwardButton", "HumanoidReloadButton"]);
});

test("profile recommendation is deterministic and does not mutate the source", () => {
  const binds = [binding("HumanoidForwardButton", "Key_W")];
  const before = JSON.stringify(binds);
  assert.deepEqual(planFootProfile("combat", ids, binds, meta),
    planFootProfile("combat", ids, binds, meta));
  assert.equal(JSON.stringify(binds), before);
});
