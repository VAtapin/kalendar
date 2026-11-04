import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export async function ownerCapture(directory) {
  const bytes = await readFile(directory + '/INDEX.json'), index = JSON.parse(bytes), captures = {};
  assert.equal(index.execution, 'normalmainApp-router-nooverrides');
  assert.equal(index.syntheticPreparedFormsFixtureOnly, true);
  assert.equal(Object.keys(index.responses).length, 9);
  for (const [id, meta] of Object.entries(index.responses)) {
    const body = await readFile(directory + '/' + id + '.json');
    const request = JSON.parse(await readFile(directory + '/' + id + '-request.json'));
    const http = JSON.parse(await readFile(directory + '/' + id + '-http.json'));
    assert.equal(sha(body), meta.bodySha256); assert.equal(meta.productionInstalled, true); assert.equal(meta.productionServerAccessed, false);
    assert.equal(http.status, meta.status); assert.deepEqual(http.headers, meta.headers);
    assert.deepEqual(request, { method: meta.method, path: meta.path, input: meta.input });
    const cache = meta.headers['cache-control'].join(',').toLowerCase().split(',').map(value => value.trim());
    assert.ok(cache.includes('private') && !cache.includes('public'));
    if (meta.method === 'POST' || meta.status === 200) assert.ok(cache.includes('no-store'));
    else { assert.equal(meta.method, 'GET'); assert.equal(meta.status, 422); assert.ok(cache.includes('no-cache')); }
    captures[id] = { ...meta, body: JSON.parse(body), bytes: body, request, http };
  }
  assert.deepEqual(Object.values(captures).map(c => c.status), [200, 409, 200, 409, 422, 200, 422, 409, 409]);
  const full = captures['response-03'].body.data, sources = full.sourceTemplate.sourceVersions;
  assert.equal(sources.length, 11); assert.equal(new Set(sources.map(s => JSON.stringify([s.work, s.edition, s.language]))).size, 11);
  assert.equal(full.blocks.length, 681);
  const names = { 'public-template.http.json': 'response-01', 'discovery-409.http.json': 'response-02',
    'private-prepared.http.json': 'response-03' };
  const read = async name => {
    if (names[name]) return structuredClone(captures[names[name]].body);
    if (name === 'discovery-request.http.json') return structuredClone(captures['response-02'].request.input);
    if (name === 'retry-request.http.json') return structuredClone(captures['response-03'].request.input);
    throw Error('Unknown owner capture pointer');
  };
  return { read, captures, indexSha256: sha(bytes), rawTriples: 9,
    cache: id => captures[id].headers['cache-control'].join(',') };
}
