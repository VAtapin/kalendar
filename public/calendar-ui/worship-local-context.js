import { createPreparedPresanctifiedFields } from './worship-presanctified-form.js';
import { midnightParams } from './worship-midnight-context.js';
// Typed request preparation only. No network, persistence or assignment fabrication.
const keys=(object,allowed)=>object&&typeof object==='object'&&!Array.isArray(object)&&Object.keys(object).every(key=>allowed.includes(key));
export function normalizeMidnightClergyContext(state,input){
  midnightParams({...state,midnightProfile:'reader'});
  if(state.midnightProfile!=='clergy'||!['bishop','archbishop','metropolitan'].includes(state.midnightBishopTitle)
    )throw Error('Explicit clergy profile/title required');
  if(!keys(input,['schemaVersion','templeProfileId','confirmedLiteralForms','people','commemorations'])
    ||input.schemaVersion!==1||input.templeProfileId!==state.temple||input.confirmedLiteralForms!==true
    ||!keys(input.people,['primate','diocesan','rector'])||!Object.keys(input.people).length)throw Error('Invalid Midnight local context');
  if(input.commemorations&&(!keys(input.commemorations,['living','departed'])||['living','departed'].some(key=>!Array.isArray(input.commemorations[key])||input.commemorations[key].length)))throw Error('Unsupported commemorations');
  const people={};
  for(const role of ['primate','diocesan','rector']){
    const person=input.people[role];if(person===undefined)continue;
    const rank=role==='primate'?'patriarch':role==='diocesan'?state.midnightBishopTitle:null;
    if(!keys(person,rank?['rank','forms']:['forms'])||(rank&&person.rank!==rank)||!keys(person.forms,['dative'])
      ||Object.keys(person.forms).length!==1||!validLocalLiteral(person.forms.dative))throw Error('Explicit dative form/rank required');
    people[role]={...(rank?{rank}:{}),forms:{dative:person.forms.dative}};
  }
  return {schemaVersion:1,templeProfileId:state.temple,confirmedLiteralForms:true,people,commemorations:{living:[],departed:[]}};
}
export function buildMidnightClergyPost(state,input,templateVersion,printedVariantConfirmed){
  const base=midnightParams({...state,midnightProfile:'reader'});
  if(printedVariantConfirmed!==true||!/^[a-f0-9]{64}$/.test(templateVersion||''))throw Error('Explicit printed variant/version required');
  const localContext=normalizeMidnightClergyContext(state,input);
  const {commemorations,...wireContext}=localContext;
  return {method:'POST',path:'/api/v1/liturgical/assignments/midnight-office',query:{},credentials:'omit',cache:'no-store',
    headers:{Accept:'application/json','Content-Type':'application/json'},
    body:{...base,profile:'clergy',...(state.midnightBishopTitle!=='bishop'?{bishopTitle:state.midnightBishopTitle}:{}),templateVersion,
      sourceVariantId:'printed-russian-patriarch-and-superior',localContext:wireContext}};
}

// This form owns transient values. Never put its values into calendar URL state.
const midnightClergy = state => state.office === 'midnight-office' && state.midnightProfile === 'clergy';
export function localClergyFields(state) {
  if (midnightClergy(state)) return ['primate', 'diocesan', 'rector']
    .map(person => ({ key: person + '.dative', person, grammaticalCase: 'dative' }));
  if (state.office !== 'liturgy' || !['basil-great', 'presanctified'].includes(state.rite)) return [];
  const people = ['celebrant', 'deacon'];
  return people.flatMap(person => (state.rite === 'basil-great' ? ['nominative', 'dative'] : ['nominative'])
    .map(grammaticalCase => ({ key: person + '.' + grammaticalCase, person, grammaticalCase })));
}
export function normalizeLocalClergyContext(state, input) {
  if (midnightClergy(state)) return normalizeMidnightClergyContext(state, input);
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
    people[field.person] ||= { ...(midnightClergy(state) && field.person !== 'rector'
      ? { rank: field.person === 'primate' ? 'patriarch' : state.midnightBishopTitle } : {}), forms: {} };
    people[field.person].forms[field.grammaticalCase] = value;
  }
  if (!Object.keys(people).length) throw new Error('Missing local clergy values');
  const context = { schemaVersion: 1, templeProfileId, confirmedLiteralForms: true, people, commemorations: { living: [], departed: [] } };
  return midnightClergy(state) ? normalizeMidnightClergyContext(state, context) : context;
}

export function createLocalContextForm({ state, temples, create, onSubmit, onClear = () => {}, onDirty = () => {} }) {
  const page = create('details', '', 'worship-local-context');
  page.open = true;
  page.append(create('summary', 'Местные имена священнослужителей'),
    create('p', 'Введите только готовые церковнославянские формы. Имена не склоняются автоматически. Пустые формы останутся незаполненными.', 'hint'),
    create('p', 'Введённые формы действуют только в текущем читателе и не включаются в ссылку.', 'hint'));
  page.append(create('p', midnightClergy(state)
    ? 'Здесь задаются готовые формы поминовения патриарха, правящего архиерея и настоятеля. После применения текст службы обновится. Эти данные не подтверждают фактическое расписание богослужений.'
    : 'Здесь задаются имена служащих священника и диакона. После применения текст службы обновится. Остальные местные и дневные части останутся отмечены отдельно.', 'hint'));
  page.append(create('p', 'Формы отправляются на сервер только после применения для подготовки текста. Форма не сохраняет их в ссылке или настройках.', 'hint'));
  const form = create('form'); form.noValidate = true;
  const templeLabel = create('label', 'Храм', 'control'), temple = create('select');
  for (const [id, title] of Object.entries(temples)) {
    const option = create('option', title); option.value = id; temple.append(option);
  }
  temple.value = Object.hasOwn(temples, state.temple) ? state.temple : Object.keys(temples)[0];
  if (midnightClergy(state)) temple.disabled = true;
  templeLabel.append(temple); form.append(templeLabel);
  const inputs = new Map(), labels = new Map();
  for (const field of localClergyFields(state)) {
    const midnightLabels = { primate: 'Патриарх — дательный падеж (кому?)', diocesan: 'Правящий архиерей — дательный падеж (кому?)', rector: 'Настоятель — дательный падеж (кому?)' };
    const label = midnightClergy(state) ? midnightLabels[field.person] : field.person === 'celebrant'
      ? field.grammaticalCase === 'nominative' ? 'Священник — именительный падеж (кто?)' : 'Священник — дательный падеж (кому?)'
      : field.grammaticalCase === 'nominative' ? 'Диакон — именительный падеж (кто?)' : 'Диакон — дательный падеж (кому?)';
    const wrapper = create('label', label, 'control'), input = create('input');
    input.type = 'text'; input.value = ''; input.maxLength = 160;
    input.lang = 'cu'; input.dataset.textLanguage = 'cu';
    input.autocomplete = 'off'; input.spellcheck = false;
    input.dataset.localField = field.key; wrapper.append(input); form.append(wrapper); inputs.set(field.key, input);
    labels.set(field.key, label);
  }
  const prepared = createPreparedPresanctifiedFields({ state, create, values, temple: () => temple.value, onDirty: dirty });
  if (prepared) form.append(prepared.page);
  const preview = create('div', '', 'local-form-preview'); preview.setAttribute('aria-live', 'polite'); preview.hidden = true;
  form.append(preview);
  const applied = create('p', '', 'hint'); applied.setAttribute('role', 'status'); applied.hidden = true; form.append(applied);
  const consentLabel = create('label', '', 'control'), consent = create('input');
  consent.type = 'checkbox'; consent.checked = false;
  consentLabel.append(consent, create('span', 'Подтверждаю точность введённых буквальных форм. Это мои данные, а не подтверждение назначения всей службы.'));
  form.append(consentLabel);
  let variantConsent;
  if (midnightClergy(state)) {
    const label = create('label', '', 'control'); variantConsent = create('input');
    variantConsent.type = 'checkbox'; variantConsent.checked = false;
    label.append(variantConsent, create('span', 'Выбираю печатный чин с поминовением патриарха и настоятеля.'));
    form.append(label);
  }
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
    preview.replaceChildren(create('strong', 'Проверьте формы перед применением'));
    for (const [key, input] of inputs) {
      if (!input.value) continue;
      const line = create('p'); line.append(create('span', labels.get(key)), create('span', ': '));
      const literal = create('span'); literal.textContent = input.value; literal.lang = 'cu'; literal.dataset.textLanguage = 'cu'; line.append(literal); preview.append(line);
    }
    preview.append(create('p', 'Пустые поля не будут заполнены автоматически. Текст с этими формами появится после применения.', 'hint'));
    prepared?.preview(preview);
    preview.hidden = disposed || (!filled.length && !prepared?.active());
    if (invalid && !disposed) {
      error.textContent = create('span', 'Проверьте буквальные формы: кириллица, не более 160 символов, без начальных и конечных пробелов.').textContent;
      error.hidden = false;
    }
    submit.disabled = disposed || pending || !consent.checked || (variantConsent && !variantConsent.checked) || !filled.length || invalid || !!(prepared?.active() && !prepared.valid());
  }
  function dirty() { ++version; controller?.abort(); consent.checked = false; if (variantConsent) variantConsent.checked = false; error.hidden = true; applied.hidden = true; applied.textContent = ''; update(); onDirty(); }
  for (const input of inputs.values()) input.addEventListener('input', dirty);
  temple.addEventListener('change', dirty); consent.addEventListener('change', update);
  variantConsent?.addEventListener('change', update);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (disposed || pending || submit.disabled) return;
    const request = ++version;
    try {
      const full = prepared?.active() ? prepared.collect(consent.checked) : null;
      const context = full?.context || buildLocalClergyContext(state, values(), temple.value, consent.checked, temples);
      controller = new AbortController();
      pending = true; update();
      await onSubmit(context, { signal: controller.signal, isCurrent: () => !disposed && request === version,
        ...(variantConsent ? { printedVariantConfirmed: variantConsent.checked } : {}),
        ...(full ? { preparedSourceChoices: full.choices } : {}) });
      if (!disposed && request === version && !controller.signal.aborted) { applied.textContent = create('span', 'Введённые формы применены. Проверьте текст службы ниже.').textContent; applied.hidden = false; }
    } catch {
      if (!disposed && request === version) { error.textContent = create('span', 'Не удалось применить местные формы. Проверьте ввод и попробуйте ещё раз.').textContent; error.hidden = false; }
    } finally { pending = false; update(); }
  });
  function erase() { ++version; controller?.abort(); for (const input of inputs.values()) input.value = ''; prepared?.erase(); consent.checked = false; if (variantConsent) variantConsent.checked = false; error.hidden = true; applied.hidden = true; applied.textContent = ''; update(); }
  clear.addEventListener('click', () => { erase(); onDirty(); onClear(); });
  return { page, dispose() { disposed = true; erase(); } };
}
