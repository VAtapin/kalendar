(() => {
  'use strict';
  const pending = new Map();
  const bibleQueue = [];
  let active = 0;
  const fonts=new Map();
  async function font(url) {
    if(!url)return;
    if(!fonts.has(url))fonts.set(url,(async()=>{const face=new FontFace('OrthocalMonomakh','url('+JSON.stringify(url)+')');await face.load();document.fonts.add(face);})());
    return fonts.get(url);
  }
  function popup(content,title) {
    const dialog=document.createElement('dialog');dialog.className='oc-dialog';dialog.setAttribute('aria-label',title);
    const close=document.createElement('button');close.type='button';close.className='oc-dialog-close';close.textContent='Закрыть ×';
    close.addEventListener('click',()=>dialog.close());dialog.append(close,content);document.body.append(dialog);
    const active=document.activeElement;dialog.addEventListener('close',()=>{dialog.remove();active?.focus();},{once:true});
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
    dialog.showModal();return dialog;
  }
  async function copy(text,status) {
    try {await navigator.clipboard.writeText(text);status.textContent='Скопировано.';}
    catch {status.textContent='Копирование недоступно. Выделите текст и скопируйте вручную.';}
  }
  function route(endpoint, action) {
    const url = new URL(endpoint);
    if (url.searchParams.has('rest_route')) { url.searchParams.set('rest_route',url.searchParams.get('rest_route').replace(/\/$/,'')+'/'+action); return url; }
    return new URL(action,endpoint);
  }
  async function json(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, {signal: controller.signal, credentials: 'same-origin', headers: {Accept:'application/json'}});
      const value = await response.json();
      if (!response.ok) throw new Error(value.message || 'Не удалось получить данные.');
      return value;
    } finally { clearTimeout(timeout); }
  }
  async function bible(endpoint, path) {
    const url = route(endpoint,'bible'); url.searchParams.set('path', path);
    const key = url.href;
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      if (active >= 3) await new Promise(resolve => bibleQueue.push(resolve)); else active++;
      try { return await json(url); }
      finally { const next = bibleQueue.shift(); if (next) next(); else active--; }
    })();
    pending.set(key,task);
    // Deduplicate in-flight requests only; no persistent Bible cache permission is assumed.
    task.finally(() => pending.delete(key)).catch(() => {});
    return task;
  }
  function verifyTranslation(value, translation) {
    if (value?.translation?.code !== translation.code || value.translation.language?.code !== translation.language.code) throw new Error('Источник вернул другой перевод или язык.');
  }
  async function readingText(reading, translation, endpoint) {
    if (reading?.schemaVersion !== 1 || reading.parseStatus !== 'parsed' || !reading.passages?.length) throw new Error('Ссылка разобрана не полностью. Исходное обозначение чтения сохранено.');
    const prefix = 'translations/' + encodeURIComponent(translation.code) + '/books';
    const library = await bible(endpoint,prefix); verifyTranslation(library,translation);
    if (!Array.isArray(library.books)) throw new Error('Каталог книг недоступен.');
    const result = [];
    for (const passage of reading.passages) {
      const a = passage.start, b = passage.end;
      if (!a || !b || ![a.chapter,b.chapter].every(n=>Number.isSafeInteger(n)&&n>0) || b.chapter<a.chapter || b.chapter-a.chapter>150) throw new Error('Неверные границы чтения.');
      if (!(a.verse===null&&b.verse===null) && (![a.verse,b.verse].every(n=>Number.isSafeInteger(n)&&n>0) || (a.chapter===b.chapter&&a.verse>b.verse))) throw new Error('Неверные границы стихов.');
      const matches = library.books.filter(book => book.canonical_book?.osis_code === passage.book);
      if (matches.length !== 1) throw new Error('Не найдено однозначное соответствие книги '+passage.book+'.');
      const book = matches[0];
      if (!Number.isSafeInteger(book.chapters_count) || b.chapter>book.chapters_count || typeof book.slug!=='string') throw new Error('Глава отсутствует в переводе.');
      for (let chapter=a.chapter;chapter<=b.chapter;chapter++) {
        const data = await bible(endpoint,prefix+'/'+encodeURIComponent(book.slug)+'/chapters/'+chapter);
        verifyTranslation(data,translation);
        if (data.book?.slug!==book.slug || data.chapter?.number!==chapter || !Array.isArray(data.verses) || !data.verses.length) throw new Error('Не получена полная глава.');
        if (data.verses.some((v,i)=>!Number.isSafeInteger(v.number)||v.number<1||(i&&v.number<=data.verses[i-1].number))) throw new Error('Неверный порядок стихов.');
        const first=chapter===a.chapter&&a.verse!==null?a.verse:1;
        const last=chapter===b.chapter&&b.verse!==null?b.verse:data.verses.at(-1).number;
        const verses=data.verses.filter(v=>v.number>=first&&v.number<=last);
        if (!verses.length || verses[0].number!==first || verses.at(-1).number!==last || verses.some((v,i)=>(i&&v.number!==verses[i-1].number+1)||typeof v.plain_text!=='string'||!v.plain_text.trim())) throw new Error('В переводе отсутствуют запрошенные стихи. Неполный текст не показан.');
        result.push(...verses.map(v=>({reference:passage.book+' '+chapter+':'+v.number,text:v.plain_text})));
      }
    }
    return result;
  }
  function init(root) {
    if (root.dataset.ocReady) return;
    root.dataset.ocReady='1';
    const cfg=JSON.parse(root.dataset.orthocal);
    if(cfg.fontUrl)void font(cfg.fontUrl).catch(()=>{});
    // AJAX HTML is rendered at a REST URL; public date links must retain the page URL.
    root.querySelectorAll('[data-oc-date]').forEach(link=>{
      const url=new URL(cfg.pageUrl||window.location.href);url.hash='';url.searchParams.set('orthocal_date',link.dataset.ocDate);link.href=url.href;
    });
    const status=root.querySelector(':scope > .oc-status');
    let generation=0;
    async function render(changes, detail=false, readingIndex=-1) {
      const current=++generation;
      status.textContent='Загрузка…'; root.setAttribute('aria-busy','true');
      try {
        const url=route(cfg.endpoint,'render');
        const attrs={...cfg,...changes};
        for (const [name,value] of Object.entries(attrs)) if (!['endpoint','translation','liveDate','pageUrl','fontUrl'].includes(name)) url.searchParams.set(name,value);
        const value=await json(url);
        if (current!==generation) return;
        // Only our escaped server-rendered markup is parsed. Remote API text is never HTML.
        const document=new DOMParser().parseFromString(value.html,'text/html');
        const next=document.querySelector('.orthocal');
        if (!next) throw new Error('Не удалось отобразить календарь.');
        if(detail==='modal') {
          popup(next,readingIndex>=0?'Библейские чтения':'День календаря');init(next);
          if(readingIndex>=0){const item=next.querySelectorAll('[data-oc-reading]')[readingIndex];if(item)item.open=true;}
        } else if (detail) {
          const slot=root.querySelector(':scope > .oc-detail'); slot.replaceChildren(next); init(next);
          next.tabIndex=-1; next.focus({preventScroll:true}); next.scrollIntoView({block:'nearest',behavior:'smooth'});
        } else { root.replaceWith(next); init(next); }
        status.textContent='';
      } catch (error) { if (current===generation) status.textContent=error.name==='AbortError'?'Источник не ответил вовремя. Повторите запрос.':error.message; }
      finally { if (current===generation) root.removeAttribute('aria-busy'); }
    }
    root.addEventListener('click',event=>{
      if (event.target.closest('.orthocal')!==root) return;
      const date=event.target.closest('[data-oc-date]');
      if (date && cfg.open!=='page' && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button===0 && !date.closest('.oc-permalink')) {
        event.preventDefault(); const d=date.dataset.ocDate;
        if (cfg.open==='new') { const url=new URL(date.href||window.location.href); url.searchParams.set('orthocal_date',d); window.open(url.href,'_blank','noopener'); return; }
        render({mode:'day',date:d,year:d.slice(0,4),month:Number(d.slice(5,7)),open:'inline'},cfg.open==='modal'?'modal':!!root.querySelector(':scope > .oc-detail'));
      }
      const day=event.target.closest('[data-oc-day]');if(day)render({date:day.dataset.ocDay});
      const library=event.target.closest('[data-oc-library]');if(library)void render({mode:library.dataset.ocLibrary,scope:'',tone:'',weekday:'',text_id:''},'modal');
      if(event.target.closest('[data-oc-copy-link]'))void copy(root.querySelector('.oc-permalink a').href,status);
      const copyReading=event.target.closest('[data-oc-copy-reading]');if(copyReading)void copy(copyReading.closest('.oc-reading-body').querySelector('.oc-verses').textContent,status);
      const summary=event.target.closest('[data-oc-reading] > summary');
      if(summary&&cfg.reading_open==='modal') {event.preventDefault();const index=[...root.querySelectorAll('[data-oc-reading]')].indexOf(summary.parentElement);void render({mode:'readings',reading_open:'inline'},'modal',index);}
      const period=event.target.closest('[data-oc-period]');
      if (period) {const d=period.dataset.ocPeriod;render({year:d.slice(0,4),month:Number(d.slice(5,7))});}
      if (event.target.closest('[data-oc-retry]')) render({});
      if (event.target.closest('[data-oc-now]')) {
        // Empty date/year/month are resolved in the WordPress site's timezone.
        render({date:'',year:'',month:''});
      }
    });
    root.querySelector('[data-oc-year]')?.addEventListener('change',event=>{
      if (event.target.checkValidity()) render({year:event.target.value});
    });
    root.querySelector('[data-oc-picker]')?.addEventListener('change',event=>{if(event.target.checkValidity()&&event.target.value)void render({date:event.target.value});});
    root.querySelectorAll('[data-oc-text-filter]').forEach(input=>input.addEventListener('change',()=>void render({[input.dataset.ocTextFilter]:input.value,text_id:''})));
    root.querySelector('[data-oc-event-search]')?.addEventListener('input',event=>{
      const query=event.target.value.toLocaleLowerCase().trim();let shown=0;
      root.querySelectorAll('.oc-events li').forEach(item=>{item.hidden=!item.textContent.toLocaleLowerCase().includes(query);if(!item.hidden)shown++;});
      root.querySelector('[data-oc-no-events]').hidden=shown>0;
    });
    if (cfg.liveDate && ['today','day','readings'].includes(cfg.mode)) {
      const timer=setInterval(()=>{
        if (!root.isConnected) {clearInterval(timer);return;}
        if (!document.hidden && !root.querySelector('details[open]')) void render({date:''});
      },300000);
    }
    const select=root.querySelector('[data-oc-translation]');
    if (!select) return;
    let translations=null, catalogue=null, readingGeneration=0;
    async function loadCatalogue() {
      if (translations) return translations;
      catalogue ||= bible(cfg.endpoint,'translations').then(value=>{
        if (!Array.isArray(value)||value.some(t=>typeof t.code!=='string'||!t.language?.code)) throw new Error('Каталог переводов требует обновления.');
        translations=value;
        select.replaceChildren(new Option('Выберите язык и перевод',''));
        for (const t of value) select.add(new Option(t.language.code+' · '+t.name,t.code));
        if (value.some(t=>t.code===cfg.translation)) select.value=cfg.translation;
        else { const same=value.filter(t=>t.language.code===cfg.lang); if (same.length===1) select.value=same[0].code; }
        return value;
      }).catch(error=>{catalogue=null;throw error;});
      return catalogue;
    }
    async function loadReading(details) {
      const revision=readingGeneration;
      const output=details.querySelector('.oc-verses'); output.textContent='Загрузка текста…';
      try {
        const all=await loadCatalogue();
        const translation=all.find(t=>t.code===select.value);
        if (!translation) throw new Error('Выберите язык и перевод.');
        if(translation.language.code==='cu') {const value=await json(route(cfg.endpoint,'font'));await font(value.url);}
        const verses=await readingText(JSON.parse(details.dataset.ocReading),translation,cfg.endpoint);
        if (revision!==readingGeneration) return;
        output.lang=translation.language.code;
        output.replaceChildren();
        for (const verse of verses) {
          const p=document.createElement('p'), ref=document.createElement('small');
          ref.textContent=verse.reference+' '; p.append(ref,document.createTextNode(verse.text));output.append(p);
        }
      } catch(error) {
        if(revision!==readingGeneration) return;
        output.textContent=error.message+' ';
        const retry=document.createElement('button');retry.type='button';retry.textContent='Повторить';retry.addEventListener('click',()=>loadReading(details));output.append(retry);
      }
    }
    select.addEventListener('focus',()=>loadCatalogue().catch(error=>{status.textContent=error.message;}));
    select.addEventListener('change',()=>{readingGeneration++;root.querySelectorAll('[data-oc-reading]').forEach(d=>{d.querySelector('.oc-verses').replaceChildren();if(d.open)void loadReading(d);});});
    root.querySelectorAll('[data-oc-reading]').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)void loadReading(d);}));
    root.querySelector('[data-oc-font]')?.addEventListener('input',event=>root.style.setProperty('--oc-reading-size',event.target.value+'px'));
  }
  document.querySelectorAll('[data-orthocal]').forEach(init);
  window.OrthocalInit=container=>container.querySelectorAll('[data-orthocal]').forEach(init);
})();
