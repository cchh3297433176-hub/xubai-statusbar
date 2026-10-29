    async function renderConfigPanel(panel, editingName) {
        const wrap = panel.querySelector('#ab-config-panel');
        const cfg = editingName ? (await getConfig(editingName)) || {} : {};
        const names = await listConfigNames();
        wrap.style.display = 'block';
        wrap.innerHTML = `
            <div style="font-size:12px;opacity:0.8;margin-bottom:6px;">配置管理</div>
            <input id="cfg-name" placeholder="配置名称，如 中转站A" value="${esc(editingName || '')}" style="width:100%;padding:6px;margin-bottom:6px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:4px;box-sizing:border-box;">
            <input id="cfg-baseurl" placeholder="Base URL，如 https://api.xxx.com" value="${esc(cfg.baseUrl || '')}" style="width:100%;padding:6px;margin-bottom:6px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:4px;box-sizing:border-box;">
            <input id="cfg-apikey" type="password" placeholder="API Key" value="${esc(cfg.apiKey || '')}" style="width:100%;padding:6px;margin-bottom:6px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:4px;box-sizing:border-box;">
            <div style="display:flex;gap:6px;margin-bottom:6px;">
                <button id="cfg-fetch-models" style="flex:1;padding:6px;">拉取模型列表</button>
            </div>
            <input id="cfg-model-search" placeholder="搜模型关键词" style="width:100%;padding:6px;margin-bottom:6px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:4px;box-sizing:border-box;display:none;">
            <div id="cfg-model-list" style="max-height:160px;overflow-y:auto;border:1px solid #444;border-radius:4px;margin-bottom:6px;display:none;"></div>
            <input id="cfg-model-manual" placeholder="手动填写模型 ID（优先使用）" value="${esc(cfg.model || '')}" style="width:100%;margin-bottom:6px"><div style="font-size:12px;opacity:0.8;margin-bottom:6px;">当前选中模型：<span id="cfg-model-chosen">${esc(cfg.model || '未选择')}</span></div>
            <div style="display:flex;gap:6px;">
                <button id="cfg-save" style="flex:1;padding:6px;background:#3a5a3a;">保存配置</button>
                <button id="cfg-close" style="flex:1;padding:6px;">关闭</button>
            </div>
            <hr style="border-color:#444;margin:10px 0;">
            <div style="font-size:12px;opacity:0.8;margin-bottom:6px;">已保存的配置</div>
            ${names.map(n => `
                <div style="display:flex;align-items:center;gap:6px;padding:4px 0;">
                    <span style="flex:1;font-size:12px;">${esc(n)}</span>
                    <button class="cfg-edit" data-name="${esc(n)}" style="padding:2px 8px;font-size:12px;">编辑</button>
                    <button class="cfg-del" data-name="${esc(n)}" style="padding:2px 8px;font-size:12px;">删除</button>
                </div>`).join('') || '<div style="font-size:12px;opacity:0.6;">暂无</div>'}
        `;

        let chosenModel = cfg.model || '';
        fetchedModels = [];

        on(wrap.querySelector('#cfg-fetch-models'), 'click', async () => {
            const baseUrl = wrap.querySelector('#cfg-baseurl').value.trim();
            const apiKey = wrap.querySelector('#cfg-apikey').value.trim();
            if (!baseUrl) { toast('先填 Base URL', 'warning'); return; }
            wrap.querySelector('#cfg-fetch-models').textContent = '拉取中…';
            try {
                fetchedModels = await fetchModelList(baseUrl, apiKey);
                renderModelList(fetchedModels);
                wrap.querySelector('#cfg-model-search').style.display = 'block';
                wrap.querySelector('#cfg-model-list').style.display = 'block';
                toast(`拉到 ${fetchedModels.length} 个模型`, 'success');
            } catch (e) {
                toast('拉取失败：' + e.message, 'error');
            }
            wrap.querySelector('#cfg-fetch-models').textContent = '拉取模型列表';
        });

        function renderModelList(list) {
            const box = wrap.querySelector('#cfg-model-list');
            box.innerHTML = list.map(m => `<div class="cfg-model-item" data-model="${esc(m)}" style="padding:6px;font-size:12px;cursor:pointer;border-bottom:1px solid #333;">${esc(m)}</div>`).join('') || '<div style="padding:6px;font-size:12px;opacity:0.6;">没搜到</div>';
            box.querySelectorAll('.cfg-model-item').forEach(item => on(item, 'click', () => {
                chosenModel = item.dataset.model;
                wrap.querySelector('#cfg-model-manual').value = chosenModel;
                wrap.querySelector('#cfg-model-chosen').textContent = chosenModel;
            }));
        }
        on(wrap.querySelector('#cfg-model-search'), 'input', (e) => {
            const kw = e.target.value.trim().toLowerCase();
            renderModelList(kw ? fetchedModels.filter(m => m.toLowerCase().includes(kw)) : fetchedModels);
        });

        on(wrap.querySelector('#cfg-save'), 'click', async () => {
            const name = wrap.querySelector('#cfg-name').value.trim();
            if (!name) { toast('给配置起个名字', 'warning'); return; }
            const baseUrl = wrap.querySelector('#cfg-baseurl').value.trim();
            const apiKey = wrap.querySelector('#cfg-apikey').value.trim();
            if (!baseUrl) { toast('填一下 Base URL', 'warning'); return; }
            chosenModel = wrap.querySelector('#cfg-model-manual').value.trim() || chosenModel;
            if (!chosenModel) throw new Error('请手动填写或选择模型');
            await saveConfig(name, { baseUrl, apiKey, model: chosenModel });
            toast(`配置已保存: ${name}`, 'success');
            const sel = panel.querySelector('#ab-config-select');
            if (![...sel.options].some(o => o.value === name)) {
                sel.insertAdjacentHTML('beforeend', `<option value="${esc(name)}">${esc(name)}</option>`);
            }
            sel.value = name;panel.querySelector('#ab-source').value='custom';panel.querySelector('#ab-custom-wrap').style.display='block';
            await saveLastSelection({source:'custom',configName:name});updateConnectionLabel(panel);updateConnectionOverview(panel);
            renderConfigPanel(panel, name);
        });
        on(wrap.querySelector('#cfg-close'), 'click', () => { wrap.style.display = 'none'; });
        wrap.querySelectorAll('.cfg-edit').forEach(btn => on(btn, 'click', () => renderConfigPanel(panel, btn.dataset.name)));
        wrap.querySelectorAll('.cfg-del').forEach(btn => on(btn, 'click', async () => {
            if (!(await mintConfirm(`删除配置"${btn.dataset.name}"吗？`))) return;
            await deleteConfig(btn.dataset.name);
            toast('已删除', 'info');
            renderConfigPanel(panel, null);
            const sel = panel.querySelector('#ab-config-select');
            [...sel.options].forEach(o => { if (o.value === btn.dataset.name) o.remove(); });
        }));
    }

