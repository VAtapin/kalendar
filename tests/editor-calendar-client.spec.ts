import {beforeEach, describe, expect, it, vi} from 'vitest';
import {editorSnapshotFixture} from './fixtures/editor-calendar-snapshot';

vi.mock('../src/persistence/project-storage', () => ({loadCachedCalendarSnapshot: vi.fn(async () => undefined), saveCachedCalendarSnapshot: vi.fn(async () => undefined)}));
import {loadCachedCalendarSnapshot} from '../src/persistence/project-storage';
import {loadEditorCalendar} from '../src/calendar/api/editor-calendar-client';

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', vi.fn()); });
describe('BibleDesktop editor calendar client', () => {
  it('opens a saved project offline without fetching or automatically refreshing it', async () => {
    const saved = {fetchedAt: '2026-10-08T12:00:00.000Z', snapshot: await editorSnapshotFixture()};
    await expect(loadEditorCalendar({year: 2027, language: 'ru', saved})).resolves.toBe(saved);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses cached public data offline and switches profile without a new network request', async () => {
    const saved = {fetchedAt: '2026-10-08T12:00:00.000Z', snapshot: await editorSnapshotFixture()};
    vi.mocked(loadCachedCalendarSnapshot).mockResolvedValueOnce(saved);
    expect(await loadEditorCalendar({year: 2027, language: 'ru', profile: 'parish'})).toBe(saved);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('fetches only BibleDesktop and verifies schema/hash before use', async () => {
    const snapshot = await editorSnapshotFixture();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(snapshot)));
    const saved = await loadEditorCalendar({year: 2027, language: 'ru', refresh: true});
    expect(saved.snapshot).toEqual(snapshot);
    const url = new URL(String(vi.mocked(fetch).mock.calls[0]?.[0]));
    expect(url.origin).toBe(__PUBLIC_API_URL__);
    expect(url.pathname).toBe('/api/v1/calendar/editor-year');
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.credentials).toBe('omit');
  });
  it('rejects damaged project data instead of silently replacing a pinned version', async () => {
    const snapshot = await editorSnapshotFixture(); snapshot.engineVersion = 'changed';
    await expect(loadEditorCalendar({year: 2027, language: 'ru', saved: {snapshot, fetchedAt: new Date().toISOString()}})).rejects.toThrow(/контрольная сумма/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('honors Retry-After without replacing the saved snapshot on failure', async () => {
    const saved = {fetchedAt: '2026-10-08T12:00:00.000Z', snapshot: await editorSnapshotFixture()};
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', {status: 429, headers: {'Retry-After': '30'}}));
    await expect(loadEditorCalendar({year: 2027, language: 'ru', saved, refresh: true})).rejects.toThrow(/ограничило/);
    await expect(loadEditorCalendar({year: 2028, language: 'ru', refresh: true})).rejects.toThrow(/ограничило/);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(saved.snapshot.request.year).toBe(2027);
  });
});
