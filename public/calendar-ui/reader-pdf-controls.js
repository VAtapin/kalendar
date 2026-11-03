/** Lazy-load only a built, content-addressed PDF module from this site. */
export async function loadReaderPdf() {
  const response = await fetch('/calendar-ui/worship-pdf-manifest.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('PDF module unavailable');
  const manifest = await response.json();
  if (!/^\/assets\/worship-pdf-[\w-]{8,}\.js$/.test(manifest.module || '')) throw new Error('Invalid PDF module');
  return import(manifest.module);
}

export function createReaderPdfControls({ create, host, available, selection, getSnapshot, load = loadReaderPdf }) {
  const panel = create('div', '', 'reader-pdf-controls');
  const label = create('label', 'Комментарий к PDF (не часть богослужебного текста)', 'control');
  const comment = create('textarea'); comment.maxLength = 2000; comment.rows = 2; label.append(comment);
  const button = create('button', 'Скачать PDF', 'reader-button'); button.type = 'button'; button.disabled = true;
  const cancel = create('button', 'Отменить подготовку PDF', 'reader-button'); cancel.type = 'button'; cancel.hidden = true;
  const status = create('p', '', 'hint'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  panel.append(label, button, cancel, status); host.append(panel);
  let controller, disposed = false, version = 0;
  function stop() { ++version; controller?.abort(); controller = null; cancel.hidden = true; button.disabled = disposed || !available(); }
  function refresh() { stop(); status.textContent = ''; }
  comment.addEventListener('input', refresh);
  cancel.addEventListener('click', () => { stop(); status.textContent = create('span', 'Подготовка PDF отменена.').textContent; });
  button.addEventListener('click', async () => {
    if (disposed || !available() || controller) return;
    const token = selection(), request = ++version, abort = new AbortController(); controller = abort;
    const isCurrent = () => !disposed && version === request && !abort.signal.aborted && selection() === token && available();
    button.disabled = true; cancel.hidden = false;
    status.textContent = create('span', 'Готовлю PDF… Большая книга может занять около минуты.').textContent;
    try {
      const module = await load(); if (!isCurrent()) return;
      const snapshot = getSnapshot(module); if (!snapshot || !isCurrent()) return;
      const note = (comment.value || '').trim();
      if (note) snapshot.information.push(create('span', 'Комментарий пользователя:').textContent + ' ' + note);
      await module.downloadWorshipPdf(snapshot, snapshot.title, { signal: abort.signal, isCurrent,
        onProgress: (done, total) => { if (isCurrent()) status.textContent = create('span', 'Обработано блоков:').textContent + ` ${done} / ${total}`; } });
      if (isCurrent()) status.textContent = create('span', 'PDF готов к скачиванию.').textContent;
    } catch (error) {
      if (isCurrent()) status.textContent = create('span', error?.name === 'StaleWorshipPdfError' ? 'Подготовка PDF отменена.' : 'Не удалось подготовить PDF. Попробуйте ещё раз.').textContent;
    } finally { if (request === version) stop(); }
  });
  return { refresh, dispose() { disposed = true; stop(); comment.value = ''; } };
}
