import assert from 'node:assert/strict';
import {readPo,compileMo} from './wordpress-po.mjs';

const root='docs/translations/wordpressorg';
const key=entry=>(entry.msgctxt??'')+'\u0004'+entry.msgid;
const catalogues=['stable-1.3.78-uk.po','stable-readme-1.3.78-uk.po'];
const patterns={
  placeholders:/%(?:\d+\$)?[-+0 '#]*\d*(?:\.\d+)?[a-zA-Z]|%\([^)]+\)[a-zA-Z]/g,
  urls:/https?:\/\/[^\s<>"\\]+/g,
  shortcodes:/\[orthocal_[^\]]*\]/g,
  parameters:/\b[a-z_]+="[^"]*"/g,
  html:/<\/?[a-zA-Z][^>]*>/g,
  dates:/YYYY-MM-DD/g,
  paths:/\b(?:assets|scripts|uploads)\/[A-Za-z0-9_./*-]+/g,
};
for(const [index,file] of catalogues.entries()){
  const rows=readPo(`${root}/${file}`),entries=rows.filter(e=>e.msgid);
  const baseline=index===0?'wordpress/orthocal/languages/georg-kloster-calendar-workshop-uk.po':`${root}/stable-readme-1.3.78-ru.po`;
  const expected=index===0?441:67;
  assert.equal(entries.length,expected,'Catalogue coverage');
  assert.equal(new Set(entries.map(key)).size,expected,'Duplicate keys');
  assert.deepEqual(entries.map(key).sort(),readPo(baseline).filter(e=>e.msgid).map(key).sort(),'Originals/contexts');
  for(const entry of entries){
    assert.ok(entry.msgstr.trim(),`Empty: ${entry.msgid}`);
    assert.ok(!entry.comments.some(x=>/^#,.*\bfuzzy\b/.test(x)),`Fuzzy: ${entry.msgid}`);
    for(const [name,pattern] of Object.entries(patterns)){
      const tokens=text=>(text.match(pattern)??[]).map(x=>['urls','paths'].includes(name)?x.replace(/[.,;:]+$/,''):x).sort();
      assert.deepEqual(tokens(entry.msgstr),tokens(entry.msgid),`${name}: ${entry.msgid}`);
    }
    assert.ok(!/РРРР-ММ-ДД|[Шш]орткод|\bslug\b|адмінці/.test(entry.msgstr),`Format/glossary: ${entry.msgid}`);
    assert.ok(!/\d (?:МБ|КБ)(?=[.,;\s]|$)/u.test(entry.msgstr),`Unit spacing: ${entry.msgid}`);
    if(entry.msgid.startsWith(' '))assert.ok(entry.msgstr.startsWith(' '),`Leading fragment space: ${entry.msgid}`);
    if(entry.msgid.endsWith(' '))assert.ok(entry.msgstr.endsWith(' '),`Trailing fragment space: ${entry.msgid}`);
  }
  assert.equal(compileMo(rows).readUInt32LE(0),0x950412de,'MO compilation');
  console.log(`PASS ${file}: ${expected} complete translations, originals/contexts, technical tokens, glossary, fragment spacing and MO`);
}
const ui=new Map(readPo(`${root}/${catalogues[0]}`).map(e=>[e.msgid,e.msgstr]));
for(const [original,translation] of [
  ['Shortcode generator','Конструктор коротких кодів'],
  ['In a popup','У виринаючому вікні'],
  ['Default calendar language','Початкова мова календаря'],
  ['Check images and fonts','Перевіряти зображення та шрифти'],
  ['Prayers and daily texts for ','Молитви та тексти дня для '],
])assert.equal(ui.get(original),translation,original);

const exports=process.argv.slice(2);
if(exports.length){
  assert.equal(exports.length,4,'Supply Stable, Development, Stable Readme and Development Readme Current exports');
  for(const [index,path] of exports.entries()){
    const local=readPo(`${root}/${catalogues[index<2?0:1]}`).filter(e=>e.msgid);
    const exported=readPo(path).filter(e=>e.msgid);
    assert.equal(exported.length,local.length,'Current export coverage');
    const map=new Map(exported.map(e=>[key(e),e.msgstr]));
    assert.equal(map.size,local.length,'Unique export keys');
    for(const row of local)assert.equal(map.get(key(row)),row.msgstr,`Approved translation differs: ${row.msgid}`);
    console.log(`PASS Current export ${index+1}: ${exported.length} translations exactly match reviewed catalogue`);
  }
}
