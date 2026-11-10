import { expect, it, vi } from 'vitest';
import { installErrorJournal } from '../src/diagnostics/error-journal';

function setup(fetch = vi.fn(async () => new Response(null, { status: 204 }))) {
  const target = new EventTarget() as unknown as Window;
  Object.assign(target, { fetch, location: { href: 'https://example.org/calendar/private?token=secret', origin: 'https://example.org' } });
  const report = installErrorJournal(target);
  return { target, fetch, report };
}

it('returns the original failed response and records only safe save metadata', async () => {
  const response = new Response('private error body', { status: 409 });
  const fetch = vi.fn().mockResolvedValueOnce(response).mockResolvedValue(new Response(null, { status: 204 }));
  const { target } = setup(fetch);
  const options = { method: 'PUT', body: 'private calendar', headers: { Authorization: 'secret' } };
  expect(await target.fetch('/api/v1/account/calendars/private-id?token=secret', options)).toBe(response);
  expect(fetch.mock.calls[0]).toEqual(['/api/v1/account/calendars/private-id?token=secret', options]);
  expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({ kind: 'http', operation: 'calendar-save', status: 409 });
  expect(JSON.stringify(fetch.mock.calls[1])).not.toMatch(/secret|private/);
});

it('preserves network failures, skips cancellations and never loops on failed reporting', async () => {
  const failure = new TypeError('private network details');
  const fetch = vi.fn().mockRejectedValue(failure);
  const { target } = setup(fetch);
  await expect(target.fetch('/api/v1/account/calendars', { method: 'POST' })).rejects.toBe(failure);
  expect(fetch).toHaveBeenCalledTimes(2);
  fetch.mockRejectedValue(new DOMException('cancel', 'AbortError'));
  await expect(target.fetch('/api/test')).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetch).toHaveBeenCalledTimes(3);
});

it('ignores successful requests and bounds reports from application errors', async () => {
  const { target, fetch, report } = setup();
  await target.fetch('/api/health');
  expect(fetch).toHaveBeenCalledTimes(1);
  for (let index = 0; index < 30; index++) report('vue');
  expect(fetch).toHaveBeenCalledTimes(21);
  const event = new Event('unhandledrejection');
  Object.assign(event, { reason: new Error('private input') });
  target.dispatchEvent(event);
  expect(fetch).toHaveBeenCalledTimes(21);
});
