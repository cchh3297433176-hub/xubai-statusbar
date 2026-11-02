    // Standalone reference functions: serialized into selected AI guidance, never run in the workbench.
    function mintInteractionHost() {
        let host = window;
        try { if (window.top?.SillyTavern) host = window.top; } catch (_) {}
        const helper={};
        for(const name of ['getChatMessages','setChatMessages','createChatMessages','triggerSlash']) {
            const owner=[window,window.TavernHelper,host.TavernHelper].find(value=>typeof value?.[name]==='function');
            if(owner)helper[name]=owner[name].bind(owner);
        }
        return {host,helper,context:host.SillyTavern?.getContext?.()};
    }
    function mintOpeningMeta(content, index) {
        const field = name => String(content).match(new RegExp('<!--\\s*' + name + ':\\s*([\\s\\S]*?)\\s*-->','i'))?.[1]?.trim() || '';
        const plain = String(content).replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
        return { title: field('title') || '开场白 ' + (index + 1), desc: field('desc') || plain.slice(0,100), tag: field('tag') };
    }
    async function mintReadOpenings() {
        const {helper, context} = mintInteractionHost();
        if (typeof helper.getChatMessages !== 'function') throw new Error('请启用酒馆助手；独立预览无法读取开场白');
        if (context?.groupId) throw new Error('此开场白模板仅适用于单角色聊天');
        const first = (await helper.getChatMessages('0', {include_swipes:true}))[0];
        if (!first || first.role !== 'assistant') throw new Error('当前聊天的第0楼不是角色开场白');
        const character = context?.characters?.[context.characterId];
        const card = character?.data;
        const currentCard = character ? [character.first_mes ?? card?.first_mes ?? '', ...(card?.alternate_greetings || [])] : null;
        const source = currentCard || first.swipes || [];
        const identity = JSON.stringify([context?.characterId, context?.chatId]);
        const entries = source.map((content,index)=>({content:String(content), index, identity,
            fromCard:!!currentCard, ...mintOpeningMeta(content,index)}))
            .filter(e=>e.content.trim() && !e.content.includes('【开场白菜单】'));
        return {entries, first, identity};
    }
    async function mintSwitchOpening(entry) {
        const {helper,context} = mintInteractionHost();
        if (typeof helper.setChatMessages !== 'function') throw new Error('缺少酒馆助手消息修改接口');
        const fresh = await mintReadOpenings();
        if (fresh.identity !== entry.identity) throw new Error('聊天已切换，请刷新菜单');
        const latest = fresh.entries.find(e=>e.index===entry.index && e.fromCard===entry.fromCard);
        if (!latest || latest.content !== entry.content) throw new Error('开场白已修改，请刷新后重新选择');
        let text = latest.content;
        if (latest.fromCard && typeof context?.substituteParams === 'function') text = context.substituteParams(text);
        const swipes = [...(fresh.first.swipes || [])];
        let index = latest.fromCard ? swipes.indexOf(text) : latest.index;
        if (index < 0) { index = swipes.length; swipes.push(text); }
        // Only commit on an explicit click; retain every old page and every later chat message.
        await helper.setChatMessages([{message_id:0, swipes, swipe_id:index}]);
    }
    function mintMountOpeningMenu(root) {
        let disposed=false, loading=false, signature='', timer;
        const status = root.querySelector('[data-opening-status]');
        const list = root.querySelector('[data-opening-list]');
        if (!list) throw new Error('缺少 data-opening-list 容器');
        const report = text => { if(status) status.textContent=text; };
        async function refresh() {
            if(disposed || loading || document.hidden) return;
            if(!root.isConnected) { cleanup(); return; }
            loading=true;
            try {
                const {entries,identity}=await mintReadOpenings();
                if(disposed) return;
                const next=JSON.stringify([identity,entries]);
                if(next===signature) return;
                signature=next; list.replaceChildren();
                for(const entry of entries) {
                    const button=document.createElement('button');button.type='button';
                    const title=document.createElement('strong');title.textContent=entry.title;
                    const desc=document.createElement('span');desc.textContent=entry.desc;
                    button.append(title,desc);
                    if(entry.tag){const tag=document.createElement('small');tag.textContent=entry.tag;button.append(tag);}
                    button.addEventListener('click',async()=>{
                        if(root.dataset.switching==='true')return;
                        root.dataset.switching='true';button.disabled=true;
                        try{await mintSwitchOpening(entry);report('已切换');}
                        catch(e){report(e.message);signature='';}
                        finally{delete root.dataset.switching;button.disabled=false;}
                    });
                    list.append(button);
                }
                report(entries.length?'':'没有可用的开场白');
            } catch(e) { report(e.message); }
            finally { loading=false; }
        }
        function cleanup(){disposed=true;clearInterval(timer);window.removeEventListener('pagehide',cleanup);}
        timer=setInterval(refresh,2000);window.addEventListener('pagehide',cleanup,{once:true});refresh();
        return cleanup;
    }
    function mintBindDirectSend(root, buildText) {
        const button=root.querySelector('[data-send-confirm]');
        const status=root.querySelector('[data-send-status]');
        if(!button)throw new Error('缺少 data-send-confirm 按钮');
        let busy=false, submitted=false;
        const report=text=>{if(status)status.textContent=text;};
        button.addEventListener('click',async()=>{
            if(busy || submitted)return;
            let text;
            try { text=String(buildText()??'').trim(); } catch(e) { report(e.message); return; }
            if(!text){report('请先填写内容');return;}
            const {helper,context}=mintInteractionHost();
            if(typeof helper.createChatMessages!=='function'||typeof helper.triggerSlash!=='function'){
                report('请启用酒馆助手；预览中不会发送');return;
            }
            if(context?.streamingProcessor || context?.isGenerating?.()){report('请等待当前回复结束');return;}
            busy=true;button.disabled=true;
            try{
                // Structured message API keeps pipes, braces, newlines and slash-like text out of the command parser.
                await helper.createChatMessages([{role:'user',message:text}]);
                submitted=true;report('消息已发送，正在请求回复');
                await helper.triggerSlash('/trigger');
                report('已发送并请求回复');
            }catch(e){report(submitted?'消息已发送，但请求回复失败；请在酒馆手动继续，勿重复提交。'+e.message:'发送失败：'+e.message);}
            finally{busy=false;button.disabled=submitted;}
        });
    }
    function mintFillInput(text, append=true) {
        text=String(text??'').trim();if(!text)throw new Error('请先选择内容');
        const {host}=mintInteractionHost();
        const input=host.document.querySelector('#send_textarea');
        if(!input)throw new Error('未找到酒馆输入框；预览中不会写入');
        const value=append && input.value.trim()?input.value+'\n'+text:text;
        const setter=Object.getOwnPropertyDescriptor(host.HTMLTextAreaElement.prototype,'value')?.set;
        if(setter)setter.call(input,value);else input.value=value;
        input.dispatchEvent(new host.Event('input',{bubbles:true}));input.focus();
        // Intentionally no send command, click, submit, or Enter event.
    }
    const MINT_INTERACTION_FEATURES = [
        {id:'openings',label:'开场白跳转',guide:'自动读取当前角色卡开场白，显示标题、简介及可选tag。新增、编辑、排序后自动更新菜单，不写死标题/数量，不按裸编号存本地说明。优先读取每个开场白的 <!-- title: 标题 -->、<!-- desc: 简介 -->、<!-- tag: 标签 -->；没有说明时显示正文预览，不声称自动理解剧情。默认包含首个真实开场白，只排除含【开场白菜单】标记的菜单页。点击时重新核对角色、聊天与内容，再切换或追加到第0楼消息页；保留历史页与后续消息，不自动发送。用普通script启动一次，不使用eval/base64/onerror启动。',refs:[mintInteractionHost,mintOpeningMeta,mintReadOpenings,mintSwitchOpening,mintMountOpeningMenu],example:'HTML提供 data-opening-list 容器和 role="status" 的 data-opening-status；DOM就绪后 mintMountOpeningMenu(root)。将返回的清理函数绑定组件卸载。'},
        {id:'direct-send',label:'填写后直接发送',guide:'收集表单填写与选择值，先校验必填项，点击明确的确认发送按钮后才提交。直接创建用户消息并触发AI回复，不经过输入框。使用结构化消息接口，禁止把用户文本拼进Slash命令。固定 /trigger 仅触发一次；加提交锁和失败提示，已创建消息但触发失败时不得重发消息。默认单次提交，发送成功后禁用按钮；如需再次提交必须由明确的重填操作复位。',refs:[mintInteractionHost,mintBindDirectSend],example:'HTML提供 data-send-confirm 按钮及 role="status" 的 data-send-status。DOM就绪后 mintBindDirectSend(root,()=>按表单字段拼成的完整字符串)。'},
        {id:'fill-input',label:'选择后填入输入框',guide:'支持按需求单选/多选，用稳定选项ID保存选择，不能以显示文字去重。确认后把所选内容按显示顺序整理成文字，调用 mintFillInput。默认追加保留已有草稿；用户明确要求替换时传false。不选择则提示。只写入输入框并触发input事件，绝不发送、触发回复、模拟回车或点击发送。',refs:[mintInteractionHost,mintFillInput],example:'在选项确认按钮的click回调中调用 mintFillInput(选中项按显示顺序拼成的文字)，捕获错误并在本组件role="status"区域显示。'}
    ];
    let mintInteractionSelection=[];
    function normalizeInteractionFeatures(ids) {
        return MINT_INTERACTION_FEATURES.filter(f=>Array.isArray(ids)&&ids.includes(f.id)).map(f=>f.id);
    }
    function interactionFeaturePrompt(ids) {
        const selected=MINT_INTERACTION_FEATURES.filter(f=>normalizeInteractionFeatures(ids).includes(f.id));
        if(!selected.length)return '';
        return '【用户勾选的交互功能】\n仅实现以下勾选功能，不擅自增加其他交互。下面代码是生成成品时应复制适配的参考，不是已存在的全局函数；必须把所需函数完整放入成品body内的script中。保持正则捕获组与原格式。功能在酒馆助手渲染的同层前端运行，隔离预览没有宿主接口时显示简短提示，不能伪造成功。所有不可信标题、简介、选项用textContent/value写入，禁止innerHTML插值。不同组件作用域隔离，脚本只初始化一次，卸载清理定时器。\n\n'+selected.map(f=>'### '+f.label+'\n'+f.guide+'\n'+f.example).join('\n\n')+'\n\n【参考JavaScript】\n```javascript\n'+[...new Set(selected.flatMap(f=>f.refs))].map(fn=>fn.toString()).join('\n\n')+'\n```\nFORMATGUIDE中另附所选交互的运行依赖与使用方式；仅在勾选开场白功能时附带title/desc/tag注释示例，不要求模型每轮重写整个开场白列表。';
    }
    function restoreInteractionChoices(panel,ids) {
        mintInteractionSelection=normalizeInteractionFeatures(ids);
        panel.querySelectorAll('[data-mint-interaction]').forEach(input=>{input.checked=mintInteractionSelection.includes(input.value);});
    }
    function installInteractionControls(panel) {
        const box=targetDoc.createElement('fieldset');box.id='mint-interaction-options';
        box.style.cssText='border:0;padding:0;margin:12px 0;min-width:0';
        const legend=targetDoc.createElement('legend');legend.textContent='交互功能';box.append(legend);
        for(const feature of MINT_INTERACTION_FEATURES){
            const label=targetDoc.createElement('label');label.style.cssText='display:flex;align-items:center;gap:8px;margin:8px 0';
            const input=targetDoc.createElement('input');input.type='checkbox';input.value=feature.id;input.dataset.mintInteraction='';
            input.checked=mintInteractionSelection.includes(feature.id);label.append(input,targetDoc.createTextNode(feature.label));box.append(label);
            on(input,'change',()=>{mintInteractionSelection=normalizeInteractionFeatures([...box.querySelectorAll('input:checked')].map(i=>i.value));});
        }
        panel.querySelector('#mint-request-card').append(box);
    }
