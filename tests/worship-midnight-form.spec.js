// Form and request unit tests only; no fabricated successful HTTP replies.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { create } from './fixtures/reader-pdf-dom.mjs';
import { localClergyFields, buildLocalClergyContext, createLocalContextForm } from '../public/calendar-ui/worship-local-context.js';
import { buildMidnightClergyPost } from '../public/calendar-ui/worship-local-context.js';
const state = { office: 'midnight-office', date: '2026-11-09', temple: 'george-victorious', sequence: 'standalone', textLanguage: 'cu', midnightProfile: 'clergy', midnightLocation: 'church', midnightBishopTitle: 'bishop' };
const temples = { 'george-victorious': 'Храм Георгия Победоносца' };
const inputs = page => page.querySelectorAll('input').filter(e => e.type === 'text');
const checks = page => page.querySelectorAll('input').filter(e => e.type === 'checkbox');
const button = (page, title) => page.querySelectorAll('button').find(e => e.textContent === title);
const event = async (element, type) => element.events[type]?.({ preventDefault() {} });
function filledForm(onSubmit = () => {}, extra = {}) {
  const form = createLocalContextForm({ state, temples, create, onSubmit, ...extra });
  for (const input of inputs(form.page)) { input.value = 'Те́стовому'; event(input, 'input'); }
  return form;
}
test('reuses the same form with exactly three explicit dative roles', () => {
  assert.deepEqual(localClergyFields(state).map(f => f.key), ['primate.dative', 'diocesan.dative', 'rector.dative']);
  assert.deepEqual(localClergyFields({ ...state, midnightProfile: 'reader' }), []);
  const form = filledForm();
  assert.equal(inputs(form.page).length, 3); assert.equal(checks(form.page).length, 2);
  assert.equal(form.page.querySelector('select').disabled, true);
  assert.ok(form.page.textContent.includes('Правящий архиерей — дательный падеж'));
  assert.ok(!form.page.textContent.includes('printed-russian-patriarch-and-superior'));
  form.dispose();
});
test('requires two independent confirmations before preparing a private JSON request', async () => {
  const sent = [], form = filledForm((context, pending) => sent.push(buildMidnightClergyPost(state, context, 'a'.repeat(64), pending.printedVariantConfirmed)));
  const [literal, variant] = checks(form.page), submit = button(form.page, 'Применить введённые формы');
  assert.equal(submit.disabled, true);
  literal.checked = true; await event(literal, 'change'); assert.equal(submit.disabled, true);
  await event(form.page.querySelector('form'), 'submit'); assert.equal(sent.length, 0);
  variant.checked = true; await event(variant, 'change'); assert.equal(submit.disabled, false);
  await event(form.page.querySelector('form'), 'submit'); assert.equal(sent.length, 1);
  assert.equal(sent[0].body.sourceVariantId, 'printed-russian-patriarch-and-superior');
  assert.equal(sent[0].body.localContext.people.primate.rank, 'patriarch');
  assert.equal(sent[0].body.localContext.people.diocesan.rank, 'bishop');
  assert.ok(!sent[0].path.includes('Те́стовому')); assert.deepEqual(sent[0].query, {});
  form.dispose();
});
test('changing a literal removes both confirmations and cancels a pending request', async () => {
  let pending, resolve; const form = filledForm((_context, p) => { pending = p; return new Promise(r => { resolve = r; }); });
  for (const check of checks(form.page)) { check.checked = true; await event(check, 'change'); }
  const submitPromise = event(form.page.querySelector('form'), 'submit');
  assert.equal(pending.signal.aborted, false);
  const input = inputs(form.page)[0]; input.value = 'Ино́му'; await event(input, 'input');
  assert.equal(pending.signal.aborted, true); assert.equal(pending.isCurrent(), false);
  assert.ok(checks(form.page).every(c => !c.checked)); resolve(); await submitPromise;
  const applied = form.page.querySelectorAll('p').find(e => e.getAttribute('role') === 'status');
  assert.equal(applied.hidden, true); form.dispose();
});
test('erase removes exact values, preview and confirmations without sending a request', async () => {
  let sent = 0, cleared = 0; const form = filledForm(() => { sent++; }, { onClear: () => { cleared++; } });
  for (const check of checks(form.page)) { check.checked = true; await event(check, 'change'); }
  await event(button(form.page, 'Удалить введённые формы'), 'click');
  assert.equal(sent, 0); assert.equal(cleared, 1); assert.ok(inputs(form.page).every(i => i.value === ''));
  assert.ok(checks(form.page).every(c => !c.checked)); assert.equal(form.page.querySelector('.local-form-preview').hidden, true);
  form.dispose();
});
test('keeps partial inputs exact and rejects missing rank or changed temple', () => {
  const values = { 'rector.dative': 'Те́стовому' }, context = buildLocalClergyContext(state, values, state.temple, true, temples);
  assert.deepEqual(Object.keys(context.people), ['rector']); assert.equal(context.people.rector.forms.dative, values['rector.dative']);
  assert.throws(() => buildLocalClergyContext({ ...state, midnightBishopTitle: undefined }, values, state.temple, true, temples));
  assert.throws(() => buildLocalClergyContext(state, values, 'nicholas', true, { ...temples, nicholas: 'Никольский храм' }));
});
test('existing Basil and Presanctified field lists and single confirmation remain', () => {
  for (const rite of ['basil-great', 'presanctified']) {
    const selection = { ...state, office: 'liturgy', rite }, fields = localClergyFields(selection);
    assert.equal(fields.length, rite === 'basil-great' ? 4 : 2);
    const form = createLocalContextForm({ state: selection, temples, create, onSubmit() {} });
    assert.equal(checks(form.page).length, 1); form.dispose();
  }
});
