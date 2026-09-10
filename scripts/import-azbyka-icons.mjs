import {mkdirSync,existsSync,readFileSync,writeFileSync,renameSync,unlinkSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseIconCard} from './lib/icon-card-parser.mjs';
const root=resolve('data/icon-library');mkdirSync(root,{recursive:true});
const lock=join(root,'import.lock');
if(existsSync(lock)) {
  const pid=Number(readFileSync(lock,'utf8'));let alive=false;
  try{process.kill(pid,0);alive=true;}catch{}
  if(alive)throw new Error('Importer already running: '+pid);
  unlinkSync(lock);
}
writeFileSync(lock,String(process.pid),{flag:'wx'});
process.on('exit',()=>{try{unlinkSync(lock);}catch{}});
mkdirSync(join(root,'pages'),{recursive:true});
const file=join(root,'catalog.json');
const db=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{schemaVersion:1,source:'https://azbyka.ru/days/',rightsStatus:'unverified-not-for-public-distribution',indexes:{},records:{},blobs:{},lastRequestAt:0};
const save=()=>{writeFileSync(file+'.tmp',JSON.stringify(db,null,2)+'\n');renameSync(file+'.tmp',file);};
db.importState={status:'running',pid:process.pid,startedAt:new Date().toISOString()};
process.on('exit',code=>{db.importState.status=code===0?'stopped':'failed';db.importState.stoppedAt=new Date().toISOString();save();});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function clean(html){return html.replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/\s+/g,' ').trim();}
async function get(url,image=false){
  const u=new URL(url);if(u.origin!=='https://azbyka.ru'||!u.pathname.startsWith('/days/'))throw new Error('Unexpected source URL');
  const cached=join(root,'pages',createHash('sha256').update(u.href).digest('hex')+'.html');
  if(!image&&existsSync(cached))return readFileSync(cached,'utf8');
  await pause(Math.max(0,30000-(Date.now()-db.lastRequestAt)));db.lastRequestAt=Date.now();save();
  const r=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(45000),headers:{'User-Agent':'CalendarIconImporter/1.0 (source-attributed local archive; 30s interval)'}});
  if(!r.ok){const error=new Error(`HTTP ${r.status}: ${u}`);error.status=r.status;throw error;}
  if(image&&!/^image\/(jpeg|png|webp|gif)(?:;|$)/i.test(r.headers.get('content-type')||''))throw new Error('Not a supported raster image: '+u);
  const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>32*1024*1024)throw new Error('Oversized source file');
  if(!image)writeFileSync(cached,bytes);
  if(image){const magic=bytes.subarray(0,12);if(!(magic[0]===255&&magic[1]===216&&magic[2]===255)&&!magic.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&!/^GIF8[79]a/.test(magic.toString())&&!(magic.subarray(0,4).toString()==='RIFF'&&magic.subarray(8,12).toString()==='WEBP'))throw new Error('Invalid raster file signature');}
  return image?{bytes,mime:r.headers.get('content-type').split(';')[0].toLowerCase()}:bytes.toString('utf8');
}
function links(html){const table=html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1]||'';return [...table.matchAll(/<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/g)].filter(m=>/^\/days\/(?:sv-|ikona-)/.test(m[1])).map(m=>({url:new URL(m[1],db.source).href,title:clean(m[2])}));}
async function index(url,kind){if(db.indexes[url])return;const html=await get(url);const list=links(html);if(!list.length)throw new Error('Index layout changed: '+url);for(const item of list)db.records[item.url]??={...item,kind,status:'pending',rightsStatus:'unverified',images:[],dates:[],mappingStatus:'unreviewed',calendarRecordIds:[]};db.indexes[url]={count:list.length,fetchedAt:new Date().toISOString()};save();console.log('INDEX',kind,list.length,Object.keys(db.records).length);}
// Scope: the three user-selected icon catalogues. Do not scrape biographies or
// other sections. Re-running is safe: completed cards are skipped.
const selectedKind=process.argv.find(x=>x.startsWith('--kind='))?.split('=')[1]||'';
if(selectedKind&&!['mother-of-god','savior','saint'].includes(selectedKind))throw new Error('Unknown --kind: '+selectedKind);
if(!selectedKind||selectedKind==='mother-of-god')await index('https://azbyka.ru/days/menology/ikons','mother-of-god');
if(!selectedKind||selectedKind==='savior')await index('https://azbyka.ru/days/menology/ikons-savior','savior');
if(!selectedKind||selectedKind==='saint')for(let page=1;page<=16;page++)await index('https://azbyka.ru/days/menology/saints-with-ikon'+(page===1?'':`?page=${page}`),'saint');
const max=Number(process.argv.find(x=>x.startsWith('--max='))?.split('=')[1]||Infinity);let done=0;
for(const record of Object.values(db.records)){
  if(selectedKind&&record.kind!==selectedKind)continue;
  if(record.status==='downloaded'&&record.parserVersion===2&&record.images.every(i=>i.path&&existsSync(join(root,i.path))))continue;if(done>=max)break;
  if(!record.parserVersion)record.status='pending';
  try {
  if(record.status==='pending'){
    const html=await get(record.url);const parsed=parseIconCard(html,record.url);if(!parsed.title)throw new Error('Missing title: '+record.url);
    record.title=parsed.title;record.description=`${record.kind==='saint'?'Иконы и изображения':record.kind==='savior'?'Икона Спасителя':'Образ Божией Матери'}: ${record.title}. Карточка источника — Азбука веры.`;
    record.descriptionKind='generated-catalog-label-not-biography';
    record.dates=parsed.dates;record.images=parsed.images.map(image=>({...image,status:'pending'}));record.parserVersion=2;
    record.fetchedAt=new Date().toISOString();record.status='metadata';save();
  }
  for(const image of record.images){if(image.status==='downloaded'&&image.path&&existsSync(join(root,image.path)))continue;let blob=db.blobs[image.sourceUrl];if(blob&&!existsSync(join(root,blob.path)))blob=null;if(!blob){const {bytes,mime}=await get(image.sourceUrl,true);const hash=createHash('sha256').update(bytes).digest('hex');const extension=({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'})[mime];const relative=`originals/${hash}.${extension}`;mkdirSync(join(root,'originals'),{recursive:true});if(!existsSync(join(root,relative)))writeFileSync(join(root,relative),bytes);blob={path:relative,sha256:hash,bytes:bytes.length,mime,downloadedAt:new Date().toISOString()};db.blobs[image.sourceUrl]=blob;}Object.assign(image,blob,{status:'downloaded',previewStatus:'pending'});save();}
  record.status=record.images.length?'downloaded':'no-images';delete record.error;save();done++;console.log(new Date().toISOString(),'CARD',Object.values(db.records).filter(r=>r.status==='downloaded').length,record.title,record.images.length,'IMAGES',Object.keys(db.blobs).length);
  } catch(error) {
    record.error={message:error.message,at:new Date().toISOString()};save();
    console.error(new Date().toISOString(),'ERROR',record.url,error.message);
    if(error.status===404||error.status===410){record.status='source-missing';save();continue;}
    throw error;
  }
}
console.log(JSON.stringify({records:Object.keys(db.records).length,downloaded:Object.values(db.records).filter(r=>r.status==='downloaded').length,images:Object.keys(db.blobs).length}));
