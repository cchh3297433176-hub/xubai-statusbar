    function normalizeNaiPreset(value={}){
        const number=(n,f,min,max)=>{const v=Number(n);return Number.isFinite(v)?Math.min(max,Math.max(min,v)):f;};
        return {id:String(value.id||generateUUID()),name:String(value.name||'我的生图预设').slice(0,100),model:String(value.model||'').slice(0,150),artists:String(value.artists||'').slice(0,10000),positive:String(value.positive||'').slice(0,20000),negative:String(value.negative||'').slice(0,20000),width:Math.round(number(value.width,832,64,4096)),height:Math.round(number(value.height,1216,64,4096)),steps:Math.round(number(value.steps,28,1,100)),scale:number(value.scale,5,0,30),sampler:String(value.sampler||'k_euler_ancestral').slice(0,100),seed:(String(value.seed??'-1').trim()||'-1').slice(0,20),transparent:value.transparent===true,alphaConfirmed:value.alphaConfirmed===true};
    }
    function buildNaiDraft(value,subject=''){
        const p=normalizeNaiPreset(value);
        if(!p.model.trim())throw new Error('请填中转实际支持的模型 ID，不能用“NAI”代替');
        if(p.transparent&&!p.alphaConfirmed)throw new Error('透明背景需要确认中转支持 V5 原生透明通道；旧模型请先生成再抠图');
        if(p.width%64||p.height%64)throw new Error('画布宽高请使用64的倍数，并遵守中转限制');
        if(!/^-1$|^\d+$/.test(p.seed))throw new Error('种子请填 -1 或非负整数');
        if(Number(p.seed)>4294967295)throw new Error('种子超出32位范围');
        const prompt=[p.artists,p.positive,subject,p.transparent?'transparent background':''].map(v=>v.trim()).filter(Boolean).join(', ');
        cleanSkillText(prompt);cleanSkillText(p.negative);
        // A provider-neutral draft, not a guessed API request. No secret or server URL is exported.
        return {type:'xubai-image-draft',version:1,model:p.model,prompt,negative_prompt:p.negative,width:p.width,height:p.height,steps:p.steps,scale:p.scale,sampler:p.sampler,seed:Number(p.seed),format:'png',transparent_requested:p.transparent,requires_provider_mapping:true};
    }
    function naiFields(panel){
        const get=id=>panel.querySelector('#mint-nai-'+id);return normalizeNaiPreset({id:get('select').value||undefined,name:get('name').value,model:get('model').value,artists:get('artists').value,positive:get('positive').value,negative:get('negative').value,width:get('width').value,height:get('height').value,steps:get('steps').value,scale:get('scale').value,sampler:get('sampler').value,seed:get('seed').value,transparent:get('transparent').checked,alphaConfirmed:get('alpha-confirmed').checked});
    }
    function loadNaiFields(panel,preset){
        const p=normalizeNaiPreset(preset);for(const key of ['name','model','artists','positive','negative','width','height','steps','scale','sampler','seed'])panel.querySelector('#mint-nai-'+key).value=p[key];panel.querySelector('#mint-nai-transparent').checked=p.transparent;panel.querySelector('#mint-nai-alpha-confirmed').checked=p.alphaConfirmed;
    }
    function refreshNaiSelect(panel){
        const select=panel.querySelector('#mint-nai-select');select.replaceChildren();const blank=targetDoc.createElement('option');blank.value='';blank.textContent='新建一份生图预设';select.append(blank);for(const item of naiBook.items){const opt=targetDoc.createElement('option');opt.value=item.id;opt.textContent=item.name;select.append(opt);}select.value=naiBook.selected||'';loadNaiFields(panel,naiBook.items.find(v=>v.id===select.value)||{});
    }
    function renderRecentFeedback(panel){
        const box=panel?.querySelector('#mint-recent-feedback');if(!box)return;box.replaceChildren();
        for(const notice of recentFeedback){const row=targetDoc.createElement('div');row.className='mint-log-entry';const title=targetDoc.createElement('b');title.textContent=new Date(notice.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false})+' · '+({error:'出错',success:'完成',info:'提示',egg:'纸条'}[notice.type]||'提示');const msg=targetDoc.createElement('p');msg.textContent=notice.message;row.append(title,msg);if(notice.type==='error'){const copy=targetDoc.createElement('button');copy.textContent='复制错误';on(copy,'click',()=>copyMintMessage(notice.message));row.append(copy);}box.append(row);}
        if(!recentFeedback.length)box.textContent='还没有提示记录。本次打开页面期间保留最近20条。';
    }
    function recordMintFeedback(message,type){
        const clean=String(message).replace(/Bearer\s+\S+/gi,'Bearer [已隐藏]').replace(/\bsk-[a-zA-Z0-9_-]{8,}/g,'[已隐藏密钥]').slice(0,1200);
        recentFeedback=[{ts:Date.now(),message:clean,type},...recentFeedback].slice(0,20);renderRecentFeedback(targetDoc.getElementById('aibar-panel'));
    }
    function mountMintFeedback(box){
        const panel=targetDoc.getElementById('aibar-panel');const rack=panel?.querySelector('#mint-feedback-rack');
        if(rack&&!panel.hidden){if(box.parentElement!==rack)rack.append(box);rack.hidden=box.hidden;return true;}
        if(box.parentElement!==targetDoc.body)targetDoc.body.append(box);return false;
    }
    function scheduleMintNotice(){
        if(activities.size){clearTimeout(feedbackTimer);feedbackTimer=null;return;}
        if(!uiNotice||feedbackTimer!=null)return;
        const notice=uiNotice;feedbackTimer=setTimeout(()=>{if(uiNotice===notice)uiNotice=null;feedbackTimer=null;renderCapsule();},notice.type==='error'?18000:(notice.type==='success'||notice.type==='egg')?6500:3000);
    }

    let mintImageController=null;
    let pendingGeneratedImage=null;
    function baiBaiApi(){
        const api=targetWindow.STBaiBaiImage||window.STBaiBaiImage;
        if(!api||api.apiVersion!==1||!api.capabilities?.generate||typeof api.generate!=='function')throw new Error('未检测到支持公开 API v1 的柏宝绘。请安装/更新柏宝绘后刷新，或先使用手动上传。');
        return api;
    }
    function baiBaiStatus(){const api=baiBaiApi();const status=api.getBackendStatus();return {api,status};}
    function refreshBaiBaiStatus(panel){
        const box=panel?.querySelector('#mint-baibai-status');if(!box)return;
        try{const {status}=baiBaiStatus();box.textContent=status.configured?`已检测到 · ${status.backend} · ${status.model||'当前渠道'}。配置与鉴权由柏宝绘管理。`:'柏宝绘未配好渠道：'+status.reason;}
        catch(e){box.textContent=e.message;}
    }
    function decodedBaiBaiImage(dataUrl){
        const match=/^data:image\/(png|webp|jpeg);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(dataUrl||''));
        if(!match)throw new Error('柏宝绘返回的图片不是支持的 PNG/WebP/JPEG 数据');
        if(match[2].length>17*1024*1024)throw new Error('图片超过图库12MB上限；请到柏宝绘图库下载后压缩上传');
        const raw=atob(match[2]);const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
        const file=new Blob([bytes],{type:'image/'+match[1]});file.name='序白配图-'+Date.now()+'.'+(match[1]==='jpeg'?'jpg':match[1]);return file;
    }
    function buildBaiBaiRequest(p,subject,includeArtists=false){
        if(p.transparent)throw new Error('柏宝绘公开接口未提供透明参数覆盖；本入口暂不请求透明背景。独立中转透明生图需先确认接口。');
        const prompt=[includeArtists?p.artists:'',p.positive,subject].map(v=>v.trim()).filter(Boolean).join(', ');
        if(!prompt)throw new Error('请填写本次画面标签或正面提示词。建议使用英文标签，可先用你熟悉的工具转换。');
        cleanSkillText(prompt);const request={prompt,size:p.width>p.height?'landscape':'portrait',save:true};
        if(!/^-1$|^\d+$/.test(p.seed)||Number(p.seed)>4294967295)throw new Error('种子请填 -1 或32位非负整数');
        if(Number(p.seed)>0)request.seed=Number(p.seed);return request;
    }
    async function uploadPendingBaiBai(){
        const file=pendingGeneratedImage;if(!file)throw new Error('没有待上传的已生成图片');
        const url=await uploadRemoteImage(file);if(pendingGeneratedImage===file)pendingGeneratedImage=null;
        if(destroyed)return url;
        const remote=remoteImages.find(v=>v.url===url);const added=imagePlan.length<12;
        if(added){imagePlan.push({id:String(remote?.id||url),url,name:remote?.name||file.name,note:''});await saveImagePlan();}
        const current=targetDoc.getElementById('aibar-panel');if(current){await renderRemoteGallery(current);await renderImagePlan(current);const msg=current.querySelector('#mint-baibai-status');if(msg)msg.textContent=added?'已生成并上传服务器图库。去配图清单填写用途后即可制作状态栏。':'已上传服务器图库；本次配图清单已满，请到图库选择。';}
        toast('配图已生成并上传服务器图库','success');return url;
    }
    async function generateViaBaiBai(panel){
        if(mintImageController)throw new Error('已有一张图片正在生成，请等待或取消');
        if(pendingGeneratedImage)throw new Error('有一张已生成的图片尚未入库，请先仅重试上传或下载保存，避免重复生图');
        if(!remoteGalleryLoaded)throw new Error('请先在设置连接/刷新服务器图库，确认上传目的地可用');
        if(!galleryConfig.baseUrl||!galleryConfig.token)throw new Error('先连接服务器图库，避免出图后无处上传');
        const {api,status}=baiBaiStatus();if(!status.configured)throw new Error(status.reason||'柏宝绘未配置出图渠道');
        const request=buildBaiBaiRequest(naiFields(panel),panel.querySelector('#mint-nai-subject').value.trim(),panel.querySelector('#mint-baibai-artists').checked);
        mintImageController=new AbortController();const controller=mintImageController;
        const output=panel.querySelector('#mint-baibai-status');output.textContent='正在请求柏宝绘生图…';let received=false;
        try{
            const result=await api.generate(request,{signal:controller.signal,onProgress:p=>{const live=targetDoc.getElementById('aibar-panel')?.querySelector('#mint-baibai-status');if(live)live.textContent=({queued:'排队中',generating:'正在生图','queued-remote':'服务端排队中',retrying:'柏宝绘正在按渠道规则重试',saving:'正在保存到柏宝绘图库'}[p.phase]||'处理中')+'…';}});
            received=true;if(controller.signal.aborted)throw new Error('已取消接收图片；可到柏宝绘图库检查结果');
            pendingGeneratedImage=decodedBaiBaiImage(result.dataUrl);result.dataUrl='';
            const live=targetDoc.getElementById('aibar-panel');if(live?.querySelector('#mint-baibai-status'))live.querySelector('#mint-baibai-status').textContent='已出图，正在上传服务器图库…';
            return await uploadPendingBaiBai();
        }catch(e){
            if(received)throw new Error('生图已完成，但入库没有完成：'+e.message+'。可以仅重试上传（不会重新生图）；也可下载待上传图片或到柏宝绘图库找回。');
            throw new Error(e?.code==='aborted'?'已取消柏宝绘生图。已发出的请求是否计费由渠道决定。':e.message||String(e));
        }finally{if(mintImageController===controller)mintImageController=null;}
    }
    function installBaiBaiBridge(panel){
        const body=panel.querySelector('#mint-nai-settings .mint-settings-body');const box=targetDoc.createElement('div');box.className='mint-card';box.innerHTML='<b>可选：复用柏宝绘生图</b><p class="mint-muted">需要安装支持公开 API v1 的柏宝绘。只传正面标签、画面描述、横竖方向与可选种子；模型、具体像素、步数、负面词和渠道画师串使用柏宝绘当前配置。上面的独立预设不会覆盖它。图片也保存在柏宝绘图库，便于入库失败时找回。</p><label class="mint-skill-option"><input id="mint-baibai-artists" type="checkbox">额外附加本页画师串（注意渠道可能已有画师串）</label><p id="mint-baibai-status" class="mint-muted" role="status"></p><button id="mint-baibai-check">检查柏宝绘</button><button id="mint-baibai-generate">调用柏宝绘生成1张并入库 · 可能扣费</button><button id="mint-baibai-cancel">取消本次生图</button><button id="mint-baibai-retry-upload">仅重试上传 · 不重新生图</button><button id="mint-baibai-download">下载待上传图片</button><button id="mint-baibai-discard">丢弃待上传图片</button>';
        body.append(box);refreshBaiBaiStatus(panel);
        on(panel.querySelector('#mint-baibai-check'),'click',()=>refreshBaiBaiStatus(panel));
        on(panel.querySelector('#mint-baibai-generate'),'click',async()=>{if(window.__XUBAI_PREVIEW__)throw new Error('独立预览不会调用真实生图。请在酒馆助手里使用柏宝绘入口。');await generateViaBaiBai(panel);});
        on(panel.querySelector('#mint-baibai-retry-upload'),'click',async()=>{if(mintImageController)throw new Error('请等待当前任务结束');mintImageController=new AbortController();try{await uploadPendingBaiBai();}finally{mintImageController=null;}});
        on(panel.querySelector('#mint-baibai-download'),'click',()=>{if(!pendingGeneratedImage)throw new Error('没有待上传图片');const url=URL.createObjectURL(pendingGeneratedImage);const a=targetDoc.createElement('a');a.href=url;a.download=pendingGeneratedImage.name;targetDoc.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);});
        on(panel.querySelector('#mint-baibai-discard'),'click',async()=>{if(mintImageController)throw new Error('请等待当前任务结束');if(pendingGeneratedImage&&await mintConfirm('丢弃这张待上传图片？如果还没有下载，请先保存；无法撤销已产生的生图费用。'))pendingGeneratedImage=null;});
        on(panel.querySelector('#mint-baibai-cancel'),'click',()=>{if(!mintImageController)return toast('当前没有柏宝绘生图任务');mintImageController.abort();});
    }

    function buildMintStudio(panel){
        panel.querySelector('.mint-workbench-note')?.remove();
        const shelf=targetDoc.createElement('div');shelf.id='mint-feedback-rack';shelf.hidden=true;panel.querySelector('#mint-tabs').before(shelf);
        const paper=targetDoc.createElement('div');paper.className='mint-paper-note mint-decoration';paper.innerHTML=`<span>${mintIcon('star')}</span><div><b>灵感已就位</b><small>慢慢挑，今天也有一点喜欢。</small></div><span>${extendedMintIcon('heart')}</span>`;panel.querySelector('#mint-hero').after(paper);
        const workflow=panel.querySelector('.mint-workflow');workflow.replaceChildren();
        for(const [label,selector]of [['写需求','#mint-request-card'],['配图片','#mint-image-plan'],['看成品','#ab-result']]){
            const b=targetDoc.createElement('button');b.textContent=label;b.className='mint-step-button';on(b,'click',()=>{const el=panel.querySelector(selector);if(selector==='#ab-result'&&!session)return toast('先生成一版，成品会出现在这里');el?.scrollIntoView({behavior:'smooth',block:'start'});});workflow.append(b);
        }
        const skillPick=targetDoc.createElement('details');skillPick.id='mint-skill-create';skillPick.className='mint-settings-block';skillPick.innerHTML='<summary>风格与 Skill · 本次发送选择</summary><div class="mint-settings-body"><div id="mint-skill-picks"></div><button id="mint-open-skills">导入 / 管理 Skill ›</button></div>';panel.querySelector('#mint-image-plan').after(skillPick);
        const settings=panel.querySelector('#mint-page-settings');
        const skillSection=targetDoc.createElement('details');skillSection.id='mint-skill-settings';skillSection.className='mint-settings-block';skillSection.innerHTML=`<summary>风格包与 Skill</summary><div class="mint-settings-body"><p class="mint-muted">多份文本可叠加勾选；关闭总开关后都不发送。只用于生成，不写入聊天正文。导入的脚本、链接与资源引用不会自动执行或下载。</p><label class="mint-form-label">导入 MD / TXT / 本工具 JSON<input id="mint-skill-import" type="file" accept=".md,.txt,.json,text/plain,application/json" multiple></label><div class="mint-row"><button id="mint-skills-export">导出全部 Skill</button><button id="mint-skills-clear-picks">全部取消勾选</button></div><div id="mint-skill-manager"></div><details id="mint-skill-editor"><summary>新增 / 编辑 Skill</summary><input id="mint-skill-id" type="hidden"><label class="mint-form-label">名称<input id="mint-skill-name" maxlength="100" placeholder="例如：我的乙游状态栏规范"></label><label class="mint-form-label">内容<textarea id="mint-skill-text" rows="8" placeholder="粘贴 SKILL.md、设计规范、模板文本……"></textarea></label><div class="mint-row"><button id="mint-skill-save">保存文本</button><button id="mint-skill-new">清空并新建</button></div></details><div class="mint-chip-row"><button data-skill-example="mint">添加清透示例</button><button data-skill-example="journal">添加手账示例</button><button data-skill-example="moon">添加夜色示例</button></div><p class="mint-muted">导入后默认不勾选。文件引用的附属资源需要另行处理；不是完整 Agent 技能运行器。</p></div>`;
        const naiSection=targetDoc.createElement('details');naiSection.id='mint-nai-settings';naiSection.className='mint-settings-block';naiSection.innerHTML=`<summary>NAI 生图预设 · 参数准备</summary><div class="mint-settings-body"><p class="mint-callout">尚未接入你的中转。这页可保存预设、拼接提示词、导出参数草稿；独立中转接口确认后再适配；下方可选复用柏宝绘出图，只有点击该生图按钮才会请求并可能扣费。</p><label class="mint-form-label">配置选择<select id="mint-nai-select"></select></label><div class="mint-row"><button id="mint-nai-new">新建预设</button><button id="mint-nai-delete">删除当前预设</button></div><label class="mint-form-label">预设名称<input id="mint-nai-name" maxlength="100"></label><label class="mint-form-label">模型 ID · 手动填写<input id="mint-nai-model" placeholder="填写中转实际支持的完整模型ID"></label><p class="mint-muted">不是所有 NAI 中转都提供模型列表；以站点文档为准。画布和其他参数也可能由中转覆盖。</p><label class="mint-form-label">画师串<textarea id="mint-nai-artists" rows="2" placeholder="可留空；保留你原有的标签与权重写法"></textarea></label><label class="mint-form-label">固定正面提示词<textarea id="mint-nai-positive" rows="3"></textarea></label><label class="mint-form-label">固定负面提示词<textarea id="mint-nai-negative" rows="3"></textarea></label><div class="mint-theme-times"><label>宽度<input id="mint-nai-width" type="number" min="64" max="4096" step="64"></label><label>高度<input id="mint-nai-height" type="number" min="64" max="4096" step="64"></label><label>步数<input id="mint-nai-steps" type="number" min="1" max="100"></label><label>提示词引导 scale<input id="mint-nai-scale" type="number" min="0" max="30" step="0.1"></label></div><label class="mint-form-label">采样器<input id="mint-nai-sampler" placeholder="以中转支持项为准"></label><label class="mint-form-label">种子 · -1 表示随机<input id="mint-nai-seed" inputmode="numeric"></label><label class="mint-skill-option"><input id="mint-nai-transparent" type="checkbox">希望输出透明背景</label><label class="mint-skill-option"><input id="mint-nai-alpha-confirmed" type="checkbox">我已确认中转支持 V5 原生透明通道</label><p class="mint-muted">PNG 格式不等于透明背景；旧模型请生成后抠图。透明输出还需要接口和图库全程保留 alpha。</p><button id="mint-nai-save" style="width:100%">保存这份生图预设</button><label class="mint-form-label">本次画面描述<textarea id="mint-nai-subject" rows="3" placeholder="例如：银白薄荷绿头发，黑白耳机，Q版人物，简单色块"></textarea></label><div class="mint-row"><button id="mint-nai-preview">拼接并预览参数</button><button id="mint-nai-copy">复制正面提示词</button></div><pre id="mint-nai-draft" class="mint-payload-preview" hidden></pre><div class="mint-row"><button id="mint-nai-export">导出全部生图预设</button><button id="mint-nai-draft-export">导出本次参数草稿</button></div><label class="mint-form-label">导入本工具的预设 JSON<input id="mint-nai-import" type="file" accept=".json,application/json"></label></div>`;
        const logSection=targetDoc.createElement('details');logSection.id='mint-feedback-log';logSection.className='mint-settings-block';logSection.innerHTML='<summary>最近提示与错误</summary><div class="mint-settings-body"><button id="mint-feedback-test">测试面板内提示</button><div id="mint-recent-feedback"></div></div>';
        const about=settings.querySelector('[data-setting-group="5"]');if(about)about.before(skillSection,naiSection,logSection);else settings.append(skillSection,naiSection,logSection);
        const jump=panel.querySelector('.mint-settings-jump');for(const [label,section]of [['风格与 Skill',skillSection],['生图预设',naiSection],['提示记录',logSection]]){const b=targetDoc.createElement('button');b.textContent=label;on(b,'click',()=>{section.open=true;section.scrollIntoView({behavior:'smooth',block:'start'});});jump?.append(b);}
        on(panel.querySelector('#mint-open-skills'),'click',()=>{switchMintPage(panel,'settings',false);skillSection.open=true;skillSection.scrollIntoView({behavior:'smooth',block:'start'});});
        const css=targetDoc.getElementById('mint-style');if(css&&!css.dataset.v35){css.textContent+='\n'+MINT_V35_CSS;css.dataset.v35='1';}
    }
    async function initializeMintStudio(panel){
        skillBook=normalizeSkillBook(await getConfig(SKILL_BOOK_KEY));
        const saved=await getConfig(NAI_PRESETS_KEY);naiBook={selected:String(saved?.selected||''),items:(Array.isArray(saved?.items)?saved.items:[]).slice(0,30).map(normalizeNaiPreset)};
        await renderSkillBook(panel);refreshNaiSelect(panel);renderRecentFeedback(panel);renderCapsule();
        on(panel.querySelector('#mint-skill-import'),'change',async e=>{
            const files=[...(e.target.files||[])];if(files.length>20)throw new Error('一次最多导入20个文件');const incoming=[];
            for(const file of files){if(file.size>500000)throw new Error('文件过大：'+file.name);incoming.push(...parseSkillImport(await file.text(),file.name));}
            if(skillBook.items.length+incoming.length>60)throw new Error('最多保存60份 Skill，请先删除不用的条目');
            skillBook.items.push(...incoming);await saveSkillBook();await renderSkillBook(panel);e.target.value='';toast(`已导入 ${incoming.length} 份；按需勾选后才会发送`,'success');
        });
        on(panel.querySelector('#mint-skills-export'),'click',()=>downloadMintText('xubai-skills.json',exportSkillBook()));
        on(panel.querySelector('#mint-skills-clear-picks'),'click',async()=>{skillBook.items.forEach(v=>v.enabled=false);await saveSkillBook();await renderSkillBook(panel);});
        on(panel.querySelector('#mint-skill-new'),'click',()=>{panel.querySelector('#mint-skill-id').value='';panel.querySelector('#mint-skill-name').value='';panel.querySelector('#mint-skill-text').value='';});
        on(panel.querySelector('#mint-skill-save'),'click',async()=>{
            const id=panel.querySelector('#mint-skill-id').value;const name=panel.querySelector('#mint-skill-name').value.trim();const content=cleanSkillText(panel.querySelector('#mint-skill-text').value);if(!name||!content.trim())throw new Error('请填写名称和内容');
            const item=skillBook.items.find(v=>v.id===id);if(item){item.name=name;item.content=content;}else{if(skillBook.items.length>=60)throw new Error('最多60份 Skill');const entry={id:generateUUID(),name,content,enabled:false};skillBook.items.push(entry);panel.querySelector('#mint-skill-id').value=entry.id;}
            await saveSkillBook();await renderSkillBook(panel);toast('Skill 已保存；请勾选需要发送的条目','success');
        });
        const examples={mint:['清透布局','以白底黑字、清晰信息层级、薄荷色强调制作状态栏。适配手机窄屏；标签短、留白适度；装饰不遮挡正文。'],journal:['手账贴贴','加入少量贴纸、细胶带、章鱼印章式装饰。正文保持清晰，背景尽量纯净。交互使用可点击的 HTML 元素，不把文字画进图片。'],moon:['月光夜色','使用黑底白字、克制的薄荷色高亮，弱化次级信息，保持夜间可读性。通过明确的分组和可折叠区显示信息，避免堆叠发光特效。']};
        panel.querySelectorAll('[data-skill-example]').forEach(b=>on(b,'click',async()=>{if(skillBook.items.length>=60)throw new Error('最多60份 Skill');const [name,content]=examples[b.dataset.skillExample];skillBook.items.push({id:generateUUID(),name,content,enabled:false});await saveSkillBook();await renderSkillBook(panel);}));
        on(panel.querySelector('#mint-nai-select'),'change',async e=>{naiBook.selected=e.target.value;loadNaiFields(panel,naiBook.items.find(v=>v.id===naiBook.selected)||{});await saveConfig(NAI_PRESETS_KEY,naiBook);});
        on(panel.querySelector('#mint-nai-new'),'click',()=>{panel.querySelector('#mint-nai-select').value='';loadNaiFields(panel,{});});
        on(panel.querySelector('#mint-nai-save'),'click',async()=>{const p=naiFields(panel);const at=naiBook.items.findIndex(v=>v.id===p.id);if(at<0){if(naiBook.items.length>=30)throw new Error('最多30份生图预设');naiBook.items.push(p);}else naiBook.items[at]=p;naiBook.selected=p.id;await saveConfig(NAI_PRESETS_KEY,naiBook);refreshNaiSelect(panel);toast('生图预设已保存','success');});
        on(panel.querySelector('#mint-nai-delete'),'click',async()=>{const id=panel.querySelector('#mint-nai-select').value;if(!id)return;if(!await mintConfirm('删除这份生图预设？图库图片会保留。'))return;naiBook.items=naiBook.items.filter(v=>v.id!==id);naiBook.selected='';await saveConfig(NAI_PRESETS_KEY,naiBook);refreshNaiSelect(panel);});
        const draft=()=>buildNaiDraft(naiFields(panel),panel.querySelector('#mint-nai-subject').value.trim());
        on(panel.querySelector('#mint-nai-preview'),'click',()=>{const box=panel.querySelector('#mint-nai-draft');box.textContent=JSON.stringify(draft(),null,2);box.hidden=false;});
        on(panel.querySelector('#mint-nai-copy'),'click',async()=>{await copyMintMessage(draft().prompt);});
        on(panel.querySelector('#mint-nai-draft-export'),'click',()=>downloadMintText('xubai-image-draft.json',JSON.stringify(draft(),null,2)));
        on(panel.querySelector('#mint-nai-export'),'click',()=>downloadMintText('xubai-nai-presets.json',JSON.stringify({type:'xubai-nai-presets',version:1,items:naiBook.items},null,2)));
        on(panel.querySelector('#mint-nai-import'),'change',async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>1000000)throw new Error('预设文件最大1MB');let data;try{data=JSON.parse(await file.text());}catch{throw new Error('预设 JSON 格式错误');}if(data.type!=='xubai-nai-presets'||!Array.isArray(data.items))throw new Error('目前仅支持本工具导出的生图预设，不会猜测其他插件格式');if(data.items.length+naiBook.items.length>30)throw new Error('最多30份预设');const incoming=data.items.map(v=>normalizeNaiPreset({...v,id:generateUUID()}));incoming.forEach(v=>{cleanSkillText(v.artists);cleanSkillText(v.positive);cleanSkillText(v.negative);});naiBook.items.push(...incoming);await saveConfig(NAI_PRESETS_KEY,naiBook);refreshNaiSelect(panel);e.target.value='';toast('生图预设已导入','success');});
        installBaiBaiBridge(panel);
        on(panel.querySelector('#mint-feedback-test'),'click',()=>toast('看到这里就说明面板内提示可用了；关闭后也能在最近提示里找回。','success'));
    }

    const MINT_V35_CSS="/* White mint editor + journal accents + moonlight night theme. */\n#aibar-panel[data-theme=night]{--mint-bg:#080d10;--mint-surface:#121b20;--mint-field:#182329;--mint-fg:#fff;--mint-muted:#b4c6cc;--mint-line:#2b424a;--mint-accent:#9de8da;--mint-soft:#203a3c;--mint-shadow:0 6px 20px #0003}\n#aibar-panel #mint-hero{border-radius:24px 24px 24px 7px;background:linear-gradient(135deg,var(--mint-soft),var(--mint-bg))!important;margin-bottom:8px}\n#aibar-panel .mint-paper-note{display:flex;align-items:center;gap:12px;padding:10px 14px;margin:0 8px 20px;border-bottom:1px dashed var(--mint-line);color:var(--mint-accent)}\n#aibar-panel .mint-paper-note>div{flex:1}#aibar-panel .mint-paper-note b{font-size:11px;font-weight:600;letter-spacing:1px}#aibar-panel .mint-paper-note small{font-size:10px;display:block;color:var(--mint-muted)}\n#aibar-panel .mint-workflow{counter-reset:step;gap:7px}#aibar-panel .mint-workflow .mint-step-button{flex:1;min-width:0;border-radius:12px!important;padding:10px 6px!important;font-size:11px;color:var(--mint-accent)!important}\n#aibar-panel .mint-step-button:before{counter-increment:step;content:counter(step);display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border:1px solid var(--mint-accent);border-radius:50%;font:11px system-ui;margin-right:3px}\n#aibar-panel .mint-card,#aibar-panel details{box-shadow:0 5px 16px #24433e05}#aibar-panel[data-theme=night] .mint-card,#aibar-panel[data-theme=night] details{box-shadow:none}\n#aibar-panel .mint-settings-dashboard{border-radius:20px 20px 20px 6px}#aibar-panel .mint-settings-jump button{border:1px solid var(--mint-line)!important}\n#aibar-panel .mint-skill-option{display:flex;align-items:center;gap:7px;font-size:12px;padding:8px 0;line-height:1.7}\n#aibar-panel .mint-skill-option span{min-width:0;overflow-wrap:anywhere}#aibar-panel .mint-skill-option input{flex-shrink:0}\n#aibar-panel .mint-skill-row{display:flex;align-items:center;gap:6px;border-bottom:1px dashed var(--mint-line)}#aibar-panel .mint-skill-row label{flex:1;min-width:0}#aibar-panel .mint-skill-row button{font-size:10px;padding:5px 8px!important;min-height:30px}\n#aibar-panel .mint-payload-preview{white-space:pre-wrap;overflow-wrap:anywhere;max-height:230px;overflow:auto;font:11px/1.7 system-ui;color:var(--mint-muted);background:var(--mint-field);border:1px solid var(--mint-line);border-radius:12px;padding:12px}\n#aibar-panel #mint-skill-text,#aibar-panel #mint-nai-settings textarea{width:100%}\n#aibar-panel .mint-callout{font-size:11px;padding:12px;border-left:3px solid var(--mint-accent);background:var(--mint-soft);border-radius:0 12px 12px 0;line-height:1.8}\n#aibar-panel .mint-log-entry{border-bottom:1px dashed var(--mint-line);padding:10px 0;font-size:11px}#aibar-panel .mint-log-entry p{white-space:pre-wrap;overflow-wrap:anywhere;margin:5px 0;color:var(--mint-muted)}\n#aibar-panel #mint-feedback-rack{flex:0 0 auto!important;max-height:28dvh;overflow-y:auto;padding:0 10px 9px;background:var(--mint-bg);z-index:3;min-height:0}\n#aibar-panel #mint-feedback-rack[hidden]{display:none!important}\n#aibar-panel #mint-feedback-rack #mint-feedback{position:relative!important;inset:auto!important;transform:none!important;width:100%!important;max-width:100%!important;max-height:none!important;margin:0!important;display:flex!important;box-sizing:border-box!important;visibility:visible!important;opacity:1!important;border-radius:17px!important;box-shadow:0 4px 18px #0001!important;animation:none!important}\n#aibar-panel #mint-feedback-rack #mint-feedback[hidden]{display:none!important}\n#aibar-panel #mint-feedback-rack .mint-toast-message{max-height:95px}#aibar-panel #mint-feedback-rack .mint-toast-avatar{width:43px;height:48px}\n#aibar-panel #mint-feedback-rack #mint-feedback strong{font:600 12px/1.6 system-ui!important;color:var(--toast-fg)!important}\n#aibar-panel[data-theme=night] #ab-generate{background:linear-gradient(110deg,#b8f5e6,#7cd2cb)!important;box-shadow:0 3px 16px #8be0d21a!important}\n#aibar-panel #mint-page-settings>details{scroll-margin-top:10px}\n";

    let panelOpening=null;
    let galleryRefreshTask=null;
    let galleryRefreshKey='';
    let galleryCheckedAt=0;
    let galleryConnectionNote='';
    let fullscreenCleanup=null;
    async function loadMintStartup(){
        await initDB();
        const [theme,ui,gallery,plan,selection]=await Promise.all([getConfig(THEME_CONFIG_KEY),getConfig(UI_PREFS_KEY),getConfig(GALLERY_CONFIG_KEY),getConfig(IMAGE_PLAN_KEY),getLastSelection()]);
        themePrefs=normalizeThemePrefs(theme);uiPrefs=normalizeUiPrefs(ui);imagePlan=normalizeImagePlan(plan);
        const next=gallery||{baseUrl:'',token:''};if(next.baseUrl!==galleryConfig.baseUrl||next.token!==galleryConfig.token){remoteGalleryLoaded=false;remoteImages=[];galleryCheckedAt=0;}
        galleryConfig=next;return selection;
    }
    function chooseSavedModel(last,names){
        if(last?.source==='tavern')return {source:'tavern',configName:''};
        if(last?.source==='custom')return {source:'custom',configName:names.includes(last.configName)?last.configName:names[0]||''};
        return names.length===1?{source:'custom',configName:names[0]}:{source:'tavern',configName:''};
    }
    function restoreModelControls(panel,last){
        const select=panel.querySelector('#ab-config-select');const names=[...select.options].map(o=>o.value).filter(Boolean);const saved=chooseSavedModel(last,names);
        panel.querySelector('#ab-source').value=saved.source;if(saved.configName)select.value=saved.configName;
        panel.querySelector('#ab-custom-wrap').style.display=saved.source==='custom'?'block':'none';updateConnectionLabel(panel);updateConnectionOverview(panel);
    }
    function primePanelTheme(panel){
        panel.dataset.theme=isDayTime()?'day':'night';
        for(const id of ['mint-mascot','mint-mini-avatar']){const img=panel.querySelector('#'+id);if(img){img.src=isDayTime()?MINT_DAY_AVATAR:MINT_NIGHT_AVATAR;img.dataset.mode=panel.dataset.theme;img.decoding='async';}}
    }
    function gallerySignature(config){return config.baseUrl+'\n'+config.token;}
    async function refreshSavedGallery(force=false){
        const config={...galleryConfig};if(!config.baseUrl||!config.token)return null;
        const key=gallerySignature(config);
        if(galleryRefreshTask&&galleryRefreshKey===key)return galleryRefreshTask;
        if(!force&&remoteGalleryLoaded&&Date.now()-galleryCheckedAt<60000)return null;
        galleryRefreshKey=key;galleryConnectionNote=remoteGalleryLoaded?'正在刷新图库…':'正在自动连接图库…';syncGalleryConnectionStatus();
        const task=(async()=>{
            try{
                const data=await galleryRequest('/api/images',{},config);if(!Array.isArray(data.images))throw new Error('服务器没有返回兼容图库列表');
                if(destroyed||gallerySignature(galleryConfig)!==key)return null;
                remoteImages=data.images;remoteGalleryLoaded=true;galleryCheckedAt=Date.now();
                const used=Number(data.used_bytes)||0,quota=Number(data.quota_bytes)||0;
                galleryConnectionNote=`已连接 · ${(used/1048576).toFixed(1)} MB${quota?' / '+(quota/1073741824).toFixed(1)+' GB':''}`;
                const panel=targetDoc.getElementById('aibar-panel');if(panel){await renderRemoteGallery(panel);if(session)await renderPlaceholders(panel);}
                return data;
            }catch(e){
                if(gallerySignature(galleryConfig)===key){galleryConnectionNote='自动连接未完成：'+e.message+'；配置已保留，可点刷新重试';recordMintFeedback(galleryConnectionNote,'error');}return null;
            }finally{if(galleryRefreshKey===key)syncGalleryConnectionStatus();}
        })();
        galleryRefreshTask=task;
        try{return await task;}finally{if(galleryRefreshTask===task)galleryRefreshTask=null;}
    }
    function syncGalleryConnectionStatus(){
        const panel=targetDoc.getElementById('aibar-panel');if(!panel)return;const usage=panel.querySelector('#mint-usage');if(usage)usage.textContent=galleryConnectionNote;updateConnectionOverview(panel);
    }
    async function openPanel(){
        const old=targetDoc.getElementById('aibar-panel');
        if(old?.dataset.mintReady==='true'){
            old.hidden=false;applyMintTheme();renderCapsule();syncGenerationUI();clearInterval(themeTimer);themeTimer=setInterval(applyMintTheme,15000);syncGalleryConnectionStatus();void refreshSavedGallery();return old;
        }
        if(panelOpening)return panelOpening;
        panelOpening=openPanelImpl();try{return await panelOpening;}finally{panelOpening=null;}
    }
    function hideMintPanel(panel){
        closeMintFullscreen();panel.hidden=true;clearInterval(themeTimer);positionMintFeedback();
    }
    function extendedMintIcon(name){
        const paths={expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',fit:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m8 10-3 2 3 2m8-4 3 2-3 2"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',chevron:'<path d="m6 9 6 6 6-6"/>',check:'<path d="m5 12 4 4L19 6"/>'};
        return `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.expand}</svg>`;
    }
