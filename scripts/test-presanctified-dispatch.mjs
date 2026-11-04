import {ownerCapture} from './test-presanctified-owner-capture.mjs';
import assert from 'node:assert/strict';
import { fetchWorshipParts } from '../public/calendar-ui/worship-parts.js';
const directory = process.argv[2]; assert.ok(directory);
const owner = await ownerCapture(directory), read = owner.read;
const initial = await read('discovery-request.http.json'), retry = await read('retry-request.http.json');
const proposal = await read('discovery-409.http.json'), template = await read('public-template.http.json'), prepared = await read('private-prepared.http.json');
const state = { office: 'liturgy', rite: initial.rite, date: initial.date, temple: initial.temple,
  midLentBranch: initial.midLentBranch, textLanguage: initial.language };
const options = { localContext: initial.localContext, preparedSourceChoices: initial.preparedSourceChoices };
async function run(input = options, failure = false) {
  const requests = [], base = [];
  const fetcher = async (url, request) => {
    requests.push({ path: url.pathname, method: request.method || 'GET' });
    if (url.pathname.endsWith('/templates/liturgy')) {
      assert.equal(request.method, undefined); assert.ok(!url.search.includes('localContext'));
      return { status: 200, json: async () => structuredClone(template) };
    }
    assert.equal(url.pathname, '/api/v1/liturgical/assignments/liturgy'); assert.equal(url.search, ''); assert.equal(request.method, 'POST');
    const index = requests.length - 2; assert.ok(index < 2);
    assert.deepEqual(JSON.parse(request.body), [initial, retry][index]);
    return { status: failure ? 503 : index === 0 ? 409 : 200, headers: new Headers({ 'cache-control': owner.cache(index===0?'response-02':'response-03') }),
      json: async () => structuredClone(index === 0 ? proposal : prepared) };
  };
  try {
    const result = await fetchWorshipParts('https://replay.invalid', state, value => base.push(value), fetcher, undefined, input);
    assert.equal(result.preparedPrintedBook, true); assert.equal(requests.length, 3);
    return result;
  } finally { assert.equal(base.length, 0, 'Never expose an ordinary base for an explicit prepared request'); }
}
assert.equal((await run()).entries.flatMap(e => e.blocks).length, 681);
await assert.rejects(() => run(options, true));
await assert.rejects(() => run({ ...options, preparedSourceChoices: null }));
await assert.rejects(() => run({ ...options, localContext: null }));
const legacy = owner.captures['response-06']; let bases = 0, legacyPosts = 0;
const oldFlow = await fetchWorshipParts('https://replay.invalid', state, () => ++bases, async (url, request) => {
  if (url.pathname.endsWith('/templates/liturgy')) return { status: 200, json: async () => structuredClone(template) };
  assert.equal(request.method, 'POST'); assert.equal(url.search, ''); ++legacyPosts;
  assert.deepEqual(JSON.parse(request.body), legacy.input);
  return { status: 200, json: async () => structuredClone(legacy.body) };
}, undefined, { localContext: legacy.input.localContext });
assert.equal(bases, 1); assert.equal(legacyPosts, 0); assert.equal(oldFlow.complete, false);
assert.equal(oldFlow.localValuesApplied, undefined); assert.equal(oldFlow.assignmentsStatus, 'error');
console.log('Existing dispatch: exact GET template + POST409/POST200, no base callback/fallback, null input and HTTP failure PASS');
console.log('Legacy partial client still rejects unsupported hierarchy context before any POST PASS');
