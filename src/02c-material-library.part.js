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
        const start=targetDoc.createElement('div');start.className='mint-material-start';
        const hero=targetDoc.createElement('div');hero.innerHTML='<h2>素材库</h2>';start.append(hero);
        const tabs=targetDoc.createElement('div');tabs.className='mint-material-tabs';
        for(const [key,label] of [['image','图片'],['skill','Skill'],['svg','SVG']]){const b=targetDoc.createElement('button');b.textContent=label;b.dataset.materialOpen=key;tabs.append(b);}
        start.append(tabs);
        const mascot=targetDoc.createElement('img');mascot.className='mint-material-mascot';mascot.src=MINT_DAY_AVATAR;mascot.alt='序白';start.append(mascot);
        const detail=targetDoc.createElement('div');detail.hidden=true;detail.className='mint-material-detail';
        const style=targetDoc.createElement('style');style.textContent=`
#aibar-panel .mint-material-start h2{font-size:20px;margin:8px 0 16px}
#aibar-panel .mint-material-tabs{display:grid;gap:10px}
#aibar-panel .mint-material-tabs button{justify-content:flex-start;min-height:68px;border:1px solid var(--mint-line)!important;border-radius:18px!important;padding:14px 18px!important;font-size:16px;font-weight:700}
#aibar-panel .mint-material-mascot{display:block;max-width:190px;width:60%;height:auto;margin:24px auto}
#aibar-panel .mint-material-detail h2{margin:8px 0 12px;font-size:20px}
#aibar-panel .mint-material-detail input{width:100%}
#aibar-panel .mint-material-grid{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
#aibar-panel .mint-material-grid button{min-height:42px;max-width:100%}
#aibar-panel .mint-material-grid button[aria-pressed=true]{background:var(--mint-accent)!important;color:var(--mint-bg)!important}
#aibar-panel .mint-material-icon svg{width:23px;height:23px}
#aibar-panel .mint-material-icon{width:55px;height:52px;padding:8px!important}
#aibar-panel .mint-material-detail pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.7 system-ui}
#aibar-panel .mint-status-strip{display:flex;justify-content:space-between;padding:4px 18px 0;font:600 11px system-ui;min-height:19px}
`;panel.append(style);gallery.append(start,imageView,detail);imageView.hidden=true;
        let current='home',query='',randomIds=null;
        const backButton=()=>{const b=targetDoc.createElement('button');b.textContent='‹ 返回';b.onclick=()=>{if(current==='image'){imageView.hidden=true;start.hidden=false;current='home';}else {detail.hidden=true;start.hidden=false;current='home';}};return b;};
        const imageBack=backButton();imageView.prepend(imageBack);
        function showDetail(item){const overlay=targetDoc.createElement('div');overlay.id='mint-confirm';overlay.dataset.theme=isDayTime()?'day':'night';const card=targetDoc.createElement('div');card.className='mint-confirm-card';card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.style.cssText='max-height:85dvh;overflow:auto;text-align:left';const h=targetDoc.createElement('h3');h.textContent=item.name;const pre=targetDoc.createElement('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.7 system-ui';pre.textContent=item.content;const close=targetDoc.createElement('button');close.textContent='关闭';close.onclick=()=>overlay.remove();card.append(h,pre,close);overlay.append(card);targetDoc.body.append(overlay);close.focus();}
        function render(){
            detail.replaceChildren();detail.append(backButton());const h=targetDoc.createElement('h2');h.textContent=current==='skill'?'Skill':'SVG';detail.append(h);
            const search=targetDoc.createElement('input');search.type='search';search.placeholder=current==='skill'?'搜索风格':'搜索图标';search.value=query;detail.append(search);
            const actions=targetDoc.createElement('div');actions.className='mint-row';const clear=targetDoc.createElement('button');clear.textContent='清除选择';clear.onclick=async()=>{materialSelection[current==='skill'?'styles':'icons']=[];if(current==='skill'){skillBook.items.forEach(v=>v.enabled=false);await saveSkillBook();await renderSkillBook(panel);}await saveMaterialSelection();render();};actions.append(clear);
            if(current==='skill'){const random=targetDoc.createElement('button');random.textContent='随机推荐';random.onclick=()=>{randomIds=[...MINT_STYLE_CATALOG].sort(()=>Math.random()-.5).slice(0,6).map(x=>x.id);query='';render();};actions.append(random);const all=targetDoc.createElement('button');all.textContent='全部';all.onclick=()=>{randomIds=null;render();};actions.append(all);}
            detail.append(actions);
            const grid=targetDoc.createElement('div');grid.className='mint-material-grid';detail.append(grid);
            function paint(){grid.replaceChildren();if(current==='skill'){
                for(const item of skillBook.items.filter(v=>materialMatches(v.name+' '+v.content,search.value))){
                    const b=targetDoc.createElement('button');b.textContent=item.name;b.setAttribute('aria-pressed',String(item.enabled));b.onclick=async()=>{item.enabled=!item.enabled;await saveSkillBook();await renderSkillBook(panel);b.setAttribute('aria-pressed',String(item.enabled));};grid.append(b);
                    const info=targetDoc.createElement('button');info.textContent='查看';info.setAttribute('aria-label','查看 '+item.name);info.onclick=()=>showDetail(item);grid.append(info);
                }
                for(const item of MINT_STYLE_CATALOG.filter(v=>(!randomIds||randomIds.includes(v.id))&&materialMatches(v.name+' '+v.keywords,search.value))){
                    const b=targetDoc.createElement('button');b.textContent=item.name;b.setAttribute('aria-pressed',String(materialSelection.styles.includes(item.id)));b.onclick=async()=>{const arr=materialSelection.styles;const i=arr.indexOf(item.id);i<0?arr.push(item.id):arr.splice(i,1);await saveMaterialSelection();b.setAttribute('aria-pressed',String(i<0));};grid.append(b);
                    const info=targetDoc.createElement('button');info.textContent='查看';info.setAttribute('aria-label','查看 '+item.name);info.onclick=()=>showDetail(item);grid.append(info);
                }
            }else{
                const names=Object.keys(MINT_ICON_CATALOG).filter(name=>materialMatches(name+' '+MINT_ICON_CATALOG[name].keywords.join(' '),search.value)).slice(0,180);
                for(const name of names){const b=targetDoc.createElement('button');b.className='mint-material-icon';b.innerHTML=materialSvg(name);b.title=name;b.setAttribute('aria-label',name);b.setAttribute('aria-pressed',String(materialSelection.icons.includes(name)));b.onclick=async()=>{const a=materialSelection.icons,i=a.indexOf(name);if(i<0){if(a.length>=12){toast('最多选择12个图标','warning');return;}a.push(name);}else a.splice(i,1);await saveMaterialSelection();b.setAttribute('aria-pressed',String(i<0));};grid.append(b);}
            }}
            search.addEventListener('input',()=>{query=search.value;paint();});paint();
        }
        tabs.addEventListener('click',e=>{const key=e.target.closest('button')?.dataset.materialOpen;if(!key)return;current=key;query='';randomIds=null;start.hidden=true;if(key==='image'){imageView.hidden=false;}else{detail.hidden=false;render();}});
        void getConfig(MATERIAL_SELECTION_KEY).then(x=>{if(x&&Array.isArray(x.styles)&&Array.isArray(x.icons))materialSelection={styles:x.styles.filter(id=>MINT_STYLE_CATALOG.some(v=>v.id===id)),icons:x.icons.filter(id=>MINT_ICON_CATALOG[id]).slice(0,12)};});
        const go=panel.querySelector('#mint-image-plan')?.previousElementSibling;if(go)go.addEventListener('click',()=>{start.hidden=true;detail.hidden=true;imageView.hidden=false;current='image';});
        const inspect=targetDoc.createElement('button');inspect.type='button';inspect.textContent='查看输入与输出';inspect.onclick=()=>{if(!mintLastRequest){toast('还没有生成记录','info');return;}const data=mintLastRequest;showDetail({name:'本次输入与输出',content:'输入 '+Array.from(data.input).length+' 字符'+(data.imageCount?'，参考图片 '+data.imageCount+' 张':'')+'\n\n'+data.input+'\n\n输出 '+Array.from(data.output).length+' 字符\n\n'+data.output});};panel.querySelector('#mint-status-slot').append(inspect);
        const counts=targetDoc.createElement('label');counts.className='mint-form-label';counts.textContent='生成方案数量';const select=targetDoc.createElement('select');select.id='mint-variant-count';select.style.width='100%';for(const n of [1,2,3]){const o=targetDoc.createElement('option');o.value=String(n);o.textContent=n+' 个方案';select.append(o);}counts.append(select);panel.querySelector('#mint-generate-slot').before(counts);const variants=targetDoc.createElement('div');variants.id='mint-variant-picks';variants.className='mint-material-grid';panel.querySelector('#mint-result-slot').before(variants);
        const strip=targetDoc.createElement('div');strip.className='mint-status-strip';strip.innerHTML='<time aria-label="本地时间"></time><span></span>';panel.prepend(strip);
        const time=strip.querySelector('time'),battery=strip.querySelector('span');const tick=()=>{if(strip.isConnected)time.textContent=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});};tick();const timer=setInterval(()=>{if(!strip.isConnected){clearInterval(timer);return;}tick();},30000);
        if(typeof targetWindow.navigator.getBattery==='function'){targetWindow.navigator.getBattery().then(b=>{const update=()=>{if(strip.isConnected)battery.textContent=Math.round(b.level*100)+'%';};update();b.addEventListener('levelchange',update);}).catch(()=>{});}
    }
