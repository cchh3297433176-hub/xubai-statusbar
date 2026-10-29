    async function openPanelImpl() {
        const startupSelection=await loadMintStartup();
        installMintStyle();
        const old = targetDoc.getElementById('aibar-panel');
        if (old){fontPreviewCleanup?.();fontPreviewCleanup=null;old.remove();}
        const panel = await renderPanel();
        assembleOtomePanel(panel);
        primePanelTheme(panel);restoreModelControls(panel,startupSelection);
        targetDoc.body.appendChild(panel);
        await initializeMintPanel(panel);
        installMaterialLibrary(panel);
        bindOtomePanel(panel);
        await refreshFontSelect(panel);

        on(panel.querySelector('#ab-close'), 'click', () => hideMintPanel(panel));
        on(panel.querySelector('#ab-source'), 'change', async (e) => {
            panel.querySelector('#ab-custom-wrap').style.display = e.target.value === 'custom' ? 'block' : 'none';
            await saveLastSelection({ source: e.target.value, configName: panel.querySelector('#ab-config-select').value });
        });
        on(panel.querySelector('#ab-config-select'), 'change', async (e) => {
            await saveLastSelection({ source: panel.querySelector('#ab-source').value, configName: e.target.value });
        });
        on(panel.querySelector('#ab-font-select'), 'change', () => updatePreview(panel));
        on(panel.querySelector('#ab-ref-image'), 'change', (e) => {
            const files = [...e.target.files];
            panel.querySelector('#ab-ref-image-name').textContent = files.length ? `已选择 ${files.length} 张: ${files.map(f => f.name).join('、')}` : '';
        });
        on(panel.querySelector('#ab-fetch-char'), 'click', async () => {
            const btn = panel.querySelector('#ab-fetch-char');
            btn.disabled = true;
            try {
                const info = await tryGetCharacterCardInfo();
                panel.querySelector('#ab-char-info').value = info;
                toast('已读取角色卡信息', 'success');
            } catch (e) {
                toast('读取失败：' + e.message, 'error');
            }
            btn.disabled = false;
        });
        on(panel.querySelector('#ab-list-existing-regex'), 'click', async () => {
            const btn = panel.querySelector('#ab-list-existing-regex');
            const sel = panel.querySelector('#ab-existing-regex-select');
            btn.disabled = true;
            try {
                const all = await getAllRegexesSafe('all');
                sel.innerHTML = all.map((r, i) => `<option value="${i}">${esc(r.script_name)}　[${esc(scopeLabel(r.scope))}]</option>`).join('') || '<option value="">没有找到正则</option>';
                sel.dataset.regexes = JSON.stringify(all.map(r => ({ name: r.script_name, replace: r.replace_string, find: r.find_regex })));
                sel.style.display = 'block';
                panel.querySelector('#ab-use-existing-regex').style.display = 'block';
                toast(`列出了 ${all.length} 条`, 'success');
            } catch (e) {
                toast('读取失败：' + e.message, 'error');
            }
            btn.disabled = false;
        });
        on(panel.querySelector('#ab-use-existing-regex'), 'click', () => {
            const sel = panel.querySelector('#ab-existing-regex-select');
            const list = JSON.parse(sel.dataset.regexes || '[]');
            const picked = list[sel.value];
            if (!picked) { toast('先选一条', 'warning'); return; }
            panel.querySelector('#ab-ref').value = `参考下面这条正则的风格，生成一个相似或改良版的：\n【${picked.name}】\n${picked.replace}`;
            panel.querySelector('#ab-ref').dataset.lockedFindRegex = picked.find || '';
            toast('已填入参考框', 'success');
        });
        on(panel.querySelector('#ab-persona-clear'), 'click', () => {
            panel.querySelector('#ab-persona').value = '';
        });
        on(panel.querySelector('#ab-list-books'), 'click', async () => {
            const btn = panel.querySelector('#ab-list-books');
            const sel = panel.querySelector('#ab-world-book-select');
            const fetchBtn = panel.querySelector('#ab-fetch-world');
            btn.disabled = true;
            try {
                const { bound, unbound } = await listWorldbookCategories();
                sel.innerHTML =
                    (bound.length ? `<optgroup label="已绑定角色卡">${bound.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</optgroup>` : '') +
                    (unbound.length ? `<optgroup label="未绑定">${unbound.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</optgroup>` : '');
                sel.style.display = 'block';
                fetchBtn.style.display = 'block';
                if (!bound.length && !unbound.length) toast('没找到任何世界书', 'warning');
            } catch (e) {
                toast('列出世界书失败：' + e.message, 'error');
            }
            btn.disabled = false;
        });
        on(panel.querySelector('#ab-fetch-world'), 'click', async () => {
            const btn = panel.querySelector('#ab-fetch-world');
            const listWrap = panel.querySelector('#ab-world-list');
            const bookName = panel.querySelector('#ab-world-book-select').value;
            if (!bookName) { toast('先选一本世界书', 'warning'); return; }
            btn.disabled = true;
            try {
                const entries = await tryGetWorldbookEntries(bookName);
                if (!entries.length) {
                    listWrap.innerHTML = '<div style="font-size:12px;opacity:0.6;padding:6px 0;">这本世界书没有条目，或内容都是空的</div>';
                } else {
                    listWrap.innerHTML = entries.map((e, idx) => `
                        <div style="border-bottom:1px solid #333;padding:4px 0;">
                            <label style="display:flex;align-items:flex-start;gap:6px;font-size:12px;">
                                <input type="checkbox" class="world-entry-check" data-content="${esc(e.content)}" ${e.enabled ? '' : 'disabled'} style="margin-top:3px;">
                                <span style="flex:1;">${esc(e.comment)}${e.enabled ? '' : '（未启用）'}</span>
                                <button class="world-entry-toggle" data-idx="${idx}" style="padding:1px 6px;font-size:11px;">预览</button>
                            </label>
                            <div class="world-entry-content" data-idx="${idx}" style="display:none;font-size:11px;opacity:0.75;padding:4px 0 4px 22px;white-space:pre-wrap;">${esc(e.content)}</div>
                        </div>`).join('');
                    listWrap.querySelectorAll('.world-entry-toggle').forEach(b => on(b, 'click', () => {
                        const content = listWrap.querySelector(`.world-entry-content[data-idx="${b.dataset.idx}"]`);
                        const show = content.style.display === 'none';
                        content.style.display = show ? 'block' : 'none';
                        b.textContent = show ? '收起' : '预览';
                    }));
                }
                toast(`读到 ${entries.length} 条`, 'success');
            } catch (e) {
                listWrap.innerHTML = '';
                toast('读取失败：' + e.message, 'error');
            }
            btn.disabled = false;
        });
        on(panel.querySelector('#ab-config-manage-btn'), 'click', () => {
            const sel = panel.querySelector('#ab-config-select').value;
            return renderConfigPanel(panel, sel || null);
        });

        on(panel.querySelector('#ab-formatguide-write'), 'click', async () => {
            const wrap = panel.querySelector('#ab-write-world-panel');
            const showing = wrap.style.display === 'block';
            if (showing) { wrap.style.display = 'none'; return; }
            wrap.style.display = 'block';
            try {
                const { bound, unbound } = await listWorldbookCategories();
                panel.querySelector('#ab-write-book-bound').innerHTML = '<option value="">-- 不选 --</option>' + bound.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
                panel.querySelector('#ab-write-book-unbound').innerHTML = '<option value="">-- 不选 --</option>' + unbound.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
            } catch (e) {
                toast('列出世界书失败：' + e.message, 'error');
            }
        });
        on(panel.querySelector('#ab-write-confirm'), 'click', async () => {
            const boundSel = panel.querySelector('#ab-write-book-bound').value;
            const unboundSel = panel.querySelector('#ab-write-book-unbound').value;
            const newName = panel.querySelector('#ab-write-book-new').value.trim();
            const target = newName || unboundSel || boundSel;
            if (!target) { toast('选一本已有的，或者填新世界书名字', 'warning'); return; }
            const isNew = !!newName;
            try {
                await writeFormatGuideToWorldbook(target, isNew, `AI状态栏格式说明-${session.scriptName}`, session.formatGuide);
                toast(`已写入世界书: ${target}`, 'success');
                panel.querySelector('#ab-write-world-panel').style.display = 'none';
            } catch (e) {
                toast('写入失败：' + e.message, 'error');
            }
        });

        on(panel.querySelector('#ab-formatguide-copy'), 'click', async () => {
            const ta = panel.querySelector('#ab-formatguide-text');
            let copied = false;
            try { if (targetWindow.navigator.clipboard?.writeText) { await targetWindow.navigator.clipboard.writeText(ta.value); copied = true; } } catch (_) {}
            if (!copied) {
                try { ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); copied = !!targetDoc.execCommand('copy'); } catch (_) {}
            }
            toast(copied ? '已复制' : '复制失败，请长按选中文字后手动复制', copied ? 'success' : 'warning');
        });
        on(panel.querySelector('#ab-test-clear'), 'click', () => {
            panel.querySelector('#ab-test-input').value = '';
            panel.querySelector('#ab-test-status').textContent = '';
            const frame = panel.querySelector('#ab-test-preview'); frame.srcdoc = ''; frame.style.display = 'none'; frame.parentElement.hidden = true;
        });

        on(panel.querySelector('#ab-test-render'), 'click', async () => {
            const input = panel.querySelector('#ab-test-input').value;
            const statusEl = panel.querySelector('#ab-test-status');
            const iframe = panel.querySelector('#ab-test-preview');
            if (!input.trim()) { toast('先粘贴一段模拟内容', 'warning'); return; }
            const { matched, result, error } = testRenderAgainst(input);
            if (error) {
                statusEl.textContent = error;
                iframe.style.display = 'none'; iframe.parentElement.hidden = true;
                return;
            }
            if (!matched) {
                statusEl.textContent = '没有匹配上——正则没认出这段文字，检查标签格式是不是跟 findRegex 对得上。';
                iframe.style.display = 'none'; iframe.parentElement.hidden = true;
                return;
            }
            statusEl.textContent = '匹配成功，下面是实际替换后的效果：';
            const fontName = panel.querySelector('#ab-font-select')?.value;
            const fontSnippet = fontName ? await getFont(fontName) : null;
            iframe.srcdoc = buildPreviewDoc(result, fontSnippet);
            iframe.style.display = 'block'; iframe.parentElement.hidden = false;
        });
        on(panel.querySelector('#ab-generate'), 'click', () => doGenerate(panel, 'create'));
        on(panel.querySelector('#ab-revise-btn'), 'click', () => {
            if (!panel.querySelector('#ab-revise').value.trim()) { toast('先写修改意见吧', 'warning'); return; }
            return doGenerate(panel, 'revise');
        });
        on(panel.querySelector('#ab-variant-btn'), 'click', () => doGenerate(panel, 'variant'));

        on(panel.querySelector('#ab-save'), 'click', async () => {
            if (!session) return;
            if (!(await mintConfirm('保存为新的正则脚本吗？'))) return;
            try {
                let text = session.replaceStringRaw;
                for (const [token, imgKey] of Object.entries(session.assignments)) {
                    const url = await ensureAssignedUrl(imgKey);
                    session.assignments[token] = url;
                    // Escape special HTML/CSS characters, preserving URL semantics.
                    const safeUrl = url.replace(/'/g, '%27').replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/\\/g, '%5C');
                    text = text.split(`{{IMG:${token}}}`).join(safeUrl);
                }
                await persistSessionImages();
                const unresolved = extractPlaceholderKeys(text);
                if (unresolved.length) throw new Error('以下图片位还未绑定：' + unresolved.join('、') + '。请先选择图片或移除占位符');
                const fontName = panel.querySelector('#ab-font-select').value;
                if (fontName) {
                    const fontSnippet = await getFont(fontName);
                    if (fontSnippet) text = buildFontBlock(fontSnippet) + '\n' + text;
                }
                if (/data:[^\s"'<>)]*;base64,/i.test(text)) throw new Error('检测到内嵌 base64 素材，已阻止保存，避免总结插件再次过载。请改成图片或字体链接');
                const scope = panel.querySelector('#ab-scope').value;
                const newEntry = {
                    source: { user_input: false, ai_output: true, slash_command: false, world_info: false, reasoning: false },
                    destination: { display: true, prompt: false },
                    trim_strings: '',
                    run_on_edit: true,
                    min_depth: null,
                    max_depth: null,
                    id: generateUUID(),
                    script_name: session.scriptName,
                    find_regex: session.findRegex,
                    replace_string: `\`\`\`html\n${text}\n\`\`\``,
                    ...(scope === 'preset' ? {} : { scope }),
                    enabled: true,
                };
                if (typeof updateTavernRegexesWith !== 'function') throw new Error('当前酒馆助手缺少 updateTavernRegexesWith，请更新酒馆助手后保存');
                await updateTavernRegexesWith(list => [...list, newEntry], { type: scope });
                toast('已保存为新正则：' + session.scriptName, 'success');
            } catch (e) {
                toast('保存失败：' + e.message, 'error');
                console.error(e);
            }
        });

        on(panel.querySelector('#ab-hist-trim'), 'click', async () => {
            const n = parseInt(panel.querySelector('#ab-hist-keep-n').value, 10) || 10;
            const list = await listHistory(); // 已经按时间倒序
            const toDelete = list.slice(n);
            if (!toDelete.length) { toast('没有多余的可清', 'info'); return; }
            if (!(await mintConfirm(`删除 ${toDelete.length} 条较旧的记录吗？`))) return;
            for (const h of toDelete) await deleteHistory(h.id);
            toast(`已清掉 ${toDelete.length} 条`, 'success');
            renderHistory(panel);
        });
        on(panel.querySelector('#ab-hist-select-mode'), 'click', () => {
            historySelectMode = !historySelectMode;
            panel.querySelector('#ab-hist-select-mode').textContent = historySelectMode ? '退出多选' : '多选删除';
            renderHistory(panel);
        });

        await renderHistory(panel);
        if (session) await showResult(panel, session);
        updateConnectionLabel(panel);
        panel.dataset.mintReady='true';
    }

