import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {gzipSync, gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {verifyEditorSnapshot, snapshotCalendar, type EditorCalendarSnapshot} from '../src/calendar/api/editor-snapshot';
import {createOrthodoxCalendarApiFromXml} from '../src/calendar/fasting/fasting-api';
import {localizeCalendarEvent} from '../src/calendar/localization/calendar-language';
import {installSlavonicCorpus} from '../src/calendar/localization/slavonic-corpus';
import {resolveFoodRule} from '../src/calendar/presentation/fasting';
import {mergeMonasteryEvents} from '../src/calendar/engine/merge-monastery-events';
import {createBlankCalendarProject} from '../src/document/factories';
import {createProjectArchive, parseProjectArchive} from '../src/persistence/project-storage';
import {createFullCalendarTemplate} from '../src/templates/calendar-templates';

// Fixtures are real PublicCalendarService responses supplied by BibleDesktop.
// --capture only records those responses after WebCrypto/schema validation.
installSlavonicCorpus(JSON.parse(readFileSync('public/data/church-slavonic/catalogue.json', 'utf8')));
const reference = createOrthodoxCalendarApiFromXml(readFileSync('public/data/MemoryDays.xml', 'utf8')).getYear(2027);
for (const language of ['ru', 'de', 'cu', 'uk', 'pl'] as const) {
  const destination = resolve(`tests/fixtures/editor-calendar-2027-${language}.json.gz`);
  const json = process.argv.includes('--capture') ? readFileSync(`tmp/editor-snapshot-2027-${language}.json`)
    : gunzipSync(readFileSync(destination));
  const snapshot = JSON.parse(json.toString('utf8')) as EditorCalendarSnapshot;
  await verifyEditorSnapshot(snapshot);
  assert.equal(snapshot.request.lang, language);
  const calendar = snapshotCalendar(snapshot);
  assert.deepEqual(calendar.pascha, reference.pascha);
  assert.equal(calendar.days.length, reference.days.length);
  for (const [index, expected] of reference.days.entries()) {
    const actual = calendar.days[index]!;
    assert.deepEqual(actual.date, expected.date); assert.deepEqual(actual.oldStyleDate, expected.oldStyleDate);
    assert.equal(actual.weekday, expected.weekday);
    const projection = (event: typeof actual.events[number]) => {
      const display = localizeCalendarEvent(event, language);
      return {id: event.id, title: event.title, sourceId: event.sourceId, sourceIndex: event.sourceIndex,
        typeCode: event.typeCode, priority: event.priority, ruleKind: event.ruleKind, styleToken: event.styleToken,
        occurrenceDate: event.occurrenceDate, spanStart: event.spanStart, spanFinish: event.spanFinish,
        dayIndexInSpan: event.dayIndexInSpan, display: {title: display.title, shortTitle: display.shortTitle,
          veryShortTitle: display.veryShortTitle, description: display.description}};
    };
    assert.deepEqual(actual.events.map(projection), expected.events.map(projection), `${language}: ${actual.isoDate} events`);
    for (const profile of ['typikon-strict', 'parish'] as const) {
      assert.deepEqual(resolveFoodRule(actual, profile), resolveFoodRule(expected, profile), `${language}: ${actual.isoDate} ${profile}`);
    }
  }
  const hash = snapshot.contentHash;
  const withPrivate = mergeMonasteryEvents(calendar, [{id: 'private', title: 'Частный праздник', priority: 2000,
    dateRule: {type: 'annual', month: 10, day: 8}, styleToken: 'monastery-feast'}]);
  assert.equal(withPrivate.daysByIsoDate['2027-10-08']!.events[0]!.title, 'Частный праздник');
  assert.equal(calendar.daysByIsoDate['2027-10-08']!.events.some(event => event.sourceId === 'private'), false);
  assert.equal(snapshot.contentHash, hash);
  const project = createBlankCalendarProject(2027);
  project.calendarLanguage = language;
  project.calendarSnapshot = {fetchedAt: '2026-10-08T12:00:00.000Z', snapshot};
  project.document.pages = createFullCalendarTemplate('A3', 'portrait', 2027, 'Тест');
  const reopened = parseProjectArchive(JSON.parse(JSON.stringify(createProjectArchive(project))))!;
  assert.equal(reopened.calendarSnapshot?.snapshot.contentHash, hash);
  await verifyEditorSnapshot(reopened.calendarSnapshot!.snapshot);
  assert.equal(reopened.document.pages.length, 13);
  if (process.argv.includes('--capture')) writeFileSync(destination, gzipSync(json, {level: 9}));
  console.log(`PASS ${language}: hash, 365 days/events, both profiles, private overlays, 13-page archive; ${json.length} B JSON`);
}
