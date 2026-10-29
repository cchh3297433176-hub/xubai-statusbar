    function destroyApp() {
        if (destroyed) return;
        destroyed = true;legacyThumbnailObserver?.disconnect();closeMintFullscreen();mintImageController?.abort();pendingGeneratedImage=null;
        activeConfirmation?.();fontPreviewCleanup?.();fontPreviewCleanup=null;
        globalListeners.forEach(({ target, type, handler, options }) => {
            try { target.removeEventListener(type, handler, options); } catch (e) {}
        });
        globalListeners = [];
        clearInterval(themeTimer); clearInterval(menuTimer); clearTimeout(menuDelay); clearTimeout(feedbackTimer);
        generationEpoch++; generationController?.abort();
        for (const url of urlCache.values()) URL.revokeObjectURL(url); urlCache.clear();
        if (db) { db.close(); db = null; }
        for (const id of ['mint-style', 'mint-feedback', MENU_BTN_ID, 'font-preview-style']) targetDoc.getElementById(id)?.remove();
        const el = targetDoc.getElementById('aibar-panel');
        if (el) el.remove();
        if (window.__AIBAR_DESTROY === destroyApp) delete window.__AIBAR_DESTROY;
        console.log('[AI状态栏] 已清理。');
    }
    window.__AIBAR_DESTROY = destroyApp;
    addListener(targetWindow, 'focus', applyMintTheme);
    addListener(targetWindow, 'resize', positionMintFeedback);
    if(targetWindow.visualViewport){addListener(targetWindow.visualViewport,'resize',positionMintFeedback);addListener(targetWindow.visualViewport,'scroll',positionMintFeedback);}
    addListener(targetDoc, 'visibilitychange', applyMintTheme);
    addListener(window,'pagehide',e=>{if(!e.persisted)destroyApp();});
    addListener(targetWindow,'pageshow',e=>{if(e.persisted){applyMintTheme();void refreshSavedGallery(true);}});
    addListener(targetWindow,'online',()=>{void refreshSavedGallery(true);});
    if(targetWindow!==window)addListener(targetWindow,'pagehide',e=>{if(!e.persisted)destroyApp();});

    const $ = targetWindow.jQuery || window.jQuery;
    const MENU_BTN_ID = 'aibar-menu-item';
    function injectToExtensionsMenu() {
        const $menu = $('#extensionsMenu');
        if ($menu.length > 0 && $(`#${MENU_BTN_ID}`).length === 0) {
            const $menuItem = $(`
                <div id="${MENU_BTN_ID}" class="list-group-item flex-container flexGap5 interactable" title="${BUTTON_NAME}">
                    ${mintIcon('star')}
                    <span>${BUTTON_NAME}</span>
                </div>
            `);
            $menuItem.on('click', () => { openPanel().catch(e => toast(e.message || String(e), 'error')); });
            $menu.append($menuItem);
        }
    }

    menuTimer = setInterval(injectToExtensionsMenu, 2000);
    menuDelay = setTimeout(injectToExtensionsMenu, 500);
    initDB().catch(e=>console.error('[序白工坊] 配置初始化失败：',e));
    console.log('[序白工坊] 原作 Claude；与你一起改造。银白头发是原装的。');
})();
