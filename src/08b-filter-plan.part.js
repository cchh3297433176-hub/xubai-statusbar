    const GENERATED_FILTER_CHECK_PROMPT = `【配套发送过滤】用户已勾选生成配套发送过滤。美化与过滤必须使用同一条 FINDREGEX，过滤仅将匹配到的完整状态栏替换为空字符串，不得把正文包含在匹配范围内。不能依赖替换成HTML后再识别状态栏。不需要另写一条不同的过滤正则，插件会复用 FINDREGEX 并添加全局匹配。
在 FORMATGUIDE 后、END 前增加独占一行的 ===FILTERCHECK===，下一行输出JSON对象：{"statusSamples":["完整的状态栏原文样例1","字段内容不同的状态栏原文样例2"],"proseSamples":["不包含状态栏的正常正文1","不包含状态栏的正常正文2"]}。
statusSamples必须是FINDREGEX能完整匹配的原始文本，不能填HTML成品；至少两条不同的状态栏样例。proseSamples至少两条不同的普通正文。匹配条件必须允许保留状态栏前后相邻的正文，不得使用吞掉整段回复的宽泛匹配。四组样例会由插件实际执行校验。`;
    function generatedFilterPlan(findRegex, checkText) {
        const plan={version:1,findRegex:String(findRegex || ''),valid:false,checks:null,error:''};
        try {
            const checks=typeof checkText==='string'?JSON.parse(stripCodeFence(checkText)):checkText;
            const validList=value=>Array.isArray(value)&&value.length>=2&&value.length<=6&&value.every(s=>typeof s==='string'&&s.length>0&&s.length<=4096)&&new Set(value).size>=2;
            if(!checks || !validList(checks.statusSamples) || !validList(checks.proseSamples)) throw new Error('AI未提供至少两条不同的状态栏样例和两条正文样例');
            const re=parseRegexString(findRegex);
            if(!re)throw new Error('美化匹配表达式无效');
            const replace=text=>{re.lastIndex=0;return text.replace(re,'');};
            const probe='窗外传来脚步声，屋内的人放下手中的书。\n他走向门口，故事仍在继续。';
            for(const text of [probe,...checks.proseSamples]){
                re.lastIndex=0;if(re.test(text))throw new Error('匹配条件会命中普通正文');
            }
            for(const sample of checks.statusSamples){
                re.lastIndex=0;const match=re.exec(sample);
                if(!match || match.index!==0 || match[0]!==sample || !match[0].length)throw new Error('状态栏样例不能被完整匹配');
                const before=probe+'\n',after='\n'+probe;
                // A placement may be excluded by an anchor; every placement that DOES match must preserve prose.
                let adjacentMatched=false;
                for(const [input,expected] of [[before+sample,before],[sample+after,after]]){
                    re.lastIndex=0;
                    if(re.test(input)){
                        adjacentMatched=true;
                        if(replace(input)!==expected)throw new Error('过滤会删除相邻正文');
                    }
                }
                if(!adjacentMatched)throw new Error('无法在保留相邻正文的情况下过滤状态栏');
            }
            plan.checks={statusSamples:[...checks.statusSamples],proseSamples:[...checks.proseSamples]};plan.valid=true;
        }catch(error){plan.error=error.message || String(error);}
        return plan;
    }
    function generatedFilterStatus(result) {
        if(!result?.filterRequested)return '';
        return result.filterPlan?.valid?'美化已生成；配套发送过滤已通过样例校验。':'美化已生成；配套发送过滤未就绪：'+(result.filterPlan?.error || '缺少校验资料')+'。可先保存美化。';
    }
