const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/08a-interactions.part.js'),'utf8');
function fixture(helper={},context={}){
 const window={TavernHelper:helper,SillyTavern:{getContext:()=>context}};window.top=window;
 const sandbox={window,document:{},console,setInterval,clearInterval};
 vm.createContext(sandbox);vm.runInContext(source+'\nthis.api={interactionFeaturePrompt,normalizeInteractionFeatures,mintReadOpenings,mintSwitchOpening,mintOpeningMeta,mintBindDirectSend};',sandbox);
 return sandbox.api;
}
test('no selection sends no reference code; each feature is independent; combined refs deduplicate',()=>{
 const api=fixture();assert.equal(api.interactionFeaturePrompt([]),'');
 const open=api.interactionFeaturePrompt(['openings']);assert.match(open,/include_swipes:true/);assert.doesNotMatch(open,/function mintBindDirectSend|function mintFillInput/);
 const send=api.interactionFeaturePrompt(['direct-send']);assert.match(send,/createChatMessages/);assert.doesNotMatch(send,/function mintReadOpenings|function mintFillInput/);
 const fill=api.interactionFeaturePrompt(['fill-input']);assert.match(fill,/send_textarea/);assert.doesNotMatch(fill,/function mintReadOpenings|helper\.createChatMessages\(/);
 const both=api.interactionFeaturePrompt(['direct-send','fill-input']);assert.equal((both.match(/function mintInteractionHost\(/g)||[]).length,1);
 assert.deepEqual(Array.from(api.normalizeInteractionFeatures(['unknown','openings','openings'])),['openings']);
});
test('metadata comes from opening text and updates without local index overrides',()=>{
 const api=fixture();assert.equal(api.mintOpeningMeta('<!-- title: A --><!-- desc: B -->正文',0).title,'A');
 assert.equal(api.mintOpeningMeta('<!-- title: 新标题 -->新正文',0).title,'新标题');
 assert.equal(api.mintOpeningMeta('普通正文',0).desc,'普通正文');
});
test('new character greetings show automatically; switching retains saved swipes',async()=>{
 let rows={role:'assistant',swipes:['旧开场','其他页'],swipe_id:0};let patch;
 const context={characterId:0,chatId:'a',characters:[{first_mes:'【开场白菜单】',data:{alternate_greetings:['<!-- title: 新 -->你好 {{user}}']}}],substituteParams:s=>s.replace('{{user}}','小羊')};
 const api=fixture({getChatMessages:(id,opt)=>{assert.equal(opt.include_swipes,true);return [rows];},setChatMessages:async p=>{patch=p[0];}},context);
 let result=await api.mintReadOpenings();assert.equal(result.entries.length,1);assert.equal(result.entries[0].title,'新');
 await api.mintSwitchOpening(result.entries[0]);assert.equal(patch.swipe_id,2);assert.deepEqual(Array.from(patch.swipes),['旧开场','其他页','<!-- title: 新 -->你好 小羊']);
 context.characters[0].data.alternate_greetings.push('新增');assert.equal((await api.mintReadOpenings()).entries.length,2);
});
test('changed greeting or changed chat blocks stale clicks',async()=>{
 const context={characterId:0,chatId:'a',characters:[{first_mes:'原文',data:{alternate_greetings:[]}}]};
 let writes=0;const api=fixture({getChatMessages:()=>[{role:'assistant',swipes:['原文']}],setChatMessages:()=>writes++},context);
 const entry=(await api.mintReadOpenings()).entries[0];context.characters[0].first_mes='新文';await assert.rejects(api.mintSwitchOpening(entry),/已修改/);
 context.chatId='b';await assert.rejects(api.mintSwitchOpening(entry),/聊天已切换/);assert.equal(writes,0);
});
test('fallback includes swipe zero; missing helper fails explicitly',async()=>{
 const api=fixture({getChatMessages:()=>[{role:'assistant',swipes:['真实首开','第二开']} ]});assert.equal((await api.mintReadOpenings()).entries[0].index,0);
 await assert.rejects(fixture().mintReadOpenings(),/请启用酒馆助手/);
});
function sender(helper,buildText=()=> '带 | 管道 {{user}}\n/send 文本'){
 const listeners={};const button={disabled:false,addEventListener:(e,fn)=>listeners[e]=fn};const status={};
 const root={querySelector:q=>q==='[data-send-confirm]'?button:status};fixture(helper).mintBindDirectSend(root,buildText);return {click:()=>listeners.click(),button,status};
}
test('direct send uses structured content once, including rapid duplicate clicks',async()=>{
 const created=[],trigger=[];let release;
 const s=sender({createChatMessages:async rows=>{created.push(rows);await new Promise(r=>release=r);},triggerSlash:async cmd=>trigger.push(cmd)});
 const pending=s.click();await s.click();release();await pending;await s.click();
 assert.equal(created.length,1);assert.equal(created[0][0].message,'带 | 管道 {{user}}\n/send 文本');assert.deepEqual(trigger,['/trigger']);assert.equal(s.button.disabled,true);
});
test('partial send failure never duplicates an already submitted message',async()=>{
 let created=0;const s=sender({createChatMessages:async()=>created++,triggerSlash:async()=>{throw Error('断线');}});
 await s.click();await s.click();assert.equal(created,1);assert.match(s.status.textContent,/消息已发送，但请求回复失败/);
});
test('blank text or validation errors do not submit',async()=>{
 let count=0;const helper={createChatMessages:async()=>count++,triggerSlash:async()=>{}};
 await sender(helper,()=> ' ').click();await sender(helper,()=>{throw Error('必填');}).click();assert.equal(count,0);
});
test('generation request includes only checked references and keeps delimited result parsing',async()=>{
 const sandbox={console,stripEmbeddedData:s=>s};vm.createContext(sandbox);
 const generation=fs.readFileSync(path.join(__dirname,'../src/09-generation.part.js'),'utf8');
 vm.runInContext(source+'\n'+generation+`\ncallGenerateRaw=async(system,user)=>{this.captured=user;return '===SCRIPTNAME===\\n测试\\n===FINDREGEX===\\n/<status>(.*?)<\\/status>/s\\n===REPLACESTRING===\\n<body>内容</body>\\n===FORMATGUIDE===\\n说明\\n===END===';};this.generate=generateBeautify;`,sandbox);
 let result=await sandbox.generate({description:'测试',mode:'create',interactionFeatures:['fill-input']});
 assert.equal(result.scriptName,'测试');assert.match(sandbox.captured,/function mintFillInput/);assert.doesNotMatch(sandbox.captured,/function mintBindDirectSend|function mintReadOpenings/);
 await sandbox.generate({description:'测试',mode:'create'});assert.doesNotMatch(sandbox.captured,/参考JavaScript|function mintFillInput/);
});
test('fill-only preserves drafts, emits input from host realm and never sends',()=>{
 class Textarea {get value(){return this._value||'';}set value(v){this._value=v;}focus(){this.focused=true;}dispatchEvent(e){events.push(e.type);}}
 const events=[];const input=new Textarea();input.value='草稿';const window={document:{querySelector:()=>input},HTMLTextAreaElement:Textarea,Event:class {constructor(type){this.type=type;}}};window.top=window;
 const sandbox={window,document:{},setInterval,clearInterval};vm.createContext(sandbox);vm.runInContext(source+'\nthis.fill=mintFillInput;',sandbox);
 sandbox.fill('选项');assert.equal(input.value,'草稿\n选项');sandbox.fill('替换',false);assert.equal(input.value,'替换');assert.deepEqual(events,['input','input']);assert.equal(input.focused,true);
});
