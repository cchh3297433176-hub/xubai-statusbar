    async function updatePreview(panel) {
        if (!session) return;
        const resolved = resolvePlaceholders(session.replaceStringRaw, session.assignments);
        const fontName = panel.querySelector('#ab-font-select')?.value;
        const fontSnippet = fontName ? await getFont(fontName) : null;
        panel.querySelector('#ab-preview').srcdoc = buildPreviewDoc(resolved, fontSnippet);
    }

    async function renderPlaceholders(panel) {
        const wrap = panel.querySelector('#ab-placeholders');
        const keys = extractPlaceholderKeys(session.replaceStringRaw);
        if (!keys.length) { wrap.textContent = '这版没有图片占位符；需要图片时可勾选「确保包含图片位」。'; return; }
        const active = keys.includes(wrap.dataset.activeToken) ? wrap.dataset.activeToken : keys[0];
        wrap.dataset.activeToken = active;
        const imgKeys = await listImageKeys();
        wrap.innerHTML = `<div style="font-size:12px;opacity:.8;margin-bottom:8px">选中图片位后上传或选择图片。只保存链接，不把图片编码写入正则。</div>` + keys.map(key => {
            const assigned = session.assignments[key]; const src = imageUrl(assigned) || urlCache.get(assigned) || '';
            return `<div class="ph-row" data-token="${esc(key)}" style="display:flex;gap:8px;align-items:center;border:1px solid;padding:8px;border-radius:10px;margin-bottom:7px">
                <img class="ph-thumb" ${src ? `src="${esc(src)}"` : ''} alt="图片位预览" referrerpolicy="no-referrer" style="width:40px;height:40px;object-fit:cover;border-radius:8px">
                <code style="flex:1;font-size:12px;overflow-wrap:anywhere">{{IMG:${esc(key)}}}</code>
                <button class="ph-select-slot" data-token="${esc(key)}" aria-pressed="${key === active}">${key === active ? '已选中' : '选这格'}</button>
                <button class="ph-clear" data-token="${esc(key)}">解绑</button></div>`;
        }).join('') + `<label style="display:block;margin-top:8px">上传到服务器并绑定<input id="ph-upload-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="display:block;width:100%"></label>
            <div style="display:flex;gap:6px;margin:8px 0"><input id="ph-url" type="url" placeholder="或者粘贴 HTTPS 图片链接" style="flex:1;min-width:0"><button id="ph-use-url">使用链接</button></div>
            <details><summary>服务器图库 · ${remoteImages.length} 张</summary><div id="ph-remote-gallery" style="display:flex;gap:8px;overflow:auto;padding:8px 0"></div></details>
            <details><summary>原有本地图库 · ${imgKeys.length} 张（选用时上传）</summary><div id="ph-local-gallery" style="display:flex;gap:8px;overflow:auto;padding:8px 0"></div></details>`;
        const targetSession = session;
        async function assign(value, targetToken = wrap.dataset.activeToken) {
            if (session !== targetSession) throw new Error('状态栏版本已切换，图片已上传到图库，请在当前版本重新选择');
            session.assignments[targetToken] = value;
            await persistSessionImages(); await renderPlaceholders(panel); await updatePreview(panel);
        }
        wrap.querySelectorAll('.ph-select-slot').forEach(button => on(button, 'click', async () => { wrap.dataset.activeToken = button.dataset.token; await renderPlaceholders(panel); }));
        wrap.querySelectorAll('.ph-clear').forEach(button => on(button, 'click', async () => {
            delete session.assignments[button.dataset.token]; await persistSessionImages(); await renderPlaceholders(panel); await updatePreview(panel);
            toast('已解除绑定，图片文件仍保留', 'success');
        }));
        on(wrap.querySelector('#ph-upload-file'), 'change', async e => {
            const file = e.target.files[0]; if (!file) return;
            const token = wrap.dataset.activeToken; await assign(await uploadRemoteImage(file), token); await renderRemoteGallery(panel); toast('已上传并绑定到图片位', 'success');
        });
        on(wrap.querySelector('#ph-use-url'), 'click', async () => {
            const url = imageUrl(wrap.querySelector('#ph-url').value.trim());
            if (!url || !url.startsWith('https://')) throw new Error('请填写有效的 HTTPS 图片链接');
            await assign(url); toast('图片链接已绑定', 'success');
        });
        for (const item of remoteImages) {
            const button = targetDoc.createElement('button'); button.title = item.name; button.setAttribute('aria-label', '选择图片 ' + item.name);
            const img = targetDoc.createElement('img'); img.src = item.thumbnail_url || item.url; img.alt = item.name; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.onerror = () => { img.alt = '加载失败，请检查链接'; }; img.style.cssText='width:54px;height:54px;object-fit:cover';
            button.appendChild(img); wrap.querySelector('#ph-remote-gallery').appendChild(button);
            on(button, 'click', () => assign(item.url));
        }
        for (const key of imgKeys) {
            const button = targetDoc.createElement('button'); button.title = key; button.setAttribute('aria-label', '上传本地图片 ' + key);
            const img = targetDoc.createElement('img'); if(urlCache.has(key))img.src=urlCache.get(key);else img.dataset.localImageKey=key;img.alt = key; img.loading = 'lazy'; img.style.cssText='width:54px;height:54px;object-fit:cover';
            button.appendChild(img); wrap.querySelector('#ph-local-gallery').appendChild(button);
            on(button, 'click', async () => { const token = wrap.dataset.activeToken; await assign(await ensureAssignedUrl(key), token); await renderRemoteGallery(panel); toast('本地图片已上传并绑定', 'success'); });
        }
        observeLegacyThumbnails(panel);
    }

    async function showResult(panel, result) {
        session = { ...result, assignments: session?.assignments && session.scriptName === result.scriptName ? session.assignments : {} };
        panel.querySelector('#ab-result').style.display = 'block';
        panel.querySelector('#ab-scriptname').textContent = session.scriptName;
        const fgWrap = panel.querySelector('#ab-formatguide-wrap');
        if (session.formatGuide) {
            fgWrap.style.display = 'block';
            panel.querySelector('#ab-formatguide-text').value = session.formatGuide;
        } else {
            fgWrap.style.display = 'none';
        }
        await renderPlaceholders(panel);
        await updatePreview(panel);
    }

    let historySelectMode = false;

    async function renderHistory(panel) {
        const list=await listHistory();const wrap=panel.querySelector('#ab-history');
        wrap.innerHTML=list.length?list.map(h=>{
            const assigned=Object.values(h.assignments||{}).find(v=>imageUrl(v));const remote=remoteImages.find(item=>item.url===assigned);
            const thumbnail=remote?.thumbnail_url||assigned||MINT_DAY_AVATAR;
            return `<article class="mint-history-card">${historySelectMode?`<input type="checkbox" class="ab-hist-check" data-id="${esc(h.id)}" aria-label="选择${esc(h.scriptName)}">`:''}<img class="mint-history-cover" src="${esc(thumbnail)}" alt="状态栏配图" loading="lazy" referrerpolicy="no-referrer"><div class="mint-history-copy"><b>${esc(h.scriptName)}</b><time>${new Date(h.ts).toLocaleString('zh-CN',{hour12:false})}</time></div>${historySelectMode?'':`<div class="mint-history-actions"><button class="ab-hist-restore" data-id="${esc(h.id)}">恢复这一版</button><button class="ab-hist-del" data-id="${esc(h.id)}">删除记录</button></div>`}</article>`;
        }).join(''):mintEmptyState('history','还没有灵感存档','生成完成后，我会把这一版和配图一起收好，方便你回来继续。');
        if(historySelectMode&&list.length){
            const button=targetDoc.createElement('button');button.id='ab-hist-del-selected';button.textContent='删除选中记录';button.style.cssText='width:100%;margin-bottom:12px';wrap.prepend(button);
            on(button,'click',async()=>{
                const ids=[...wrap.querySelectorAll('.ab-hist-check:checked')].map(cb=>cb.dataset.id);if(!ids.length)throw new Error('先选择要删除的记录');
                if(!(await mintConfirm(`删除选中的 ${ids.length} 条历史记录？服务器图片会保留。`)))return;
                for(const id of ids)await deleteHistory(id);await renderHistory(panel);toast('选中记录已删除','success');
            });
        }
        wrap.querySelectorAll('.ab-hist-restore').forEach(button=>on(button,'click',async()=>{
            const h=list.find(item=>item.id===button.dataset.id);if(!h)throw new Error('找不到这条历史记录');
            session={historyId:h.id,historyTs:h.ts,scriptName:h.scriptName,findRegex:h.findRegex,replaceStringRaw:h.replaceStringRaw,formatGuide:h.formatGuide||'',assignments:{...(h.assignments||{})}};
            await showResult(panel,session);switchMintPage(panel,'create');toast('已恢复这一版，继续做点喜欢的改动吧','success');
        }));
        wrap.querySelectorAll('.ab-hist-del').forEach(button=>on(button,'click',async()=>{
            if(!(await mintConfirm('删除这条历史记录？服务器图片和已保存的正则会保留。')))return;
            await deleteHistory(button.dataset.id);await renderHistory(panel);toast('历史记录已删除','success');
        }));
    }

