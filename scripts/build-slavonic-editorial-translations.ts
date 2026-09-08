import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseMemoryDaysXml} from '../src/calendar/xml/parse-memory-days';
import {churchSlavonicTechnicalIssues} from './lib/calendar-source-audit';
const xml=readFileSync('public/data/MemoryDays.xml','utf8');
const batch=JSON.parse(readFileSync('scripts/data/slavonic-editorial-translations.json','utf8')) as {xmlSha256:string;entries:[number,string][]};
if(createHash('sha256').update(xml).digest('hex')!==batch.xmlSha256) throw new Error('XML changed: review editorial CU source associations');
const records=parseMemoryDaysXml(xml).records;
const dictionary:Record<string,string>={};
for(const [index,cu] of batch.entries) {
  const record=records.find(r=>r.sourceIndex===index);
  if(!record || !cu.trim() || churchSlavonicTechnicalIssues(cu).length
    || JSON.stringify(record.title.match(/\d+/g)??[])!==JSON.stringify(cu.match(/\d+/g)??[])) throw new Error(`Invalid editorial CU translation ${index}`);
  // Roman centuries are retained from XML; all other Latin letters are mistakes.
  const nonRoman = cu.replace(/\b[IVXLCDM]+\b/g, '');
  if(/\p{Script=Latin}/u.test(nonRoman)) throw new Error(`Latin letter in editorial CU translation ${index}`);
  for(const word of cu.match(/[\p{L}\p{M}]+/gu)??[]) {
    if((word.match(/[\u0300\u0301\u0311]/g)??[]).length>1) throw new Error(`Multiple stress marks in editorial CU translation ${index}: ${word}`);
  }
  if(JSON.stringify(record.title.match(/\b[IVXLCDM]+\b/g)??[])!==JSON.stringify(cu.match(/\b[IVXLCDM]+\b/g)??[])) throw new Error(`Roman century changed in editorial CU translation ${index}`);
  if(Object.hasOwn(dictionary,record.title)&&dictionary[record.title]!==cu) throw new Error(`Conflicting editorial CU title ${index}`);
  dictionary[record.title]=cu;
}
writeFileSync('src/calendar/localization/slavonic-editorial-titles.json',JSON.stringify(dictionary,null,2)+'\n');
console.log(`Generated ${Object.keys(dictionary).length} editorial CU titles`);
