(function () {
  const input = document.getElementById('saint-search');
  const list = document.getElementById('saint-options');
  const selected = document.getElementById('saint');
  const status = document.getElementById('saint-status');
  let names = null, pending = null, matches = [], active = -1;
  const normalize = text => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ё/g, 'е');
  const layout = text => text.replace(/[a-z\[\];',.]/g, c => 'йцукенгшщзхъфывапролджэячсмитьбю'['qwertyuiop[]asdfghjkl;\'zxcvbnm,.'.indexOf(c)] || c);
  function distance(a, b) {
    let row = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
      const next = [i + 1];
      for (let j = 0; j < b.length; j++) next[j + 1] = Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] !== b[j]));
      row = next;
    }
    return row[b.length];
  }
  function score(name, query) {
    const words = normalize(name).split(/[^а-яa-z]+/).filter(Boolean);
    const tokens = query.split(/\s+/).filter(Boolean);
    let total = 0;
    for (const token of tokens) {
      if (words.some(word => word.startsWith(token))) continue;
      if (token.length < 4 || !words.some(word => [-1, 0, 1].some(delta => distance(token, word.slice(0, token.length + delta)) <= 1))) return Infinity;
      total++;
    }
    return total;
  }
  function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; }
  function choose(name) {
    selected.value = name; input.value = name;
    if (name) document.getElementById('kind').value = 'saint';
    close(); selected.dispatchEvent(new Event('change', {bubbles: true}));
  }
  function render() {
    if (!names) return;
    const query = normalize(input.value.trim());
    const variants = [query, normalize(layout(input.value.trim().toLowerCase()))];
    matches = names.map(name => ({name, score: query.length < 3 ? 0 : Math.min(...variants.map(q => score(name, q)))}))
      .filter(item => Number.isFinite(item.score)).sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, 'ru')).map(item => item.name);
    active = -1; input.removeAttribute('aria-activedescendant');
    list.replaceChildren(...matches.map((name, index) => {
      const option = document.createElement('div'); option.id = 'saint-option-' + index;
      option.setAttribute('role', 'option'); option.setAttribute('aria-selected', String(name === selected.value));
      option.textContent = name; option.addEventListener('mousedown', event => event.preventDefault());
      option.addEventListener('click', () => choose(name)); return option;
    }));
    status.textContent = matches.length ? (query.length < 3 ? 'Все имена: ' : 'Найдено: ') + matches.length : 'Совпадений нет. Попробуйте другое написание.';
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
  }
  async function open() {
    if (names) { render(); return; }
    status.textContent = 'Загрузка имён…';
    if (!pending) pending = fetch('https://bible-desktop.com/api/calendar/icons/saints', {headers: {Accept: 'application/json'}})
      .then(async response => { if (!response.ok) throw Error(); const data = await response.json(); if (!Array.isArray(data.data)) throw Error(); names = data.data.filter(name => typeof name === 'string'); })
      .finally(() => { pending = null; });
    try { await pending; if (document.activeElement === input) render(); }
    catch { status.textContent = 'Не удалось загрузить имена. Нажмите на список ещё раз.'; }
  }
  input.addEventListener('focus', open);
  input.addEventListener('click', open);
  input.addEventListener('input', () => {
    if (selected.value) { selected.value = ''; selected.dispatchEvent(new Event('change', {bubbles: true})); }
    open();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { close(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); if (list.hidden) { open(); return; }
      if (!matches.length) return;
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
      [...list.children].forEach((option, i) => option.classList.toggle('active', i === active));
      input.setAttribute('aria-activedescendant', list.children[active].id); list.children[active].scrollIntoView({block: 'nearest'});
    } else if (event.key === 'Enter' && !list.hidden && active >= 0) { event.preventDefault(); choose(matches[active]); }
  });
  document.getElementById('saint-open').addEventListener('click', () => { input.focus(); open(); });
  document.getElementById('saint-clear').addEventListener('click', () => { choose(''); status.textContent = ''; });
  document.getElementById('kind').addEventListener('change', () => { selected.value = ''; input.value = ''; status.textContent = ''; close(); });
  document.addEventListener('focusin', event => { if (!event.target.closest('.saint-picker')) close(); });
  document.addEventListener('click', event => { if (!event.target.closest('.saint-picker')) close(); });
})();
