import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from 'playwright';

// Disposable real WordPress + official SQLite drop-in. No production credentials.
const site=resolve('tmp/orthocal-wp/wordpress');
assert.ok(existsSync(site+'/wp-load.php'),'Download WordPress and SQLite Database Integration into tmp/orthocal-wp first (see docs/WORDPRESS-PLUGIN.md).');
cpSync(resolve('wordpress/orthocal'),site+'/wp-content/plugins/orthocal',{recursive:true});
cpSync(site+'/wp-content/plugins/sqlite-database-integration/db.copy',site+'/wp-content/db.php');
mkdirSync(site+'/wp-content/mu-plugins',{recursive:true});
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const origin='http://127.0.0.1:'+port;
writeFileSync(site+'/wp-config.php',`<?php
define('DB_NAME','orthocal_test'); define('DB_USER',''); define('DB_PASSWORD',''); define('DB_HOST','localhost');
define('DB_ENGINE','sqlite'); define('WP_HOME','${origin}'); define('WP_SITEURL','${origin}');
define('AUTH_KEY','orthocal-local-test-only'); define('AUTH_SALT','orthocal-local-salt');
define('ORTHOCAL_TEST_ASSET_ROOT',${JSON.stringify(resolve('public').replaceAll('\\','/'))});
define('WP_DEBUG',true); define('WP_DEBUG_DISPLAY',false); define('WP_DEBUG_LOG',true); define('DISABLE_WP_CRON',true);
$table_prefix='oc_'; if(!defined('ABSPATH')) define('ABSPATH',__DIR__.'/'); require_once ABSPATH.'wp-settings.php';
`);
const year=JSON.parse(execFileSync(process.execPath,['dist/api/calendar-runtime.mjs','2027','typikon-strict','ru'],{encoding:'utf8',maxBuffer:32*1024*1024}));
writeFileSync(site+'/wp-content/calendar-fixture.json',JSON.stringify(year));
cpSync(resolve('scripts/wordpress-test-fixtures.php'),site+'/wp-content/mu-plugins/fixtures.php');
writeFileSync(site+'/install-test.php',`<?php
define('WP_INSTALLING',true); require __DIR__.'/wp-load.php'; require_once ABSPATH.'wp-admin/includes/upgrade.php';
if(!is_blog_installed()) wp_install('Календарная мастерская','tester','tester@example.invalid',false,'','local-test-only-7391');
update_option('timezone_string','Europe/Berlin'); update_option('orthocal_options',['key'=>'local-test-secret','lang'=>'ru']);
update_option('active_plugins',['orthocal/orthocal.php']); update_option('permalink_structure','');
update_option('orthocal_cache_generation',wp_generate_uuid4());
$old=get_page_by_path('calendar-demo');
$content='<!-- wp:group {"align":"wide","layout":{"type":"default"}} --><div class="wp-block-group alignwide">';
foreach(['[orthocal_today date="2027-05-02"]','[orthocal_upcoming date="2027-05-01"]','[orthocal_month year="2027" month="5"]','[orthocal_year year="2027"]','[orthocal_day date="2027-05-02"]','[orthocal_readings date="2027-05-02"]'] as $shortcode) $content.='<!-- wp:shortcode -->'.$shortcode.'<!-- /wp:shortcode -->';
$content.='</div><!-- /wp:group -->';
$id=wp_insert_post(['ID'=>$old?$old->ID:0,'post_title'=>'Православный календарь','post_name'=>'calendar-demo','post_content'=>$content,'post_status'=>'publish','post_type'=>'page']);
echo $id;
`);
const phpArgs=['-d','extension=pdo_sqlite','-d','extension=sqlite3','-d','memory_limit=256M'];
const install=execFileSync('php',[...phpArgs,site+'/install-test.php'],{encoding:'utf8'});const pageId=Number(install.trim());assert.ok(pageId,install);
writeFileSync(site+'/verify-test.php',`<?php
require __DIR__.'/wp-load.php';
Orthocal_Media_Cache::clear();
foreach(array_keys(Orthocal_Plugin::TITLES) as $mode) {
    if(!WP_Block_Type_Registry::get_instance()->is_registered('orthocal/'.$mode)) throw new Exception('Missing block '.$mode);
    $rendered=do_shortcode('[orthocal_'.$mode.' date="2027-05-02" year="2027" month="5"]');
    if(!str_contains($rendered,'data-orthocal=')||str_contains($rendered,'data-oc-retry'))throw new Exception('Rendering failed '.$mode);
}
if(!is_wp_error(Orthocal_Plugin::config(['date'=>'2027-02-29']))) throw new Exception('Invalid leap date accepted');
if(is_wp_error(Orthocal_Plugin::config(['date'=>'2028-02-29']))) throw new Exception('Valid leap date rejected');
$html=do_shortcode('[orthocal_day date="2027-05-02"]');
if(str_contains($html,'local-test-secret')||str_contains($html,'<script>alert')) throw new Exception('Unsafe HTML');
if(!str_contains($html,'Светлое Христово')) throw new Exception('Missing source event');
$bad=Orthocal_Plugin::day(['date'=>'2027-05-02','oldStyleDate'=>'2027-04-19','events'=>[['category'=>'commemoration','typeCode'=>7,'title'=>'<script>alert(1)</script>']]],Orthocal_Plugin::config(['mode'=>'day']));
if(str_contains($bad,'<script>')||!str_contains($bad,'&lt;script&gt;')) throw new Exception('XSS escaping');
$attrs=Orthocal_Plugin::config(['theme'=>'','compact'=>'']); if(is_wp_error($attrs)) throw new Exception('Empty Gutenberg defaults');
echo 'PASS WordPress registration, server rendering, validation, escaping and key isolation';
`);
console.log(execFileSync('php',[...phpArgs,site+'/verify-test.php'],{encoding:'utf8'}));
// Separate PHP request: prove the date is served from persistent WordPress cache,
// not merely the in-process memo. Any upstream call here fails the test.
const cachedProbe=`require '${site.replaceAll('\\','/')}/wp-load.php'; add_filter('pre_http_request',function(){throw new Exception('Repeated date called upstream instead of cache');},1,3); $html=do_shortcode('[orthocal_day date="2027-05-02"]'); if(!str_contains($html,'Светлое Христово')) throw new Exception('Cached date missing'); echo 'PASS persistent cache across PHP requests';`;
console.log(execFileSync('php',[...phpArgs,'-r',cachedProbe],{encoding:'utf8'}));
console.log(execFileSync('php',[...phpArgs,resolve('scripts/test-wordpress-media.php'),site],{encoding:'utf8'}));
const server=spawn('php',[...phpArgs,'-S','127.0.0.1:'+port,'-t',site],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let logs='';server.stderr.on('data',b=>logs+=b);
let browser;
try {
  for(let i=0;i<50;i++){try{await fetch(origin);break;}catch{await new Promise(r=>setTimeout(r,100));}}
  const denied=await fetch(origin+'/?rest_route=/orthocal/v1/bible&path=../../wp-config.php');assert.equal(denied.status,400);
  const invalid=await fetch(origin+'/?rest_route=/orthocal/v1/render&date=2027-02-29');assert.equal(invalid.status,400);
  browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const remoteAssets=[];page.on('request',r=>{if(r.url().startsWith('https://kalender.georg-kloster.ru/'))remoteAssets.push(r.url());});
  await page.goto(origin+'/?page_id='+pageId);await page.locator('.orthocal').first().waitFor();
  assert.equal(await page.locator('.orthocal').count(),6);
  console.log('Browser: six blocks rendered');
  assert.ok(!(await page.content()).includes('local-test-secret'));
  const month=page.locator('.orthocal').filter({has:page.locator('h2',{hasText:'Календарь на месяц'})}).first();
  await month.locator('[data-oc-date="2027-05-02"]').click();
  await month.locator('.oc-detail .oc-day').waitFor();
  console.log('Browser: day navigation works');
  assert.equal(await page.locator('.orthocal').count(),7);
  const day=month.locator('.oc-detail .orthocal');
  const permalink=new URL(await day.locator('.oc-permalink a').getAttribute('href'));
  assert.equal(permalink.searchParams.get('page_id'),String(pageId));assert.equal(permalink.searchParams.has('rest_route'),false);
  await day.locator('[data-oc-reading] summary').first().click();
  await day.locator('[data-oc-translation] option[value="test-ru"]').waitFor({state:'attached'});
  await page.waitForFunction(()=>[...document.querySelectorAll('.oc-detail .oc-verses')].some(e=>e.textContent.includes('Тестовый стих')));
  console.log('Browser: Bible verses rendered');
  assert.ok(await day.locator('.oc-verses').first().textContent());
  await day.locator('[data-oc-translation]').selectOption('test-missing');
  await page.waitForFunction(()=>[...document.querySelectorAll('.oc-detail .oc-verses')].some(e=>e.textContent.includes('отсутствуют запрошенные стихи')));
  await month.locator('[data-oc-period="2027-06-01"]').click();
  await month.locator(':scope > .oc-month h3').filter({hasText:'Июнь 2027'}).waitFor();
  assert.equal(await month.locator(':scope > .oc-month [data-oc-date]').count(),30);
  assert.equal(await month.locator(':scope > .oc-detail .orthocal').count(),0);
  // Capture full-width plugin at desktop and a narrow phone viewport.
  await page.screenshot({path:resolve('artifacts/orthocal-desktop.png'),fullPage:true});
  await month.screenshot({path:resolve('artifacts/orthocal-month.png')});
  await page.locator('.orthocal').filter({has:page.locator('h2',{hasText:'Календарь на год'})}).screenshot({path:resolve('artifacts/orthocal-year.png')});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.screenshot({path:resolve('artifacts/orthocal-mobile.png'),fullPage:true});
  await page.locator('.orthocal').first().screenshot({path:resolve('artifacts/orthocal-today-mobile.png')});
  // Exercise actual settings form and the editor's client-side block registrations.
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(origin+'/wp-login.php');
  await page.locator('#user_login').fill('tester');await page.locator('#user_pass').fill('local-test-only-7391');
  await Promise.all([page.waitForURL('**/wp-admin/**'),page.locator('#wp-submit').click()]);
  await page.goto(origin+'/wp-admin/admin.php?page=orthocal');
  assert.equal(await page.locator('input[name="orthocal_options[key]"]').inputValue(),'');
  assert.ok(!(await page.content()).includes('local-test-secret'));
  assert.equal(await page.locator('#toplevel_page_orthocal').count(),1);
  await page.locator('[data-oc-tab="shortcodes"]').click();
  await page.locator('[data-oc-build="compact"]').selectOption('1');
  await page.locator('[data-oc-build-section="fasting"]').uncheck();
  await page.waitForFunction(()=>document.querySelectorAll('[data-oc-preview-slot] .oc-fasting-section').length===0);
  assert.equal(await page.locator('[data-oc-preview-slot] .oc-fasting-section').count(),0);
  await page.locator('[data-oc-build="mode"]').selectOption('troparia');
  await page.locator('[data-oc-build="scope"]').selectOption('resurrection');
  await page.locator('[data-oc-build="tone"]').fill('1');
  assert.match(await page.locator('#oc-generated-code').inputValue(),/orthocal_troparia.*scope="resurrection".*tone="1"|orthocal_troparia.*tone="1".*scope="resurrection"/);
  await page.locator('[data-oc-preview]').click();
  await page.locator('.oc-liturgical-text').waitFor();
  assert.equal(await page.locator('.oc-liturgical-text').count(),1);
  await page.locator('.oc-liturgical-text summary').click();
  await page.screenshot({path:resolve('artifacts/orthocal-library-admin.png'),fullPage:true});
  await page.locator('[data-oc-build="mode"]').selectOption('month');
  await page.locator('[data-oc-build="year"]').fill('2027');
  await page.locator('[data-oc-build="month"]').fill('5');
  await page.locator('[data-oc-build="open"]').selectOption('modal');
  await page.locator('[data-oc-preview]').click();
  await page.locator('[data-oc-preview-slot] [data-oc-date="2027-05-02"]').click();
  await page.locator('dialog[open] .oc-day').waitFor();
  await page.screenshot({path:resolve('artifacts/orthocal-day-modal.png')});
  await page.locator('dialog[open] [data-oc-reading] summary').first().click();
  await page.locator('dialog[open]').nth(1).locator('.oc-verses').filter({hasText:'Тестовый стих'}).first().waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(),1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(),0);
  await page.locator('[data-oc-tab="help"]').click();
  assert.ok(await page.locator('h2',{hasText:'Помощь'}).count());
  assert.deepEqual(remoteAssets,[],'All images and fonts must be served by installed WordPress');
  await page.goto(origin+'/wp-admin/post.php?post='+pageId+'&action=edit');
  await page.waitForFunction(()=>window.wp?.blocks?.getBlockType('orthocal/year'));
  assert.equal(await page.evaluate(()=>wp.blocks.getBlockTypes().filter(b=>b.name.startsWith('orthocal/')).length),19);
  const nojs=await browser.newContext({javaScriptEnabled:false});
  const plain=await nojs.newPage();await plain.goto(origin+'/?page_id='+pageId+'&orthocal_date=2027-05-02');
  assert.ok(await plain.locator('.oc-detail .oc-day').count());await nojs.close();
  assert.deepEqual(errors,[]);
  console.log('PASS real WordPress/SQLite + Edge: 19 modes, persistent media, AJAX month/day, Bible text and missing verses, nested day/reading dialogs, library filters, admin preview/help/settings, key isolation, local-only assets, mobile layout and 19 Gutenberg blocks');
} catch(error) {
  if(browser) {const p=browser.contexts()[0]?.pages()[0];if(p){writeFileSync(resolve('tmp/orthocal-wp/failure.html'),await p.content());await p.screenshot({path:resolve('tmp/orthocal-wp/failure.png'),fullPage:true});}}
  console.error(logs.slice(-3000));throw error;
} finally {await browser?.close();server.kill();}
