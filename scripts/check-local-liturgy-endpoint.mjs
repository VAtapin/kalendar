// Readiness probe with an empty invalid request: no names, writes or source publication.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function checkLocalLiturgyEndpoint(base, fetcher = fetch) {
  const url = new URL('/api/v1/liturgical/assignments/liturgy', base), origin = 'https://kalender.georg-kloster.ru';
  const preflight = await fetcher(url, { method: 'OPTIONS', credentials: 'omit', cache: 'no-store',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }, signal: AbortSignal.timeout(20_000) });
  assert.ok([200, 204].includes(preflight.status), 'JSON POST preflight must succeed');
  assert.ok(['*', origin].includes(preflight.headers.get('access-control-allow-origin')), 'Kalendar origin must be allowed');
  const methods = (preflight.headers.get('access-control-allow-methods') || '').split(',').map(value => value.trim().toUpperCase());
  const headers = (preflight.headers.get('access-control-allow-headers') || '').split(',').map(value => value.trim().toLowerCase());
  assert.ok(methods.includes('*') || methods.includes('POST'), 'POST must be allowed');
  assert.ok(headers.includes('*') || headers.includes('content-type'), 'JSON content type must be allowed');
  const response = await fetcher(url, {
    method: 'POST', body: '{}', credentials: 'omit', cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Origin: origin }, signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.status, 422, 'Local POST endpoint must reject the empty JSON request with HTTP 422');
  const cache = response.headers.get('cache-control') || '';
  assert.ok(cache.includes('no-store') && cache.includes('private'), 'Local POST errors must be private and not cached');
  assert.ok(['*', origin].includes(response.headers.get('access-control-allow-origin')), 'POST validation must be readable by Kalendar');
  const value = await response.json();
  assert.ok(value.errors && typeof value.errors === 'object' && !value.data, 'Local POST validation must not return service data');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkLocalLiturgyEndpoint(process.argv[2] || 'https://bible-desktop.com');
  console.log('Local Liturgy POST endpoint: empty request rejected privately; PASS');
}
