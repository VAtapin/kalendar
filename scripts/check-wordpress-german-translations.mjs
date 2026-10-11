import assert from 'node:assert/strict';
import {readPo,compileMo} from './wordpress-po.mjs';

const root='docs/translations/wordpressorg';
const key=entry=>(entry.msgctxt??'')+'\u0004'+entry.msgid;
const matches=(text,pattern)=>(text.match(pattern)??[]).sort();
const patterns={
  placeholders:/%(?:\d+\$)?[-+0 '#]*\d*(?:\.\d+)?[a-zA-Z]|%\([^)]+\)[a-zA-Z]/g,
  urls:/https?:\/\/[^\s<>"\\]+/g,
  shortcodes:/\[orthocal_[^\]]*\]/g,
  parameters:/\b[a-z_]+="[^"]*"/g,
  html:/<\/?[a-zA-Z][^>]*>/g,
  dates:/YYYY-MM-DD/g,
};

for(const [file,baseline,expected] of [
  ['stable-1.3.78-de.po','../../../wordpress/orthocal/languages/georg-kloster-calendar-workshop-de_DE.po',441],
  ['stable-readme-1.3.78-de.po','stable-readme-1.3.78-ru.po',67],
]){
  const entries=readPo(`${root}/${file}`).filter(e=>e.msgid);
  const originals=readPo(`${root}/${baseline}`).filter(e=>e.msgid);
  assert.equal(entries.length,expected,file);
  assert.equal(new Set(entries.map(key)).size,expected,'Duplicate translation keys');
  assert.deepEqual(entries.map(key).sort(),originals.map(key).sort(),'Originals and contexts must remain unchanged');
  for(const entry of entries){
    assert.ok(entry.msgstr.trim(),`Empty translation: ${entry.msgid}`);
    assert.ok(!entry.comments.some(line=>/^#,.*\bfuzzy\b/.test(line)),`Fuzzy: ${entry.msgid}`);
    for(const [name,pattern] of Object.entries(patterns)){
      const tokens=text=>matches(text,pattern).map(value=>name==='urls'?value.replace(/[.,;:]+$/,''):value).sort();
      assert.deepEqual(tokens(entry.msgstr),tokens(entry.msgid),`${name}: ${entry.msgid}`);
    }
    assert.ok(!/\b(?:Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem)\b/.test(entry.msgstr),`Formal address in default: ${entry.msgid}`);
    assert.ok(!/\b(?:nochmal|fürs|vorm|drauf|Nutzer|Nutzern|Slug)\b/.test(entry.msgstr),`Style/glossary: ${entry.msgid}`);
    assert.ok(!/(?<=[^\s\u00a0])…/.test(entry.msgstr),`Space before ellipsis: ${entry.msgid}`);
    assert.ok(!/\d (?:MB|KB|px|Pixel(?:n)?|%|€)\b/.test(entry.msgstr),`Nonbreaking unit space: ${entry.msgid}`);
    assert.ok(!/\s—\s/.test(entry.msgstr),`German dash: ${entry.msgid}`);
    if(entry.msgid.startsWith(' '))assert.ok(entry.msgstr.startsWith(' '),`Leading fragment space: ${entry.msgid}`);
    if(entry.msgid.endsWith(' '))assert.ok(entry.msgstr.endsWith(' '),`Trailing fragment space: ${entry.msgid}`);
  }
  assert.equal(compileMo(readPo(`${root}/${file}`)).readUInt32LE(0),0x950412de,'MO compilation');
  console.log(`PASS ${file}: ${expected} complete entries; unchanged originals/contexts, placeholders, URLs, shortcodes, parameters, HTML, dates; informal address, glossary and typography; MO compilation`);
}
const ui=new Map(readPo(`${root}/stable-1.3.78-de.po`).map(entry=>[entry.msgid,entry.msgstr]));
assert.equal(ui.get('Reference section'),'Abschnitt des Nachschlagewerks');
assert.equal(ui.get('Site style'),'Website-Stil');
assert.equal(ui.get('In a popup window'),'In einem Pop-up-Fenster');
assert.equal(ui.get('Name or title'),'Name oder Titel');
assert.equal(ui.get('Georg-Kloster Calendar Workshop'),'Georg-Kloster Calendar Workshop');
assert.equal(ui.get('tone '),'Ton ');
console.log('PASS reviewed German terminology and fragment spacing');

// Optional: compare PO exports downloaded from each branch after importing.
const exportedPaths=process.argv.slice(2);
if(exportedPaths.length){
  assert.equal(exportedPaths.length,4,'Supply Stable, Development, Stable Readme and Development Readme exports');
  for(const [index,path] of exportedPaths.entries()){
    const local=readPo(`${root}/${index<2?'stable-1.3.78-de.po':'stable-readme-1.3.78-de.po'}`).filter(e=>e.msgid);
    const proposed=new Map(local.map(e=>[key(e),e.msgstr]));
    const exported=readPo(path).filter(e=>e.msgid);
    assert.equal(exported.length,index<2?441:66,'Waiting export coverage');
    assert.equal(new Set(exported.map(key)).size,exported.length,'Duplicate exported keys');
    for(const entry of exported)assert.equal(entry.msgstr,proposed.get(key(entry)),`Imported translation differs: ${entry.msgid}`);
    if(index>=2)assert.deepEqual(local.filter(e=>!exported.some(row=>key(row)===key(e))).map(e=>[e.msgid,e.msgstr]),[['Georg-Kloster Calendar Workshop','Georg-Kloster Calendar Workshop']],'Only the separately approved plugin name may be absent');
    console.log(`PASS import export ${index+1}: ${exported.length} translations match the reviewed proposal`);
  }
}
