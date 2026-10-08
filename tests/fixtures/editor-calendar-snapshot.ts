import {dayOfWeek, enumerateDates, gregorianToJulian, toIsoDate} from '../../src/calendar/date/calendar-date';
import {FOOD_RULES} from '../../src/calendar/fasting/fasting-catalog';
import {canonicalSnapshot, type EditorCalendarSnapshot} from '../../src/calendar/api/editor-snapshot';

/** Contract fixture only; integration checks separately use BibleDesktop's runtime. */
export async function editorSnapshotFixture(year = 2027): Promise<EditorCalendarSnapshot> {
  const days = enumerateDates({year, month: 1, day: 1}, {year, month: 12, day: 31}).map(date => ({
    date: toIsoDate(date), oldStyleDate: toIsoDate(gregorianToJulian(date)), weekday: dayOfWeek(date), events: [],
  }));
  const snapshot: EditorCalendarSnapshot = {
    schemaVersion: 1, engineVersion: '1.0.0', runtimeVersion: 'sha256:' + 'a'.repeat(64),
    datasetVersion: 'sha256:' + 'b'.repeat(64), contentHash: '',
    request: {year, lang: 'ru', selectedProfile: 'typikon-strict'}, calendar: {year, pascha: `${year}-04-01`, days},
    fastingByDate: Object.fromEntries(days.map(day => [day.date, {
      typikonStrict: {foodRule: FOOD_RULES['dry-eating'], memorial: false, reason: 'API strict fixture'},
      parish: {foodRule: FOOD_RULES.fish, memorial: false, reason: 'API parish fixture'},
    }])), fastingProfiles: {
      typikonStrict: {rulesVersion: 'fixture', sourceUrls: []}, parish: {rulesVersion: 'fixture', sourceUrls: []},
    }, diagnostics: [], statistics: {recordCount: 0},
  };
  return signEditorFixture(snapshot);
}

export async function signEditorFixture(snapshot: EditorCalendarSnapshot): Promise<EditorCalendarSnapshot> {
  const {contentHash: _hash, ...payload} = snapshot;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalSnapshot(payload)));
  snapshot.contentHash = 'sha256:' + Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  return snapshot;
}
