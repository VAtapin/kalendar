import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

// Isolated PHP HTTP regression. No browser, production data or real mail.
mkdirSync('tmp', { recursive: true });
const data = mkdtempSync(resolve('tmp/calendar-save-http-'));
const origin = 'http://127.0.0.1:18987';
const php = process.env.PHP_BINARY || 'php';
const project = { schemaVersion: 1, name: 'Large calendar', year: 2027,
  document: { pages: Array.from({ length: 13 }, () => ({ elements: [], layers: [] })) },
  assets: [{ id: 'photo', source: 'data:image/jpeg;base64,' + 'a'.repeat(2 * 1024 * 1024) }],
  calendarSnapshot: { snapshot: JSON.parse(gunzipSync(readFileSync('tests/fixtures/editor-calendar-2027-ru.json.gz'))) } };
writeFileSync(resolve(data, 'project.json'), JSON.stringify(project));
const env = { ...process.env, CALENDAR_DATA_DIR: data, APP_PUBLIC_URL: origin, MAIL_TRANSPORT: 'disabled-test' };
const seed = `require 'public/api/lib.php';
$dir=getenv('CALENDAR_DATA_DIR'); $s=new CalendarStore($dir);
$link=$s->accountEmailLink('regression@example.org',false);
$token=$s->accountSetPassword($link['token'],'local-test-password-123'); $user=$s->accountUser($token);
$project=json_decode(file_get_contents($dir.'/project.json'),true,512,JSON_THROW_ON_ERROR);
$id=calendar_uuid(); $history=[];
for($i=1;$i<=10;$i++) $history[]=['revision'=>$i,'at'=>'2026-01-01T00:00:00Z','project'=>$project];
calendar_atomic_json_write($dir.'/calendars/'.$id.'.json',['id'=>$id,'owner'=>$user['id'],'revision'=>11,'updatedAt'=>'2026-01-01T00:00:00Z','project'=>$project,'history'=>$history]);
echo json_encode(['id'=>$id,'token'=>$token]);`;
const { id, token } = JSON.parse(execFileSync(php, ['-d', 'memory_limit=768M', '-r', seed], { env, encoding: 'utf8' }));
const server = spawn(php, ['-d', 'memory_limit=768M', '-S', '127.0.0.1:18987', 'scripts/php-dev-router.php'],
  { env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
let serverErrors = '';
server.stderr.on('data', chunk => { serverErrors = (serverErrors + chunk).slice(-4000); });
async function request(path, method = 'GET', body, authenticated = true) {
  return fetch(origin + '/api/v1/' + path, { method, headers: { Origin: origin,
    'Content-Type': 'application/json', ...(authenticated ? { Cookie: `calendar_account=${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
try {
  let ready = false;
  for (let n = 0; n < 50; n++) {
    try { await fetch(origin + '/health'); ready = true; break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  assert.ok(ready, 'local PHP server starts: ' + serverErrors);
  project.name = 'Edited calendar';
  const source = project.assets[0].source;
  project.assets[0].source = '';
  const saved = await request(`account/calendars/${id}`, 'PUT', { project, revision: 11, reuseAssets: ['photo'] });
  assert.equal(saved.status, 200, await saved.text());
  const reopened = await (await request(`account/calendars/${id}`)).json();
  assert.equal(reopened.revision, 12);
  assert.equal(reopened.project.name, 'Edited calendar');
  assert.equal(reopened.project.assets[0].source, source);
  assert.deepEqual(reopened.project.calendarSnapshot, project.calendarSnapshot);
  assert.equal(reopened.project.document.pages.length, 13);
  const history = await (await request(`account/calendars/${id}/history`)).json();
  assert.equal(history.items.length, 10);
  const restored = await request(`account/calendars/${id}`, 'PUT', { revision: 12, restoreRevision: 2 });
  assert.equal(restored.status, 200, await restored.text());
  const restoredProject = await (await request(`account/calendars/${id}`)).json();
  assert.equal(restoredProject.project.name, 'Large calendar');
  assert.equal(restoredProject.project.assets[0].source, source);
  const conflict = await request(`account/calendars/${id}`, 'PUT', { project, revision: 1 });
  assert.equal(conflict.status, 409);
  assert.ok(conflict.headers.get('x-calendar-request-id'));
  assert.equal((await request('account/calendars', 'GET', undefined, false)).status, 401);
  assert.equal((await request('missing?token=secret')).status, 404);
  assert.equal((await request('client-errors', 'POST', { kind: 'network', operation: 'calendar-save', status: 0,
    message: 'private calendar', token: 'secret' }, false)).status, 204);
  assert.equal((await request('client-errors', 'POST', { kind: 'invalid', operation: 'api', status: 0 }, false)).status, 400);
  assert.equal((await request('client-errors', 'POST', { kind: 'print', operation: 'print-fonts', status: 0 }, false)).status, 204);
  const journalPath = resolve(data, 'logs/errors.jsonl');
  const logs = () => readFileSync(journalPath, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  const entries = logs();
  assert.deepEqual(entries.filter(e => e.kind === 'api').map(e => e.status), [409, 401, 404, 400]);
  assert.equal(entries.find(e => e.status === 409).code, 'revision_conflict');
  assert.ok(entries.some(e => e.kind === 'client' && e.operation === 'calendar-save'));
  assert.ok(entries.some(e => e.kind === 'client' && e.operation === 'print-fonts'));
  assert.doesNotMatch(readFileSync(journalPath, 'utf8'), /secret|private calendar|regression@example|data:image/);
  for (let n = 0; n < 35; n++) await request('client-errors', 'POST', { kind: 'vue', operation: 'application', status: 0 }, false);
  assert.equal(logs().filter(e => e.kind === 'client').length, 30);
  const warning = `require 'public/api/lib.php'; calendar_install_error_journal(getenv('CALENDAR_DATA_DIR')); trigger_error('secret', E_USER_WARNING);`;
  execFileSync(php, ['-r', warning], { env, stdio: 'ignore' });
  assert.ok(logs().some(e => e.kind === 'php' && e.severity === 512));
  const fatal = `require 'public/api/lib.php'; calendar_install_error_journal(getenv('CALENDAR_DATA_DIR')); $huge=str_repeat('x',32*1024*1024);`;
  assert.throws(() => execFileSync(php, ['-d', 'memory_limit=16M', '-r', fatal], { env, stdio: 'ignore' }));
  assert.ok(logs().some(e => e.kind === 'fatal' && e.code === 'memory_exhausted'));
  assert.doesNotMatch(readFileSync(journalPath, 'utf8'), /secret/);
  writeFileSync(journalPath, 'x'.repeat(5 * 1024 * 1024));
  await request('missing');
  assert.equal(logs().length, 1);
  assert.ok(readFileSync(journalPath + '.1').length >= 5 * 1024 * 1024);
  console.log('PASS: 768 MB large calendar save/reopen, asset reuse, ten backups/restore, revision/authorization guards; errors-only private journal, redaction, client rate limit, PHP warning/fatal, rotation.');
} finally { server.kill(); }
