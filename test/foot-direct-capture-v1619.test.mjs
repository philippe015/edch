import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  captureKeyboardForFoot,captureMouseForFoot,approvedCapturedKeyboardKey,
} from "../dist/js/features/controls/footDirectCapture.js";
import {isStagedAssignmentValid} from "../dist/js/features/controls/presetAdvisor.js";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const key=(key,code,extra={})=>({
  key,code,repeat:false,shiftKey:false,altKey:false,ctrlKey:false,metaKey:false,...extra,
});

test("P/S capture reads AZERTY printed character (event.key) not the QWERTY physical code",()=>{
  assert.deepEqual(captureKeyboardForFoot(key("a","KeyQ")),
    {device:"Keyboard",key:"Key_A",label:"A"});
  assert.deepEqual(captureKeyboardForFoot(key("z","KeyW")),
    {device:"Keyboard",key:"Key_Z",label:"Z"});
  assert.deepEqual(captureKeyboardForFoot(key("q","KeyA")),
    {device:"Keyboard",key:"Key_Q",label:"Q"});
  assert.deepEqual(captureKeyboardForFoot(key("w","KeyZ")),
    {device:"Keyboard",key:"Key_W",label:"W"});
});

test("top row digit keys on AZERTY include digit 3, even when typing needs Shift",()=>{
  assert.deepEqual(captureKeyboardForFoot(key('"',"Digit3")),
    {device:"Keyboard",key:"Key_3",label:"3"});
  assert.deepEqual(captureKeyboardForFoot(key("3","Digit3",{shiftKey:true})),
    {device:"Keyboard",key:"Key_3",label:"3"});
  assert.deepEqual(captureKeyboardForFoot(key("&","Digit1")),
    {device:"Keyboard",key:"Key_1",label:"1"});
});

test("captures recognized function, movement, editing and modifier keys",()=>{
  for(const [raw,code,expected] of [
    ["F5","F5","Key_F5"],[" ","Space","Key_Space"],
    ["Tab","Tab","Key_Tab"],["ArrowLeft","ArrowLeft","Key_LeftArrow"],
    ["Enter","Enter","Key_Enter"],["Shift","ShiftLeft","Key_LeftShift"],
    ["Backspace","Backspace","Key_Backspace"],["5","Numpad5","Key_Numpad_5"],
    ["Control","ControlLeft","Key_LeftControl"],["Alt","AltLeft","Key_LeftAlt"],
  ]){
    const value=captureKeyboardForFoot(key(raw,code,{shiftKey:raw==="Shift",ctrlKey:raw==="Control",altKey:raw==="Alt"}));
    assert.equal(value?.key,expected,code);
    assert.equal(approvedCapturedKeyboardKey("Keyboard",expected,[]),true,expected);
  }
});

test("unsafe shortcuts, auto-repeat, dead keys and unsupported punctuation are ignored",()=>{
  for(const extra of [{repeat:true},{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true}])
    assert.equal(captureKeyboardForFoot(key("a","KeyQ",extra)),null);
  for(const [k,c] of [["Dead","Quote"],["Process","KeyA"],["é","DigitUnknown"],
    ["!","IntlBackslash"],["AltGraph","AltRight"],["Escape","Escape"]])
    assert.equal(captureKeyboardForFoot(key(k,c)),null);
  assert.equal(approvedCapturedKeyboardKey("Keyboard","Key_Unknown",[]),false);
  assert.equal(approvedCapturedKeyboardKey("GamePad","Key_A",[]),false);
  assert.equal(approvedCapturedKeyboardKey("Keyboard","Key_A",["Shift"]),false);
  assert.equal(approvedCapturedKeyboardKey("Keyboard","Key_F13",[]),false);
});

test("mouse left/middle/right and side buttons use DOM button numbers, not guesses",()=>{
  for(const [n,expected] of [[0,"Mouse_1"],[1,"Mouse_3"],[2,"Mouse_2"],
    [3,"Mouse_4"],[4,"Mouse_5"]])assert.equal(captureMouseForFoot(n)?.key,expected);
  for(const n of [-1,5,10,99])assert.equal(captureMouseForFoot(n),null);
});

test("captured keyboard keys can be staged even when absent from original source",()=>{
  const actions=["HumanoidSelectEMPGrenade","HumanoidSwitchToRechargeTool"];
  const proposal={action:actions[0],slot:"primary",device:"Keyboard",key:"Key_7",
    modifiers:[],replaceExisting:false};
  assert.equal(isStagedAssignmentValid(proposal,actions,[]),true);
  assert.equal(isStagedAssignmentValid({...proposal,key:"Key_F7"},actions,[]),true);
  assert.equal(isStagedAssignmentValid({...proposal,key:"Key_Invalid"},actions,[]),false);
  assert.equal(isStagedAssignmentValid({...proposal,device:"Mouse",key:"Mouse_4"},actions,[]),false,
    "mouse buttons must exist in the actual source; never synthesize them");
  assert.equal(isStagedAssignmentValid({...proposal,device:"GamePad",key:"Pad_A"},actions,[]),false,
    "gamepad inputs cannot be invented");
});

test("occupied slots need an explicit replacement while still preserving source",()=>{
  const actions=["HumanoidPrimaryFireButton"];
  const source=[{action:actions[0],slot:"primary",device:"Mouse",key:"Mouse_1",modifiers:[]}];
  const change={action:actions[0],slot:"primary",device:"Keyboard",key:"Key_K",
    modifiers:[],replaceExisting:false};
  assert.equal(isStagedAssignmentValid(change,actions,source),false);
  assert.equal(isStagedAssignmentValid({...change,replaceExisting:true},actions,source),true);
  assert.equal(source[0].key,"Mouse_1");
});

test("native Rust accepts only reviewed captured keyboard codes in addition to old inputs",()=>{
  const native=read("src-tauri/src/controls_preset.rs");
  assert.ok(native.includes("fn captured_keyboard_key("));
  assert.ok(native.includes('device != "Keyboard" || !modifiers.is_empty()'));
  assert.ok(native.includes('&& !captured_keyboard_key(&change.device, &change.key, &change.modifiers)'));
  assert.ok(native.includes("fn captured_keyboard_codes_are_strictly_bounded()"));
  assert.ok(native.includes("create_new(true)"));
});

test("P and S switch on focused capture for On Foot AZERTY only and do not send game input",()=>{
  const view=read("src/views/controls/presetEditor.ts");
  const css=read("public/foot-direct-capture-v1619.css");
  const html=read("public/index.html");
  for(const phrase of [
    'this.mode==="foot"&&this.family==="azerty"',
    'this.repaint(this.captureMode?"capture":undefined)',
    "captureKeyboardForFoot(e)","captureMouseForFoot(e.button)",
    "this.applyCapturedInput(input,meta)",
    "this.captureMode=false",
    "this.staged=this.staged.filter",
    "window.confirm",
    "isStagedAssignmentValid(next,src.actions,src.binds)",
    '"Appuyer sur une touche (clavier / souris)"',
    '"aria-modal":"true"',
    "oncontextmenu:",
  ])assert.ok(view.includes(phrase),phrase);
  assert.ok(css.includes(".edch-c166-capture-overlay"));
  assert.ok(html.includes("foot-direct-capture-v1619.css"));
  assert.doesNotMatch(view,/navigator\.getGamepads\(|sendGameInput\(|startPresetWrite/);
});
