import {ownerCapture} from './test-presanctified-owner-capture.mjs';
// Replay original private owner bodies only; never performs a network request.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fetchPreparedPresanctified } from '../public/calendar-ui/worship-presanctified-prepared.js';
import { partsHash } from '../public/calendar-ui/worship-hash.js';
const directory = process.argv[2];
assert.ok(directory, 'Pass the owner discovery-protocol/http-positive directory');
const owner = await ownerCapture(directory), read = owner.read;
const initial = await read('discovery-request.http.json');
const retry = await read('retry-request.http.json');
const proposal = await read('discovery-409.http.json');
const templateBody = await read('public-template.http.json');
const prepared = await read('private-prepared.http.json');
const state = { office: 'liturgy', rite: initial.rite, date: initial.date, temple: initial.temple,
  midLentBranch: initial.midLentBranch, textLanguage: initial.language };
const template = templateBody.data;
const run = async (responses, options = {}) => {
  const calls = [];
  const fetcher = async (url, request) => {
    assert.equal(url.pathname, '/api/v1/liturgical/assignments/liturgy');
    assert.equal(url.search, ''); assert.equal(request.method, 'POST');
    assert.equal(request.credentials, 'omit'); assert.equal(request.cache, 'no-store');
    assert.equal(request.headers['Content-Type'], 'application/json');
    calls.push(JSON.parse(request.body));
    assert.ok(calls.length <= 2, 'Never retry a third time');
    const response = responses[calls.length - 1];
    assert.ok(response, 'No ordinary-source fallback request');
    options.afterRequest?.(calls.length);
    return { status: response.status, headers: new Headers({ 'cache-control': response.cache || owner.cache(calls.length === 1 ? 'response-02' : 'response-03') }),
      json: async () => structuredClone(response.body) };
  };
  const result = await fetchPreparedPresanctified('https://replay.invalid', state, template,
    initial.localContext, initial.preparedSourceChoices, fetcher, options.signal, options.isCurrent);
  return { calls, result };
};
const positive = [{ status: 409, body: proposal }, { status: 200, body: prepared }];
const { calls, result } = await run(positive);
assert.deepEqual(calls, [initial, retry]);
assert.equal(result.entries.flatMap(e => e.blocks).length, 681);
assert.equal(result.preparedPrintedBook, true);
let negatives = 0;
const rejects = async (responses, options) => { await assert.rejects(() => run(responses, options)); ++negatives; };
for (const status of [200, 400, 422, 503]) await rejects([{ status, body: proposal }]);
for (const status of [409, 422, 503]) await rejects([positive[0], { status, body: prepared }]);
for (const cache of ['public, max-age=60', 'no-store', 'private', 'private, public, no-store', 'private-ish, no-store']) {
  await rejects([{ ...positive[0], cache }]); await rejects([positive[0], { ...positive[1], cache }]);
}
for (const path of [[], ['preparedSourceProposal'], ['preparedSourceProposal', 'resolvedSourceContext']]) {
  const body = structuredClone(proposal); let target = body;
  for (const key of path) target = target[key]; target.unexpected = true;
  await rejects([{ status: 409, body }]);
}
for (const key of ['publicTemplateVersion', 'sourceBodyVersion']) {
  const body = structuredClone(proposal); body.preparedSourceProposal[key] = 'f'.repeat(64);
  await rejects([{ status: 409, body }, positive[1]]);
}
for (const key of ['physicalDate', 'positiveOwnershipProofHash']) {
  const body = structuredClone(proposal); body.preparedSourceProposal.resolvedSourceContext[key] = 'changed';
  await rejects([{ status: 409, body }]);
}
for (const flag of ['wholeLiturgyAccepted', 'wholeDatedServiceAccepted', 'dateAppointmentApproved',
  'actualPerformedSequenceConfirmed', 'actualLocalScheduleConfirmed', 'actualCurrentPeopleAsserted']) {
  const body = structuredClone(prepared); body.data[flag] = true;
  await rejects([positive[0], { status: 200, body }]);
}
for (const boundary of [1, 2]) {
  const controller = new AbortController();
  await rejects(positive, { signal: controller.signal, afterRequest: count => { if (count === boundary) controller.abort(); } });
  let current = true;
  await rejects(positive, { isCurrent: () => current, afterRequest: count => { if (count === boundary) current = false; } });
}
// Recompute the untrusted outer digest: independent source pins must still reject.
const rebuild = async body => {
  const data = body.data, byNode = new Map(data.operations.map(op => [op.nodeId, op]));
  data.blocks = data.sourceTemplate.nodes.flatMap(node => {
    const operation = byNode.get(node.nodeId);
    return operation?.type === 'remove' ? [] : operation?.blocks || node.blocks || [];
  });
  data.composedBlocksHash = await partsHash(data.blocks);
  return body;
};
for (const operation of prepared.data.operations.filter(op => op.sectionId === 'presanctified-prepared-source-day')) {
  const body = structuredClone(prepared);
  const block = body.data.operations.find(op => op.slotId === operation.slotId).blocks[0];
  block.segments[0].text += ' ';
  await rejects([positive[0], { status: 200, body: await rebuild(body) }]);
}
for (const slot of ['hierarchy-great-litany', 'hierarchy-augmented-litany', 'locality-great-litany',
  'departed-temple-or-monastery', 'living-temple-or-monastery']) {
  const body = structuredClone(prepared), operation = body.data.operations.find(op => op.slotId === slot);
  operation.type = 'remove'; delete operation.blocks;
  await rejects([positive[0], { status: 200, body: await rebuild(body) }]);
}
for (const [field, value] of [['kind', 'heading'], ['role', 'priest'], ['slot', 'changed'],
  ['occurrenceId', 'changed'], ['repeatIndex', 2], ['repeatCount', 2]]) {
  const body = structuredClone(prepared), block = body.data.operations.find(op => op.slotId === 'hierarchy-great-litany').blocks[0];
  block[field] = value; await rejects([positive[0], { status: 200, body: await rebuild(body) }]);
}
for (const field of ['templateId', 'ruleVersion']) {
  const body = structuredClone(prepared); body.data[field] = 'changed';
  await rejects([positive[0], { status: 200, body }]);
}
for (const field of ['sourceAttestation', 'currentAuthorityAttestation']) {
  const body = structuredClone(prepared); body.data.operations[0].blockSources[0][field] = true;
  await rejects([positive[0], { status: 200, body }]);
}
for (const field of ['origin', 'policyId']) {
  const body = structuredClone(prepared); body.data.userSections['additional-clergy-user-values'][field] = 'changed';
  await rejects([positive[0], { status: 200, body }]);
}
for (const id of ['response-04', 'response-05', 'response-08', 'response-09']) {
  const capture = owner.captures[id];
  await rejects([positive[0], { status: capture.status, body: capture.body, cache: owner.cache(id) }]);
}
const receipt = { positiveProtocolReplays: 1, requests: calls.length, nativeBlocks: 681, negatives,
  realNetworkRequests: 0, rawHeaderComparison: true, sourceWordAdmissionComplete: true, indexSha256: owner.indexSha256, rawTriples: owner.rawTriples,
  firstCompositionSourceOperationPins: true,
  limitation: 'First admitted printed composition only; no annual coverage or actual local performance claim.' };
await writeFile('tmp/presanctified-ui-verification.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
