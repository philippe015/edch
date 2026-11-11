import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBgsReportHtml, buildControlsReportHtml, escapeHtml} from '../dist/js/features/reports/htmlReport.js';

const bgs = (systemName='Étoile A') => ({faction:'Astra Milita',systems:[{name:systemName,source:'Spansh',states:['War'],controls:true,updatedAt:'2026-11-10T12:00:00Z',retrievedAt:'2026-11-11T08:00:00Z',lastVisitedAt:'2026-11-08T12:00:00Z',influence:51.2,note:'Important'}],history:[]});
const controls={preset:'Custom.4.2.binds',devices:[{device:'SaitekX52Pro',assigned:12,actions:11,axes:2,sharedInputs:1,catalogued:true}],overlaps:[{device:'SaitekX52Pro',key:'Joy_1',modifiers:'',group:'Ship',actions:['FirePrimary','HyperSuperCombination']}],essentials:[{action:'FirePrimary',bound:true}],translations:{referenceFrench:1,boundActions:2,toReview:['OneAction']}};
test('v1.6.5 BGS report is a real self-contained HTML document with Unicode',()=>{
 const html=buildBgsReportHtml(bgs(),'PHILOU');
 assert.match(html,/^<!doctype html>/);assert.match(html,/<html lang="fr">/);assert.match(html,/Étoile A/);
 assert.match(html,/<table>/);assert.match(html,/PHILOU/);
 assert.match(html,/default-src 'none'/);assert.doesNotMatch(html,/<script/i);
 assert.match(html,/Cyberpunk Philou/);
});
test('v1.6.5 reports escape unknown community data including script and attributes',()=>{
 const html=buildBgsReportHtml(bgs('<script>alert("x")</script>'),'" onload="evil');
 assert.doesNotMatch(html,/<script>/i);assert.match(html,/&lt;script&gt;/);
 assert.match(html,/&quot; onload=&quot;evil/);
});
test('v1.6.5 controls report keeps original author, settings and printable tables',()=>{
 const html=buildControlsReportHtml(controls);
 assert.match(html,/CMDR MDLuffy/);assert.match(html,/Cyberpunk Philou/);
 assert.match(html,/SaitekX52Pro/);assert.match(html,/FirePrimary/);
 assert.match(html,/media print/);assert.match(html,/default-src 'none'/);
 assert.doesNotMatch(html,/%PDF-/);
});
test('v1.6.5 controls report safely encodes command/device fields',()=>{
 const html=buildControlsReportHtml({...controls,preset:'<img src=x onerror=evil>', devices:[{...controls.devices[0],device:'<iframe src=bad>'}]});
 assert.match(html,/&lt;img/);assert.match(html,/&lt;iframe/);
 assert.doesNotMatch(html,/<iframe/i);
});
test('v1.6.5 escaping preserves French accents and escapes HTML special chars',()=>{
 assert.equal(escapeHtml('Étoile & <Sécurité> "oui"'), 'Étoile &amp; &lt;Sécurité&gt; &quot;oui&quot;');
});
