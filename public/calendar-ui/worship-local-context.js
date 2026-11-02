// This form owns transient values. Never put its values into calendar URL state.
export function localClergyFields(state) {
  if (state.office !== 'liturgy' || !['basil-great', 'presanctified'].includes(state.rite)) return [];
  const people = ['celebrant', 'deacon'];
  return people.flatMap(person => (state.rite === 'basil-great' ? ['nominative', 'dative'] : ['nominative'])
    .map(grammaticalCase => ({ key: person + '.' + grammaticalCase, person, grammaticalCase })));
}
export function normalizeLocalClergyContext(state, input) {
  const keys = ['schemaVersion', 'templeProfileId', 'confirmedLiteralForms', 'people', 'commemorations'];
  if (input?.schemaVersion !== 1 || typeof input.templeProfileId !== 'string' || !input.templeProfileId || input.templeProfileId !== input.templeProfileId.trim() || input.templeProfileId.length > 100
    || !input.people || Object.keys(input).some(key => !keys.includes(key))
    || Object.keys(input.people).some(person => !['celebrant', 'deacon'].includes(person))
    || (input.commemorations && (Object.keys(input.commemorations).some(key => !['living', 'departed'].includes(key))
      || ['living', 'departed'].some(key => !Array.isArray(input.commemorations[key]) || input.commemorations[key].length)))) throw new Error('Unsupported local clergy input');
  if (!localClergyFields(state).length || input.confirmedLiteralForms !== true) throw new Error('Unconfirmed local clergy input');
  const cases = ['nominative', 'genitive', 'dative', 'accusative', 'instrumental', 'locative'], people = {};
  let filled = 0;
  for (const person of ['celebrant', 'deacon']) {
    const data = input.people[person];
    if (data === undefined) continue;
    if (!data || Object.keys(data).length !== 1 || !data.forms || typeof data.forms !== 'object'
      || Object.keys(data.forms).some(key => !cases.includes(key))) throw new Error('Invalid local person');
    const forms = {};
    for (const grammaticalCase of cases) {
      if (!Object.hasOwn(data.forms, grammaticalCase)) continue;
      const literal = data.forms[grammaticalCase];
      if (!validLocalLiteral(literal)) throw new Error('Invalid local literal');
      forms[grammaticalCase] = literal; ++filled;
    }
    people[person] = { forms: Object.keys(forms).length ? forms : [] };
  }
  if (!filled) throw new Error('Missing local clergy values');
  return { schemaVersion: 1, templeProfileId: input.templeProfileId, confirmedLiteralForms: true, people, commemorations: { living: [], departed: [] } };
}
export function validLocalLiteral(value) {
  return typeof value === 'string' && value === value.trim() && [...value].length >= 1 && [...value].length <= 160
    && /\p{Script=Cyrillic}/u.test(value) && /^[\p{Script=Cyrillic}\p{M} .,’'\-\u2011]+$/u.test(value)
    && !/^[\p{M}]|[\p{Cc}\p{Cf}]/u.test(value) && !/имярек|и҆́мⷬ҇къ/iu.test(value);
}
export function buildLocalClergyContext(state, values, templeProfileId, confirmed, temples) {
  const fields = localClergyFields(state), keys = new Set(fields.map(field => field.key));
  if (!fields.length || !Object.hasOwn(temples, templeProfileId) || confirmed !== true
    || Object.keys(values).some(key => !keys.has(key))) throw new Error('Invalid local clergy context');
  const people = {};
  for (const field of fields) {
    const value = values[field.key];
    if (value === undefined || value === '') continue;
    if (!validLocalLiteral(value)) throw new Error('Invalid local literal');
    people[field.person] ||= { forms: {} };
    people[field.person].forms[field.grammaticalCase] = value;
  }
  if (!Object.keys(people).length) throw new Error('Missing local clergy values');
  return { schemaVersion: 1, templeProfileId, confirmedLiteralForms: true, people, commemorations: { living: [], departed: [] } };
}

export function createLocalContextForm({ state, temples, create, onSubmit, onClear = () => {}, onDirty = () => {} }) {
  const page = create('details', '', 'worship-local-context');
  page.append(create('summary', 'Местные имена священнослужителей'),
    create('p', 'Введите только готовые церковнославянские формы. Имена не склоняются автоматически. Пустые формы останутся незаполненными.', 'hint'),
    create('p', 'Введённые формы действуют только в текущем читателе и не включаются в ссылку.', 'hint'));
  const form = create('form'); form.noValidate = true;
  const templeLabel = create('label', 'Храм', 'control'), temple = create('select');
  for (const [id, title] of Object.entries(temples)) {
    const option = create('option', title); option.value = id; temple.append(option);
  }
  temple.value = Object.hasOwn(temples, state.temple) ? state.temple : Object.keys(temples)[0];
  templeLabel.append(temple); form.append(templeLabel);
  const inputs = new Map();
  for (const field of localClergyFields(state)) {
    const label = field.person === 'celebrant'
      ? field.grammaticalCase === 'nominative' ? 'Священник — именительный падеж (кто?)' : 'Священник — дательный падеж (кому?)'
      : field.grammaticalCase === 'nominative' ? 'Диакон — именительный падеж (кто?)' : 'Диакон — дательный падеж (кому?)';
    const wrapper = create('label', label, 'control'), input = create('input');
    input.type = 'text'; input.value = ''; input.maxLength = 160;
    input.lang = 'cu'; input.dataset.textLanguage = 'cu';
    input.autocomplete = 'off'; input.spellcheck = false;
    input.dataset.localField = field.key; wrapper.append(input); form.append(wrapper); inputs.set(field.key, input);
  }
  const consentLabel = create('label', '', 'control'), consent = create('input');
  consent.type = 'checkbox'; consent.checked = false;
  consentLabel.append(consent, create('span', 'Подтверждаю точность введённых буквальных форм. Это мои данные, а не подтверждение назначения всей службы.'));
  form.append(consentLabel);
  const error = create('p', '', 'reader-message'); error.hidden = true; error.setAttribute('role', 'alert');
  const submit = create('button', 'Применить введённые формы', 'reader-button'); submit.type = 'submit'; submit.disabled = true;
  const clear = create('button', 'Удалить введённые формы', 'reader-button'); clear.type = 'button';
  form.append(error, submit, clear); page.append(form);
  let disposed = false, pending = false, version = 0, controller;
  function values() { return Object.fromEntries([...inputs].map(([key, input]) => [key, input.value])); }
  function update() {
    const filled = [...inputs.values()].filter(input => input.value !== '');
    const invalid = filled.some(input => !validLocalLiteral(input.value));
    for (const input of inputs.values()) input.setAttribute('aria-invalid', String(input.value !== '' && !validLocalLiteral(input.value)));
    if (invalid && !disposed) {
      error.textContent = create('span', 'Проверьте буквальные формы: кириллица, не более 160 символов, без начальных и конечных пробелов.').textContent;
      error.hidden = false;
    }
    submit.disabled = disposed || pending || !consent.checked || !filled.length || invalid;
  }
  function dirty() { ++version; controller?.abort(); consent.checked = false; error.hidden = true; update(); onDirty(); }
  for (const input of inputs.values()) input.addEventListener('input', dirty);
  temple.addEventListener('change', dirty); consent.addEventListener('change', update);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (disposed || pending || submit.disabled) return;
    const request = ++version;
    try {
      const context = buildLocalClergyContext(state, values(), temple.value, consent.checked, temples);
      controller = new AbortController();
      pending = true; update();
      await onSubmit(context, { signal: controller.signal, isCurrent: () => !disposed && request === version });
    } catch {
      if (!disposed && request === version) { error.textContent = create('span', 'Не удалось применить местные формы. Проверьте ввод и попробуйте ещё раз.').textContent; error.hidden = false; }
    } finally { pending = false; update(); }
  });
  function erase() { ++version; controller?.abort(); for (const input of inputs.values()) input.value = ''; consent.checked = false; error.hidden = true; update(); }
  clear.addEventListener('click', () => { erase(); onDirty(); onClear(); });
  return { page, dispose() { disposed = true; erase(); } };
}
