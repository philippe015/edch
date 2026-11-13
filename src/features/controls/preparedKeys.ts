/** Allowlist for prepared AZERTY keyboard keys.
 * Device IDs on gamepads/HOTAS are NEVER inferred and must be present in a .binds source.
 * Keep in sync with PREPARED_AZERTY_KEYS in src-tauri/src/controls_preset.rs.
 */
export const PREPARED_AZERTY_KEYS:readonly string[] = Object.freeze([
  "Key_Z","Key_S","Key_Q","Key_D","Key_R","Key_F","Key_J","Key_L",
  "Key_H","Key_T","Key_M","Key_N","Key_V","Key_Y","Key_C","Key_U",
  "Key_B","Key_E","Key_G","Key_X","Key_3","Key_Space","Key_Tab",
  "Key_LeftShift","Key_LeftControl",
]);
const APPROVED=new Set(PREPARED_AZERTY_KEYS);
export function approvedPreparedKey(device:string,key:string,modifiers:readonly unknown[]):boolean {
  return device==="Keyboard" && APPROVED.has(key) && modifiers.length===0;
}
