import {existsSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve('data/icon-library');
const db=JSON.parse(readFileSync(join(root,'catalog.json'),'utf8'));
const records=Object.values(db.records), blobs=Object.values(db.blobs);
let running=false;const lock=join(root,'import.lock');
if(existsSync(lock)){try{process.kill(Number(readFileSync(lock,'utf8')),0);running=true;}catch{}}
console.log(JSON.stringify({running,process:db.importState,records:records.length,
  downloaded:records.filter(r=>r.status==='downloaded').length,
  withImages:records.filter(r=>r.images?.some(i=>i.status==='downloaded')).length,
  metadataOnly:records.filter(r=>r.status==='metadata').length,
  pending:records.filter(r=>r.status==='pending').length,
  sourceMissing:records.filter(r=>r.status==='source-missing').length,
  noImages:records.filter(r=>r.status==='no-images').length,
  files:blobs.length,bytes:blobs.reduce((n,b)=>n+b.bytes,0),
  missingFiles:blobs.filter(b=>!existsSync(join(root,b.path))).length,
  errors:records.filter(r=>r.error).map(r=>({url:r.url,...r.error})),
  lastRequestAt:new Date(db.lastRequestAt).toISOString()},null,2));
