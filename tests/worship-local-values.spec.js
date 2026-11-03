import { describe, expect, it } from 'vitest';
import { localLiturgy } from './fixtures/local-liturgy.mjs';
import { applyAdditionalLocalValues } from '../public/calendar-ui/worship-local-values.js';
import { partsHash, textHash } from '../public/calendar-ui/worship-hash.js';
import { fetchWorshipParts } from '../public/calendar-ui/worship-parts.js';
describe('separate user-supplied Liturgy values', () => {
  it.each([['basil-great', undefined, 4], ['presanctified', 'before-mid-lent-wednesday', 2], ['presanctified', 'from-mid-lent-wednesday', 2]])('applies literal %s values with preserved source words', async (rite, branch, count) => {
    const f = await localLiturgy(rite, branch), urls = [];
    const result = await fetchWorshipParts('https://bible.example', f.state, () => {}, async (url, options) => {
      urls.push(url);
      if (options.method === 'POST') {
        expect(url.search).toBe(''); expect(options.cache).toBe('no-store');
        expect(JSON.parse(options.body)).toEqual({ language: 'cu', mode: 'fixed', rite, ...(branch ? { midLentBranch: branch } : {}), date: f.state.date,
          templateVersion: f.template.templateVersion, temple: f.input.templeProfileId, localContext: f.input });
      }
      return { status: 200, json: async () => ({ data: options.method === 'POST' ? f.assignments : f.template }) };
    }, undefined, { localContext: f.input });
    expect(result.localValuesApplied).toBe(true); expect(result.localFilledCount).toBe(count); expect(result.complete).toBe(false);
    expect(result.entries.filter(e => e.missing).map(e => e.slotId)).toEqual(['day']);
    expect(result.entries[0].blocks).toEqual(f.template.nodes[0].blocks);
    expect(urls.every(url => !url.href.includes('Те'))).toBe(true);
  });
  it.each(['input-hash', 'temple', 'authority', 'policy', 'index', 'node', 'role', 'literal', 'source', 'missing', 'digest'])('rejects invalid local evidence %s', async problem => {
    const f = await localLiturgy(); const op = f.assignments.operations[0];
    if (problem === 'input-hash') f.assignments.localValues.inputHash = '0'.repeat(64);
    if (problem === 'temple') f.input.templeProfileId = 'dormition';
    if (problem === 'authority') f.assignments.userSections['additional-clergy-user-values'].sourceAttestation = true;
    if (problem === 'policy') f.assignments.localValues.userValuePolicy = 'source-approved';
    if (problem === 'index') f.assignments.userSections['additional-clergy-user-values'].operationIndexes = [0, 0];
    if (problem === 'node') op.nodeId = 'day';
    if (problem === 'role') op.blocks[0].role = 'deacon';
    if (problem === 'literal') op.blocks[0].segments[0].text = 'Подменено';
    if (problem === 'source') op.blockSources[0].work = 'pretend-source';
    if (problem === 'missing') f.assignments.missing = [];
    if (problem === 'digest') f.assignments.composedBlocksHash = '0'.repeat(64);
    await expect(applyAdditionalLocalValues(f.assignments, f.template, f.state, f.input)).rejects.toThrow();
  });
  it('rejects changed surrounding source words even when the returned piece and composition hashes are recomputed', async () => {
    const f = await localLiturgy('presanctified', 'before-mid-lent-wednesday'), block = f.assignments.operations[0].blocks[0];
    block.segments[0].text = 'Подмена источника ';
    block.provenance.sourcePieces[0].length = [...block.segments[0].text].length;
    block.provenance.sourcePieces[0].textSha256 = await textHash(block.segments[0].text);
    f.assignments.composedBlocksHash = await partsHash([...f.template.nodes[0].blocks, ...f.assignments.operations.flatMap(op => op.blocks)]);
    await expect(applyAdditionalLocalValues(f.assignments, f.template, f.state, f.input)).rejects.toThrow();
  });
  it.each(['ready', 'old-route', 'cacheable-error', 'wrong-rite', 'transport-error'])('guards form activation for %s without sending names', async condition => {
    const f = await localLiturgy(), baseline = { ...f.assignments, operations: [], missing: f.template.requiredAssignments, composedBlocksHash: f.template.fixedBlocksHash };
    delete baseline.userSections; delete baseline.localValues;
    const result = await fetchWorshipParts('https://bible.example', f.state, () => {}, async (url, options) => {
      if (options.method === 'POST') {
        const body = JSON.parse(options.body);
        expect(body.localContext).toBeNull(); expect(url.search).toBe(''); expect(JSON.stringify(body)).not.toContain('Те́ст');
        if (condition === 'transport-error') throw new Error('offline');
        return { status: condition === 'old-route' ? 405 : 422,
          headers: new Headers(condition === 'cacheable-error' ? {} : { 'cache-control': 'private, no-store' }),
          json: async () => ({ errors: condition === 'wrong-rite' ? { rite: ['unsupported'] } : { localContext: ['required'] } }) };
      }
      return { status: 200, json: async () => ({ data: url.pathname.includes('/templates/') ? f.template : baseline }) };
    }, undefined, { probeLocalContext: true });
    expect(result.assignmentsStatus).toBe('partial'); expect(result.localContextAvailable).toBe(condition === 'ready');
    expect(result.entries.filter(e => e.missing)).toHaveLength(f.template.requiredAssignments.length);
  });
  it('rejects moving a literal outside its source-frame position even with a recomputed body hash', async () => {
    const f = await localLiturgy('presanctified', 'before-mid-lent-wednesday'), block = f.assignments.operations[0].blocks[0];
    [block.segments[0], block.segments[1]] = [block.segments[1], block.segments[0]];
    [block.provenance.segmentOrigins[0], block.provenance.segmentOrigins[1]] = [block.provenance.segmentOrigins[1], block.provenance.segmentOrigins[0]];
    block.provenance.segmentOrigins.forEach((origin, index) => { origin.segmentIndex = index; });
    f.assignments.composedBlocksHash = await partsHash([...f.template.nodes[0].blocks, ...f.assignments.operations.flatMap(op => op.blocks)]);
    await expect(applyAdditionalLocalValues(f.assignments, f.template, f.state, f.input)).rejects.toThrow();
  });
  it.each(['complete', 'whole', 'date'])('does not promote a private name fill to %s admission', async flag => {
    const f = await localLiturgy();
    if (flag === 'complete') f.assignments.status = 'complete';
    if (flag === 'whole') f.assignments.wholeLiturgyAccepted = true;
    if (flag === 'date') f.assignments.dateAppointmentApproved = true;
    const result = await fetchWorshipParts('https://bible.example', f.state, () => {}, async (url, options) => ({ status: 200,
      json: async () => ({ data: options.method === 'POST' ? f.assignments : f.template }) }), undefined, { localContext: f.input });
    expect(result.assignmentsStatus).toBe('error'); expect(result.complete).toBe(false); expect(result.localValuesApplied).not.toBe(true);
  });
});
