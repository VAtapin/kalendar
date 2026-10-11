import assert from 'node:assert/strict';
import {readPo} from './wordpress-po.mjs';

// Pass a fresh POT generated with the official `wp i18n make-pot` command.
const originals=readPo(process.argv[2]||'wordpress/orthocal/languages/georg-kloster-calendar-workshop.pot').filter(e=>e.msgid);
const key=e=>(e.msgctxt||'')+'\u0004'+e.msgid;
const expected=originals.map(key).sort();
assert.equal(originals.length,441);
assert.equal(originals.some(e=>/[А-Яа-яЁёІіЇїЄє]/.test(e.msgid)),false,'Source strings must use US English');
for(const locale of ['ru_RU','de_DE','uk','pl_PL']) {
  const entries=readPo('wordpress/orthocal/languages/georg-kloster-calendar-workshop-'+locale+'.po').filter(e=>e.msgid);
  assert.deepEqual(entries.map(key).sort(),expected,locale+' extraction coverage');
  assert.equal(entries.some(e=>!e.msgstr),false,locale+' missing translations');
}
assert.ok(originals.some(e=>e.msgid==='January'&&e.msgctxt==='date month'));
assert.ok(originals.some(e=>e.msgid==='January'&&e.msgctxt==='month name'));
console.log('PASS US English originals, 441/441 translations in four locales and separate month contexts');
