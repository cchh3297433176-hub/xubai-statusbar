(function() {
    'use strict';
    const TavernHelper = window.TavernHelper;
    const { getWorldbookNames, getCharWorldbookNames, getWorldbook, createWorldbookEntries, getTavernRegexes, replaceTavernRegexes, updateTavernRegexesWith, parseReasoningFromString } = TavernHelper || {};
    const DB_NAME = 'ST_LocalImg_DB'; // 与"本地图片"脚本共用同一个图库
    const STORE = 'images';
    const HISTORY_STORE = 'gen_history';
    const CONFIG_STORE = 'ai_configs';
    const FONT_STORE = 'fonts';
    const LAST_SEL_KEY = '__last_selection__';
    const BUTTON_NAME = '序白 · 状态栏生成器';
    const IMG_TOKEN_RE = /\{\{IMG:([a-zA-Z0-9_\u4e00-\u9fa5]+)\}\}/g;

    if (window.__AIBAR_DESTROY) window.__AIBAR_DESTROY();

    const targetWindow = (() => {
        try { return window.parent?.document ? window.parent : window; }
        catch (e) { return window; }
    })();
    const targetDoc = targetWindow.document;
    const toast=(msg,type)=>{showCapsule(msg,type||'info');if(type==='error')console.error('[序白工坊]',msg);};

    let db = null;
    let urlCache = new Map();
    let destroyed = false;
    let globalListeners = [];

    function addListener(target, type, handler, options) {
        if (!target || destroyed) return;
        target.addEventListener(type, handler, options);
        globalListeners.push({ target, type, handler, options });
    }

