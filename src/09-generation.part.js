    async function fetchModelList(baseUrl, apiKey) {
        const url = apiEndpoint(baseUrl, 'models');
        const ctl = new AbortController(); const timeout = setTimeout(() => ctl.abort(), 20000);
        let resp; try { resp = await fetch(url, { signal: ctl.signal, headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} }); } finally { clearTimeout(timeout); }
        if (!resp.ok) throw new Error(`获取模型列表失败: HTTP ${resp.status}`);
        const data = await resp.json();
        return (data.data || []).map(m => m.id).sort();
    }

    // ================= 调用模型生成 =================
    async function callGenerateRaw(systemPrompt, userMessage, sourceInfo, refImageDataUris) {
        const images = refImageDataUris && refImageDataUris.length ? refImageDataUris : null;
        const userContent = images
            ? [...images.map(img => ({ type: 'image_url', image_url: { url: img } })), { type: 'text', text: userMessage }]
            : userMessage;

        if (sourceInfo.source === 'custom') {
            const cfg = sourceInfo.cfg;
            if (!cfg || !cfg.baseUrl || !cfg.model) throw new Error('自定义配置不完整，先去配置里选好模型');
            let baseUrl = cfg.baseUrl.replace(/\/$/, '');
            const isAnthropic = baseUrl.includes('anthropic.com') || baseUrl.includes('/v1/messages');

            if (isAnthropic) {
                baseUrl = baseUrl.replace(/\/v1\/messages$/, '').replace(/\/v1$/, '');
                const anthropicContent = Array.isArray(userContent)
                    ? userContent.map(block => {
                        if (block.type === 'image_url' && block.image_url?.url) {
                            const m = block.image_url.url.match(/^data:(image\/\w+);base64,(.+)$/);
                            if (m) return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
                        }
                        return block.type === 'text' ? { type: 'text', text: block.text } : block;
                    })
                    : userContent;
                const resp = await modelFetch(apiEndpoint(baseUrl, 'messages'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey || '', 'anthropic-version': '2023-06-01' },
                    body: JSON.stringify({ model: cfg.model, max_tokens: 4096, system: systemPrompt, messages: [{ role: 'user', content: anthropicContent }] })
                });
                if (!resp.ok) throw new Error(`自定义端口请求失败: HTTP ${resp.status}`);
                const data = await resp.json();
                return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
            }

            const resp = await modelFetch(apiEndpoint(baseUrl, 'chat/completions'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
                body: JSON.stringify({
                    model: cfg.model,
                    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }]
                })
            });
            if (!resp.ok) throw new Error(`自定义端口请求失败: HTTP ${resp.status}`);
            const data = await resp.json();
            return data.choices?.[0]?.message?.content ?? '';
        }

        // 走酒馆当前连接：用 TavernHelper.generateRaw，参数是 ordered_prompts，图片直接嵌进消息内容数组
        if (typeof TavernHelper === 'undefined' || typeof TavernHelper.generateRaw !== 'function') {
            throw new Error('找不到 TavernHelper.generateRaw，无法调用生成接口（把这行错误发给小克）');
        }
        const orderedPrompts = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
        ];
        const raw = await TavernHelper.generateRaw({
            user_input: '',
            ordered_prompts: orderedPrompts,
            overrides: {
                world_info_before: '', world_info_after: '', persona_description: '',
                char_description: '', char_personality: '', scenario: '', dialogue_examples: '',
                chat_history: { prompts: [], with_depth_entries: false, author_note: '' }
            },
            injects: [], max_chat_history: 0,
            should_stream: true
        });
        try {
            if (typeof parseReasoningFromString === 'function') {
                const parsed = parseReasoningFromString(raw, { strict: false });
                return parsed?.content ?? raw;
            }
        } catch (e) { /* 忽略，走下面兜底 */ }
        return raw;
    }

    const SYSTEM_PROMPT = `不要输出任何 data: 或 base64 内嵌素材。需要图片时只输出 {{IMG:标识名}} 占位符。
你是一个 SillyTavern 正则脚本专家，专门负责根据用户需求生成用于美化 AI 输出的状态栏正则脚本。
设计原则：Avoid unnecessary secondary labels and descriptions. Let the layout do the explaining. 优先通过清晰的布局、留白、对齐和层级传达信息。生成的状态栏及示例不得使用 emoji；需要图标时优先使用 SVG、CSS 或简洁文字。只根据本次提供的需求和明确选中的参考资料设计，未提供的世界观、人物身份和专有设定不要擅自添加。

严格按照下面这个格式输出，用这几行独占一行的标记把内容分段（标记必须原样输出，不能省略、不能加序号、不能加markdown符号）：

===SCRIPTNAME===
（这里写脚本名称，一行）
===FINDREGEX===
（这里写用于匹配AI输出中需要替换部分的正则表达式，斜杠包裹格式，如 /<status>([\\s\\S]*?)<\\/status>/，一行）
===REPLACESTRING===
（这里写替换成的完整HTML/CSS代码，要求：
- 用 \`\`\`html 代码块包裹
- 必须包含完整的 <body>...</body>，需要的话在 body 内写 <style>
- 如果设计中需要用到图片（背景图、头像、图标等），不要编造图片链接，一律用占位符代替，格式固定为 {{IMG:标识名}}（标识名用简短英文或拼音，比如 bg1、avatar），比如 background:url('{{IMG:bg1}}') 或 <img src="{{IMG:avatar}}">，不同用途用不同标识名
- 不要输出 body 标签之外的额外内容
- 如果用户提供了参考图片，分析它的配色、布局、装饰元素风格，让设计尽量贴近这种视觉风格（但不要把参考图本身当成占位符插进去，参考图只是风格灵感）
）
===FORMATGUIDE===
（这里写一段可以直接粘贴进角色卡/预设提示词里的完整说明，用中文写，必须包含以下几部分：
1) 一句强调语气的"必须遵守"声明，说明这个格式不能省略、不能加额外解释
2) 具体的标签格式定义（跟上面 FINDREGEX 对应的标签结构，逐个字段列出）
3) 一个填好真实内容的完整示例（不是占位符，是看起来像正常输出的例子）
4) 如果设计涉及时间/地点/状态变化等会随剧情推进的内容，加一条"注意事项"提醒AI要符合逻辑地推进
整体要写成可以直接复制粘贴进提示词就能用的完整文本，不要写"你可以这样写"之类的解释性外壳。
）
===END===

不要在 ===SCRIPTNAME=== 之前输出任何前言/解释，不要在 ===END=== 之后输出任何东西。每个标记独占一行，标记和标记之间的内容原样输出，不要额外转义引号或换行。`;

    function parseGenDelimited(result) {
        const grab = (tag, nextTags) => {
            const startIdx = result.indexOf(`===${tag}===`);
            if (startIdx === -1) return '';
            const contentStart = startIdx + `===${tag}===`.length;
            let endIdx = result.length;
            for (const nt of nextTags) {
                const idx = result.indexOf(`===${nt}===`, contentStart);
                if (idx !== -1 && idx < endIdx) endIdx = idx;
            }
            return result.slice(contentStart, endIdx).trim();
        };
        const scriptName = grab('SCRIPTNAME', ['FINDREGEX', 'REPLACESTRING', 'FORMATGUIDE', 'END']);
        const findRegex = grab('FINDREGEX', ['REPLACESTRING', 'FORMATGUIDE', 'END']);
        const replaceString = grab('REPLACESTRING', ['FORMATGUIDE', 'END']);
        const formatGuide = grab('FORMATGUIDE', ['END']);
        if (!scriptName && !findRegex && !replaceString) return null;
        return { scriptName, findRegex, replaceString, formatGuide };
    }
    function stripCodeFence(text) {
        const raw = String(text ?? '').trim();
        const fenced = raw.match(/^```[a-zA-Z0-9_-]*\s*([\s\S]*?)\s*```$/);
        return fenced?.[1]?.trim() ?? raw;
    }

    // ================= 角色卡 / 世界书 上下文（尽力而为，接口不确定就报原始错误） =================
    async function tryGetCharacterCardInfo() {
        if (typeof SillyTavern === 'undefined' || typeof SillyTavern.getContext !== 'function') {
            throw new Error('找不到 SillyTavern.getContext');
        }
        const context = SillyTavern.getContext();
        const char = context.characters?.[context.characterId];
        if (!char) throw new Error('读不到当前角色卡数据（可能没打开角色卡，或者接口字段结构对不上，发这行错误给小克）');
        const parts = [];
        if (char.description) parts.push('【角色描述】\n' + char.description);
        if (char.personality) parts.push('【性格】\n' + char.personality);
        if (char.scenario) parts.push('【场景设定】\n' + char.scenario);
        if (!parts.length) throw new Error('角色卡里没找到常见字段（description/personality/scenario），把这行错误发给小克确认字段名');
        return parts.join('\n\n');
    }

    function scopeLabel(scope) {
        if (scope === 'global') return '全局';
        if (scope === 'character') return '角色卡';
        if (scope === 'preset') return '预设';
        return '预设/其他';
    }

    async function listWorldbookCategories() {
        if (typeof getWorldbookNames !== 'function' || typeof getCharWorldbookNames !== 'function') {
            throw new Error('找不到 getWorldbookNames / getCharWorldbookNames 接口，把这行错误发给小克');
        }
        const allNames = await Promise.resolve(getWorldbookNames());
        const charBooks = await Promise.resolve(getCharWorldbookNames('current'));
        const bound = [charBooks.primary, ...(charBooks.additional || [])].filter(Boolean);
        const unbound = allNames.filter(n => !bound.includes(n));
        return { bound, unbound };
    }

    async function tryGetWorldbookEntries(bookName) {
        if (typeof getWorldbook !== 'function') throw new Error('找不到 getWorldbook 接口，把这行错误发给小克');
        let entries;
        try {
            entries = await getWorldbook(bookName);
        } catch (e) {
            throw new Error('调用 getWorldbook 失败: ' + e.message);
        }
        if (!Array.isArray(entries)) entries = entries?.entries || [];
        return entries.map((e, i) => {
            const title = e.comment || e.name || e.title || e.memo
                || (Array.isArray(e.key) ? e.key.join(',') : '')
                || (Array.isArray(e.keys) ? e.keys.join(',') : '');
            return {
                uid: e.uid ?? i,
                comment: title || `条目${i + 1}`,
                content: e.content || '',
                enabled: !e.disable,
            };
        });
    }

    async function writeFormatGuideToWorldbook(bookName, isNewBook, comment, content) {
        if (typeof createWorldbookEntries !== 'function') {
            throw new Error('找不到 createWorldbookEntries 接口，把这行错误发给小克');
        }
        const newEntry = { comment: comment || 'AI状态栏格式说明', content, key: [] };
        await createWorldbookEntries(bookName, [newEntry]);
    }

    async function generateBeautify({ skillPayload = '', plannedImages = [], description, refContent, existing, revisionPrompt, mode, sourceInfo, forceImage, refImageDataUris, extraContext, lockedFindRegex, lockStructure }) {
        const sections = [`【需求描述】\n${description || '（无）'}`];
        if(skillPayload)sections.push('【用户勾选的设计 Skill】\n'+skillPayload);
        if (extraContext) sections.push(`【故事背景参考（角色卡/用户人设/世界书）】\n${extraContext}`);
        if (refContent) sections.push(`【参考内容/预设条目原文】\n${refContent}`);
        if (refImageDataUris && refImageDataUris.length) sections.push(`【参考图片】用户附了 ${refImageDataUris.length} 张参考图，请综合分析它们的视觉风格并在设计中体现。`);
        if(plannedImages.length)sections.push(imagePlanPrompt(plannedImages));
        if (forceImage) sections.push('【硬性要求】必须至少设计一处使用图片的元素（背景图或图标均可），一定要用 {{IMG:标识名}} 占位符，不能省略这一步。');
        if (lockedFindRegex) sections.push(`【硬性要求·标签格式锁定】必须原样使用下面这个标签结构，一个标签名、顺序、层级都不能改，只能改视觉样式（颜色/布局/字体/装饰）：\n${lockedFindRegex}\n输出的 FINDREGEX 必须和上面这行一模一样，一个字符都不能变。`);
        if (lockStructure) sections.push('【硬性要求·功能结构锁定】这是"换皮肤不换骨架"的需求：参考正则里的 DOM 结构、CSS 布局方式（比如 flex/grid 这些决定排版逻辑的部分）、如果有 JS 交互逻辑也要原样保留，只能修改颜色、字体、圆角、阴影、装饰性图案、背景图这些纯视觉层面的东西，不能改变原有功能和结构骨架。');
        if (mode !== 'create' && existing) {
            sections.push(`【当前脚本】\n若是"继续修改"请基于它输出完整新版本；若是"换一版"可参考但要有明显不同的布局/风格。\n\`\`\`json\n${JSON.stringify({ scriptName: existing.scriptName, findRegex: existing.findRegex, replaceString: existing.replaceStringRaw }, null, 2)}\n\`\`\``);
        }
        if (mode === 'revise' && revisionPrompt) sections.push(`【修改意见】\n${revisionPrompt}`);
        if (mode === 'variant') sections.push('【要求】请生成一版结构或视觉风格明显不同的新方案，不要只改颜色。');

        const raw = await callGenerateRaw(SYSTEM_PROMPT, stripEmbeddedData(sections.join('\n\n')), sourceInfo, refImageDataUris);
        const parsed = parseGenDelimited(raw);
        if (!parsed) throw new Error('AI 没有按格式输出，原始返回：' + raw.slice(0, 300));
        return {
            scriptName: parsed.scriptName || '未命名状态栏',
            findRegex: lockedFindRegex || parsed.findRegex || '', // 锁定了就强制用锁定的，不管AI输出了什么
            replaceStringRaw: stripCodeFence(parsed.replaceString || ''),
            formatGuide: parsed.formatGuide || '',
        };
    }

    // ================= 预览文档构建 =================
