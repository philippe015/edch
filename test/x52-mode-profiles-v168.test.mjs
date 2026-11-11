import test from 'node:test';
import assert from 'node:assert/strict';
import {buildX52ModePlans, MODE_TEMPLATES, renderX52ModesHtml, x52ModeDialCandidates} from '../dist/js/features/controls/x52ModeProfiles.js';
const meta = {controls:{
  HyperSuperCombination:{g:'Ship',n:'FSD'},GalaxyMapOpen:{g:'Galaxy map',n:'Galaxy'},
  FirePrimary:{g:'Ship',n:'Fire'},DeployHardpoint:{g:'Ship',n:'Hardpoints'},
  ExplorationFSSMode:{g:'Scanners',n:'FSS'},
},templates:{},templateBase:'',keymap:{},devices:{},vidpid:{},vendors:{}};
const bind=(action,slot,device,key,modifiers=[])=>({action,slot,device,key,modifiers});
const actions=['HyperSuperCombination','GalaxyMapOpen','FirePrimary','DeployHardpoint','ExplorationFSSMode'];
const binds=[bind(actions[0],'primary','Keyboard','Key_J'),bind(actions[1],'secondary','Keyboard','Key_M'),bind(actions[2],'primary','SaitekX52Pro','Joy_8'),bind('ModeSwitch','primary','SaitekX52Pro','Joy_27')];

test('three modes describe pilotage, combat, exploration and BGS in correct order',()=>{
 assert.deepEqual(MODE_TEMPLATES.map(x=>x.id),[1,2,3]);
 assert.deepEqual(buildX52ModePlans(actions,binds,meta).map(x=>x.title),['Pilotage / Navigation','Combat','Exploration / Patrouilles BGS']);
});
test('only known actions appear, source bindings are preserved and axes never receive synthetic bindings',()=>{
 const modes=buildX52ModePlans(actions,binds,meta);
 assert.ok(modes[0].rows.some(x=>x.action==='HyperSuperCombination' && x.current.some(c=>c.includes('Key_J'))));
 assert.ok(modes[1].rows.some(x=>x.action==='FirePrimary' && x.current.some(c=>c.includes('Joy_8'))));
 assert.ok(modes[2].rows.some(x=>x.action==='ExplorationFSSMode' && x.current.length===0));
 assert.ok(modes.every(x=>x.rows.every(y=>actions.includes(y.action))));
 assert.equal(binds.length,4);
});
test('raw selector events provide candidates ONLY for inputs already present in source .binds',()=>{
 assert.deepEqual(x52ModeDialCandidates(27,binds),['Joy_27']);
 assert.deepEqual(x52ModeDialCandidates(28,binds),[]);
 assert.deepEqual(x52ModeDialCandidates(-1,binds),[]);
 assert.deepEqual(x52ModeDialCandidates(2.5,binds),[]);
});
test('HTML report is standalone printable UTF-8 and escapes untrusted name and game source values',()=>{
 const html=renderX52ModesHtml(buildX52ModePlans(actions,binds,meta),'<img src=x onerror=alert(1)> & spéciale',{1:27});
 assert.match(html,/<html lang="fr">/);
 assert.match(html,/Content-Security-Policy/);
 assert.match(html,/@media print/);
 assert.ok(html.includes('Exploration / Patrouilles BGS'));
 assert.ok(!html.includes('<img src=x'));
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert.ok(html.includes('Index joydev 27'));
 assert.ok(!html.includes('<script'));
});
test('empty source creates clear plans without an invented game profile',()=>{
 const r=buildX52ModePlans([],[],meta);assert.equal(r.length,3);
 assert.ok(r.every(x=>x.rows.length===0&&x.assigned===0));
});
