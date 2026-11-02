    // Destination selection is local metadata only; it does not add worldbook contents to AI requests.
    function worldbookBindingTargets(snapshot, onlyGlobal, keyword = '') {
        const global = new Set(snapshot.global || []);
        const term = String(keyword).trim().toLocaleLowerCase();
        return [...new Set(snapshot.all || [])]
            .filter(name => name !== snapshot.primary && (!onlyGlobal || global.has(name)) && name.toLocaleLowerCase().includes(term))
            .sort((a, b) => a.localeCompare(b));
    }
    function worldbookBindingBridge() {
        const bridge = targetWindow.KelaodeWorldbookRegex;
        if (!bridge || bridge.version < 1 || typeof bridge.listTargets !== 'function' || typeof bridge.bind !== 'function') {
            throw new Error('请先更新并启用世界书管理器，再绑定世界书正则');
        }
        return bridge;
    }
    async function bindRegexesToSelectedWorldbook(panel, scripts) {
        const name = panel.querySelector('#ab-bind-worldbook').value;
        if (!name) throw new Error('请先选择目标世界书');
        const bridge = worldbookBindingBridge();
        const snapshot = await bridge.listTargets();
        const allowed = worldbookBindingTargets(snapshot, panel.querySelector('#ab-bind-global-only').checked,
            panel.querySelector('#ab-bind-keyword').value);
        if (!allowed.includes(name)) throw new Error('目标世界书的绑定状态已变化，请重新选择');
        await bridge.bind(name, scripts);
        return name;
    }
    function installWorldbookBindingControls(panel) {
        const scope = panel.querySelector('#ab-scope');
        const wrap = targetDoc.createElement('div');
        wrap.id = 'ab-worldbook-binding';
        wrap.hidden = true;
        wrap.style.cssText = 'min-width:0;margin:0 0 12px;';
        wrap.innerHTML = `<label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input id="ab-bind-global-only" type="checkbox" checked>仅全局已开启</label>
            <input id="ab-bind-keyword" type="search" placeholder="搜索世界书…" aria-label="搜索绑定目标世界书" style="width:100%;min-width:0;box-sizing:border-box;margin:6px 0">
            <select id="ab-bind-worldbook" aria-label="绑定目标世界书" size="5" style="width:100%;max-width:100%;min-width:0;box-sizing:border-box"></select>
            <div id="ab-bind-status" role="status" style="font-size:12px;margin-top:6px"></div>`;
        scope.parentElement.after(wrap);
        const select = wrap.querySelector('#ab-bind-worldbook');
        const status = wrap.querySelector('#ab-bind-status');
        const keyword = wrap.querySelector('#ab-bind-keyword');
        const onlyGlobal = wrap.querySelector('#ab-bind-global-only');
        let snapshot = null;
        let revision = 0;
        function filter() {
            const selected = select.value;
            select.replaceChildren();
            const names = snapshot ? worldbookBindingTargets(snapshot, onlyGlobal.checked, keyword.value) : [];
            const empty = targetDoc.createElement('option');
            empty.value = ''; empty.textContent = names.length ? '选择世界书' : '没有符合条件的世界书';
            empty.disabled = true; empty.selected = true; select.append(empty);
            for (const name of names) {
                const option = targetDoc.createElement('option'); option.value = name; option.textContent = name; option.title = name;
                select.append(option);
            }
            select.value = names.includes(selected) ? selected : '';
        }
        async function refresh() {
            const token = ++revision;
            wrap.hidden = scope.value !== 'worldbook';
            const save = panel.querySelector('#ab-save');
            const text = [...(save?.childNodes || [])].find(node => node.nodeType === 3);
            if (text) text.textContent = scope.value === 'worldbook' ? '绑定世界书' : '保存为新正则';
            if (wrap.hidden) return;
            select.disabled = true; status.textContent = '';
            try {
                const next = await worldbookBindingBridge().listTargets();
                if (token !== revision) return;
                snapshot = next; filter();
            } catch (error) {
                if (token !== revision) return;
                snapshot = null; filter(); status.textContent = error.message;
            } finally { if (token === revision) select.disabled = false; }
        }
        on(scope, 'change', refresh);
        on(keyword, 'input', filter);
        on(onlyGlobal, 'change', filter);
        refresh();
    }
