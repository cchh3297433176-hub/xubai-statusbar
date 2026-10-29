    function fontUrlKind(value) {
        try { const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;return /\.(woff2?|ttf|otf)(?:$|[?#])/i.test(url.href)?'font':'css'; } catch{return null;}
    }
    function quoteFontFamily(value) { return JSON.stringify(String(value).replace(/[\n\r<>]/g,'').trim()); }
    function normalizeFontInput(raw) {
        const input=String(raw||'').trim();if(!input)return '';
        if(fontUrlKind(input)){
            const safe=esc(input);
            if(fontUrlKind(input)==='font'){
                let hash=0;for(const c of input)hash=(Math.imul(hash,31)+c.charCodeAt(0))|0;
                const family='XuBai_'+(hash>>>0).toString(16);
                return `<style>@font-face{font-family:${quoteFontFamily(family)};src:url(${JSON.stringify(input).replace(/</g,'\\3c ')});font-display:swap;}body{font-family:${quoteFontFamily(family)};}</style>`;
            }
            return `<link rel="stylesheet" href="${safe}">`;
        }
        if(/<(?:link|style)\b/i.test(input)){
            const parsed=new targetWindow.DOMParser().parseFromString(input,'text/html');
            return [...parsed.querySelectorAll('style,link[rel~=stylesheet]')].map(node=>node.tagName==='STYLE'?`<style>${node.textContent.replace(/<\/style/gi,'')}</style>`:node.getAttribute('href')?`<link rel="stylesheet" href="${esc(new URL(node.getAttribute('href'),targetDoc.baseURI).href)}">`:'').join('\n');
        }
        return `<style>${input.replace(/<\/style/gi,'')}</style>`;
    }
    function extractFontFamily(snippet) {
        const metadata=String(snippet||'').match(/\/\*\s*xubai-family:\s*([^*]+)\*\//i);
        if(metadata)return metadata[1].trim();
        const face=String(snippet||'').match(/@font-face\s*\{[^}]*\}/i);
        const text=face?.[0]||String(snippet||'');
        const m=text.match(/font-family\s*:\s*(?:"([^"]+)"|'([^']+)'|([^;}\n]+))/i);
        return m?(m[1]||m[2]||m[3].split(',')[0]).trim():'';
    }
    function wrapFontSnippet(snippet) { return normalizeFontInput(snippet); }
    function buildFontBlock(snippet) {
        const normalized=normalizeFontInput(snippet);const family=extractFontFamily(normalized);
        return normalized+(family?`<style>body,body *{font-family:${quoteFontFamily(family)} !important;}</style>`:'');
    }
    async function prepareFontSnippet(raw, explicitFamily='', signal) {
        const normalized=normalizeFontInput(raw);let family=explicitFamily.trim()||extractFontFamily(normalized);
        if(!family){
            const urls=[];const parsed=new targetWindow.DOMParser().parseFromString(normalized,'text/html');
            parsed.querySelectorAll('link[rel~=stylesheet]').forEach(link=>urls.push(link.href));
            for(const style of parsed.querySelectorAll('style')){
                for(const m of style.textContent.matchAll(/@import\s+(?:url\(\s*)?["']?(https?:\/\/[^\s"'\);]+)["']?\s*\)?/gi))urls.push(m[1]);
            }
            for(const url of urls.slice(0,3)){
                if(signal?.aborted)throw new Error('字体预览已切换');
                try{
                    const resp=await fetch(url,{credentials:'omit',signal});
                    if(resp.ok){family=extractFontFamily(await resp.text());if(family)break;}
                }catch(e){if(signal?.aborted)throw e;}
            }
        }
        if(family){
            if(/[\r\n*<>]/.test(family)||family.length>160)throw new Error('字体字族名称格式不正确');
            return {family,snippet:normalized+`\n<style>/* xubai-family: ${family} */body{font-family:${quoteFontFamily(family)};}</style>`};
        }
        return {family:'',snippet:normalized};
    }
    function makeFontPreviewDoc(snippet, family, text, token, day) {
        const bg=day?'#ffffff':'#182024',fg=day?'#17252b':'#ffffff',muted=day?'#52676d':'#bdcecf';
        const payload=JSON.stringify({family,text,token}).replace(/</g,'\\u003c');
        return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${snippet}<style>html,body{margin:0;background:${bg};color:${fg}}body{padding:16px;font:12px/1.7 system-ui,sans-serif}small{color:${muted};font:11px system-ui}#font-sample{font-size:24px;line-height:1.65;overflow-wrap:anywhere;margin:7px 0 12px;font-family:${family?quoteFontFamily(family):'system-ui'}!important}#font-system{font:16px/1.6 system-ui,sans-serif!important}</style></head><body><small>自定义字体预览</small><div id="font-sample"></div><small>系统字体对照</small><div id="font-system"></div><script>
const data=${payload};document.getElementById('font-sample').textContent=data.text;document.getElementById('font-system').textContent=data.text;
const report=(state,message)=>parent.postMessage({kind:'xubai-font-preview',token:data.token,state,message},'*');
window.addEventListener('load',async()=>{
try{
 if(!data.family)return report('unknown','样式已载入，但没有识别到字体字族；可填写实际 font-family 后重试。');
 const faces=await document.fonts.load('24px '+JSON.stringify(data.family),data.text+' 中文试字 Aa 0123');
 await document.fonts.ready;
 if(faces.length&&faces.some(face=>face.status==='loaded'))report('loaded','字体已加载：'+data.family+'（已按预览文字检查）');
 else report('unknown','未确认自定义字族已注册，请检查 font-family 名称。');
}catch(e){report('error','字体加载失败：'+e.message+'；检查字体跨域权限或链接。');}
},{once:true});
<\/script></body></html>`;
    }

