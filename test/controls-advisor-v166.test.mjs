import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bindingKey, catalogRows, inputCatalog, recommendProfile, occupancyWarnings,
  isStagedAssignmentValid, groupTab,
} from '../dist/js/features/controls/presetAdvisor.js';

const meta={controls:{
 HyperSuperCombination:{g:'Ship',n:'Saut hyperespace'},
 GalaxyMapOpen:{g:'Galaxy map',n:'Carte galactique'},
 FirePrimary:{g:'Ship',n:'Tir principal'},
 FireSecondary:{g:'Ship',n:'Tir secondaire'},
 LandingGearToggle:{g:'Ship',n:'Train d’atterrissage'},
 SRVBrake:{g:'SRV',n:'Frein VRS'},
 HumanoidJumpButton:{g:'OnFoot',n:'Saut à pied'},
 UICancel:{g:'UI',n:'Retour interface'},
},devices:{},templates:{},vidpid:{}};
const b=(action,slot,device,key,modifiers=[])=>({action,slot,device,key,modifiers});
const binds=[
 b('FirePrimary','primary','SaitekX52Pro','Joy_1'),
 b('UICancel','primary','Keyboard','Key_Escape'),
 b('SRVBrake','primary','Keyboard','Key_J'),
 b('HumanoidJumpButton','primary','Keyboard','Key_Space'),
 b('FireSecondary','primary','SaitekX52Pro','Joy_2'),
 b('LandingGearToggle','primary','Keyboard','Key_L'),
 b('GalaxyMapOpen','secondary','{NoDevice}',''),
];
const actions=Object.keys(meta.controls);

test('tabs accurately separate ship, SRV, foot and UI using EDCH catalog groups',()=>{
 assert.equal(groupTab('Ship'),'ship');
 assert.equal(groupTab('SRV'),'srv');
 assert.equal(groupTab('OnFoot'),'foot');
 assert.equal(groupTab('Galaxy map'),'ui');
 assert.equal(catalogRows(actions,binds,meta,'ship').length,4);
 assert.equal(catalogRows(actions,binds,meta,'foot').length,1);
 assert.equal(catalogRows(actions,binds,meta,'ship','saut',a=>a==='HyperSuperCombination'?'Saut hyperespace':a).length,1);
 assert.equal(catalogRows(actions,binds,meta,'srv').length,1);
});

test('action catalog shows main and secondary input without modifying original',()=>{
 const rows=catalogRows(actions,binds,meta,'all');
 const fire=rows.find(x=>x.action==='FirePrimary');
 assert.equal(fire.primary.key,'Joy_1'); assert.equal(fire.secondary,undefined);
 assert.equal(binds[0].key,'Joy_1');
});

test('only existing, non-analog device inputs are offered',()=>{
 const out=inputCatalog([...binds,b('PitchAxis','axis','SaitekX52Pro','Joy_XAxis'),b('Aim','primary','Keyboard','Key_A')]);
 assert.equal(out.some(x=>x.key==='Joy_XAxis'),false);
 assert.equal(out.some(x=>x.key==='Key_Escape'),true);
 assert.equal(out.some(x=>x.key==='Joy_1'),true);
});

test('suggestions do not reuse a button already bound in the target game group',()=>{
 const advice=recommendProfile('balanced',actions,binds,meta);
 assert.ok(advice.changes.length>0);
 assert.ok(advice.changes.every(x=>x.replaceExisting===false));
 assert.ok(advice.changes.every(x=>x.action==='HyperSuperCombination'));
 assert.ok(advice.changes.every(x=>x.device==='Keyboard'||x.device==='Mouse'));
 assert.ok(advice.changes.every(x=>x.key==='Key_J')); // deliberately selected semantic hint for FSD
 assert.equal(occupancyWarnings(binds,advice.changes,meta).length,0);
});

test('same key across different contexts is not an automatic conflict',()=>{
 const change={action:'HyperSuperCombination',slot:'primary',device:'Keyboard',key:'Key_J',modifiers:[],replaceExisting:false};
 assert.deepEqual(occupancyWarnings(binds,[change],meta),[]);
});

test('occupied input and duplicate staged slot are flagged',()=>{
 const used={action:'HyperSuperCombination',slot:'primary',device:'SaitekX52Pro',key:'Joy_1',modifiers:[],replaceExisting:false};
 assert.ok(occupancyWarnings(binds,[used],meta).some(x=>x.includes('partagée')));
 assert.ok(occupancyWarnings(binds,[used,used],meta).some(x=>x.includes('répétée')));
});

test('never silently replace an occupied slot without explicit flag',()=>{
 const x={action:'FirePrimary',slot:'primary',device:'Keyboard',key:'Key_J',modifiers:[],replaceExisting:false};
 assert.equal(isStagedAssignmentValid(x,actions,binds),false);
 assert.equal(isStagedAssignmentValid({...x,replaceExisting:true},actions,binds),true);
});

test('profile suggestions are deterministic and constrained by valid known inputs',()=>{
 for (const profile of ['balanced','navigation','combat','exploration']) {
  const a=recommendProfile(profile,actions,binds,meta);
  const b2=recommendProfile(profile,actions,binds,meta);
  assert.deepEqual(a,b2);
  assert.ok(a.changes.length<=8);
  for (const x of a.changes)assert.equal(isStagedAssignmentValid(x,actions,binds),true);
 }
});

test('unknown actions and source assignment arrays are never mutated',()=>{
 const original=JSON.stringify(binds);
 const a=recommendProfile('combat',['UnknownAction'],binds,meta);
 assert.equal(a.changes.length,0);
 assert.equal(JSON.stringify(binds),original);
 assert.equal(bindingKey(binds[0]),bindingKey({...binds[0]}));
});
