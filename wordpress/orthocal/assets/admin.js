(() => {
  const root=document.querySelector('[data-oc-admin]');if(!root)return;
  function tab(name) {
    root.querySelectorAll('[data-oc-panel]').forEach(panel=>panel.hidden=panel.dataset.ocPanel!==name);
    root.querySelectorAll('[data-oc-tab]').forEach(link=>{link.classList.toggle('nav-tab-active',link.dataset.ocTab===name);if(link.dataset.ocTab===name)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    root.querySelector('[data-oc-save]').hidden=['shortcodes','help'].includes(name);
  }
  tab(root.dataset.activeTab);
  root.querySelectorAll('[data-oc-tab]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();tab(link.dataset.ocTab);history.replaceState(null,'',link.href);}));
  const fields=[...root.querySelectorAll('[data-oc-build]')];const output=root.querySelector('#oc-generated-code');
  function values(){return Object.fromEntries(fields.filter(input=>!input.closest('label').hidden).map(input=>[input.dataset.ocBuild,input.value]).filter(([,v])=>v!==''));}
  function generate(){
    const mode=root.querySelector('[data-oc-build="mode"]').value;
    const texts=['texts','troparia','kontakia','prayers','magnifications'].includes(mode);
    const allowed={date:!texts,year:['month','year','calendar','fasts','pascha'].includes(mode),month:['month','calendar'].includes(mode),limit:['upcoming','feasts','memorial'].includes(mode),filter:['upcoming','feasts'].includes(mode),tone:texts,weekday:texts,scope:texts,text_id:texts,image_pack:['today','day','fasting','calendar'].includes(mode)};
    fields.forEach(input=>input.closest('label').hidden=allowed[input.dataset.ocBuild]===false);
    const {mode:_,...attrs}=values();output.value='[orthocal_'+mode+Object.entries(attrs).map(([key,value])=>' '+key+'="'+value.replace(/["<>\[\]]/g,'')+'"').join('')+']';
  }
  fields.forEach(input=>input.addEventListener('input',generate));generate();
  async function copy(text,status){try{await navigator.clipboard.writeText(text);status.textContent='Скопировано.';}catch{status.textContent='Выделите строку и скопируйте вручную.';}}
  root.querySelector('[data-oc-copy-code]').addEventListener('click',()=>copy(output.value,root.querySelector('[data-oc-generator-status]')));
  root.querySelectorAll('[data-oc-copy-example]').forEach(button=>button.addEventListener('click',()=>copy(button.dataset.ocCopyExample,root.querySelector('[data-oc-help-status]'))));
  root.querySelector('[data-oc-help-search]').addEventListener('input',event=>root.querySelectorAll('[data-oc-help-item]').forEach(item=>item.hidden=!item.textContent.toLocaleLowerCase().includes(event.target.value.toLocaleLowerCase())));
  function endpoint(action){const url=new URL(root.dataset.endpoint);if(url.searchParams.has('rest_route'))url.searchParams.set('rest_route',url.searchParams.get('rest_route').replace(/\/$/,'')+'/'+action);else url.pathname+=action;return url;}
  root.querySelector('[data-oc-preview]').addEventListener('click',async()=>{
    const status=root.querySelector('[data-oc-generator-status]');status.textContent='Загрузка…';
    try{const url=endpoint('render');for(const [key,value] of Object.entries(values()))url.searchParams.set(key,value);const response=await fetch(url);const value=await response.json();if(!response.ok)throw new Error(value.message||'Ошибка запроса');
      const doc=new DOMParser().parseFromString(value.html,'text/html');const block=doc.querySelector('.orthocal');if(!block)throw new Error('Блок не получен.');
      const slot=root.querySelector('[data-oc-preview-slot]');slot.replaceChildren(block);window.OrthocalInit?.(slot);status.textContent='Предпросмотр по сохранённым настройкам.';
    }catch(error){status.textContent=error.message;}
  });
  root.querySelector('[data-oc-load-translations]').addEventListener('click',async()=>{
    const status=root.querySelector('[data-oc-admin-status]');status.textContent='Загрузка каталога…';
    try{const url=endpoint('bible');url.searchParams.set('path','translations');const response=await fetch(url);const value=await response.json();if(!response.ok||!Array.isArray(value))throw new Error(value.message||'Каталог недоступен');
      const select=root.querySelector('[data-oc-admin-translations]');select.replaceChildren(new Option('Выберите перевод',''));for(const t of value)select.add(new Option((t.language?.code||'')+' · '+t.name+' ('+t.code+')',t.code));select.hidden=false;status.textContent='Выбор подставит код в поле. Затем сохраните настройки.';
    }catch(error){status.textContent=error.message;}
  });
  root.querySelector('[data-oc-admin-translations]').addEventListener('change',event=>root.querySelector('[name="orthocal_options[translation]"]').value=event.target.value);
})();
