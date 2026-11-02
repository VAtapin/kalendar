import { describe, expect, it } from 'vitest';
import { checkLocalLiturgyEndpoint } from '../scripts/check-local-liturgy-endpoint.mjs';
const preflight = () => ({ status: 204, headers: new Headers({ 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type' }) });
describe('private POST deployment readiness probe', () => {
  it('sends only empty JSON, without names, query parameters or credentials', async () => {
    await checkLocalLiturgyEndpoint('https://bible.example', async (url, options) => {
      if (options.method === 'OPTIONS') { expect(options.body).toBeUndefined(); return preflight(); }
      expect(url.search).toBe(''); expect(options.body).toBe('{}'); expect(options.credentials).toBe('omit');
      expect(options.method).toBe('POST'); expect(options.headers['Content-Type']).toBe('application/json');
      return { status: 422, headers: new Headers({ 'cache-control': 'no-store, private', 'access-control-allow-origin': '*' }), json: async () => ({ errors: { request: ['invalid object'] } }) };
    });
  });
  it.each([404, 405, 409, 419, 500])('does not accept unavailable HTTP %s as a ready route', async status => {
    await expect(checkLocalLiturgyEndpoint('https://bible.example', async () => ({ status }))).rejects.toThrow();
  });
  it('rejects cacheable validation errors', async () => {
    await expect(checkLocalLiturgyEndpoint('https://bible.example', async (url, options) => options.method === 'OPTIONS' ? preflight() : { status: 422, headers: new Headers() })).rejects.toThrow();
  });
});
