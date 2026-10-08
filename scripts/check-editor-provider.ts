import {loadEnv} from 'vite';
import {verifyEditorSnapshot, type EditorCalendarSnapshot} from '../src/calendar/api/editor-snapshot';

// Run before publishing the editor: keep the current site if the provider is not ready.
const config = loadEnv('production', process.cwd(), 'PUBLIC_API_URL');
const origin = new URL(config.PUBLIC_API_URL || '');
if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid PUBLIC_API_URL origin');
const url = new URL('/api/v1/calendar/editor-year?year=2027&lang=ru&profile=typikon-strict', origin);
const response = await fetch(url, {headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(90000)});
if (!response.ok) throw new Error(`BibleDesktop editor API is not ready: HTTP ${response.status}`);
const snapshot = await response.json() as EditorCalendarSnapshot;
await verifyEditorSnapshot(snapshot);
if (snapshot.request.year !== 2027 || snapshot.request.lang !== 'ru') throw new Error('Incorrect calendar request tuple');
console.log(`PASS ${origin.origin}: hash-verified 2027 editor snapshot, ${snapshot.calendar.days.length} days, both fasting profiles`);
