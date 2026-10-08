import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync,mkdirSync,existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Kalendar retains editor storage routes, but must never serve calendar data.
mkdirSync('tmp',{recursive:true});
const data=mkdtempSync(resolve('tmp/removed-calendar-api-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const origin=`http://127.0.0.1:${port}`;
const server=spawn(process.env.PHP_BINARY||'php',['-S',`127.0.0.1:${port}`,'-t',resolve('dist'),'scripts/php-dev-router.php'],{windowsHide:true,stdio:'ignore',env:{...process.env,CALENDAR_DATA_DIR:data,APP_PUBLIC_URL:origin}});
try {
  for(let i=0;i<60;i++){try{if((await fetch(origin+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  for(const route of ['calendar','calendar/today','calendar/day?date=2026-10-08','calendar/month?year=2026&month=10','calendar/year?year=2026','calendar/pascha?year=2026','calendar/upcoming?date=2026-10-08','calendar/service?date=2026-10-08','calendar-demo/day?date=2026-10-08','calendar-texts','calendar-access/plans','liturgical/works']) {
    for(const method of ['GET','POST']) {
      const response=await fetch(`${origin}/api/v1/${route}`,{method});
      assert.equal(response.status,404,`${method} ${route} must be retired`);
    }
  }
  for(const file of ['api/calendar-public.php','api/calendar-access.php','api/calendar-service.php','api/calendar-texts.php','api/liturgical.php','api/calendar-runtime.mjs','api/calendar-runtime.json','calendar-api-font.php','calendar-api-test.html']) {
    assert.equal(existsSync(resolve('dist',file)),false,`${file} must be absent after publication`);
  }
  assert.equal((await fetch(origin+'/api/v1/calendar-grid-templates')).status,200,'Editor grid templates remain available');
  const client=readFileSync('public/calendar-ui/web-calendar.js','utf8');
  assert.ok(client.includes("new URL('/api/v1/calendar/' + path, globalThis.KalendarConfig.publicApiUrl)"));
  assert.ok(!client.includes('/api/v1/calendar-demo/'));
  console.log('PASS retired calendar endpoints return 404, deployed runtime is absent, editor templates remain available, calendar client uses Bible Desktop');
} finally {server.kill();}
