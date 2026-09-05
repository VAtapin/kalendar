import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

mkdirSync('tmp', { recursive: true });
const data = mkdtempSync(resolve('tmp/admin-http-'));
const origin = 'http://127.0.0.1:18989';
const server = spawn('php', ['-S', '127.0.0.1:18989', 'scripts/php-dev-router.php'], {
  env: { ...process.env, CALENDAR_DATA_DIR: data, APP_PUBLIC_URL: origin,
    CALENDAR_OWNER_EMAIL: 'owner@example.org', MAIL_TRANSPORT: 'disabled-test',
    MAIL_FROM_ADDRESS: 'sender@example.org' }, stdio: 'ignore', windowsHide: true,
});
async function call(path, body, token) {
  const response = await fetch(`${origin}/api/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json() };
}
async function login(email, subscribe = false) {
  const sent = await call('email-verifications', { email, subscribe });
  assert.equal(sent.status, 201);
  const token = new URL(sent.data.developmentVerificationUrl).searchParams.get('verify');
  const result = await call('email-verifications/confirm', { token });
  assert.equal(result.status, 200);
  return result.data.accessToken;
}
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try { await call(''); ready = true; break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  assert.ok(ready, 'PHP server starts');
  const regular = await login('regular@example.org');
  const paired = await call('email-verifications', {email:'paired@example.org', browserFlow:true});
  const browserSecret = paired.data.requestToken;
  const mailToken = new URL(paired.data.developmentVerificationUrl).searchParams.get('verify');
  assert.equal((await call('email-verifications/status', {requestToken:browserSecret})).data.status, 'pending');
  assert.equal((await call('user-settings', undefined, browserSecret)).status, 401);
  const phone = await call('email-verifications/confirm', {token:mailToken});
  assert.equal(phone.data.returnToRequestingBrowser, true);
  assert.equal(phone.data.accessToken, undefined);
  assert.equal((await call('email-verifications/status', {requestToken:browserSecret})).data.email, 'paired@example.org');
  assert.equal((await call('user-settings', undefined, browserSecret)).status, 200);
  assert.equal((await call('user-settings', undefined, mailToken)).status, 401);
  const owner = await login('owner@example.org');
  for (const endpoint of ['calendars', 'subscribers', 'mail-log']) {
    assert.equal((await call(`admin/${endpoint}`)).status, 403);
    assert.equal((await call(`admin/${endpoint}`, undefined, regular)).status, 403);
    assert.equal((await call(`admin/${endpoint}`, undefined, owner)).status, 200);
  }
  assert.equal((await call('admin/campaigns', {subject:'x', text:'x'}, regular)).status, 403);
  assert.equal((await call('admin/calendars/00000000-0000-4000-8000-000000000000', undefined, regular)).status, 403);
  assert.equal((await call('admin/campaigns/00000000-0000-4000-8000-000000000000/send', {}, regular)).status, 403);
  for (let i = 0; i < 6; i++) await login('regular@example.org');
  assert.equal((await call('user-settings', undefined, regular)).status, 200);
  await login('subscriber@example.org', true);
  const subscribers = (await call('admin/subscribers', undefined, owner)).data.items;
  assert.equal(subscribers.find(x => x.email === 'subscriber@example.org').status, 'subscribed');
  assert.equal(subscribers.find(x => x.email === 'regular@example.org').status, 'not_subscribed');
  assert.ok(!JSON.stringify(subscribers).includes('unsubscribeToken'));
  const campaign = await call('admin/campaigns', {subject:'Test', text:'No real email will be sent'}, owner);
  assert.equal(campaign.data.total, 1);
  const sent = await call(`admin/campaigns/${campaign.data.id}/send`, {}, owner);
  assert.equal(sent.data.failed, 1);
  assert.equal((await call(`admin/campaigns/${campaign.data.id}/send`, {}, owner)).data.failed, 1);
  assert.equal((await call('admin/mail-log', undefined, owner)).data.items.filter(x => x.kind === 'newsletter').length, 1);
  console.log('PASS: owner-only APIs, durable browser credentials, consent, mail log, no duplicate campaign retries. No real mail sent.');
} finally { server.kill(); }
