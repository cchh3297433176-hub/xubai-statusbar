    const MATERIAL_SELECTION_KEY='__mint_material_selection_v1__';
    let materialSelection={styles:[],icons:[]};
    const mintTranslations={minimalism:'极简',neumorphism:'新拟态',glassmorphism:'玻璃拟态',brutalism:'粗野主义',retro:'复古',dark:'深色',hand:'手账',japanese:'日式',nature:'自然',typography:'文字',gradient:'渐变',heart:'爱心',cloud:'云',sun:'太阳',moon:'月亮',star:'星星',weather:'天气',map:'地图',location:'位置',user:'人物',flower:'花',search:'搜索',calendar:'日历',clock:'时钟'};
    function materialAliases(value){let t=String(value).toLowerCase();return Object.entries(mintTranslations).filter(([en])=>t.includes(en)).map(([,zh])=>zh).join(' ');}
    function materialMatches(text,query){const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);let s=(text+' '+materialAliases(text)).toLowerCase();return terms.every(t=>s.includes(t));}
    async function saveMaterialSelection(){await saveConfig(MATERIAL_SELECTION_KEY,materialSelection);}
    function selectedMaterialPrompt(){
        const styles=MINT_STYLE_CATALOG.filter(x=>materialSelection.styles.includes(x.id));
        const icons=materialSelection.icons.filter(id=>MINT_ICON_CATALOG[id]);
        let sections=[];
        if(styles.length)sections.push('【已选设计风格】\n'+styles.map(x=>x.name+'：'+x.content).join('\n'));
        if(icons.length)sections.push('【已选 SVG 图标】仅在合适位置使用以下本地图标，可继承颜色：\n'+icons.map(name=>name+' '+materialSvg(name)).join('\n'));
        return sections.join('\n\n');
    }
    function materialSvg(name){
        const item=MINT_ICON_CATALOG[name];if(!item)return '';
        const children=item.body.map(([tag,attrs])=>'<'+tag+' '+Object.entries(attrs).map(([k,v])=>k+'="'+String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')+'"').join(' ')+'/>').join('');
        return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+children+'</svg>';
    }
    function installMaterialLibrary(panel){
        const gallery=panel.querySelector('#mint-page-gallery');if(!gallery)return;
        const imageView=targetDoc.createElement('div');imageView.id='mint-existing-gallery';
        while(gallery.firstChild)imageView.append(gallery.firstChild);
        const el=(tag,cls,text)=>{const n=targetDoc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
        const button=(text,cls,action)=>{const b=el('button',cls,text);b.type='button';if(action)b.onclick=action;return b;};
        const style=el('style');style.textContent=`
#aibar-panel #mint-page-gallery{font:14px/1.5 system-ui,-apple-system,sans-serif!important}
#aibar-panel .mint-material-header{display:flex;align-items:center;justify-content:space-between;margin:0 0 12px;gap:12px}
#aibar-panel .mint-material-header h2{font:700 22px/1.3 system-ui!important;margin:0}
#aibar-panel .mint-material-header img{width:54px;height:54px;object-fit:contain}
#aibar-panel .mint-material-tabs{display:flex;padding:4px;border-radius:16px;background:var(--mint-soft);gap:4px;margin-bottom:14px}
#aibar-panel .mint-material-tabs button{flex:1;min-width:0;min-height:40px;padding:8px!important;border-radius:12px!important;font:600 14px system-ui!important;background:transparent!important;color:var(--mint-muted)!important}
#aibar-panel .mint-material-tabs button[aria-selected=true]{background:var(--mint-bg)!important;color:var(--mint-accent)!important;box-shadow:0 2px 7px #26474310!important}
#aibar-panel .mint-material-toolbar{display:flex;gap:7px;align-items:center;margin:0 0 10px}
#aibar-panel .mint-material-toolbar input{flex:1;min-width:0;width:0;font:14px system-ui!important}
#aibar-panel .mint-material-toolbar button{flex:none;width:42px;height:44px;min-height:44px;border-radius:12px!important;padding:10px!important}
#aibar-panel .mint-material-toolbar svg{width:20px;height:20px}
#aibar-panel .mint-material-meta{display:flex;justify-content:space-between;align-items:center;gap:6px;min-height:32px;margin:0 0 8px;color:var(--mint-muted);font:12px system-ui}
#aibar-panel .mint-material-meta button{min-height:32px;padding:5px 10px!important;font:12px system-ui!important;background:transparent!important}
#aibar-panel .mint-material-meta button[aria-pressed=true]{color:var(--mint-accent)!important;background:var(--mint-soft)!important}
#aibar-panel .mint-material-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:0 0 12px}
#aibar-panel .mint-material-item{min-width:0;display:flex;align-items:center;gap:0;border:1px solid var(--mint-line);border-radius:16px;background:var(--mint-surface);overflow:hidden}
#aibar-panel .mint-material-item[data-selected=true]{border-color:var(--mint-accent);background:var(--mint-soft)}
#aibar-panel .mint-material-item .mint-material-name{flex:1;min-width:0;min-height:54px;text-align:left;justify-content:flex-start;background:transparent!important;border-radius:0!important;padding:11px 4px 11px 12px!important;font:500 13px/1.45 system-ui!important}
#aibar-panel .mint-material-item label{display:flex;align-items:center;justify-content:center;flex:none;width:40px;min-height:54px;cursor:pointer}
#aibar-panel .mint-material-item input[type=checkbox]{appearance:auto!important;-webkit-appearance:checkbox!important;width:18px!important;height:18px!important;margin:0!important;accent-color:var(--mint-accent)}
#aibar-panel .mint-material-grid.is-svg{grid-template-columns:repeat(auto-fill,minmax(48px,1fr));gap:8px}
#aibar-panel .mint-material-icon{width:100%;height:48px;min-height:48px;border-radius:13px!important;padding:10px!important;background:var(--mint-surface)!important;border:1px solid var(--mint-line)!important}
#aibar-panel .mint-material-icon[aria-pressed=true]{border-color:var(--mint-accent)!important;background:var(--mint-soft)!important;color:var(--mint-accent)!important}
#aibar-panel .mint-material-icon svg{width:24px;height:24px}
#aibar-panel .mint-material-pager{display:flex;align-items:center;justify-content:center;gap:16px;font:12px system-ui}
#aibar-panel .mint-material-pager button{min-height:36px;padding:6px 12px!important;font:12px system-ui!important}
#aibar-panel .mint-material-empty{grid-column:1/-1;text-align:center;color:var(--mint-muted);padding:24px 4px;font:13px/1.7 system-ui}
#aibar-panel .mint-material-shortcut{width:100%;display:flex;justify-content:space-between;margin:8px 0!important;font:13px system-ui!important;border:1px solid var(--mint-line)!important;border-radius:13px!important;background:var(--mint-surface)!important}
#aibar-panel .mint-status-strip{display:flex;justify-content:space-between;padding:4px 18px 0;font:600 11px system-ui;min-height:19px}
`;panel.append(style);
        const heading=el('div','mint-material-header');heading.append(el('h2','','素材库'));const mascot=el('img');mascot.src=MINT_DAY_AVATAR;mascot.alt='序白';heading.append(mascot);
        const tabs=el('div','mint-material-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','素材类型');
        const detail=el('div','mint-material-detail');gallery.append(heading,tabs,imageView,detail);
        let current='skill',query='',randomIds=null,pageIndex=0,selectedOnly=false,closeDetail=null;
        const isSelected=item=>item.isOwn?!!skillBook.items.find(x=>x.id===item.id)?.enabled:materialSelection.styles.includes(item.id);
        const selectionCount=()=>materialSelection.styles.length+skillBook.items.filter(x=>x.enabled&&skillBook.send).length;
        const shortcut=button('','mint-material-shortcut',()=>{switchMintPage(panel,'gallery',false);open('skill');});
        const oldSkillPick=panel.querySelector('#mint-skill-create');
        if(oldSkillPick){oldSkillPick.hidden=true;oldSkillPick.before(shortcut);}else panel.querySelector('#mint-generate-slot')?.before(shortcut);
        function syncShortcut(){shortcut.textContent='选择 Skill / 风格';const count=el('span','',selectionCount()+' 已选 ›');shortcut.append(count);}
        async function toggleItem(item,wanted){
            if(item.isOwn){const real=skillBook.items.find(x=>x.id===item.id);if(!real)return;real.enabled=wanted;if(wanted)skillBook.send=true;await saveSkillBook();await renderSkillBook(panel);}
            else{const a=materialSelection.styles,i=a.indexOf(item.id);if(wanted&&i<0){if(a.length>=12){toast('最多选择12份素材','warning');return;}a.push(item.id);}else if(!wanted&&i>=0)a.splice(i,1);await saveMaterialSelection();}
            syncShortcut();paint();
        }
        function showDetail(item,selectable=false){
            closeDetail?.();const previous=targetDoc.activeElement,host=el('div');host.id='mint-material-dialog';
            const shadow=host.attachShadow({mode:'open'});const css=el('style');
            css.textContent=`:host{all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;font:14px/1.6 system-ui!important;color:#203733!important;color-scheme:light!important}*{box-sizing:border-box}.shade{position:absolute;inset:0;background:#173d395c;backdrop-filter:blur(5px);display:grid;place-items:center;padding:16px}.card{display:flex;flex-direction:column;min-height:0;width:min(480px,100%);max-height:calc(100dvh - 32px);background:#fff;border:1px solid #dcece6;border-radius:22px;box-shadow:0 18px 70px #112f3c30;overflow:hidden}header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #e6eeeb;flex:none}h3{font:650 17px/1.4 system-ui;margin:0;overflow-wrap:anywhere}button{appearance:none;border:0;background:#eaf6f2;color:#285b51;cursor:pointer;font:14px system-ui;border-radius:12px;min-height:42px;padding:10px 16px}button:focus-visible{outline:2px solid #237f78;outline-offset:-3px}.exit{width:42px;flex:none;font-size:25px;padding:0}pre{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.85 system-ui;margin:0;padding:18px;user-select:text}footer{display:flex;padding:12px 18px;border-top:1px solid #e6eeeb;flex:none;gap:10px}footer button{flex:1}.choose{background:#237f78;color:white}small{display:block;font:12px system-ui;color:#688078;margin-top:4px}:host([data-theme=night]) .card{background:#142321;color:#edf8f5}:host([data-theme=night]) button{background:#29433d;color:#e4f7f1}:host([data-theme=night]) .choose{background:#9de8da;color:#15372e}`;
            host.dataset.theme=panel.dataset.theme||'day';const shade=el('div','shade'),card=el('section','card');card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-labelledby','material-title');
            const header=el('header'),title=el('h3','',item.label||item.name);title.id='material-title';const exit=button('×','exit');exit.setAttribute('aria-label','关闭详情');header.append(title,exit);
            const pre=el('pre','',item.content),footer=el('footer'),close=button('关闭');footer.append(close);
            const finish=()=>{targetDoc.removeEventListener('keydown',keyboard,true);host.remove();closeDetail=null;if(previous?.isConnected)previous.focus({preventScroll:true});};
            function keyboard(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish();}else if(e.key==='Tab'){const a=[...shadow.querySelectorAll('button')];const i=a.indexOf(shadow.activeElement);e.preventDefault();a[(i+(e.shiftKey?-1:1)+a.length)%a.length].focus({preventScroll:true});}}
            if(selectable){const choose=button(isSelected(item)?'取消选用':'选用此项','choose');choose.onclick=async()=>{await toggleItem(item,!isSelected(item));choose.textContent=isSelected(item)?'已选用 · 点击取消':'选用此项';};footer.append(choose);}
            exit.onclick=close.onclick=finish;shade.onclick=e=>{if(e.target===shade)finish();};card.append(header,pre,footer);shade.append(card);shadow.append(css,shade);targetDoc.documentElement.append(host);targetDoc.addEventListener('keydown',keyboard,true);closeDetail=finish;exit.focus({preventScroll:true});
        }
        let grid,search,pager,meta;
        function render(){
            detail.replaceChildren();const toolbar=el('div','mint-material-toolbar');search=el('input');search.type='search';search.placeholder=current==='skill'?'搜索 Skill、风格、配色、字体':'搜索 SVG';search.setAttribute('aria-label',search.placeholder);search.value=query;toolbar.append(search);
            if(current==='skill'){const shuffle=button('','',()=>{randomIds=MINT_STYLE_CATALOG.slice().sort(()=>Math.random()-.5).slice(0,8).map(x=>x.id);query='';search.value='';pageIndex=0;selectedOnly=false;paint();});shuffle.innerHTML=materialSvg('shuffle');shuffle.title='随机推荐';shuffle.setAttribute('aria-label','随机推荐');toolbar.append(shuffle);}
            detail.append(toolbar);meta=el('div','mint-material-meta');grid=el('div','mint-material-grid'+(current==='svg'?' is-svg':''));pager=el('div','mint-material-pager');detail.append(meta,grid,pager);
            search.oninput=()=>{query=search.value;randomIds=null;pageIndex=0;paint();};paint();
        }
        function paint(){
            if(!grid||current==='image')return;grid.replaceChildren();pager.replaceChildren();meta.replaceChildren();let items;
            if(current==='skill'){items=[...skillBook.items.map(x=>({...x,isOwn:true})),...MINT_STYLE_CATALOG].filter(v=>(!randomIds||randomIds.includes(v.id))&&(!selectedOnly||isSelected(v))&&materialMatches([v.label,v.name,v.keywords,v.isOwn?v.content:''].join(' '),query));}
            else items=Object.keys(MINT_ICON_CATALOG).filter(name=>(!selectedOnly||materialSelection.icons.includes(name))&&materialMatches(name+' '+MINT_ICON_CATALOG[name].keywords.join(' '),query));
            const count=current==='skill'?selectionCount():materialSelection.icons.length;const selected=button('已选 '+count,'',()=>{selectedOnly=!selectedOnly;randomIds=null;pageIndex=0;paint();});selected.setAttribute('aria-pressed',String(selectedOnly));meta.append(selected);
            if(count){const clear=button('清空','',async()=>{if(current==='skill'){materialSelection.styles=[];skillBook.items.forEach(v=>v.enabled=false);await saveSkillBook();await renderSkillBook(panel);}else materialSelection.icons=[];await saveMaterialSelection();syncShortcut();paint();});meta.append(clear);}
            if(randomIds){meta.append(button('查看全部','',()=>{randomIds=null;pageIndex=0;paint();}));}
            const size=current==='skill'?20:72,pages=Math.max(1,Math.ceil(items.length/size));pageIndex=Math.min(pageIndex,pages-1);
            if(!items.length)grid.append(el('div','mint-material-empty',selectedOnly?'还没有选用素材':'没有找到相关素材'));
            for(const item of items.slice(pageIndex*size,(pageIndex+1)*size)){
                if(current==='skill'){
                    const row=el('div','mint-material-item');row.dataset.selected=String(isSelected(item));const name=button(item.label||item.name,'mint-material-name',()=>showDetail(item,true));name.setAttribute('aria-label','查看 '+(item.label||item.name));
                    const label=el('label'),check=el('input');check.type='checkbox';check.checked=isSelected(item);check.setAttribute('aria-label','选用 '+(item.label||item.name));check.onchange=()=>{check.disabled=true;toggleItem(item,check.checked).catch(e=>{check.disabled=false;check.checked=isSelected(item);toast(e.message||String(e),'error');});};label.append(check);row.append(name,label);grid.append(row);
                }else{const name=item,b=button('','mint-material-icon');b.innerHTML=materialSvg(name);b.title=name;b.setAttribute('aria-label',name);b.setAttribute('aria-pressed',String(materialSelection.icons.includes(name)));b.onclick=async()=>{const a=materialSelection.icons,i=a.indexOf(name);if(i<0){if(a.length>=12){toast('最多选择12个图标','warning');return;}a.push(name);}else a.splice(i,1);await saveMaterialSelection();paint();};grid.append(b);}
            }
            if(pages>1){const prev=button('‹','',()=>{pageIndex--;paint();}),next=button('›','',()=>{pageIndex++;paint();});prev.setAttribute('aria-label','上一页');next.setAttribute('aria-label','下一页');prev.disabled=pageIndex===0;next.disabled=pageIndex===pages-1;pager.append(prev,el('span','',(pageIndex+1)+' / '+pages),next);}
        }
        function open(key){current=key;query='';randomIds=null;pageIndex=0;selectedOnly=false;imageView.hidden=key!=='image';detail.hidden=key==='image';tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.materialOpen===key)));if(key!=='image')render();syncShortcut();}
        for(const [key,label]of [['image','图片'],['skill','Skill'],['svg','SVG']]){const b=button(label,'',()=>open(key));b.dataset.materialOpen=key;b.setAttribute('role','tab');tabs.append(b);}
        const navLabel=panel.querySelector('#mint-tab-gallery span');if(navLabel)navLabel.textContent='素材';
        void getConfig(MATERIAL_SELECTION_KEY).then(x=>{if(x&&Array.isArray(x.styles)&&Array.isArray(x.icons))materialSelection={styles:x.styles.filter(id=>MINT_STYLE_CATALOG.some(v=>v.id===id)),icons:x.icons.filter(id=>MINT_ICON_CATALOG[id]).slice(0,12)};syncShortcut();if(current!=='image')paint();});
        const go=panel.querySelector('#mint-image-plan')?.previousElementSibling;if(go)go.addEventListener('click',()=>open('image'));
        open('skill');
        const inspect=targetDoc.createElement('button');inspect.type='button';inspect.textContent='查看输入与输出';inspect.onclick=()=>{if(!mintLastRequest){toast('还没有生成记录','info');return;}const data=mintLastRequest;showDetail({name:'本次输入与输出',content:'输入 '+Array.from(data.input).length+' 字符'+(data.imageCount?'，参考图片 '+data.imageCount+' 张':'')+'\n\n'+data.input+'\n\n输出 '+Array.from(data.output).length+' 字符\n\n'+data.output});};panel.querySelector('#mint-status-slot').append(inspect);
        const ctxToggle=targetDoc.createElement('label');ctxToggle.className='mint-skill-option';const ctxCheck=targetDoc.createElement('input');ctxCheck.type='checkbox';ctxCheck.id='mint-include-context';ctxToggle.append(ctxCheck,targetDoc.createTextNode('本次使用已读取的角色卡、人设和世界书'));panel.querySelector('#mint-creation-details').append(ctxToggle);
        const counts=targetDoc.createElement('label');counts.className='mint-form-label';counts.textContent='生成方案数量';const select=targetDoc.createElement('select');select.id='mint-variant-count';select.style.width='100%';for(const n of [1,2,3]){const o=targetDoc.createElement('option');o.value=String(n);o.textContent=n+' 个方案';select.append(o);}counts.append(select);panel.querySelector('#mint-generate-slot').before(counts);const variants=targetDoc.createElement('div');variants.id='mint-variant-picks';variants.className='mint-material-grid';panel.querySelector('#mint-result-slot').before(variants);
        const strip=targetDoc.createElement('div');strip.className='mint-status-strip';strip.innerHTML='<time aria-label="本地时间"></time><span></span>';panel.prepend(strip);
        const time=strip.querySelector('time'),battery=strip.querySelector('span');const tick=()=>{if(strip.isConnected)time.textContent=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});};tick();const timer=setInterval(()=>{if(!strip.isConnected){clearInterval(timer);return;}tick();},30000);
        if(typeof targetWindow.navigator.getBattery==='function'){Promise.resolve().then(()=>targetWindow.navigator.getBattery()).then(b=>{const update=()=>{if(strip.isConnected)battery.textContent=Math.round(b.level*100)+'%';};update();b.addEventListener('levelchange',update);}).catch(()=>{});}
    }
