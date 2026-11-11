import test from 'node:test';
import assert from 'node:assert/strict';
import {isX52Device, gameJoystickCandidates, x52BindingSummary} from '../dist/js/features/controls/hotasMapping.js';
const physical={id:'js0',name:'Saitek X52 Pro Flight Control System',vendor:'06a3',product:'0762',readable:true};
const b=(action,slot,device,key,modifiers=[])=>({action,slot,device,key,modifiers});
const binds=[
 b('FirePrimary','primary','SaitekX52Pro','Joy_1'),
 b('FireSecondary','primary','SaitekX52Pro','Joy_2'),
 b('AxisYaw','axis','SaitekX52Pro','Joy_XAxis'),
 b('OpenMap','secondary','Keyboard','Key_M'),
 b('Headlook','primary','SaitekX52Pro','Joy_4',[{device:'SaitekX52Pro',key:'Joy_3'}]),
];
test('X52 identification depends on physical name, not fictional connected devices',()=>{
 assert.equal(isX52Device(physical),true);
 assert.equal(isX52Device({...physical,name:'generic Logitech keyboard'}),false);
});
test('Linux button 0 maps to observed Joy_1 as hypothesis only',()=>{
 let matches=gameJoystickCandidates({deviceId:'js0',kind:'button',inputIndex:0,value:1},binds,physical);
 assert.equal(matches.length,1);
 assert.equal(matches[0].binding.key,'Joy_1');
 assert.equal(matches[0].offset,1);
});
test('ambiguous Linux numbering shows both matches for explicit user choice',()=>{
 let matches=gameJoystickCandidates({deviceId:'js0',kind:'button',inputIndex:1,value:1},binds,physical);
 assert.deepEqual(matches.map(x=>x.binding.key),['Joy_1','Joy_2']);
});
test('axis motion and events from another physical joystick never propose a button',()=>{
 assert.deepEqual(gameJoystickCandidates({deviceId:'js0',kind:'axis',inputIndex:1,value:22000},binds,physical),[]);
 assert.deepEqual(gameJoystickCandidates({deviceId:'js1',kind:'button',inputIndex:1,value:1},binds,physical),[]);
});
test('unknown buttons and modified-only inputs do not fabricate assignments',()=>{
 assert.deepEqual(gameJoystickCandidates({deviceId:'js0',kind:'button',inputIndex:110,value:1},binds,physical),[]);
 assert.deepEqual(gameJoystickCandidates({deviceId:'js0',kind:'button',inputIndex:3,value:1},binds,physical),[]);
});
test('summary counts only actual source .binds records',()=>{
 assert.deepEqual(x52BindingSummary(binds),{buttons:3,axes:1,actions:4});
});
