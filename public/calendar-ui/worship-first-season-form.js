import { validLocalLiteral } from './worship-local-context.js';

export function createFirstSeasonForm({ state, create, onSubmit, onDirty, onClear }) {
  const page = create('details', '', 'worship-local-context'); page.open = true;
  page.append(create('summary', 'Имена для отпуста утрени'), create('p', 'Введите готовые формы имён в винительном падеже. Для выбранного печатного варианта указаны патриарх и епископ.', 'hint'));
  const form = create('form'); form.noValidate = true; page.append(form);
  const inputs = [];
  for (const label of ['Патриарх — винительный падеж (кого?)', 'Епископ — винительный падеж (кого?)']) {
    const wrapper = create('label', label, 'control'), input = create('input'); input.type = 'text'; input.maxLength = 160;
    input.autocomplete = 'off'; input.spellcheck = false; input.lang = 'cu'; input.dataset.textLanguage = 'cu';
    wrapper.append(input); form.append(wrapper); inputs.push(input);
  }
  const consent = create('input'); consent.type = 'checkbox'; const label = create('label', '', 'control');
  label.append(consent, create('span', 'Подтверждаю точность введённых форм имён.')); form.append(label);
  const error = create('p', '', 'reader-message'); error.hidden = true; error.setAttribute('role', 'alert');
  const apply = create('button', 'Применить введённые формы', 'reader-button'); apply.type = 'submit';
  const clear = create('button', 'Удалить введённые формы', 'reader-button'); clear.type = 'button';
  form.append(error, apply, clear); let disposed = false, pending = false, version = 0, controller;
  function update() { apply.disabled = disposed || pending || !consent.checked || inputs.some(input => !validLocalLiteral(input.value)); }
  function dirty() { ++version; controller?.abort(); consent.checked = false; error.hidden = true; update(); onDirty?.(); }
  inputs.forEach(input => input.addEventListener('input', dirty)); consent.addEventListener('change', update);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (apply.disabled) return; const request = ++version;
    const local = { schemaVersion: 1, templeProfileId: state.temple, confirmedLiteralForms: true,
      people: { primate: { rank: 'patriarch', forms: { accusative: inputs[0].value } }, diocesan: { rank: 'bishop', forms: { accusative: inputs[1].value } } } };
    controller = new AbortController(); pending = true; update();
    try { await onSubmit(local, { firstSeasonPrepared: true, signal: controller.signal, isCurrent: () => !disposed && version === request }); }
    catch { if (!disposed && version === request) { error.textContent = create('span', 'Не удалось подготовить Первый час. Проверьте ввод и попробуйте ещё раз.').textContent; error.hidden = false; } }
    finally { pending = false; update(); }
  });
  function erase() { ++version; controller?.abort(); inputs.forEach(input => { input.value = ''; }); consent.checked = false; error.hidden = true; update(); }
  clear.addEventListener('click', () => { erase(); onDirty?.(); onClear?.(); }); update();
  return { page, dispose() { disposed = true; erase(); } };
}
