// Offline real-kernel captures only: this check never sends clergy names to a server.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fetchWorshipParts, partsHash } from '../public/calendar-ui/worship-parts.js';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { create, descendants } from '../tests/fixtures/worship-dom.mjs';

let rows;
if (process.argv[2] === '--responses') rows = JSON.parse(await readFile(process.argv[3], 'utf8'));
else if (process.argv[2] === '--manifest' && process.argv[4] === '--templates') {
  const manifest = JSON.parse(await readFile(process.argv[3], 'utf8'));
  const templateManifest = JSON.parse(await readFile(process.argv[5], 'utf8'));
  assert.equal(manifest.databaseWrites, 0); assert.equal(manifest.sourceAttestation, false); assert.equal(manifest.wholeLiturgyAccepted, false);
  rows = [];
  for (const [profile, info] of Object.entries(manifest.profiles)) {
    const readChecked = async (file, sha) => {
      const bytes = await readFile(resolve(dirname(process.argv[3]), file));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), sha); return JSON.parse(bytes.toString('utf8'));
    };
    const body = await readChecked(profile + '-request.json', info.requestSha256);
    const response = await readChecked(profile + '-assignments.json', info.responseSha256);
    const [file, templateInfo] = Object.entries(templateManifest.files).find(([file, item]) => file.endsWith('-template.json') && item.profile === profile);
    const bytes = await readFile(resolve(dirname(process.argv[5]), file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), templateInfo.sha256);
    rows.push({ body, response, template: JSON.parse(bytes.toString('utf8')) });
  }
} else throw new Error('Use --responses capture.json or --manifest local-manifest.json --templates fixed-manifest.json');
assert.equal(rows.length, 3);
globalThis.document = { fonts: { ready: Promise.resolve() }, createTextNode: text => create('span', text) };
globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
for (const row of rows) {
  const run = async (body, response) => {
    const state = { office: 'liturgy', rite: body.rite, midLentBranch: body.midLentBranch, date: body.date, temple: body.temple, textLanguage: 'cu', textSize: 22 };
    const result = await fetchWorshipParts('https://isolated-api.example', state, () => {}, async (url, options) => {
      if (options.method === 'POST') {
        assert.equal(url.search, ''); assert.equal(options.cache, 'no-store');
        const request = JSON.parse(options.body); assert.equal(request.temple, body.temple); assert.equal(request.localContext.confirmedLiteralForms, true);
      }
      return { status: 200, json: async () => options.method === 'POST' ? response : row.template };
    }, undefined, { localContext: body.localContext });
    return { result, state };
  };
  const { result, state } = await run(row.body, row.response), filled = row.body.rite === 'basil-great' ? 4 : 2;
  assert.equal(result.localValuesApplied, true); assert.equal(result.complete, false); assert.equal(result.localFilledCount, filled);
  assert.equal(result.entries.filter(entry => entry.missing).length, row.body.rite === 'basil-great' ? 32 : 28);
  assert.equal(await partsHash(result.entries.filter(entry => !entry.userProvided).flatMap(entry => entry.blocks || [])), row.template.data.fixedBlocksHash);
  const reader = renderWorshipReader({ state, create, formatDate: date => date, onRetry() {} }); reader.render(result);
  const nodes = descendants(reader.page); assert.equal(nodes.filter(node => node.dataset.origin === 'user-provided').length, filled);
  assert.ok(nodes.some(node => node.textContent === 'Местные имена введены пользователем. Они не подтверждают назначение всей службы.'));
  assert.ok(!nodes.some(node => node.textContent === 'Полная служба дня')); reader.dispose();
  const forged = structuredClone(row.response); forged.data.userSections['additional-clergy-user-values'].sourceAttestation = true;
  const denied = await run(row.body, forged); assert.equal(denied.result.assignmentsStatus, 'error'); assert.ok(!denied.result.localValuesApplied);
  if (row.partialResponse) {
    const partial = await run(row.partialBody, row.partialResponse);
    assert.equal(partial.result.localFilledCount, 1); assert.equal(partial.result.complete, false);
    assert.equal(partial.result.entries.filter(entry => entry.missing).length, row.template.data.requiredAssignments.length - 1);
  }
  console.log(`${state.rite}/${state.midLentBranch || 'ordinary'}: ${filled} literal fills; partial/source words/private user origin PASS`);
}
