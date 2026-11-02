const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/10-regex-preview.part.js'),'utf8');
const ctx={generateUUID:()=> 'filter-id'};vm.createContext(ctx);vm.runInContext(source+'\nthis.make=makeStatusFilter;',ctx);
const pattern='/〔([^｜|\\-\\n]+?)\\s*[｜|\\-]\\s*([^｜|\\-\\n]+?)\\s*[｜|\\-]\\s*([^｜|\\-\\n]+?)\\s*[｜|\\-]\\s*([^｜|\\-\\n]+?)(?:\\s*[｜|\\-]\\s*([^｜|\\-〕\\n]+?))?(?:\\s*[｜|\\-]\\s*([^〕\\n]+?))?〕/';
function regex(rule){const end=rule.find_regex.lastIndexOf('/');return new RegExp(rule.find_regex.slice(1,end),rule.find_regex.slice(end+1));}
test('chapter bracket filter keeps original source and removes four to six fields only',()=>{
 const rule=ctx.make(pattern,'章节状态栏',1,'character');assert.equal(rule.find_regex,pattern+'g');assert.equal(rule.min_depth,3);assert.equal(rule.destination.prompt,true);assert.equal(rule.destination.display,false);assert.equal(rule.replace_string,'');
 for(const status of ['〔第一章｜黄昏｜书店｜微雨〕','〔第一章|黄昏|书店|微雨|题记〕','〔第一章｜黄昏｜书店｜微雨｜题记｜来源〕'])assert.equal(('前文\n'+status+'\n后文').replace(regex(rule),''),'前文\n\n后文');
 for(const text of ['〔这是普通旁白〕','正文第一段\n正文第二段','〔一｜二〕'])assert.equal(text.replace(regex(rule),''),text);
});
test('original non-global flags are retained and multiple status matches are removed',()=>{const rule=ctx.make('/〔a\\|b〕/i','test',0,'global');assert.equal(rule.find_regex,'/〔a\\|b〕/gi');assert.equal(rule.min_depth,0);assert.equal('前〔A|B〕中〔a|b〕后'.replace(regex(rule),''),'前中后');});
test('bracket support does not accept missing boundaries or arbitrary matchers',()=>{for(const p of ['/〔.+/','/.+〕/','/[\\s\\S]+/'])assert.throws(()=>ctx.make(p,'test',1,'character'),e=>e.code==='UNSUPPORTED_STATUS_FILTER');});
