(() => {
  const el=wp.element.createElement;
  const modes={
    today:['Сегодня','Карточка текущего дня: пост, праздники, памяти и чтения.'],upcoming:['Ближайшие праздники','Список ближайших главных, великих или поминальных дней.'],month:['Календарь на месяц','Сетка выбранного месяца с событиями, постом и старым стилем.'],year:['Календарь на год','Годовой календарь с православными датами.'],day:['День календаря','Полная карточка указанной даты.'],readings:['Чтения дня','Библейские чтения выбранной даты.'],calendar:['Православный календарь','Календарь с выбором даты и переходом к подробному дню.'],fasting:['Пост и трапеза','Правило поста и трапезы выбранного дня.'],saints:['Памяти святых','Памяти святых выбранного дня.'],feasts:['Праздники','Ближайшие православные праздники.'],memorial:['Поминальные дни','Ближайшие дни особого поминовения усопших.'],pascha:['Пасха','Дата Пасхи и связанные сведения для выбранного года.'],fasts:['Посты на год','Многодневные посты выбранного года.'],date:['Дата по двум стилям','Гражданская дата и соответствующая дата старого стиля.'],texts:['Богослужебные тексты','Справочник тропарей, кондаков, молитв и величаний.'],troparia:['Тропари','Справочник тропарей с фильтрами по гласу и дню седмицы.'],kontakia:['Кондаки','Справочник кондаков с фильтрами по гласу и дню седмицы.'],prayers:['Молитвы','Справочник молитв.'],magnifications:['Величания','Справочник величаний.'],horologion:['Часослов','Выбранный раздел Часослова и календарные вставки дня.']
  };
  const select=(label,value,onChange,options)=>el(wp.components.SelectControl,{label,value:value||'',options:[{label:'Настройка сайта',value:''},...options.map(([value,label])=>({value,label}))],onChange});
  const text=(label,value,onChange,type='text')=>el(wp.components.TextControl,{label,type,value:value||'',onChange});
  const preview=(mode,attributes)=>{
    const [title,description]=modes[mode];const detail=[];
    if(attributes.date)detail.push('Дата: '+attributes.date);if(attributes.year)detail.push('Год: '+attributes.year);if(attributes.month)detail.push('Месяц: '+attributes.month);
    detail.push(attributes.lang?{ru:'Русский',cu:'Церковнославянский',de:'Deutsch',uk:'Українська',pl:'Polski'}[attributes.lang]: 'Язык сайта');
    return el('section',{className:'orthocal oc-theme-book oc-editor-preview'},el('div',{className:'oc-heading'},el('span',{className:'oc-eyebrow'},'КАЛЕНДАРНАЯ МАСТЕРСКАЯ'),el('h3',null,title)),el('p',null,description),el('p',{className:'oc-message'},detail.join(' · ')),el('p',{className:'oc-editor-note'},'Предварительный просмотр в редакторе. Данные календаря будут загружены на опубликованной странице.'));
  };
  for(const [mode,[title,description]] of Object.entries(modes))wp.blocks.registerBlockType('orthocal/'+mode,{
    title:'Православный календарь: '+title,description,icon:'calendar-alt',category:'widgets',keywords:['календарь','православный',title.toLowerCase()],
    edit({attributes,setAttributes}) {
      const controls=[text('Дата (ГГГГ-ММ-ДД); если пусто — сегодня',attributes.date,date=>setAttributes({date}))];
      if(['month','year','calendar','fasts','pascha'].includes(mode))controls.push(text('Год',attributes.year,year=>setAttributes({year}),'number'));
      if(['month','calendar'].includes(mode))controls.push(text('Месяц (1–12)',attributes.month,month=>setAttributes({month}),'number'));
      if(['upcoming','feasts','memorial'].includes(mode))controls.push(text('Количество (1–10)',attributes.limit,limit=>setAttributes({limit}),'number'),select('События',attributes.filter,filter=>setAttributes({filter}),[['main','Главные'],['twelve','Пасха и двунадесятые'],['great','Великие'],['memorial','Поминальные'],['all','Все']]));
      controls.push(select('Язык календаря',attributes.lang,lang=>setAttributes({lang}),[['ru','Русский'],['cu','Церковнославянский'],['de','Deutsch'],['uk','Українська'],['pl','Polski']]),select('Профиль поста',attributes.profile,profile=>setAttributes({profile}),[['typikon-strict','Типикон'],['parish','Приходской']]),select('Оформление',attributes.theme,theme=>setAttributes({theme}),[['book','Книжное'],['modern','Современное'],['inherit','В стиле сайта']]),select('Размер блока',attributes.compact,compact=>setAttributes({compact}),[['0','Подробный'],['1','Компактный']]),select('Старый стиль',attributes.oldstyle,oldstyle=>setAttributes({oldstyle}),[['1','Показывать'],['0','Скрыть']]));
      if(['texts','troparia','kontakia','prayers','magnifications'].includes(mode))controls.push(select('Раздел справочника',attributes.scope,scope=>setAttributes({scope}),[['resurrection','Воскресные'],['weekday','Дни седмицы'],['common','Общие']]),text('Глас (1–8)',attributes.tone,tone=>setAttributes({tone}),'number'),text('День седмицы (0–6)',attributes.weekday,weekday=>setAttributes({weekday}),'number'));
      if(mode==='horologion')controls.push(select('Раздел Часослова',attributes.office,office=>setAttributes({office}),[['horologion','Весь Часослов'],['first-hour','Первый час'],['third-hour','Третий час'],['sixth-hour','Шестой час'],['ninth-hour','Девятый час'],['matins','Утреня'],['vespers','Вечерня']]));
      return el('div',wp.blockEditor.useBlockProps(),el(wp.blockEditor.InspectorControls,null,el(wp.components.PanelBody,{title:'Настройки календаря',initialOpen:true},...controls)),preview(mode,attributes));
    },save:()=>null
  });
})();
