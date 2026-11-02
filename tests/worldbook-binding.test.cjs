const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/10a-worldbook-binding.part.js'), 'utf8');
function api(bridge) {
 return vm.runInNewContext(source+';({worldbookBindingTargets,bindRegexesToSelectedWorldbook,worldbookBindingBridge})', {targetWindow:{KelaodeWorldbookRegex:bridge}});
}
const snapshot={all:['娱乐圈','主世界书','备用娱乐圈','Fantasy','娱乐圈'],global:['娱乐圈','主世界书'],primary:'主世界书'};
test('global and keyword filters combine; the primary book is excluded by default',()=>{
 const {worldbookBindingTargets:filter}=api();
 assert.deepEqual(Array.from(filter(snapshot,true)),['娱乐圈']);
 assert.deepEqual(Array.from(filter(snapshot,true,'备用')),[]);
 assert.deepEqual(Array.from(filter(snapshot,false,'备用')),['备用娱乐圈']);
 assert.deepEqual(Array.from(filter(snapshot,false,'FANTASY')),['Fantasy']);
 assert.equal(filter(snapshot,false).includes('主世界书'),false);
});
test('save rechecks metadata; stale or excluded selections do not write',async()=>{
 let writes=0;
 const {bindRegexesToSelectedWorldbook:bind}=api({version:1,listTargets:async()=>snapshot,bind:async()=>writes++});
 const values={'#ab-bind-worldbook':{value:'备用娱乐圈'},'#ab-bind-global-only':{checked:true},'#ab-bind-keyword':{value:''}};
 const panel={querySelector:key=>values[key]};
 await assert.rejects(bind(panel,[{id:'style'}]),/绑定状态已变化/);
 assert.equal(writes,0);
 values['#ab-bind-global-only'].checked=false;
 assert.equal(await bind(panel,[{id:'style'},{id:'filter'}]),'备用娱乐圈');
 assert.equal(writes,1);
 values['#ab-bind-worldbook'].value='';
 await assert.rejects(bind(panel,[]),/选择目标世界书/);
});
test('missing manager produces an actionable error without an alternate global save',()=>{
 assert.throws(()=>api().worldbookBindingBridge(),/更新并启用世界书管理器/);
});
