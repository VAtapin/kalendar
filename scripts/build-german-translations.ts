import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseMemoryDaysXml } from '../src/calendar/xml/parse-memory-days';
// Pin numeric source indexes to the reviewed XML revision. A changed XML must
// be reviewed, not silently re-associated with a different person's translation.
const xml = readFileSync('public/data/MemoryDays.xml','utf8');
const batch = JSON.parse(readFileSync('scripts/data/german-translations-02.json','utf8')) as {xmlSha256:string;entries:[number,string][]};
if (createHash('sha256').update(xml).digest('hex') !== batch.xmlSha256) throw new Error('XML changed: review German source associations before rebuilding');
const records = parseMemoryDaysXml(xml).records;
const dictionary:Record<string,string> = {};
for (const [index,de] of batch.entries) {
  const record = records.find(r=>r.sourceIndex===index);
  if (!record || !de.trim() || /\p{Script=Cyrillic}/u.test(de)
    || JSON.stringify(record.title.match(/\d+/g) ?? []) !== JSON.stringify(de.match(/\d+/g) ?? [])) throw new Error(`Invalid German translation ${index}`);
  if (Object.hasOwn(dictionary,record.title) && dictionary[record.title]!==de) throw new Error(`Conflicting German translation ${index}`);
  dictionary[record.title]=de;
}
writeFileSync('src/calendar/localization/german-additions.json', JSON.stringify(dictionary,null,2)+'\n');
console.log(`Generated ${Object.keys(dictionary).length} complete German titles`);
