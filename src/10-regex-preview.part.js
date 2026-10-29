    function buildPreviewDoc(htmlFragment, fontSnippet) {
        const normalized = htmlFragment.trim();
        const hasBody = /<body[\s>]/i.test(normalized) && /<\/body>/i.test(normalized);
        const body = hasBody ? normalized : `<body>${normalized}</body>`;
        const fontHead = fontSnippet ? buildFontBlock(fontSnippet) : '';
        return `<!doctype html>
<html><head><meta charset="utf-8">
${fontHead}
<style>
html,body{margin:0;min-height:100%;background:transparent;}
body{padding:10px;box-sizing:border-box;font-family:system-ui,sans-serif;}
*,*::before,*::after{box-sizing:border-box;max-width:100%;}
</style></head>
${body}</html>`;
    }
    function resolvePlaceholders(text, assignments) {
        return text.replace(IMG_TOKEN_RE, (m, key) => {
            const assigned = assignments[key];
            if (assigned && imageUrl(assigned)) return imageUrl(assigned);
            if (assigned && urlCache.has(assigned)) return urlCache.get(assigned);
            return m;
        });
    }
    function extractPlaceholderKeys(text) {
        const keys = new Set();
        let m;
        IMG_TOKEN_RE.lastIndex = 0;
        while ((m = IMG_TOKEN_RE.exec(text))) keys.add(m[1]);
        return [...keys];
    }

    function parseRegexString(str) {
        const m = String(str || '').trim().match(/^\/([\s\S]*)\/([a-z]*)$/);
        if (!m) return null;
        try { return new RegExp(m[1], m[2].includes('g') ? m[2] : m[2] + 'g'); } catch (e) { return null; }
    }
    function testRenderAgainst(sampleText) {
        if (!session) return { matched: false, error: '还没有生成结果' };
        const re = parseRegexString(session.findRegex);
        if (!re) return { matched: false, error: 'findRegex 格式解析失败，检查是不是标准的 /pattern/flags 格式' };
        re.lastIndex = 0;
        if (!re.test(sampleText)) return { matched: false };
        re.lastIndex = 0;
        const resolvedReplace = resolvePlaceholders(session.replaceStringRaw, session.assignments);
        const result = sampleText.replace(re, resolvedReplace);
        return { matched: true, result };
    }

    // ================= 读写酒馆正则（保存用） =================
    async function getAllRegexesSafe(enableState) {
        try {
            return await Promise.resolve(getTavernRegexes({ scope: 'all', enable_state: enableState || 'all' }));
        } catch (e) {
            const g = (await Promise.resolve(getTavernRegexes({ type: 'global' }))) || [];
            const c = (await Promise.resolve(getTavernRegexes({ type: 'character' }))) || [];
            return [...g, ...c];
        }
    }
    async function saveAllRegexesSafe(list) {
        await replaceTavernRegexes(list, { scope: 'all' });
    }

    // ================= 面板 =================
    function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    let session = null;
    let fetchedModels = [];

