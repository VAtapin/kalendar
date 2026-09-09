import {mkdirSync, writeFileSync, readdirSync, copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const root=resolve('wordpress/orthocal');
const titles={today:'Сегодня',upcoming:'Ближайшие праздники',month:'Календарь на месяц',year:'Календарь на год',day:'День календаря',readings:'Чтения дня',calendar:'Православный календарь',fasting:'Пост и трапеза',saints:'Памяти святых',feasts:'Праздники',memorial:'Поминальные дни',pascha:'Пасха',fasts:'Посты на год',date:'Дата по двум стилям',texts:'Богослужебные тексты',troparia:'Тропари',kontakia:'Кондаки',prayers:'Молитвы',magnifications:'Величания'};
for(const [mode,title] of Object.entries(titles)) {
  const directory=resolve(root,'blocks',mode);mkdirSync(directory,{recursive:true});
  writeFileSync(resolve(directory,'block.json'),JSON.stringify({
    $schema:'https://schemas.wp.org/trunk/block.json',apiVersion:3,name:'orthocal/'+mode,version:'1.3.3',
    title:'Православный календарь: '+title,category:'widgets',icon:'calendar-alt',textdomain:'orthocal',
    attributes:Object.fromEntries(['date','year','month','limit','filter','lang','profile','theme','css_mode','compact','oldstyle','show_nav','show_picker','show_copy','show_search','show_section_titles','open','reading_open','images','image_size','image_pack','icons','heading','sections','event_levels','scope','tone','weekday','text_id'].map(name=>[name,{type:'string'}])),
    supports:{html:false},editorScript:'orthocal-editor',style:'orthocal',viewScript:'orthocal',
  },null,2)+'\n');
}
for(const file of ['orthocal.php',...readdirSync(resolve(root,'includes')).filter(f=>f.endsWith('.php')).map(f=>'includes/'+f)]) execFileSync('php',['-l',resolve(root,file)],{stdio:'inherit'});
for(const file of readdirSync(resolve(root,'assets')).filter(f=>f.endsWith('.js'))) execFileSync(process.execPath,['--check',resolve(root,'assets',file)],{stdio:'inherit'});
mkdirSync('artifacts',{recursive:true});
// Static paths; no shell interpolation of source or user content.
if(process.platform==='win32') execFileSync('powershell',['-NoProfile','-Command',"Compress-Archive -LiteralPath 'wordpress/orthocal' -DestinationPath 'artifacts/orthocal-1.3.3.zip' -Force"],{stdio:'inherit'});
else execFileSync('zip',['-qr',resolve('artifacts/orthocal-1.3.3.zip'),'orthocal'],{cwd:resolve('wordpress'),stdio:'inherit'});
console.log('artifacts/orthocal-1.3.3.zip');
// Publication is explicit so a local plugin build does not overwrite another task's release.
if(process.argv.includes('--publish-downloads')){
  mkdirSync('public/downloads',{recursive:true});
  copyFileSync('artifacts/orthocal-1.3.3.zip','public/downloads/orthocal-1.3.3.zip');
  copyFileSync('docs/CALENDAR-HTTP-API.md','public/downloads/calendar-api-guide.md');
}
