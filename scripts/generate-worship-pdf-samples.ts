import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { exportWorshipPdf, type WorshipPdfSnapshot, type WorshipPdfBlock } from '../src/export/worship-pdf';
import { sourceBookIndex } from '../public/calendar-ui/book-library.js';

// Read-only local captures. No API requests, source alteration or invented hymns.
const backend = process.argv[2];
if (!backend) throw new Error('Pass the local BibleDesktop root for read-only source samples');
const read = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const fontBytes = { civil: await readFile('public/fonts/DejaVuSerif.ttf'), cu: await readFile('public/fonts/Ponomar-Regular.ttf'), fallback: await readFile('public/fonts/DejaVuSans.ttf') };
const labels = { contents: 'Оглавление', sources: 'Источники', incomplete: 'Это книжный текст или частичный состав, а не подтверждённая служба дня.', page: 'Страница' };
function block(source: any, language: string): WorshipPdfBlock {
  return { kind: source.kind === 'heading' ? 'heading' : 'paragraph', language, role: source.role,
    runs: source.segments.map((s: any) => ({ text: s.text, rubric: s.style === 'rubric' || source.kind === 'rubric' || source.role === 'rubric' })) };
}
function templateSnapshot(template: any, title: string, fallbackLanguage: string): WorshipPdfSnapshot {
  const names: Record<string, string> = { 'liturgy-basil-great': 'Литургия Василия Великого', 'liturgy-john-chrysostom': 'Литургия Иоанна Златоуста', 'horologion-cas-tretii': 'Третий час', 'horologion-cas-sestoi': 'Шестой час', 'horologion-posledovanie-izobrazitelnyx': 'Изобразительны', 'sluzhebnik-daily-dismissals': 'Отпусты дневные', 'horologion-velikoe-povecerie': 'Великое повечерие' };
  return { kind: 'dated-service', title, information: ['Локальный образец PDF из сохранённого источника Bible Desktop.'], status: 'Постоянная основа - назначения дня не подтверждены', complete: false,
    warnings: ['Обязательные вставки и условия исполнения не выбраны. Условные варианты не включены.'], labels,
    sourceMetadata: template.sourceVersions,
    sources: template.sourceVersions.map((s: any) => `${names[s.work] || title}${s.source?.url ? ' - ' + s.source.url : ''}`),
    blocks: template.nodes.flatMap((node: any) => node.kind === 'slot'
      ? [{ kind: 'warning', runs: [{ text: 'Обязательное место не назначено.' }] }]
      : (node.blocks || []).map((b: any) => block(b, node.language || template.language || fallbackLanguage))) };
}
const hourRaw = await read('tmp/worship-parts/sixth-hour-template.json');
const hour = hourRaw.data || hourRaw;
const basilRaw = await read(resolve(backend, 'storage/app/worship-research/additional-fixed-runtime/api/basil-template.json'));
const corpus = (await read(resolve(backend, 'resources/data/worship/annual-source-readers/octoechos-corpus-corpus.json'))).works[0];
const bookIndex = sourceBookIndex({ slug: corpus.slug, blocks: corpus.versions.cu });
const navigation: NonNullable<WorshipPdfSnapshot['navigation']> = [];
for (const tone of bookIndex.tones) {
  navigation.push({ blockIndex: tone.index, title: tone.text, language: 'cu' });
  const seen = new Set<number>();
  for (const heading of bookIndex.headings.filter((h: any) => h.index > tone.index && h.index < tone.end && h.weekday)) {
    if (seen.has(heading.weekday)) continue;
    seen.add(heading.weekday);
    navigation.push({ blockIndex: heading.index, title: `${tone.text} / ${heading.text}`, language: 'cu' });
  }
}
const samples: [string, WorshipPdfSnapshot][] = [
  ['sixth-hour-civil', templateSnapshot(hour, 'Шестой час', 'cu-civil')],
  ['basil-cu', templateSnapshot(basilRaw.data || basilRaw, 'Литургия Василия Великого', 'cu')],
  ['octoechos-cu', { kind: 'book', title: corpus.title, information: ['Церковнославянское издание. Ponomar.'], status: 'Полный исходный текст Октоиха', complete: false,
    warnings: [], sources: [`Октоих. Ponomar - ${corpus.url}`], sourceMetadata: { sourceHash: corpus.source_hash, url: corpus.url }, labels, navigation, blocks: corpus.versions.cu.map((b: any) => block(b, 'cu')) }],
];
await mkdir('output/pdf', { recursive: true });
for (const [name, snapshot] of samples) {
  if (process.argv[3] && process.argv[3] !== name) continue;
  const before = performance.now();
  const result = await exportWorshipPdf(snapshot, { fontBytes });
  await writeFile(`output/pdf/${name}.pdf`, result.bytes);
  await writeFile(`output/pdf/${name}.expected.json`, JSON.stringify(snapshot));
  console.log(JSON.stringify({ sample: name, pages: result.pageCount, bytes: result.bytes.length, seconds: Math.round((performance.now() - before) / 1000), memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024) }));
}
