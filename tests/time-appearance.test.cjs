const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
const clockParser=read('05-style-theme.part.js').match(/    function timeToMinutes\(value\) \{[\s\S]*?\n    \}/)[0];
const optionsSource=clockParser+read('08a-interactions.part.js');
const slots=[
    {start:'06:00',end:'11:00',style:'暖白'},
    {start:'11:00',end:'18:00',style:'浅绿'},
    {start:'22:00',end:'06:00',style:'蓝黑'},
];
const fixture=(globals={})=>{
    const ctx=vm.createContext(globals);
    vm.runInContext(optionsSource+'\nthis.api={validateTimeAppearance,timeAppearancePrompt,mintMountTimeAppearance,restoreTimeAppearance};',ctx);
    return ctx;
};

test('validates multiple and overnight slots, with gaps and adjacent boundaries allowed',()=>{
    const {api}=fixture();
    assert.equal(api.validateTimeAppearance({enabled:false,slots:[{start:'',end:'',style:''}]}).length,0);
    const validated=api.validateTimeAppearance({enabled:true,slots});
    assert.deepEqual(Array.from(validated,slot=>slot.id),['slot-1','slot-2','slot-3']);
    assert.throws(()=>api.validateTimeAppearance({enabled:true,slots:[]}),/至少一个/);
    assert.throws(()=>api.validateTimeAppearance({enabled:true,slots:[{start:'24:00',end:'06:00',style:'夜'}]}),/起止时间/);
    assert.throws(()=>api.validateTimeAppearance({enabled:true,slots:[{start:'06:00',end:'06:00',style:'夜'}]}),/起止时间/);
    assert.throws(()=>api.validateTimeAppearance({enabled:true,slots:[{start:'06:00',end:'10:00',style:' '}]}),/外观描述/);
    assert.throws(()=>api.validateTimeAppearance({enabled:true,slots:[...slots,{start:'23:00',end:'07:00',style:'冲突'}]}),/重叠/);
});

test('browser reference switches at Beijing boundaries and clears timers on removal',()=>{
    let now=Date.parse('2026-11-09T13:59:59Z'), pending, delay;
    const docEvents=new Map(), winEvents=new Map();
    const win={
        setTimeout(fn,ms){pending=fn;delay=ms;return 1;},
        clearTimeout(){pending=undefined;},
        addEventListener:(name,fn)=>winEvents.set(name,fn),
        removeEventListener:name=>winEvents.delete(name),
    };
    const doc={
        defaultView:win,hidden:false,
        addEventListener:(name,fn)=>docEvents.set(name,fn),
        removeEventListener:name=>docEvents.delete(name),
    };
    const root={ownerDocument:doc,dataset:{},isConnected:true};
    const {api}=fixture({Date:class extends Date {static now(){return now;}}});
    const cleanup=api.mintMountTimeAppearance(root,api.validateTimeAppearance({enabled:true,slots}));
    assert.equal(root.dataset.mintTimeMode,'base');
    assert.equal(delay,1000);
    now+=1000;pending();
    assert.equal(root.dataset.mintTimeMode,'slot-3');
    now=Date.parse('2026-11-09T16:00:00Z');docEvents.get('visibilitychange')();
    assert.equal(root.dataset.mintTimeMode,'slot-3');
    now=Date.parse('2026-11-09T22:00:00Z');pending();
    assert.equal(root.dataset.mintTimeMode,'slot-1');
    assert.equal(delay,5*3600000);
    cleanup();
    assert.equal(pending,undefined);
    assert.equal(docEvents.size,0);
    assert.equal(winEvents.size,0);
});

test('generation sends the enabled schedule, preserves its history snapshot and rejects overlaps before calling the model',async()=>{
    const history=[];
    const ctx=fixture({
        console,AbortController,session:null,generationBusy:false,generationEpoch:0,destroyed:false,
        selectedSkillPayload:()=>'',selectedMaterialPrompt:()=>'',normalizeImagePlan:()=>[],imagePlan:[],
        imagePlanAssignments:()=>({}),syncGenerationUI:()=>{},receiveGeneration:p=>p,
        generateUUID:()=> 'id',addHistory:async e=>history.push(e),toast:()=>{},
        targetDoc:{getElementById:()=>null},stripEmbeddedData:s=>s,
    });
    vm.runInContext(read('09-generation.part.js')+read('14-generate-actions.part.js')+`
        callGenerateRaw=async(system,user)=>{
            this.request=user;
            return '===SCRIPTNAME===\\n测试\\n===FINDREGEX===\\n/<status>(.*?)<\\/status>/s\\n===REPLACESTRING===\\n<body>内容</body>\\n===FORMATGUIDE===\\n说明\\n===END===';
        };
        this.run=doGenerate;
    `,ctx);
    const enabled={checked:true};
    const rows=slots.map(slot=>({
        querySelector:selector=>({value:slot[{'[data-time-start]':'start','[data-time-end]':'end','[data-time-style]':'style'}[selector]]}),
    }));
    const controls={
        '#ab-source':{value:'tavern'},'#ab-desc':{value:'测试'},'#ab-force-image':{checked:false},
        '#mint-time-appearance':{querySelector:()=>enabled,querySelectorAll:()=>rows},
    };
    const panel={querySelector:selector=>controls[selector]??null,querySelectorAll:()=>[]};
    await ctx.run(panel,'create');
    assert.match(ctx.request,/北京时间/);
    assert.match(ctx.request,/"start": "22:00"/);
    assert.match(ctx.request,/function mintMountTimeAppearance/);
    assert.equal(history[0].timeAppearance.enabled,true);
    assert.equal(history[0].timeAppearance.slots[2].end,'06:00');
    enabled.checked=false;
    await ctx.run(panel,'create');
    assert.doesNotMatch(ctx.request,/【按时间切换外观】|function mintMountTimeAppearance/);
    assert.equal(history[1].timeAppearance.enabled,false);
    assert.equal(history[0].timeAppearance.enabled,true);
    enabled.checked=true;
    rows.push(rows[0]);
    await assert.rejects(ctx.run(panel,'create'),/重叠/);
    assert.equal(history.length,2);
});
