import test from "node:test";
import assert from "node:assert/strict";
import { captureFootKey, conflictsForFoot, footActions } from "../dist/js/features/controls/footEdit.js";

const meta = {
  controls: {
    HumanoidJumpButton: { g: "OnFoot", n: "Jump" },
    HumanoidReloadButton: { g: "OnFoot", n: "Reload" },
    HumanoidMoveAxis: { g: "OnFoot", n: "Move Axis" },
    YawLeftButton: { g: "Ship", n: "Yaw Left" },
    SystemMapOpen_Humanoid: { g: "OnFoot", n: "System map" },
  },
  templates: {},
  templateBase: "",
  keymap: {},
  devices: {},
  vidpid: {},
  vendors: {},
};
function key(code, k, opts = {}) {
  return { code, key: k, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, repeat: false, ...opts };
}
test("on-foot action filter does not include ship or analog axes", () =>
  assert.deepEqual(footActions(meta), ["HumanoidJumpButton", "HumanoidReloadButton", "SystemMapOpen_Humanoid"]));
test("AZERTY physical key with French letter A maps to game Key_A", () =>
  assert.equal(captureFootKey(key("KeyQ", "a"))?.key, "Key_A"));
test("AZERTY number-row uses physical 1", () => assert.equal(captureFootKey(key("Digit1", "&"))?.key, "Key_1"));
test("control modifier is captured", () =>
  assert.deepEqual(captureFootKey(key("KeyR", "r", { ctrlKey: true }))?.modifiers, ["Key_LeftControl"]));
test("modifier key used alone", () =>
  assert.deepEqual(captureFootKey(key("ShiftLeft", "Shift", { shiftKey: true }))?.modifiers, []));
test("unknown punctuation is refused", () => assert.equal(captureFootKey(key("IntlBackslash", "<")), null));
test("repeat/meta shortcuts are refused", () =>
  assert.equal(captureFootKey(key("KeyA", "a", { metaKey: true })), null));
test("conflict detector ignores ship and reports on-foot same combo", () => {
  const bindings = [
    { action: "HumanoidReloadButton", slot: "primary", device: "Keyboard", key: "Key_R", modifiers: [] },
    { action: "YawLeftButton", slot: "primary", device: "Keyboard", key: "Key_R", modifiers: [] },
  ];
  assert.deepEqual(
    conflictsForFoot([{ action: "HumanoidJumpButton", slot: "primary", key: "Key_R", modifiers: [] }], bindings, meta),
    ["HumanoidJumpButton / HumanoidReloadButton"],
  );
});
test("replacing the same action slot does not conflict with itself", () => {
  const bindings = [{ action: "HumanoidJumpButton", slot: "primary", device: "Keyboard", key: "Key_R", modifiers: [] }];
  assert.deepEqual(
    conflictsForFoot([{ action: "HumanoidJumpButton", slot: "primary", key: "Key_R", modifiers: [] }], bindings, meta),
    [],
  );
});
