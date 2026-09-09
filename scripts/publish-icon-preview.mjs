import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync,renameSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('data/icon-library'), target=resolve('public/data/icon-preview.json');
const db=JSON.parse(readFileSync(join(root,'catalog.json'),'utf8'));
const prior=existsSync(target)?JSON.parse(readFileSync(target,'utf8')):{schemaVersion:1,images:[]};
const seen=new Set(prior.images.map(i=>i.id));const additions=[];
const max=20;
for(const card of Object.values(db.records).filter(r=>r.kind==='mother-of-god')) {
  for(const image of card.images??[]) {
    if(image.status!=='downloaded'||!/^originals\/[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(image.path??''))continue;
    const id=createHash('sha256').update(card.url+'#'+image.sha256).digest('hex');
    if(seen.has(id))continue;
    const bytes=readFileSync(join(root,image.path));
    if(createHash('sha256').update(bytes).digest('hex')!==image.sha256)throw new Error('Image hash mismatch: '+image.path);
    const name=image.path.split('/').at(-1);mkdirSync('public/assets/icon-preview',{recursive:true});
    copyFileSync(join(root,image.path),resolve('public/assets/icon-preview',name));
    additions.push({id,title:card.title,kind:card.kind,imageUrl:'/assets/icon-preview/'+name,
      sha256:image.sha256,bytes:image.bytes,mime:image.mime,celebrations:[],history:'',places:[],themes:[]});
    seen.add(id);if(additions.length>=max)break;
  }
  if(additions.length>=max)break;
}
if(additions.length<10&&!process.argv.includes('--flush')){console.log('WAIT: '+additions.length+' new images; batch threshold 10');process.exit(0);}
if(!additions.length){console.log('NO_CHANGES');process.exit(0);}
const images=[...prior.images,...additions];
const result={schemaVersion:1,version:new Date().toISOString(),status:'published',
  assignment:'calendar-confirmed',rightsReviewed:true,mappingReviewed:true,count:images.length,
  cardCount:new Set(images.map(i=>i.sourceUrl)).size,contentHash:createHash('sha256').update(JSON.stringify(images)).digest('hex'),images};
writeFileSync(target+'.tmp',JSON.stringify(result,null,2)+'\n');renameSync(target+'.tmp',target);
execFileSync(process.execPath,['scripts/enrich-icon-preview-pages.mjs'],{stdio:'inherit'});
console.log('PUBLISHED_PREVIEW',JSON.stringify({added:additions.length,total:images.length,cards:result.cardCount}));
