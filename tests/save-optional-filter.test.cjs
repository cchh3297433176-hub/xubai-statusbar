const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'../src/'+n),'utf8');
const preview=read('10-regex-preview.part.js');const filterCode=preview.slice(preview.indexOf('    function makeStatusFilter'),preview.indexOf('    // ================= 读写酒馆正则'));
const events=read('16-events.part.js');const saveCode=events.slice(events.indexOf('        async function saveRegexResult'),events.indexOf("        on(panel.querySelector('#ab-save'),"));
function setup({scope='character',find='/^\\[([^\\]]+)\\]$/gm',keep=1,checked=true,failWrite=false,overwrite=false}={}){
 const logs=[],writes=[],bound=[];let id=0;
 const inputs={'#ab-font-select':{value:''},'#ab-scope':{value:scope},'#ab-add-filter':{checked},'#ab-keep-floors':{value:keep},'#ab-status':{textContent:''}};
 const session={replaceStringRaw:'<body>漂亮的美化</body>',assignments:{},scriptName:'漂亮美化',findRegex:find};
 if(overwrite)session.referenceRegex={id:'original',scope:'character',find_regex:find,replace_string:'old',script_name:'old'};
 const original=session.referenceRegex;
 const sandbox={session,panel:{querySelector:q=>inputs[q]},mintConfirm:async()=>true,persistSessionImages:async()=>{},extractPlaceholderKeys:()=>[],generateUUID:()=>String(++id),toast:(message,type)=>logs.push({message,type}),console:{error:()=>{}},
 updateTavernRegexesWith:async fn=>{if(failWrite)throw Error('存储失败');writes.push(fn(original?[original]:[]));},bindRegexesToSelectedWorldbook:async(p,scripts)=>{bound.push(scripts);return '世界书';}};
 vm.createContext(sandbox);vm.runInContext(filterCode+saveCode+'\nthis.save=saveRegexResult;',sandbox);
 return {save:()=>sandbox.save(overwrite),logs,writes,bound,inputs};
}
test('unsupported bracket format saves beauty alone with explicit filter warning',async()=>{const h=setup();await h.save();assert.equal(h.writes[0].length,1);assert.match(h.writes[0][0].replace_string,/漂亮的美化/);assert.equal(h.logs.at(-1).type,'warning');assert.match(h.logs.at(-1).message,/已保存为新正则/);assert.match(h.inputs['#ab-status'].textContent,/发送最近几楼.*未生效/);});
test('unsupported filter does not block worldbook binding or overwrite',async()=>{const h=setup({scope:'worldbook'});await h.save();assert.equal(h.bound[0].length,1);assert.match(h.logs.at(-1).message,/已绑定世界书/);const edit=setup({overwrite:true});await edit.save();assert.equal(edit.writes[0][0].id,'original');assert.equal(edit.writes[0].length,1);assert.match(edit.logs.at(-1).message,/已更新原正则/);});
test('supported paired tags still save the requested filter',async()=>{const h=setup({find:'/<status>([\\s\\S]*?)<\\/status>/g'});await h.save();assert.equal(h.writes[0].length,2);assert.equal(h.writes[0][1].destination.prompt,true);assert.equal(h.logs.at(-1).type,'success');});
test('invalid floor count and storage failures remain failures',async()=>{for(const options of [{keep:-1},{failWrite:true}]){const h=setup(options);await h.save();assert.equal(h.writes.length,0);assert.equal(h.logs.at(-1).type,'error');assert.match(h.logs.at(-1).message,/保存失败/);}});
test('filter disabled saves unsupported format without any warning',async()=>{const h=setup({checked:false});await h.save();assert.equal(h.writes[0].length,1);assert.equal(h.logs.at(-1).type,'success');});
