import { describe, expect, it } from 'vitest';
import { additionalLiturgy } from './fixtures/additional-liturgy.mjs';
import { templateFor, assignmentsFor } from './fixtures/worship-parts.mjs';
import { fetchWorshipParts } from '../public/calendar-ui/worship-parts.js';
import { fetchWorship } from '../public/calendar-ui/worship-reader.js';
import { readLiturgySelection, validateAdditionalTemplate, validateAdditionalAssignments } from '../public/calendar-ui/worship-additional-liturgy.js';

const profiles = [['basil-great', undefined], ['presanctified', 'before-mid-lent-wednesday'], ['presanctified', 'from-mid-lent-wednesday']];
describe('additional fixed Liturgy contracts', () => {
  it.each(profiles)('requests only the supported %s/%s parameters and preserves every fixed word and missing slot', async (rite, branch) => {
    const { state, template, assignments } = additionalLiturgy(rite, branch), urls = [], bases = [];
    const result = await fetchWorshipParts('https://bible.example', state, base => bases.push(base), async url => {
      urls.push(url);
      return { status: 200, json: async () => ({ data: url.pathname.includes('/templates/') ? template : assignments }) };
    });
    expect(result.complete).toBe(false); expect(result.additionalFixed).toBe(true); expect(result.assignmentsStatus).toBe('partial');
    expect(result.entries.filter(node => !node.missing).flatMap(node => node.blocks)).toEqual(template.nodes.filter(node => node.kind === 'fixed').flatMap(node => node.blocks));
    expect(result.entries.filter(node => node.missing).map(node => node.slotId)).toEqual(template.requiredAssignments);
    expect(bases).toHaveLength(1); expect(bases[0].assignmentsStatus).toBe('loading');
    for (const url of urls) {
      expect(url.searchParams.get('rite')).toBe(rite); expect(url.searchParams.get('language')).toBe('cu'); expect(url.searchParams.get('mode')).toBe('fixed');
      expect(url.searchParams.get('midLentBranch')).toBe(branch || null);
      for (const unsupported of ['temple', 'sequence', 'calendarStyle']) expect(url.searchParams.has(unsupported)).toBe(false);
    }
    expect(urls[0].searchParams.has('date')).toBe(false);
    expect(urls[1].searchParams.get('date')).toBe(state.date);
    expect(urls[1].searchParams.get('templateVersion')).toBe(template.templateVersion);
    expect(JSON.stringify(result.entries)).not.toContain('Unselected variant words');
  });
  it.each(['rite', 'profile', 'digest', 'admission', 'duplicate-node', 'contracts', 'conditional-choice', 'conditional-repeat', 'conditional-digest'])('rejects a mismatched template %s', async problem => {
    const { state, template } = additionalLiturgy();
    if (problem === 'rite') template.rite = 'presanctified';
    if (problem === 'profile') template.profile.id = 'ordinary-one-priest-one-deacon';
    if (problem === 'digest') template.nodes[0].blocks[0].segments[0].text = 'Changed words';
    if (problem === 'admission') template.wholeLiturgyAccepted = true;
    if (problem === 'duplicate-node') template.nodes.push(template.nodes[0]);
    if (problem === 'contracts') delete template.requiredContracts.local;
    if (problem === 'conditional-choice') template.conditionalTemplates.choice.actualChoice = 'guessed';
    if (problem === 'conditional-repeat') template.conditionalTemplates.choice.actualRepeatCount = 3;
    if (problem === 'conditional-digest') template.conditionalTemplates.choice.template.nodes[0].blocks[0].segments[0].text = 'Changed conditional words';
    await expect(validateAdditionalTemplate(template, state)).rejects.toThrow();
  });
  it.each(['version', 'date', 'rite', 'branch', 'digest', 'sources', 'missing', 'contracts', 'operation', 'complete'])('rejects invalid assignments %s and keeps the fixed basis', async problem => {
    const { state, template, assignments } = additionalLiturgy();
    if (problem === 'version') assignments.templateVersion = 'c'.repeat(64);
    if (problem === 'date') assignments.requestedContext.date = '2027-01-01';
    if (problem === 'rite') assignments.requestedContext.rite = 'presanctified';
    if (problem === 'branch') assignments.midLentBranch = 'from-mid-lent-wednesday';
    if (problem === 'digest') assignments.composedBlocksHash = 'c'.repeat(64);
    if (problem === 'sources') assignments.templateSourcesHash = 'c'.repeat(64);
    if (problem === 'missing') assignments.missing = [];
    if (problem === 'contracts') delete assignments.requiredContracts.day;
    if (problem === 'operation') assignments.operations.push({ type: 'remove', nodeId: 'day' });
    if (problem === 'complete') assignments.status = 'complete';
    await expect(validateAdditionalAssignments(assignments, template, state)).rejects.toThrow();
    const result = await fetchWorshipParts('https://bible.example', state, () => {}, async url => ({ status: 200, json: async () => ({ data: url.pathname.includes('/templates/') ? template : assignments }) }));
    expect(result.assignmentsStatus).toBe('error'); expect(result.complete).toBe(false);
    expect(result.entries.filter(entry => entry.missing)).toHaveLength(2);
  });
  it('requires an explicit Presanctified branch rather than inferring it from the date', async () => {
    const { state } = additionalLiturgy('presanctified'); let calls = 0;
    expect(await fetchWorshipParts('https://bible.example', state, () => {}, async () => { calls++; })).toEqual({ status: 'context-required' });
    expect(calls).toBe(0);
  });
  it('does not substitute a different rite or language and does not call the complete-service endpoint', async () => {
    const { state } = additionalLiturgy(); let calls = 0;
    expect(await fetchWorshipParts('https://bible.example', { ...state, textLanguage: 'ru' }, () => {}, async () => { calls++; })).toEqual({ status: 'edition-unavailable' });
    await expect(fetchWorship('https://bible.example', state, async () => { calls++; })).rejects.toThrow('no full-service endpoint');
    expect(calls).toBe(0);
  });
  it.each(profiles)('restores %s/%s from a share link', (rite, branch) => {
    const state = {};
    readLiturgySelection(new URLSearchParams({ rite, ...(branch ? { midLentBranch: branch } : {}) }), state);
    expect(state.rite).toBe(rite); expect(state.midLentBranch).toBe(branch || '');
  });
  it('preserves Chrysostom defaults for old and invalid links', () => {
    for (const params of [new URLSearchParams(), new URLSearchParams({ rite: '../other', midLentBranch: 'guessed' })]) {
      const state = {}; readLiturgySelection(params, state);
      expect(state).toEqual({ rite: 'john-chrysostom', midLentBranch: '' });
    }
  });
  it('keeps default Chrysostom requests unchanged with no new selectors', async () => {
    const state = { ...additionalLiturgy().state, rite: 'john-chrysostom', textLanguage: 'cu-civil' };
    const template = templateFor('liturgy'), urls = [];
    const result = await fetchWorshipParts('https://bible.example', state, () => {}, async url => {
      urls.push(url); return { status: 200, json: async () => ({ data: url.pathname.includes('/templates/') ? template : assignmentsFor(template, state, false) }) };
    });
    expect(result.outline).toBe(true);
    for (const url of urls) { expect(url.searchParams.has('rite')).toBe(false); expect(url.searchParams.has('midLentBranch')).toBe(false); }
    expect(urls[1].searchParams.get('temple')).toBe(state.temple);
  });
});
