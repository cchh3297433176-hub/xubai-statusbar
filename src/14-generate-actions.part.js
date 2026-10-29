    function currentSourceInfo(panel) {
        const source = panel.querySelector('#ab-source').value;
        if (source === 'tavern') return { source: 'tavern' };
        return { source: 'custom', configName: panel.querySelector('#ab-config-select').value };
    }

    async function doGenerate(panel, mode) {
        if (generationBusy) { toast('收到啦！一份一份来，我只有两只手。可以等待或取消当前任务。', 'warning'); return; }
        if (!session && mode !== 'create') throw new Error('先生成一个状态栏');
        // 先把所有要用到的值同步读完，面板等下关掉也不影响
        const srcInfo = currentSourceInfo(panel);
        const userDescription=panel.querySelector('#ab-desc').value.trim();
        const layout=panel.querySelector('#mint-design-layout')?.value.trim();
        const fields=panel.querySelector('#mint-design-fields')?.value.trim();
        const description=[userDescription,layout?'【成品布局】'+layout:'',fields?'【显示内容】'+fields:'','【通用设计要求】适配手机窄屏，信息层级清晰，按钮可辨认；剧情日期天气地点从楼层内容呈现，不硬编码为手机现实时间。折叠优先使用原生 details/summary。'].filter(Boolean).join('\n');
        const skillPayload=selectedSkillPayload();
        const plannedImages=normalizeImagePlan(imagePlan).map(v=>({...v}));
        const refContent = panel.querySelector('#ab-ref')?.value.trim();
        const revisionPrompt = panel.querySelector('#ab-revise')?.value.trim();
        const forceImage = panel.querySelector('#ab-force-image').checked;
        const refImageFiles = [...(panel.querySelector('#ab-ref-image')?.files || [])];
        const charInfo = panel.querySelector('#ab-char-info')?.value.trim();
        const persona = panel.querySelector('#ab-persona')?.value.trim();
        const checkedWorldEntries = [...panel.querySelectorAll('.world-entry-check:checked')]
            .map(cb => cb.dataset.content).filter(Boolean);
        const existingSnapshot = session ? { ...session, assignments: { ...session.assignments } } : null;
        const lockFormat = panel.querySelector('#ab-lock-format')?.checked;
        const lockedFindRegex = lockFormat ? (panel.querySelector('#ab-ref')?.dataset.lockedFindRegex || '') : '';
        if (lockFormat && !lockedFindRegex) toast('勾了锁定格式，但还没选参考正则，这次锁定不会生效', 'warning');
        const lockStructure = panel.querySelector('#ab-lock-structure')?.checked;

        const btnMap = { create: '#ab-generate', revise: '#ab-revise-btn', variant: '#ab-variant-btn' };
        const btn = panel.querySelector(btnMap[mode]);
        if (refImageFiles.length > 4 || refImageFiles.some(f => f.size > 8 * 1024 * 1024)) throw new Error('参考图最多 4 张，每张最大 8MB');
        generationBusy = true; generationController = new AbortController();
        const taskController = generationController; const taskEpoch = ++generationEpoch;
        syncGenerationUI();
        if (btn) btn.disabled = true;
        toast('已开始生成，可以关闭面板去玩酒馆，好了会提示你', 'info');
        setStatusIfOpen(funLine());

        return (async () => {
            try {
                let resolvedSourceInfo = srcInfo;
                if (srcInfo.source === 'custom') {
                    if (!srcInfo.configName) throw new Error('先选一个自定义配置');
                    const cfg = await getConfig(srcInfo.configName);
                    resolvedSourceInfo = { source: 'custom', cfg };
                }
                const refImageDataUris = refImageFiles.length ? await Promise.all(refImageFiles.map(f => blobToDataUri(f))) : null;
                const contextParts = [];
                if (charInfo) contextParts.push('角色卡信息：\n' + charInfo);
                if (persona) contextParts.push('用户人设：\n' + persona);
                if (checkedWorldEntries.length) contextParts.push('世界书条目：\n' + checkedWorldEntries.join('\n---\n'));
                const extraContext = contextParts.join('\n\n') || null;

                const result = await receiveGeneration(generateBeautify({
                    skillPayload, plannedImages, description, refContent, existing: existingSnapshot, revisionPrompt, mode, sourceInfo: resolvedSourceInfo, forceImage, refImageDataUris, extraContext, lockedFindRegex, lockStructure
                }), taskController.signal);
                if (destroyed || taskEpoch !== generationEpoch) return;
                const plannedAssignments=imagePlanAssignments(plannedImages,result.replaceStringRaw);
                if(plannedImages.some(v=>!plannedAssignments[v.token]))throw new Error('模型遗漏了指定配图占位符，请重新生成；配图清单已保留。');
                const histEntry = { id: generateUUID(), ts: Date.now(), ...result, assignments: { ...(mode === 'create' ? {} : (existingSnapshot?.assignments || {})), ...plannedAssignments } };
                const generatedResult = { ...histEntry, historyId: histEntry.id, historyTs: histEntry.ts };
                await addHistory(histEntry);
                toast(`"${result.scriptName}" 生成完成，去历史记录里看`, 'success');

                session = generatedResult;
                const livePanel = targetDoc.getElementById('aibar-panel');
                if (livePanel) {
                    switchMintPage(livePanel,'create',false);
                    await showResult(livePanel, generatedResult);
                    await renderHistory(livePanel);
                    const liveStatus = livePanel.querySelector('#ab-status');
                    if (liveStatus) liveStatus.textContent = '生成完成，往下滑看预览。';
                    const liveBtn = livePanel.querySelector(btnMap[mode]);
                    if (liveBtn) liveBtn.disabled = false;
                }
            } catch (e) {
                if (taskEpoch !== generationEpoch || destroyed) return;
                toast('生成失败：' + e.message, 'error');
                setStatusIfOpen('生成失败：' + e.message);
                const livePanel = targetDoc.getElementById('aibar-panel');
                const liveBtn = livePanel?.querySelector(btnMap[mode]);
                if (liveBtn) liveBtn.disabled = false;
                console.error(e);
            } finally {
                generationBusy = false; generationController = null; syncGenerationUI();
            }
        })();
    }

    function funLine() {
        const lines = ['小序正在把灵感排成漂亮的样子…', '正在把你的「大概这样」翻译成代码…', '还在生成中，关闭面板也会继续。', '小白正在叼回代码，请稍候…'];
        return lines[Math.floor(Math.random() * lines.length)];
    }
    function setStatusIfOpen(text) {
        const livePanel = targetDoc.getElementById('aibar-panel');
        const statusEl = livePanel?.querySelector('#ab-status');
        if (statusEl) statusEl.textContent = text;
    }

