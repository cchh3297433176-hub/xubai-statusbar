    let dbOpening=null;
    function initDB() {
        if(db)return Promise.resolve(db);
        if(dbOpening)return dbOpening;
        dbOpening=new Promise((resolve, reject) => {
            if (db) return resolve(db);
            const req = indexedDB.open(DB_NAME, 6);
            req.onupgradeneeded = e => {
                const _db = e.target.result;
                if (!_db.objectStoreNames.contains(STORE)) _db.createObjectStore(STORE);
                if (!_db.objectStoreNames.contains('groups')) _db.createObjectStore('groups');
                if (!_db.objectStoreNames.contains('urlmap')) _db.createObjectStore('urlmap');
                if (!_db.objectStoreNames.contains(HISTORY_STORE)) _db.createObjectStore(HISTORY_STORE);
                if (!_db.objectStoreNames.contains(CONFIG_STORE)) _db.createObjectStore(CONFIG_STORE);
                if (!_db.objectStoreNames.contains(FONT_STORE)) _db.createObjectStore(FONT_STORE);
            };
            req.onsuccess = e => { if(destroyed){e.target.result.close();reject(new Error('脚本已关闭'));return;} db = e.target.result; db.onversionchange = () => { db.close(); db = null; }; resolve(db); };
            req.onblocked = () => reject(new Error('图库升级被其他页面阻塞，请关闭重复酒馆页面后重试'));
            req.onerror = () => reject(new Error('本地数据库初始化失败'));
        }).finally(()=>{dbOpening=null;});
        return dbOpening;
    }

    function blobToDataUri(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async function getCurrentCharacterId() {
        try { const p = await Promise.resolve(getCharAvatarPath()); if (p) return p; } catch (e) {}
        try { const n = await Promise.resolve(getCurrentCharacterName()); if (n) return n; } catch (e) {}
        return null;
    }

    // ================= 共享图库读写 =================
    function refreshCacheFor(key, blob) {
        if (urlCache.has(key)) URL.revokeObjectURL(urlCache.get(key));
        urlCache.set(key, URL.createObjectURL(blob));
    }
    async function saveImage(key, blob) {
        await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.onerror = () => reject(tx.error || new Error('本地数据库操作失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库操作已取消'));
            tx.objectStore(STORE).put(blob, key);
            tx.oncomplete = () => { refreshCacheFor(key, blob); resolve(); };
            tx.onerror = () => reject(tx.error || new Error('图片保存失败'));
            tx.onabort = () => reject(tx.error || new Error('图片保存已取消'));
        });
    }
    async function getImageBlob(key) {
        await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            tx.onerror = () => reject(tx.error || new Error('本地数据库操作失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库操作已取消'));
            tx.objectStore(STORE).get(key).onsuccess = e => resolve(e.target.result || null);
        });
    }
    async function listImageKeys() {
        await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            tx.onerror = () => reject(tx.error || new Error('本地数据库操作失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库操作已取消'));
            const req = tx.objectStore(STORE).getAllKeys();
            req.onsuccess = () => resolve((req.result || []).filter(k => k !== '__ball_icon__'));
        });
    }
    async function preloadAllImages() {
        await initDB();
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const keysReq = store.getAllKeys();
        const valsReq = store.getAll();
        return new Promise((resolve, reject) => {
            tx.onerror = () => reject(tx.error || new Error('本地图库读取失败'));
            tx.onabort = () => reject(tx.error || new Error('本地图库读取已取消'));
            tx.oncomplete = () => {
                const keys = keysReq.result || [];
                const vals = valsReq.result || [];
                keys.forEach((k, i) => { if (vals[i]) refreshCacheFor(k, vals[i]); });
                resolve();
            };
        });
    }

    // ================= 生成历史 =================
    async function addHistory(entry) {
        await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(HISTORY_STORE, 'readwrite');
            tx.onerror = () => reject(tx.error || new Error('本地数据库操作失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库操作已取消'));
            tx.objectStore(HISTORY_STORE).put(entry, entry.id);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error || new Error('本地数据库写入失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库事务已取消'));
        });
    }
    async function listHistory() {
        await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(HISTORY_STORE, 'readonly');
            tx.onerror = () => reject(tx.error || new Error('本地数据库操作失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库操作已取消'));
            const req = tx.objectStore(HISTORY_STORE).getAll();
            req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.ts - a.ts));
        });
    }
    async function deleteHistory(id) {
        await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(HISTORY_STORE, 'readwrite');
            tx.onerror = () => reject(tx.error || new Error('本地数据库操作失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库操作已取消'));
            tx.objectStore(HISTORY_STORE).delete(id);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error || new Error('本地数据库写入失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库事务已取消'));
        });
    }

    // ================= 自定义端口配置 =================
    async function saveConfig(name, cfg) {
        await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(CONFIG_STORE, 'readwrite');
            tx.onerror = () => reject(tx.error || new Error('本地数据库操作失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库操作已取消'));
            tx.objectStore(CONFIG_STORE).put(cfg, name);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error || new Error('本地数据库写入失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库事务已取消'));
        });
    }
    async function getConfig(name) {
        await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(CONFIG_STORE, 'readonly');
            tx.onerror = () => reject(tx.error || new Error('本地数据库操作失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库操作已取消'));
            tx.objectStore(CONFIG_STORE).get(name).onsuccess = e => resolve(e.target.result || null);
        });
    }
    async function listConfigNames() {
        await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(CONFIG_STORE, 'readonly');
            tx.onerror = () => reject(tx.error || new Error('本地数据库操作失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库操作已取消'));
            tx.objectStore(CONFIG_STORE).getAllKeys().onsuccess = e => resolve((e.target.result || []).filter(n => n !== LAST_SEL_KEY && n !== GALLERY_CONFIG_KEY && n !== THEME_CONFIG_KEY && n !== UI_PREFS_KEY && n !== IMAGE_PLAN_KEY && n !== SKILL_BOOK_KEY && n !== NAI_PRESETS_KEY));
        });
    }
    async function deleteConfig(name) {
        await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(CONFIG_STORE, 'readwrite');
            tx.onerror = () => reject(tx.error || new Error('本地数据库操作失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库操作已取消'));
            tx.objectStore(CONFIG_STORE).delete(name);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error || new Error('本地数据库写入失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库事务已取消'));
        });
    }
    // ================= 上次选择的模型来源（持久化） =================
    async function saveLastSelection(sel) { await saveConfig(LAST_SEL_KEY, sel); }
    async function getLastSelection() { return await getConfig(LAST_SEL_KEY); }

    // ================= 字体管理 =================
    async function saveFont(name, snippet) {
        await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(FONT_STORE, 'readwrite');
            tx.onerror = () => reject(tx.error || new Error('本地数据库操作失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库操作已取消'));
            tx.objectStore(FONT_STORE).put(snippet, name);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error || new Error('本地数据库写入失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库事务已取消'));
        });
    }
    async function getFont(name) {
        await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(FONT_STORE, 'readonly');
            tx.onerror = () => reject(tx.error || new Error('本地数据库操作失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库操作已取消'));
            tx.objectStore(FONT_STORE).get(name).onsuccess = e => resolve(e.target.result || null);
        });
    }
    async function listFontNames() {
        await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(FONT_STORE, 'readonly');
            tx.onerror = () => reject(tx.error || new Error('本地数据库操作失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库操作已取消'));
            tx.objectStore(FONT_STORE).getAllKeys().onsuccess = e => resolve(e.target.result || []);
        });
    }
    async function deleteFont(name) {
        await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(FONT_STORE, 'readwrite');
            tx.onerror = () => reject(tx.error || new Error('本地数据库操作失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库操作已取消'));
            tx.objectStore(FONT_STORE).delete(name);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error || new Error('本地数据库写入失败'));
            tx.onabort = () => reject(tx.error || new Error('本地数据库事务已取消'));
        });
    }
