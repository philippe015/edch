/** Virtual AZERTY keyboard: inspect the selected Elite Dangerous profile and draft.
 * This module is strictly read-only; it never writes a .binds file or triggers the game.
 */
import type { Bind, BindsMeta } from "./binds.js";
import { groupOf } from "./binds.js";
import type { PresetAssignment } from "./presetAdvisor.js";
import { scopeForGroup, type GameScope } from "./scopedProfiles.js";

export interface VirtualKeyAssignment {
  action: string;
  slot: "primary" | "secondary" | "axis";
  device: string;
  key: string;
  modifiers: string[];
  kind: "existing" | "prepared";
  usesModifier: boolean;
}
export interface VirtualKeySummary {
  existing: VirtualKeyAssignment[];
  prepared: VirtualKeyAssignment[];
}
export const keyIds = (id: string | readonly string[]): readonly string[] =>
  typeof id === "string" ? [id] : id;

const matches = (key: string, ids: readonly string[]): boolean => ids.includes(key);
const toKey = (bind: Bind, kind: "existing" | "prepared", usesModifier: boolean): VirtualKeyAssignment => ({
  action:bind.action,slot:bind.slot,device:bind.device,key:bind.key,
  modifiers:bind.modifiers.map(m=>m.device+" : "+m.key),kind,usesModifier,
});

/** Selected context only; a replacement in the new draft hides the old same-slot key.
 * Modifier keys display their dependent actions too, but are never changed on click.
 */
export function assignmentsForVirtualKey(
  ids: string | readonly string[],
  scope: GameScope,
  original: readonly Bind[],
  draft: readonly PresetAssignment[],
  meta: BindsMeta,
): VirtualKeySummary {
  const keys=keyIds(ids);
  const scoped = (action:string) => scopeForGroup(groupOf(meta,action))===scope;
  const overwritten = new Set(draft.filter(p=>p.replaceExisting).map(p=>p.action+"|"+p.slot));
  const existing = original.filter(b=>{
    if(!scoped(b.action))return false;
    if(overwritten.has(b.action+"|"+b.slot))return false;
    return (b.device==="Keyboard"&&matches(b.key,keys))||
      b.modifiers.some(m=>m.device==="Keyboard"&&matches(m.key,keys));
  }).map(b=>toKey(b,"existing",!(b.device==="Keyboard"&&matches(b.key,keys))));
  const prepared=draft.filter(p=>{
    if(!scoped(p.action))return false;
    return (p.device==="Keyboard"&&matches(p.key,keys)) ||
      p.modifiers.some(m=>m.device==="Keyboard"&&matches(m.key,keys));
  }).map(b=>toKey(b as Bind,"prepared",!(b.device==="Keyboard"&&matches(b.key,keys))));
  return {existing,prepared};
}

export function virtualKeyCount(summary:VirtualKeySummary):number {
  return new Set([...summary.existing,...summary.prepared]
    .map(a=>a.action+"|"+a.slot+"|"+a.kind)).size;
}

/** Focused selected-key details, avoiding duplicate rows from aliases or Enter outlines. */
export function virtualKeyLabel(ids:string | readonly string[], fallback:string):string {
  return fallback.trim() || keyIds(ids).join(" / ");
}
