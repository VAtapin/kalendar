import { validLocalLiteral } from './worship-local-context.js';

// Values stay in this form until the user explicitly applies them.
export function createArtemyFields({ state, create, onDirty }) {
  if (state.office !== 'liturgy' || state.rite !== 'john-chrysostom'
      || !['2026-11-02', '2027-11-02'].includes(state.date)
      || state.temple !== 'george-victorious' || !['auto', 'cu', undefined].includes(state.textLanguage)
      || !['auto', undefined].includes(state.officeMode)) return null;
  const page = create('fieldset');
  page.append(create('legend', 'Подготовленный печатный чин'));
  const fields = [
    ['primate.locative', 'Патриарх — предложный падеж (о ком?)'],
    ['primate.accusative', 'Патриарх — винительный падеж (кого?)'],
    ['diocesan.locative', 'Митрополит — предложный падеж (о ком?)'],
    ['diocesan.accusative', 'Митрополит — винительный падеж (кого?)'],
    ['celebrant.dative', 'Священник — дательный падеж (кому?)'],
    ['celebrant.nominative', 'Священник — именительный падеж (кто?)'],
    ['deacon.nominative', 'Диакон — именительный падеж (кто?)'],
    ['communicant.nominative', 'Причастник — именительный падеж (кто?)'],
    ['manyYears', 'Митрополит с титулом — винительный падеж для многолетия'],
  ];
  const inputs = new Map();
  for (const [key, title] of fields) {
    const label = create('label', title, 'control'), input = create('input');
    input.type = 'text'; input.value = ''; input.maxLength = 160; input.lang = 'cu';
    input.autocomplete = 'off'; input.spellcheck = false; input.dataset.artemyField = key;
    input.dataset.textLanguage = 'cu'; input.addEventListener('input', () => { confirmation.checked = false; onDirty(); });
    label.append(input); page.append(label); inputs.set(key, input);
  }
  const confirmation = create('input'); confirmation.type = 'checkbox'; confirmation.checked = false;
  const label = create('label', '', 'control');
  label.append(confirmation, create('span', 'Подтверждаю точность формы для многолетия.'));
  confirmation.addEventListener('change', onDirty); page.append(label);
  return { page,
    valid: () => confirmation.checked && [...inputs.values()].every(input => validLocalLiteral(input.value)),
    collect() {
      if (!confirmation.checked || ![...inputs.values()].every(input => validLocalLiteral(input.value))) throw Error('Explicit literal forms required');
      const value = key => inputs.get(key).value;
      return { localContext: { schemaVersion: 1, templeProfileId: state.temple, confirmedLiteralForms: true,
        people: { primate: { rank: 'patriarch', forms: { locative: value('primate.locative'), accusative: value('primate.accusative') } },
          diocesan: { rank: 'metropolitan', forms: { locative: value('diocesan.locative'), accusative: value('diocesan.accusative') } },
          celebrant: { forms: { dative: value('celebrant.dative'), nominative: value('celebrant.nominative') } },
          deacon: { forms: { nominative: value('deacon.nominative') } },
          communicant: { forms: { nominative: value('communicant.nominative') } } } },
        manyYearsContext: { confirmedLiteralForm: true, diocesanTitledAccusative: value('manyYears') } };
    },
    erase() { for (const input of inputs.values()) input.value = ''; confirmation.checked = false; },
  };
}

export function createArtemyForm({ state, create, onSubmit, onDirty, onClear }) {
  const page = create('details', '', 'worship-local-context'); page.open = true;
  page.append(create('summary', 'Подготовить печатный чин'));
  const form = create('form'); form.noValidate = true; page.append(form);
  let disposed = false, pending = false, version = 0, controller;
  const fields = createArtemyFields({ state, create, onDirty: dirty });
  if (!fields) return null;
  form.append(fields.page);
  const consent = create('input'); consent.type = 'checkbox'; consent.checked = false;
  const consentLabel = create('label', '', 'control');
  consentLabel.append(consent, create('span', 'Подтверждаю точность введённых форм имён.'));
  consent.addEventListener('change', update); form.append(consentLabel);
  const error = create('p', '', 'reader-message'); error.hidden = true; error.setAttribute('role', 'alert');
  const apply = create('button', 'Применить введённые формы', 'reader-button'); apply.type = 'submit'; apply.disabled = true;
  const clear = create('button', 'Удалить введённые формы', 'reader-button'); clear.type = 'button';
  form.append(error, apply, clear);
  function update() { apply.disabled = disposed || pending || !consent.checked || !fields.valid(); }
  function dirty() { ++version; controller?.abort(); consent.checked = false; error.hidden = true; update(); onDirty?.(); }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (disposed || pending || apply.disabled) return;
    const request = ++version;
    try {
      const { localContext, manyYearsContext } = fields.collect();
      controller = new AbortController(); pending = true; update();
      await onSubmit(localContext, { manyYearsContext, signal: controller.signal, isCurrent: () => !disposed && version === request });
    } catch {
      if (!disposed && version === request) { error.textContent = create('span', 'Не удалось подготовить выбранный печатный чин.').textContent; error.hidden = false; }
    } finally { pending = false; update(); }
  });
  function erase() { ++version; controller?.abort(); fields.erase(); consent.checked = false; error.hidden = true; update(); }
  clear.addEventListener('click', () => { erase(); onDirty?.(); onClear?.(); });
  return { page, dispose() { disposed = true; erase(); } };
}
