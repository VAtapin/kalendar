import { describe, expect, it, vi } from 'vitest';
import { fetchWorshipParts } from '../public/calendar-ui/worship-parts.js';

const state = { office: 'liturgy', rite: 'john-chrysostom', date: '2026-11-02', temple: 'george-victorious',
  sequence: 'default', textLanguage: 'cu', officeMode: 'auto' };
const localContext = { schemaVersion: 1, templeProfileId: state.temple, confirmedLiteralForms: true,
  people: { primate: { rank: 'patriarch', forms: { locative: 'Тестовомъ', accusative: 'Тестоваго' } },
    diocesan: { rank: 'metropolitan', forms: { locative: 'Тестовомъ', accusative: 'Тестоваго' } },
    celebrant: { forms: { dative: 'Тестовому', nominative: 'Тестовый' } }, deacon: { forms: { nominative: 'Тестовый' } },
    communicant: { forms: { nominative: 'Тестовый' } } } };
const manyYearsContext = { confirmedLiteralForm: true, diocesanTitledAccusative: 'Тестоваго митрополита' };
const template = { schemaVersion: 1, artifactType: 'source-bound-template', status: 'fixed-template', cleanTemplate: true,
  compositionReady: true, wholeLiturgyAccepted: false, dateDependent: false, appointedForDate: false,
  templateId: 'liturgy:test', templateVersion: 'a'.repeat(64), ruleVersion: 'test', language: 'cu', orthography: 'traditional',
  profile: { id: 'ordinary-one-priest-one-deacon', rite: 'john-chrysostom' },
  sourceVersions: [{ work: 'test', edition: 'test', language: 'cu', hash: 'b'.repeat(64) }],
  nodes: [{ nodeId: 'test', kind: 'fixed', language: 'cu', blocks: [{ kind: 'text', segments: [{ text: 'Тест', style: 'text' }] }] }] };
const templateResponse = () => ({ status: 200, json: async () => ({ data: template }) });

describe('Artemy private transport', () => {
  it('sends names only in a private JSON POST and does not fall back on failure', async () => {
    const calls = [], onBase = vi.fn();
    const fetcher = vi.fn(async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) return templateResponse();
      return { status: 422, headers: new Headers({ 'cache-control': 'private, no-store' }), json: async () => ({ errors: {} }) };
    });
    await expect(fetchWorshipParts('https://offline.invalid', state, onBase, fetcher, undefined, { localContext, manyYearsContext })).rejects.toThrow();
    expect(calls).toHaveLength(2); expect(onBase).not.toHaveBeenCalled();
    expect(calls[1].url.search).toBe(''); expect(calls[1].options.method).toBe('POST');
    expect(calls[1].options.credentials).toBe('omit'); expect(calls[1].options.cache).toBe('no-store');
    expect(JSON.parse(calls[1].options.body)).toMatchObject({ localContext, manyYearsContext });
    expect(calls[0].url.href).not.toContain('Тест');
  });
  it('aborts a pending private response before it can be read or applied', async () => {
    let resolvePost, postStarted; const started = new Promise(resolve => { postStarted = resolve; });
    const fetcher = vi.fn(async () => {
      if (fetcher.mock.calls.length === 1) return templateResponse();
      postStarted(); return new Promise(resolve => { resolvePost = resolve; });
    });
    const controller = new AbortController(), request = fetchWorshipParts('https://offline.invalid', state, () => {}, fetcher,
      controller.signal, { localContext, manyYearsContext });
    await started; controller.abort(); resolvePost({ status: 422, headers: new Headers({ 'cache-control': 'private, no-store' }), json: vi.fn() });
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});
