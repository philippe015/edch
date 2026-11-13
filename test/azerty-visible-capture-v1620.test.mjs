import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  captureVirtualFootKey,approvedCapturedKeyboardKey,captureMouseForFoot,
} from "../dist/js/features/controls/footDirectCapture.js";
import {KEY_IDS,KEY_CAPS} from "../dist/js/views/controls/keyLayouts.js";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("on-screen AZERTY letters and digit 3 are capturable as keyboard, not Mouse_1",()=>{
  for(const value of ["Key_A","Key_Z","Key_Q","Key_S","Key_D","Key_F1","Key_F12",
    "Key_3","Key_0","Key_Space","Key_Enter","Key_Tab","Key_LeftShift",
    "Key_RightControl","Key_Numpad_5","Key_LeftArrow"]){
    const input=captureVirtualFootKey(value);
    assert.equal(input?.device,"Keyboard",value);
    assert.equal(input?.key,value,value);
    assert.equal(approvedCapturedKeyboardKey(input.device,input.key,[]),true,value);
  }
  assert.equal(captureVirtualFootKey("Key_3")?.label,"3");
  assert.equal(KEY_IDS.azerty.r1[0],"Key_A");
  assert.equal(KEY_IDS.azerty.r1[1],"Key_Z");
  assert.equal(KEY_CAPS.azerty.r1.slice(0,6).join(""),"AZERTY");
  assert.ok(KEY_IDS.azerty.num.includes("Key_3"));
});

test("unavailable physical symbols and escape are visibly disabled, never fabricated",()=>{
  for(const value of ["Key_Escape","Key_CapsLock","Key_Grave","Key_RightBracket",
    "Key_LeftWin","Key_Apps","Key_OEM102","Key_Numpad_Multiply","Key_F13",
    "Key_Unknown","Mouse_1"]){
    assert.equal(captureVirtualFootKey(value),null,value);
  }
  assert.equal(captureVirtualFootKey("Key_1")?.device,"Keyboard");
  assert.equal(captureVirtualFootKey("Key_Backspace")?.device,"Keyboard");
});

test("mouse capture remains an explicit, separate click zone",()=>{
  assert.equal(captureMouseForFoot(0)?.key,"Mouse_1");
  assert.equal(captureMouseForFoot(1)?.key,"Mouse_3");
  assert.equal(captureMouseForFoot(2)?.key,"Mouse_2");
  const editor=read("src/views/controls/presetEditor.ts");
  const zone=editor.slice(editor.indexOf("const captureOverlay="),
    editor.indexOf('this.host=h("section.card.edch-controls-write-v166"'));
  assert.ok(zone.includes('h("div.edch-c166-capture-mouse-zone"'),"visible mouse zone");
  assert.ok(zone.includes("onmousedown:(e:MouseEvent)=>"),"mouse zone handles button capture");
  const beforeMouseZone=zone.slice(0,zone.indexOf('h("div.edch-c166-capture-mouse-zone"'));
  assert.doesNotMatch(beforeMouseZone,/onmousedown:/,"dialog and keyboard must not capture Mouse_1 on click");
  assert.ok(editor.includes("captureVirtualFootKey(key)"),"virtual key uses keyboard input helper");
  assert.ok(zone.includes("captureMode:true"));
});

test("keyboard is embedded in foreground dialog, not just behind dim overlay",()=>{
  const editor=read("src/views/controls/presetEditor.ts");
  const keyboard=read("src/views/controls/virtualAzertyKeyboard.ts");
  const css=read("public/foot-direct-capture-v1619.css");
  const area=editor.slice(editor.indexOf("const captureKeyboard="),
    editor.indexOf('this.host=h("section.card.edch-controls-write-v166"'));
  assert.ok(area.includes('h("div.edch-c166-capture-keyboard",null,captureKeyboard)'));
  assert.ok(area.includes("const captureOverlay="));
  assert.ok(area.includes("Échap pour annuler"));
  assert.ok(keyboard.includes("captureMode?:boolean;"));
  assert.ok(keyboard.includes("const disabled=captureMode&&!capturableKey;"));
  assert.ok(keyboard.includes("disabled,style:"));
  assert.ok(keyboard.includes("Choisir une touche sur le clavier AZERTY"));
  assert.ok(keyboard.includes('captureMode?"Choisir une touche sur le clavier AZERTY"'));
  assert.ok(css.includes(".edch-c166-capture-keyboard"));
  assert.ok(css.includes(".edch-c166-capture-mouse-zone"));
  assert.ok(css.includes("max-height:calc(100dvh - 24px)"));
  assert.ok(css.includes(".edch-vkb-key:disabled"));
});

test("on-screen buttons can be activated with Enter/Space without recording those as another key",()=>{
  const editor=read("src/views/controls/presetEditor.ts");
  assert.ok(editor.includes('target.closest("button")&&(e.key==="Enter"||e.key===" ")'));
  assert.ok(editor.includes('this.repaint(this.captureMode?"capture":undefined)'));
  assert.ok(editor.includes("this.applyCapturedInput(input,meta)"));
  assert.ok(editor.includes("isStagedAssignmentValid(next,src.actions,src.binds)"));
  assert.ok(editor.includes("this.staged=this.staged.filter"));
  assert.ok(editor.includes("window.confirm"));
  const writer=read("src-tauri/src/controls_preset.rs");
  assert.ok(writer.includes("create_new(true)"));
});
