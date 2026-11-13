/** EDCH v1.6.19 — capture keyboard/mouse input for the Odyssey On Foot editor.
 * Only physical controls that the game's Odyssey binding format can represent.
 * No game input injection, no global hook and no silent .binds modifications.
 */
export interface CapturedDigitalInput {
  device:"Keyboard"|"Mouse";
  key:string;
  label:string;
}
export interface CapturableKeyboardEvent {
  key:string; code:string; repeat:boolean;
  shiftKey:boolean; altKey:boolean; ctrlKey:boolean; metaKey:boolean;
}
const NAMED_CODES:Readonly<Record<string,string>>={
  Space:"Space",Tab:"Tab",Enter:"Enter",Backspace:"Backspace",Delete:"Delete",
  Insert:"Insert",Home:"Home",End:"End",PageUp:"PageUp",PageDown:"PageDown",
  ArrowUp:"UpArrow",ArrowDown:"DownArrow",ArrowLeft:"LeftArrow",ArrowRight:"RightArrow",
  ShiftLeft:"LeftShift",ShiftRight:"RightShift",ControlLeft:"LeftControl",
  ControlRight:"RightControl",AltLeft:"LeftAlt",AltRight:"RightAlt",
};
/** Single key only: AZERTY letters use event.key; the top digit row uses event.code.
 * Shift needed to type a number on French AZERTY is not stored as a modifier.
 * Ctrl/Alt/Meta combinations require dedicated .binds modifier support and are refused.
 */
export function captureKeyboardForFoot(e:CapturableKeyboardEvent):CapturedDigitalInput|null {
  if(e.repeat||e.metaKey||["Dead","Process","AltGraph","Unidentified"].includes(e.key))return null;
  const named=NAMED_CODES[e.code];
  if(named && /^(Shift|Control|Alt)$/.test(e.key))
    return {device:"Keyboard",key:"Key_"+named,label:named};
  if(e.ctrlKey||e.altKey)return null;
  if(e.shiftKey && !/^Digit[0-9]$/.test(e.code))return null;
  let key="";
  if(/^[a-z]$/i.test(e.key))key="Key_"+e.key.toUpperCase();
  else if(/^Digit[0-9]$/.test(e.code))key="Key_"+e.code.slice(-1);
  else if(/^Numpad[0-9]$/.test(e.code))key="Key_Numpad_"+e.code.slice(-1);
  else if(/^F(?:[1-9]|1[0-2])$/.test(e.code))key="Key_"+e.code;
  else if(named)key="Key_"+named;
  if(!key)return null;
  return {device:"Keyboard",key,label:key.replace(/^Key_/,"")};
}
/** DOM mouse button numbering: 0 left, 1 wheel, 2 right, 3/4 extra buttons.
 * Any other button is not guessed.
 */
export function captureMouseForFoot(button:number):CapturedDigitalInput|null {
  const known:Readonly<Record<number,readonly [string,string]>>={
    0:["Mouse_1","Clic gauche"],
    1:["Mouse_3","Clic molette"],
    2:["Mouse_2","Clic droit"],
    3:["Mouse_4","Bouton latéral 4"],
    4:["Mouse_5","Bouton latéral 5"],
  };
  const hit=known[button];
  return hit?{device:"Mouse",key:hit[0],label:hit[1]}:null;
}
/** Allowlisted digital keyboard codes that Odyssey accepts even if not yet used
 * in the source .binds. Frontend and Rust native validation must agree.
 */
export function approvedCapturedKeyboardKey(device:string,key:string,modifiers:readonly unknown[]):boolean {
  if(device!=="Keyboard"||modifiers.length!==0)return false;
  if(/^Key_[A-Z0-9]$/.test(key))return true;
  if(/^Key_F(?:[1-9]|1[0-2])$/.test(key))return true;
  if(/^Key_Numpad_[0-9]$/.test(key))return true;
  return new Set([
    "Space","Tab","Enter","Backspace","Delete","Insert","Home","End","PageUp","PageDown",
    "UpArrow","DownArrow","LeftArrow","RightArrow",
    "LeftShift","RightShift","LeftControl","RightControl","LeftAlt","RightAlt",
  ]).has(key.startsWith("Key_")?key.slice(4):"");
}
