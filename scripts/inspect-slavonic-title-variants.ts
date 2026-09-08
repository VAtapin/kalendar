import { readFileSync } from 'node:fs';
import { parseMemoryDaysXml } from '../src/calendar/xml/parse-memory-days';
import { slavonicSourceKey, installSlavonicCorpus } from '../src/calendar/localization/slavonic-corpus';
import { localizeCalendarEventTitleWithStatus } from '../src/calendar/localization/calendar-language';
// Read-only candidate report. This does not admit translations or change titles.
const substitutions: [RegExp,string][] = [
  [/(?<!\p{L})архиепископа(?!\p{L})/gu, 'архиеп.'],
  [/(?<!\p{L})епископа(?!\p{L})/gu, 'еп.'],
  [/(?<!\p{L})митрополита(?!\p{L})/gu, 'митр.'],
  [/(?<!\p{L})священномученика(?!\p{L})/gu, 'сщмч.'],
  [/(?<!\p{L})великомученика(?!\p{L})/gu, 'вмч.'],
  [/(?<!\p{L})великомученицы(?!\p{L})/gu, 'вмц.'],
  [/(?<!\p{L})преподобного(?!\p{L})/gu, 'прп.'],
  [/(?<!\p{L})преподобной(?!\p{L})/gu, 'прп.'],
];
function key(value:string) {
  value = value.toLowerCase().replace(/\(\s*†\s*(?=\d)/gu,'(');
  for(const [pattern,replacement] of substitutions) value=value.replace(pattern,replacement);
  return slavonicSourceKey(value);
}
const sources=JSON.parse(readFileSync('tmp/xml-independent-audit/source-names.json','utf8')) as {cid:string;ru:{text:string;condition?:string}[];cu:{text:string;condition?:string}[]}[];
const byKey=new Map<string,{sourceId:string;ru:string;cu:string}[]>();
for(const source of sources) for(const ru of source.ru) {
  const candidateKey=key(ru.text);
  for(const cu of source.cu.filter(c=>c.condition===ru.condition)) {
    byKey.set(candidateKey,[...(byKey.get(candidateKey)??[]),{sourceId:source.cid,ru:ru.text,cu:cu.text}]);
  }
}
installSlavonicCorpus(JSON.parse(readFileSync('public/data/church-slavonic/catalogue.json','utf8')));
for(const record of parseMemoryDaysXml(readFileSync('public/data/MemoryDays.xml','utf8')).records) {
  if(record.typeCode>=200 || [10,20,100].includes(record.typeCode) || localizeCalendarEventTitleWithStatus(record.title,'cu').status!=='source-fallback') continue;
  const candidates=(byKey.get(key(record.title))??[]).filter(c=>slavonicSourceKey(c.ru)!==slavonicSourceKey(record.title));
  if(candidates.length) console.log(JSON.stringify({index:record.sourceIndex,title:record.title,candidates}));
}
