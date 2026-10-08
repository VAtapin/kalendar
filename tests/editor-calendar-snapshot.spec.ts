import {describe, expect, it} from 'vitest';
import {assertEditorSnapshot, canonicalSnapshot, snapshotCalendar, snapshotDate, verifyEditorSnapshot} from '../src/calendar/api/editor-snapshot';
import {resolveFoodRule} from '../src/calendar/presentation/fasting';
import {localizeCalendarEvent} from '../src/calendar/localization/calendar-language';
import {createBlankCalendarProject} from '../src/document/factories';
import {createProjectArchive, normalizeCalendarProject, parseProjectArchive} from '../src/persistence/project-storage';
import {ProjectHistoryCodec} from '../src/persistence/project-history';
import {cloneProjectForYear} from '../src/templates/project-templates';
import {editorSnapshotFixture, signEditorFixture} from './fixtures/editor-calendar-snapshot';

describe('pinned BibleDesktop calendar snapshots', () => {
  it('matches UTF-8 key ordering and PHP JSON line separators', () => {
    expect(canonicalSnapshot({'\u{10000}': [2, 1], '\ue000': '\u2028'})).toBe('{"\ue000":"\\u2028","\u{10000}":[2,1]}');
  });
  it('uses supplied rules for both profiles without recalculating weekdays', async () => {
    const snapshot = await editorSnapshotFixture();
    await verifyEditorSnapshot(snapshot);
    const year = snapshotCalendar(snapshot), day = year.days[0]!;
    expect(resolveFoodRule(day).id).toBe('dry-eating');
    expect(resolveFoodRule(day, 'parish').id).toBe('fish');
    expect(year.daysByIsoDate[day.isoDate]).toBe(day);
    day.fastingByProfile!['typikon-strict']!.memorial = true;
    expect(resolveFoodRule({...day}).id).toBe('memorial');
  });
  it('retains raw titles for policy and uses supplied translations/short forms in print', async () => {
    const snapshot = await editorSnapshotFixture();
    snapshot.request.lang = 'de';
    const date = snapshot.calendar.days[0]!.date;
    snapshot.calendar.days[0]!.events.push({id: 'test', sourceId: 'source', sourceIndex: 1,
      title: 'Исходное название', apiLocalization: {language: 'de', status: 'exact', title: 'API Übersetzung', shortTitle: 'API kurz', veryShortTitle: 'API'},
      typeCode: 1, priority: 925, ruleKind: 'fixed-julian', occurrenceDate: date, spanStart: date,
      spanFinish: date, dayIndexInSpan: 0});
    await signEditorFixture(snapshot); await verifyEditorSnapshot(snapshot);
    const event = snapshotCalendar(snapshot).days[0]!.events[0]!;
    expect(event.title).toBe('Исходное название');
    expect(localizeCalendarEvent(event, 'de')).toMatchObject({title: 'API Übersetzung', shortTitle: 'API kurz', veryShortTitle: 'API'});
  });
  it('rejects modified, partial and future-schema snapshots', async () => {
    const snapshot = await editorSnapshotFixture();
    snapshot.fastingByDate['2027-01-01']!.parish.reason = 'changed';
    await expect(verifyEditorSnapshot(snapshot)).rejects.toThrow(/контрольная сумма/);
    snapshot.calendar.days.pop();
    expect(() => assertEditorSnapshot(snapshot)).toThrow(/неполный год/);
    expect(() => assertEditorSnapshot({...snapshot, schemaVersion: 2})).toThrow(/Неподдерживаемый/);
  });
  it('preserves pinned data in archives/normalization and strips only transient legacy data', async () => {
    const project = createBlankCalendarProject();
    project.calendarSnapshot = {fetchedAt: '2026-10-08T12:00:00.000Z', snapshot: await editorSnapshotFixture()};
    project.calendarData = {transient: true};
    const archive = createProjectArchive(project);
    expect(archive.project.calendarData).toBeNull();
    expect(parseProjectArchive(JSON.parse(JSON.stringify(archive)))?.calendarSnapshot).toEqual(project.calendarSnapshot);
    const old = createBlankCalendarProject();
    expect(normalizeCalendarProject(old).calendarSnapshot).toBeUndefined();
    expect(cloneProjectForYear(project, 2028).calendarSnapshot).toBeUndefined();
  });
  it('pools snapshots in undo history, restores the exact version, then prunes it', async () => {
    const project = createBlankCalendarProject();
    project.calendarSnapshot = {fetchedAt: '2026-10-08T12:00:00.000Z', snapshot: await editorSnapshotFixture()};
    const codec = new ProjectHistoryCodec();
    project.name = 'history-calendar:1';
    const serialized = codec.serialize(project);
    expect(serialized.length).toBeLessThan(30000);
    expect(codec.deserialize(serialized).calendarSnapshot).toEqual(project.calendarSnapshot);
    expect(codec.deserialize(serialized).name).toBe('history-calendar:1');
    delete project.calendarSnapshot; codec.prune([], project);
    expect(() => codec.deserialize(serialized)).toThrow(/календарный снимок/);
  });
  it('accepts Julian leap days in Gregorian non-leap centuries', async () => {
    expect(snapshotDate('2100-02-29', true)).toEqual({year: 2100, month: 2, day: 29});
    expect(() => snapshotDate('2100-02-29')).toThrow();
    const snapshot = await editorSnapshotFixture(2100);
    await verifyEditorSnapshot(snapshot);
    expect(snapshotCalendar(snapshot).days.some(day => day.oldStyleDate.month === 2 && day.oldStyleDate.day === 29)).toBe(true);
  });
});
