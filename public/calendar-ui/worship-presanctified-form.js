import { normalizePreparedLiturgyContext, validatePreparedChoices } from './worship-presanctified-prepared-context.js';
import pins from './worship-presanctified-day-pins.js';

// The first reviewed composition is bounded explicitly; this is no calendar resolver.
export function preparedPresanctifiedFormAvailable(state) {
  return state.office === 'liturgy' && state.rite === 'presanctified'
    && state.date === pins.date && state.temple === pins.temple
    && state.midLentBranch === 'from-mid-lent-wednesday'
    && ['auto', 'cu', undefined].includes(state.textLanguage);
}

export function createPreparedPresanctifiedFields({ state, create, values, temple, onDirty }) {
  if (!preparedPresanctifiedFormAvailable(state)) return null;
  const page = create('fieldset'), legend = create('legend', 'Выбранный печатный чин'); page.append(legend);
  const label = create('label', '', 'control'), enabled = create('input'); enabled.type = 'checkbox'; enabled.checked = false;
  label.append(enabled, create('span', 'Подготовить полный печатный чин со священником и диаконом.'));
  const fields = create('div'); fields.hidden = true;
  page.append(label, fields);
  fields.append(create('p', 'Этот выбор относится к проверенному печатному составу выбранной даты и Никольского храма. Он не подтверждает местное расписание или фактическое совершение службы.', 'hint'));
  fields.append(create('p', 'Для полного печатного чина заполните все формы, включая имена священника и диакона, и явно выберите условия ниже.', 'hint'));
  const literals = new Map(), controls = [];
  const text = (key, title) => {
    const wrapper = create('label', title, 'control'), input = create('input');
    input.type = 'text'; input.value = ''; input.maxLength = 160; input.lang = 'cu';
    input.dataset.textLanguage = 'cu'; input.dataset.preparedField = key;
    input.autocomplete = 'off'; input.spellcheck = false;
    wrapper.append(input); fields.append(wrapper); literals.set(key, { input, title }); controls.push(input); return input;
  };
  const select = (key, title, entries) => {
    const wrapper = create('label', title, 'control'), input = create('select');
    for (const [value, caption] of [['', 'Выберите явно'], ...entries]) {
      const option = create('option', caption); option.value = value; input.append(option);
    }
    input.value = ''; input.dataset.preparedField = key; wrapper.append(input); fields.append(wrapper); controls.push(input); return input;
  };
  const rank = select('diocesanRank', 'Титул правящего архиерея', [
    ['bishop', 'Епископ'], ['archbishop', 'Архиепископ'], ['metropolitan', 'Митрополит']]);
  for (const [role, title] of [['primate', 'Патриарх'], ['diocesan', 'Правящий архиерей']]) {
    text(role + '.locative', title + ' — предложный падеж (о ком?)');
    text(role + '.accusative', title + ' — винительный падеж (кого?)');
  }
  const building = select('building', 'Печатное поминовение обители', [['temple', 'Храм'], ['monastery', 'Монастырь']]);
  const locality = select('locality', 'Печатное поминовение места', [['city', 'Город'], ['village', 'Село'], ['monastery', 'Монастырь']]);
  const garments = [];
  fields.append(create('p', 'Выберите облачения, для которых нужно напечатать исходную молитву. Это выбор текста, а не свидетельство совершённого действия.', 'hint'));
  for (const [id, title] of [['epitrachelion', 'Епитрахиль'], ['phelonion', 'Фелонь']]) {
    const wrapper = create('label', '', 'control'), input = create('input'); input.type = 'checkbox'; input.checked = false;
    wrapper.append(input, create('span', title)); fields.append(wrapper); garments.push({ id, input }); controls.push(input);
  }
  text('templeSaint', 'Святитель Николай — готовая родительная форма для отпуста');
  text('daySaint', 'Святые минейного дня вечерни — готовая родительная форма для отпуста');
  fields.append(create('p', 'Минейный день вечерни этого состава: 6 марта старого стиля, 42 мученика Аморейских. Форму их поминовения вводите целиком; календарные имена не склоняются автоматически.', 'hint'));
  function collect(confirmed) {
    if (!enabled.checked || temple() !== pins.temple || confirmed !== true) throw Error('Explicit prepared source selection required');
    const common = values(), value = key => literals.get(key).input.value;
    const context = normalizePreparedLiturgyContext({ schemaVersion: 1, templeProfileId: temple(), confirmedLiteralForms: true,
      people: {
        primate: { rank: 'patriarch', forms: { locative: value('primate.locative'), accusative: value('primate.accusative') } },
        diocesan: { rank: rank.value, forms: { locative: value('diocesan.locative'), accusative: value('diocesan.accusative') } },
        celebrant: { forms: { nominative: common['celebrant.nominative'] } },
        deacon: { forms: { nominative: common['deacon.nominative'] } },
      }, commemorations: { living: [], departed: [] } }, temple());
    const choices = validatePreparedChoices({ schemaVersion: 1, private: true, confirmedLiteralForms: true,
      variant: 'prepared-priest-and-deacon', building: building.value, locality: locality.value,
      preparedGarments: garments.filter(g => g.input.checked).map(g => g.id),
      dismissalSaints: { temple: [{ identityId: 'memory-day-0033', genitive: value('templeSaint') }],
        day: [{ identityId: 'memory-day-0384', genitive: value('daySaint') }] } });
    return { context, choices };
  }
  enabled.addEventListener('change', () => { fields.hidden = !enabled.checked; onDirty(); });
  for (const input of controls) input.addEventListener(input.type === 'text' ? 'input' : 'change', onDirty);
  return { page, active: () => enabled.checked, collect,
    valid() { try { collect(true); return true; } catch { return false; } },
    preview(target) {
      if (!enabled.checked) return;
      for (const { input, title } of literals.values()) if (input.value) {
        const line = create('p'); line.append(create('span', title + ': '));
        const literal = create('span'); literal.textContent = input.value; literal.lang = 'cu'; literal.dataset.textLanguage = 'cu'; line.append(literal); target.append(line);
      }
    },
    erase() { enabled.checked = false; fields.hidden = true;
      for (const input of controls) { if (input.type === 'checkbox') input.checked = false; else input.value = ''; } },
  };
}
