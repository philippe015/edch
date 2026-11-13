import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  ON_FOOT_IN_GAME_STEPS,safePresetName,onFootPresetFromStartFile,inGameOnFootStatus,
} from "../dist/js/features/controls/inGameOnFoot.js";
import {fileForPreset,presetLineFor} from "../dist/js/features/controls/binds.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const start="Custom\r\nEDCHShip\r\nCustomSRV\r\nEDCHPro012\r\n";

test("Odyssey has a distinct fourth active preset for On Foot, not Ship or SRV",()=>{
  assert.equal(presetLineFor("OnFoot"),3);
  assert.equal(presetLineFor("Ship"),1);
  assert.equal(presetLineFor("SRV"),2);
  assert.equal(onFootPresetFromStartFile(start),"EDCHPro012");
  assert.equal(onFootPresetFromStartFile("Custom\nShips\nSRV\nCustom"),"Custom");
});

test("valid preset names are conservative and do not allow paths or XML",()=>{
  for(const n of ["Custom","EDCHPro001","EDCH_Foot"])assert.equal(safePresetName(n),n);
  for(const n of [""," ../Custom ","Custom/../../x","<Root>","a".repeat(41)])
    assert.equal(safePresetName(n),null);
  assert.equal(onFootPresetFromStartFile("Custom\nShips\nSRV\n../../evil"),null);
});

test("status shows confirmed active preset only when StartPreset actually matches",()=>{
  const ok=inGameOnFootStatus(start,"EDCHPro012");
  assert.equal(ok.status,"active");
  assert.equal(ok.activePreset,"EDCHPro012");
  const mismatch=inGameOnFootStatus(start,"EDCHPro013");
  assert.equal(mismatch.status,"other");
  assert.ok(mismatch.help.includes("EDCHPro013"));
  assert.equal(inGameOnFootStatus(null,"EDCHPro012").status,"unknown");
  assert.equal(inGameOnFootStatus("wrong",null).status,"unknown");
});

test("editing controls in Odyssey can select Custom without touching other game categories",()=>{
  const modified="Custom\nEDCHShip\nCustomSRV\nCustom\n";
  const result=inGameOnFootStatus(modified,"EDCHPro012");
  assert.equal(result.status,"other");
  assert.equal(result.activePreset,"Custom");
  const files=["Custom.4.2.binds","EDCHPro012.4.2.binds","EDCHShip.4.2.binds"];
  assert.equal(fileForPreset(result.activePreset,files),"Custom.4.2.binds");
});

test("activation instructions are for the game's user interface, not simulated game input",()=>{
  assert.equal(ON_FOOT_IN_GAME_STEPS.length,6);
  const text=ON_FOOT_IN_GAME_STEPS.join(" ");
  for(const term of ["Odyssey","À pied","Préréglages","EDCHPro","Custom","Appliquer"])
    assert.ok(text.includes(term),term);
});

test("in-game assistant is scoped to On Foot and exposes functioning host actions",()=>{
  const editor=read("src/views/controls/presetEditor.ts");
  const page=read("public/index.html");
  const css=read("public/odyssey-ingame-foot-v1618.css");
  for(const s of [
    'const inGameCard=this.mode==="foot"',
    'btn("Ouvrir le dossier des profils .binds"',
    'btn("Vérifier le profil À pied actif"',
    'btn("Relire les réglages faits dans le jeu"',
    'void this.openBindingsFolder()',
    'void this.verifyInGamePreset()',
    'void this.refreshAfterGameChanges()',
    'revealPath(path)',
    'optionsDir()',
    'readOptionFile("Bindings",start.name)',
    'fileForPreset(current',
    'controlsSaveNamedPresetBatch',
    'this.lastCreated={preset:out.preset,filename:out.filename,path:out.path}',
  ])assert.ok(editor.includes(s),s);
  assert.ok(page.includes("odyssey-ingame-foot-v1618.css"));
  assert.ok(css.includes(".edch-ingame-foot-steps"));
  assert.ok(!editor.includes("setStartPreset("));
});

test("safe discovery is read-only: the source Rust writer still only creates new files",()=>{
  const rust=read("src-tauri/src/controls_preset.rs");
  assert.ok(rust.includes("create_new(true)"));
  assert.ok(rust.includes("game_running().await"));
  assert.ok(rust.includes('Path::new(&crate::options::options_dir()?).join("Bindings")'));
  assert.ok(rust.includes("rewrite_xml_batch"));
  const js=read("src/features/controls/inGameOnFoot.ts");
  assert.doesNotMatch(js,/invoke\(|writeFile|create_new|StartPreset\.write/);
});
