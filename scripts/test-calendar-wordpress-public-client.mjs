import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:net';

mkdirSync('tmp',{recursive:true});
const data=mkdtempSync(resolve('tmp/calendar-wordpress-client-test-'));
const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const origin=`http://127.0.0.1:${port}`,base=`${origin}/api/v1/calendar`,wordpressHeaders={'X-Calendar-Client':'orthocal-wordpress'};
const server=spawn(process.env.PHP_BINARY||'php',['-S',`127.0.0.1:${port}`,'-t',resolve('dist'),'scripts/php-dev-router.php'],{windowsHide:true,stdio:'ignore',env:{...process.env,CALENDAR_DATA_DIR:data,APP_PUBLIC_URL:origin}});
const request=async(path,headers=wordpressHeaders)=>{const response=await fetch(base+path,{headers});const body=await response.arrayBuffer();return {response,body};};
try {
  for(let attempt=0;attempt<60;attempt++){try{if((await fetch(base)).status===200)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  for(const path of ['/day?date=2027-05-02','/month?year=2027&month=5','/year?year=2027','/pascha?year=2027','/upcoming?date=2027-01-01&limit=5'])assert.equal((await request(path)).response.status,200,path);
  assert.equal((await request('/day?date=2027-05-02',{})).response.status,401);
  assert.equal((await request('/day?date=2027-05-02',{'X-Calendar-Client':'other'})).response.status,401);
  const texts=await fetch(origin+'/api/v1/calendar-texts/',{headers:wordpressHeaders});assert.equal(texts.status,401);await texts.arrayBuffer();
  const service=await fetch(base+'/service?date=2027-05-02&office=sixth-hour',{headers:wordpressHeaders});assert.equal(service.status,401);await service.arrayBuffer();
  const rateHeaders={...wordpressHeaders,'X-Forwarded-For':'198.51.100.61'};
  for(let index=0;index<90;index++)assert.equal((await request('/pascha?year=2027',rateHeaders)).response.status,200);
  const limited=await request('/pascha?year=2027',rateHeaders);assert.equal(limited.response.status,429);assert.ok(Number(limited.response.headers.get('retry-after'))>0);
  console.info('PASS public WordPress client: endpoint allowlist, protected routes and IP rate limit');
} finally {server.kill();}
