    async function renderFontManager(panel) {
        fontPreviewCleanup?.();
        const names=await listFontNames();const wrap=panel.querySelector('#ab-font-manager');
        wrap.innerHTML=`<div>${names.map(name=>`<div class="mint-row" style="margin-bottom:8px"><span style="flex:1;font-size:12px">${esc(name)}</span><button class="font-edit" data-name="${esc(name)}">编辑</button><button class="font-del" data-name="${esc(name)}">删除</button></div>`).join('')||'<p class="mint-muted">还没有保存过字体。支持字体文件链接、CSS 链接和原有引入代码。</p>'}</div>
          <label class="mint-form-label" for="font-name-input">字体收藏名称</label><input id="font-name-input" placeholder="例如：我的手写体" style="width:100%">
          <div id="font-edit-hint" class="mint-muted" hidden></div>
          <label class="mint-form-label" for="font-snippet-input">字体链接 / CSS / HTML 引入代码</label><textarea id="font-snippet-input" rows="4" placeholder="https://…/font.woff2 或 https://…/font.css，也支持 @font-face、@import、link / style" style="width:100%"></textarea>
          <label class="mint-form-label" for="font-family-input">实际 font-family（可选）</label><input id="font-family-input" placeholder="自动识别失败时，填字体代码里的字族名称" style="width:100%">
          <label class="mint-form-label" for="font-preview-text">试字内容</label><input id="font-preview-text" value="小序和你一起，把灵感变可爱 Aa 0123" style="width:100%">
          <div id="font-preview-status" role="status">填入链接或代码后，会自动预览。</div>
          <iframe id="font-preview-box" title="自定义字体独立预览" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>
          <div class="mint-row"><button id="font-preview-retry">重新预览</button><button id="font-save-btn">保存并选用字体</button></div>`;
        let editingOriginalName='', sequence=0,debounce=null,timeout=null,requestTimer=null,controller=null;
        let expectedToken='';let iframe=wrap.querySelector('#font-preview-box');let disposed=false;
        const status=wrap.querySelector('#font-preview-status');
        const handler=e=>{
            if(disposed||e.source!==iframe.contentWindow||e.data?.kind!=='xubai-font-preview'||e.data.token!==expectedToken)return;
            clearTimeout(timeout);status.textContent=e.data.message;status.dataset.state=e.data.state;
        };
        targetWindow.addEventListener('message',handler);
        fontPreviewCleanup=()=>{disposed=true;sequence++;clearTimeout(debounce);clearTimeout(timeout);clearTimeout(requestTimer);controller?.abort();targetWindow.removeEventListener('message',handler);};
        async function applyPreview(){
            const thisSequence=++sequence;controller?.abort();controller=new AbortController();clearTimeout(timeout);clearTimeout(requestTimer);
            const raw=wrap.querySelector('#font-snippet-input').value.trim();const family=wrap.querySelector('#font-family-input').value.trim();
            const text=wrap.querySelector('#font-preview-text').value||'中文字体预览 Aa 0123';
            if(!raw){status.textContent='先填入字体链接或引入代码。';iframe.srcdoc=makeFontPreviewDoc('','',text,'',isDayTime());return;}
            status.textContent='正在解析字体并准备预览…';status.dataset.state='loading';
            const ownController=controller;requestTimer=setTimeout(()=>ownController.abort(),10000);
            try{
                let prepared;
                try{prepared=await prepareFontSnippet(raw,family,ownController.signal);}
                catch(e){if(thisSequence!==sequence||disposed)return;prepared={snippet:normalizeFontInput(raw),family:family||extractFontFamily(raw)};}
                if(thisSequence!==sequence||disposed)return;
                clearTimeout(requestTimer);expectedToken=generateUUID();
                status.textContent=prepared.family?'正在加载字体：'+prepared.family:'正在载入样式；未识别到字族时可手动填写。';
                iframe.srcdoc=makeFontPreviewDoc(prepared.snippet,prepared.family,text,expectedToken,isDayTime());
                timeout=setTimeout(()=>{if(!disposed&&thisSequence===sequence)status.textContent='字体仍未完成加载，请检查网络或跨域权限，也可以点「重新预览」。';},18000);
            }catch(e){if(thisSequence===sequence&&!disposed)status.textContent='预览失败：'+e.message;}
            finally{clearTimeout(requestTimer);}
        }
        for(const id of ['font-snippet-input','font-family-input','font-preview-text'])on(wrap.querySelector('#'+id),'input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>applyPreview().catch(e=>{status.textContent=e.message;}),500);});
        on(wrap.querySelector('#font-preview-retry'),'click',applyPreview);
        wrap.querySelectorAll('.font-edit').forEach(button=>on(button,'click',async()=>{
            const snippet=await getFont(button.dataset.name);editingOriginalName=button.dataset.name;
            wrap.querySelector('#font-name-input').value=editingOriginalName;wrap.querySelector('#font-snippet-input').value=snippet||'';
            wrap.querySelector('#font-family-input').value=extractFontFamily(snippet);
            const hint=wrap.querySelector('#font-edit-hint');hint.hidden=false;hint.textContent='正在编辑：'+editingOriginalName+'；修改名称后保存会重命名。';await applyPreview();
        }));
        wrap.querySelectorAll('.font-del').forEach(button=>on(button,'click',async()=>{
            if(!(await mintConfirm(`删除字体收藏「${button.dataset.name}」？已经保存的正则不会因此被改写。`)))return;
            await deleteFont(button.dataset.name);await renderFontManager(panel);await refreshFontSelect(panel);toast('字体收藏已删除','success');
        }));
        on(wrap.querySelector('#font-save-btn'),'click',async()=>{
            const name=wrap.querySelector('#font-name-input').value.trim();const raw=wrap.querySelector('#font-snippet-input').value.trim();const explicit=wrap.querySelector('#font-family-input').value.trim();
            if(!name||!raw)throw new Error('字体名称和链接 / 代码都要填写');
            const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),10000);let prepared;
            try{prepared=await prepareFontSnippet(raw,explicit,ctl.signal);}catch(e){prepared={snippet:normalizeFontInput(raw),family:explicit||extractFontFamily(raw)};}finally{clearTimeout(timer);}
            if(!prepared.family)throw new Error('尚未识别实际字体字族，请填写 font-family 后再保存，避免选中后仍显示系统字体');
            await saveFont(name,prepared.snippet);if(editingOriginalName&&editingOriginalName!==name)await deleteFont(editingOriginalName);
            await refreshFontSelect(panel);panel.querySelector('#ab-font-select').value=name;await updatePreview(panel);
            toast('字体已保存并选用：'+name,'success');await renderFontManager(panel);
        });
        const selectedName=panel.querySelector('#ab-font-select').value;
        if(selectedName&&names.includes(selectedName)){
            const selectedSnippet=await getFont(selectedName);editingOriginalName=selectedName;
            wrap.querySelector('#font-name-input').value=selectedName;wrap.querySelector('#font-snippet-input').value=selectedSnippet||'';wrap.querySelector('#font-family-input').value=extractFontFamily(selectedSnippet);
            await applyPreview();
        }
    }

    async function refreshFontSelect(panel) {
        const names = await listFontNames();
        const sel = panel.querySelector('#ab-font-select');
        const cur = sel.value;
        sel.innerHTML = '<option value="">不使用自定义字体</option>' + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
        if (names.includes(cur)) sel.value = cur;
    }

