(() => {
  const el=wp.element.createElement;
  const titles={today:'Сегодня',upcoming:'Ближайшие праздники',month:'Календарь на месяц',year:'Календарь на год',day:'День календаря',readings:'Чтения дня',calendar:'Православный календарь',fasting:'Пост и трапеза',saints:'Памяти святых',feasts:'Праздники',memorial:'Поминальные дни',pascha:'Пасха',fasts:'Посты на год',date:'Дата по двум стилям',texts:'Богослужебные тексты',troparia:'Тропари',kontakia:'Кондаки',prayers:'Молитвы',magnifications:'Величания'};
  for(const [mode,title] of Object.entries(titles)) wp.blocks.registerBlockType('orthocal/'+mode,{
    title:'Православный календарь: '+title,icon:'calendar-alt',category:'widgets',
    edit({attributes,setAttributes}) {
      const control=(label,name,options)=>el(wp.components.SelectControl,{label,value:attributes[name]||'',options:[{label:'Настройка сайта',value:''},...options.map(([value,label])=>({value,label}))],onChange:value=>setAttributes({[name]:value})});
      const attrs=Object.fromEntries(Object.entries(attributes).filter(([,value])=>value!==''));
      return el('div',wp.blockEditor.useBlockProps(),
        el(wp.blockEditor.InspectorControls,null,el(wp.components.PanelBody,{title:'Календарь'},
          el(wp.components.TextControl,{label:'Дата (ГГГГ-ММ-ДД), пусто — сегодня',value:attributes.date||'',onChange:date=>setAttributes({date})}),
          ...(['month','year','calendar','fasts','pascha'].includes(mode)?[el(wp.components.TextControl,{label:'Год',type:'number',value:attributes.year||'',onChange:year=>setAttributes({year})})]:[]),
          ...(['month','calendar'].includes(mode)?[el(wp.components.TextControl,{label:'Месяц (1–12)',type:'number',value:attributes.month||'',onChange:month=>setAttributes({month})})]:[]),
          ...(['upcoming','feasts','memorial'].includes(mode)?[el(wp.components.RangeControl,{label:'Количество',min:1,max:10,value:Number(attributes.limit||5),onChange:limit=>setAttributes({limit:String(limit)})}),control('События','filter',[['main','Главные'],['twelve','Пасха и двунадесятые'],['great','Великие'],['memorial','Поминальные'],['all','Все']])]:[]),
          control('Язык календаря','lang',[['ru','Русский'],['cu','Церковнославянский'],['de','Немецкий'],['uk','Украинский'],['pl','Польский']]),
          control('Профиль поста','profile',[['typikon-strict','Типикон'],['parish','Приходской']]),
          control('Оформление','theme',[['book','Книжное'],['modern','Современное'],['inherit','В стиле сайта']]),
          control('Открытие дня','open',[['inline','Под блоком'],['modal','В окне'],['page','На странице']]),
          control('Открытие чтений','reading_open',[['inline','Под ссылкой'],['modal','В окне']]),
          control('Картинки','images',[['1','Показывать'],['0','Скрыть']]),
          control('Заголовок','heading',[['1','Показывать'],['0','Скрыть']]),
          el(wp.components.TextControl,{label:'Разделы: fasting,saints,readings,texts,icons',value:attributes.sections||'',onChange:sections=>setAttributes({sections})}),
          ...(['texts','troparia','kontakia','prayers','magnifications'].includes(mode)?[
            control('Раздел справочника','scope',[['resurrection','Воскресные'],['weekday','Дни седмицы'],['common','Общие']]),
            el(wp.components.TextControl,{label:'Глас (1–8), необязательно',type:'number',value:attributes.tone||'',onChange:tone=>setAttributes({tone})}),
            el(wp.components.TextControl,{label:'День седмицы (0–6), необязательно',type:'number',value:attributes.weekday||'',onChange:weekday=>setAttributes({weekday})}),
            el(wp.components.TextControl,{label:'ID конкретного текста, необязательно',value:attributes.text_id||'',onChange:text_id=>setAttributes({text_id})})]:[]),
          control('Размер','compact',[['1','Компактный'],['0','Подробный']]),control('Старый стиль','oldstyle',[['1','Показывать'],['0','Скрыть']])
        )),el(wp.serverSideRender,{block:'orthocal/'+mode,attributes:attrs}));
    },save:()=>null
  });
})();
