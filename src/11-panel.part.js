    async function renderPanel() {
        const configNames = await listConfigNames();
        const panel = targetDoc.createElement('div');
        panel.id = 'aibar-panel';
        panel.style.cssText = `position:fixed;top:5%;left:50%;transform:translateX(-50%);width:min(460px,94vw);
            max-height:88vh;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;
            background:#1e1e1e;color:#eee;border-radius:10px;padding:0;
            z-index:2147483647;box-shadow:0 4px 24px rgba(0,0,0,0.5);font-size:14px;`;
        panel.innerHTML = `
            <div style="position:sticky;top:0;background:#1e1e1e;display:flex;justify-content:space-between;align-items:center;
                padding:16px 16px 10px 16px;margin-bottom:10px;border-bottom:1px solid #333;z-index:2;">
                <b>薄荷工作台 <span style="font-size:10px;opacity:.6">v3.0</span></b>
                <button id="ab-close" style="padding:2px 10px;">关闭</button>
            </div>
            <div style="padding:0 16px 16px 16px;">
                <div id="mint-hero"><img id="mint-mascot" alt="薄荷助手" referrerpolicy="no-referrer"><div><div class="mint-eyebrow">MINT STUDIO / AI TOOLS</div><div class="mint-title">状态栏小工坊</div><div id="mint-greeting" class="mint-sub"></div><div id="mint-clock" class="mint-sub"></div></div></div>
                <details id="mint-gallery-settings"><summary>服务器图库 · 连接与管理</summary>
                    <div class="mint-sub">手机选图 → 上传服务器 → 状态栏只保存链接。这里填图库专用密钥，不填 SSH 密码。</div>
                    <label>图库 HTTPS 地址<input id="mint-gallery-url" type="url" placeholder="https://你的域名/mint-gallery" style="width:100%"></label>
                    <label>图库管理密钥<input id="mint-gallery-token" type="password" autocomplete="off" placeholder="部署服务时生成的专用密钥" style="width:100%"></label>
                    <div class="mint-sub" id="mint-origin"></div>
                    <div style="display:flex;gap:7px;margin-top:8px"><button id="mint-gallery-connect" style="flex:1">连接 / 刷新并保存</button><button id="mint-gallery-forget">忘记配置</button></div>
                    <div id="mint-usage"></div>
                    <label style="display:block;margin-top:8px">上传到图库<input id="mint-gallery-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="width:100%;display:block"></label>
                    <div id="mint-gallery-list" style="font-size:12px;margin-top:8px"></div>
                    <div class="mint-sub" style="margin-top:8px">持有图片链接的人可以查看图片；删除服务器文件会使旧状态栏中的图片失效。</div>
                </details>


                <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
                    <label style="font-size:12px;opacity:0.8;">模型来源：</label>
                    <select id="ab-source" style="flex:1;padding:6px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:4px;">
                        <option value="tavern">使用酒馆当前连接</option>
                        <option value="custom">使用自定义配置</option>
                    </select>
                </div>
                <div id="ab-custom-wrap" style="display:none;margin-bottom:8px;">
                    <div style="display:flex;gap:6px;">
                        <select id="ab-config-select" style="flex:1;padding:6px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:4px;">
                            <option value="">-- 选一个已保存的配置 --</option>
                            ${configNames.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
                        </select>
                        <button id="ab-config-manage-btn" style="padding:6px 10px;">管理</button>
                    </div>
                </div>
                <div id="ab-config-panel" style="display:none;border:1px solid #444;border-radius:8px;padding:10px;margin-bottom:10px;"></div>

                <div style="font-size:12px;opacity:0.7;margin-bottom:4px;">描述你想要的状态栏</div>
                <textarea id="ab-desc" rows="3" placeholder="例如：一个简约风格的时间/天气/心情状态栏，深色卡片，圆角边框" style="width:100%;box-sizing:border-box;padding:8px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:6px;margin-bottom:6px;"></textarea>
                <label style="display:flex;align-items:center;gap:6px;font-size:12px;opacity:0.85;margin-bottom:8px;">
                    <input id="ab-force-image" type="checkbox"> 确保生成的状态栏包含图片位（背景图/图标等），不用自己在描述里特意提
                </label>
                <details style="margin-bottom:8px;">
                    <summary style="cursor:pointer;font-size:12px;opacity:0.8;">可选：粘贴预设条目原文当参考，或从已有正则里挑一个模仿</summary>
                    <textarea id="ab-ref" rows="3" style="width:100%;box-sizing:border-box;padding:8px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:6px;margin-top:6px;"></textarea>
                    <button id="ab-list-existing-regex" style="width:100%;padding:6px;margin-top:6px;">列出酒馆里已有的正则</button>
                    <select id="ab-existing-regex-select" style="width:100%;padding:6px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:4px;font-size:12px;margin-top:6px;display:none;"></select>
                    <button id="ab-use-existing-regex" style="width:100%;padding:6px;margin-top:6px;display:none;">把它的代码填进上面参考框（会覆盖）</button>
                    <label style="display:flex;align-items:center;gap:6px;font-size:12px;opacity:0.85;margin-top:8px;">
                        <input id="ab-lock-format" type="checkbox"> 锁定这条参考正则的标签格式（只换皮肤，标签结构一个不改）
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:12px;opacity:0.85;margin-top:4px;">
                        <input id="ab-lock-structure" type="checkbox"> 保留参考正则的原有结构/功能（DOM结构、JS交互逻辑、布局方式都不动），只改颜色/字体/装饰这些纯外观
                    </label>
                </details>
                <details style="margin-bottom:8px;">
                    <summary style="cursor:pointer;font-size:12px;opacity:0.8;">可选：传一张参考图，让AI模仿风格（需要你连的模型支持看图）</summary>
                    <input id="ab-ref-image" type="file" accept="image/*" multiple style="display:block;width:100%;padding:6px;box-sizing:border-box;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:6px;margin-top:6px;">
                    <div id="ab-ref-image-name" style="font-size:11px;opacity:0.6;margin-top:4px;"></div>
                </details>
                <details style="margin-bottom:8px;">
                    <summary style="cursor:pointer;font-size:12px;opacity:0.8;">可选：让AI参考角色卡/人设/世界书（默认收起，读多了会拖慢生成）</summary>
                    <div style="margin-top:8px;">
                        <button id="ab-fetch-char" style="width:100%;padding:6px;margin-bottom:6px;">尝试自动读取当前角色卡</button>
                        <textarea id="ab-char-info" rows="3" placeholder="自动读取的结果会显示在这里，也可以手动改" style="width:100%;box-sizing:border-box;padding:8px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:6px;margin-bottom:6px;font-size:12px;"></textarea>
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                            <div style="font-size:12px;opacity:0.7;">用户人设（手动粘贴）</div>
                            <button id="ab-persona-clear" style="padding:2px 8px;font-size:11px;">清除</button>
                        </div>
                        <textarea id="ab-persona" rows="3" placeholder="把你的用户人设粘贴到这里" style="width:100%;box-sizing:border-box;padding:8px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:6px;margin-bottom:6px;font-size:12px;"></textarea>
                        <details>
                            <summary style="cursor:pointer;font-size:12px;opacity:0.8;">世界书条目（先选书，默认全部不选，读出来自己挑）</summary>
                            <button id="ab-list-books" style="width:100%;padding:6px;margin:6px 0;">列出可选的世界书</button>
                            <select id="ab-world-book-select" style="width:100%;padding:6px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:4px;font-size:12px;margin-bottom:6px;display:none;"></select>
                            <button id="ab-fetch-world" style="width:100%;padding:6px;margin-bottom:6px;display:none;">读取选中世界书的条目</button>
                            <div id="ab-world-list" style="max-height:180px;overflow-y:auto;"></div>
                        </details>
                    </div>
                </details>
                <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
                    <label style="font-size:12px;opacity:0.8;">字体：</label>
                    <select id="ab-font-select" style="flex:1;padding:6px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:4px;">
                        <option value="">不使用自定义字体</option>
                    </select>
                </div>
                <details id="ab-font-details" style="margin-bottom:8px;">
                    <summary style="cursor:pointer;font-size:12px;opacity:0.8;">字体管理（添加/预览/删除自定义字体）</summary>
                    <div id="ab-font-manager" style="margin-top:8px;"></div>
                </details>
                <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;">
                    <label style="font-size:12px;opacity:0.8;">保存到：</label>
                    <select id="ab-scope" style="flex:1;padding:6px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:4px;">
                        <option value="character">角色卡正则</option>
                        <option value="global">全局正则</option>
                        <option value="preset">预设正则</option>
                    </select>
                </div>
                <button id="ab-generate" style="width:100%;padding:8px;background:#5a3a7a;color:#fff;border-radius:6px;">生成状态栏</button>
                <button id="mint-cancel-generation" hidden style="width:100%;margin-top:6px">取消接收生成结果</button><div id="ab-status" style="font-size:12px;opacity:0.75;margin-top:8px;"></div>

                <div id="ab-result" style="display:none;margin-top:14px;">
                    <hr style="border-color:#444;margin:10px 0;">
                    <div id="ab-scriptname" style="font-size:13px;font-weight:bold;margin-bottom:6px;"></div>
                    <div id="ab-formatguide-wrap" style="display:none;background:#2a2a2a;border:1px solid #555;border-radius:6px;padding:8px;margin-bottom:8px;">
                        <div style="font-size:11px;opacity:0.7;margin-bottom:4px;">这段可以直接粘贴进角色卡/预设提示词，告诉AI要输出什么格式：</div>
                        <textarea id="ab-formatguide-text" readonly rows="5" style="width:100%;box-sizing:border-box;font-size:12px;margin-bottom:6px;white-space:pre-wrap;background:#1e1e1e;color:#eee;border:1px solid #555;border-radius:4px;padding:6px;"></textarea>
                        
                        <div style="display:flex;gap:6px;margin-bottom:6px;">
                            <button id="ab-formatguide-copy" style="flex:1;padding:3px 8px;font-size:12px;">复制这段</button>
                            <button id="ab-formatguide-write" style="flex:1;padding:3px 8px;font-size:12px;">写入世界书</button>
                        </div>
                        <div id="ab-write-world-panel" style="display:none;border-top:1px solid #444;padding-top:8px;margin-top:6px;">
                            <div style="font-size:11px;opacity:0.7;margin-bottom:4px;">已绑定角色卡的世界书：</div>
                            <select id="ab-write-book-bound" style="width:100%;padding:6px;background:#1e1e1e;color:#eee;border:1px solid #555;border-radius:4px;font-size:12px;margin-bottom:6px;"></select>
                            <div style="font-size:11px;opacity:0.7;margin-bottom:4px;">未绑定的独立世界书：</div>
                            <select id="ab-write-book-unbound" style="width:100%;padding:6px;background:#1e1e1e;color:#eee;border:1px solid #555;border-radius:4px;font-size:12px;margin-bottom:6px;"></select>
                            <div style="font-size:11px;opacity:0.7;margin-bottom:4px;">或者新建一个世界书：</div>
                            <input id="ab-write-book-new" placeholder="新世界书名称" style="width:100%;padding:6px;background:#1e1e1e;color:#eee;border:1px solid #555;border-radius:4px;font-size:12px;margin-bottom:6px;box-sizing:border-box;">
                            <button id="ab-write-confirm" style="width:100%;padding:6px;background:#3a5a3a;">确认写入（只会用其中一个选择）</button>
                        </div>
                    </div>
                    <iframe sandbox="allow-scripts" referrerpolicy="no-referrer" id="ab-preview" style="width:100%;height:260px;border:1px solid #444;border-radius:6px;background:#111;"></iframe>
                    <div id="ab-placeholders" style="margin-top:10px;"></div>

                    <hr style="border-color:#444;margin:10px 0;">
                    <div style="font-size:12px;opacity:0.8;margin-bottom:4px;">测试渲染：粘贴一段模拟AI回复（带标签），看正则实际匹配替换的效果</div>
                    <textarea id="ab-test-input" rows="3" placeholder="例如：<calendar><month>7</month>...</calendar>" style="width:100%;box-sizing:border-box;padding:8px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:6px;margin-bottom:6px;font-size:12px;"></textarea>
                    <div class="mint-row"><button id="ab-test-render" style="flex:1">测试渲染</button><button id="ab-test-clear" type="button">清除</button></div>
                    <div id="ab-test-status" style="font-size:12px;opacity:0.75;margin-bottom:6px;"></div>
                    <iframe sandbox="allow-scripts" referrerpolicy="no-referrer" id="ab-test-preview" style="width:100%;height:260px;border:1px solid #444;border-radius:6px;background:#111;display:none;"></iframe>

                    <textarea id="ab-revise" rows="2" placeholder="不满意的地方？写修改意见" style="width:100%;box-sizing:border-box;padding:8px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:6px;margin-top:10px;"></textarea>
                    <div style="display:flex;gap:6px;margin-top:8px;">
                        <button id="ab-revise-btn" style="flex:1;padding:6px;">根据意见修改</button>
                        <button id="ab-variant-btn" style="flex:1;padding:6px;">换一版</button>
                    </div>
                    <button id="ab-save" style="width:100%;padding:8px;margin-top:8px;background:#3a5a3a;">保存为正则</button>
                </div>

                <hr style="border-color:#444;margin:14px 0;">
                <details>
                    <summary style="cursor:pointer;font-size:13px;opacity:0.85;">历史生成记录</summary>
                    <div style="display:flex;gap:6px;align-items:center;margin:8px 0;flex-wrap:wrap;">
                        <label style="font-size:12px;opacity:0.8;">只保留最近</label>
                        <input id="ab-hist-keep-n" type="number" min="1" value="10" style="width:60px;padding:4px;background:#2a2a2a;color:#eee;border:1px solid #555;border-radius:4px;">
                        <label style="font-size:12px;opacity:0.8;">条</label>
                        <button id="ab-hist-trim" style="padding:4px 8px;font-size:12px;">清掉多余的</button>
                        <button id="ab-hist-select-mode" style="padding:4px 8px;font-size:12px;">多选删除</button>
                    </div>
                    <div id="ab-history" style="margin-top:8px;"></div>
                </details>
            </div>`;
        return panel;
    }

