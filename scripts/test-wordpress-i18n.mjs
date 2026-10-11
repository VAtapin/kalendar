import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,cpSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const site=resolve('tmp/orthocal-wp/wordpress'),args=['-d','extension=mbstring','-d','extension=pdo_sqlite','-d','extension=sqlite3'];
const origin=readFileSync(site+'/wp-config.php','utf8').match(/WP_HOME','([^']+)/)[1];
cpSync(resolve('wordpress/orthocal'),site+'/wp-content/plugins/orthocal',{recursive:true});
const server=spawn('php',[...args,'-S',origin.replace('http://',''),'-t',site],{stdio:'ignore'});
let browser;
try {
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
  await page.goto(origin+'/wp-login.php');await page.locator('#user_login').fill('tester');await page.locator('#user_pass').fill('local-test-only-7391');await Promise.all([page.waitForURL('**/wp-admin/**'),page.locator('#wp-submit').click()]);
  mkdirSync('tmp/i18n-178-screenshots',{recursive:true});
  for(const [locale,title,constructor] of [['en_US','Today','Generator'],['ru_RU','Сегодня','Конструктор'],['de_DE','Heute','Shortcode-Generator'],['uk','Сьогодні','Конструктор'],['pl_PL','Dzisiaj','Kreator']]) {
    execFileSync('php',[...args,'scripts/test-wordpress-i18n.php',site,locale],{stdio:'inherit'});
    await page.goto(origin+'/wp-admin/admin.php?page=orthocal&tab=shortcodes');
    await page.locator('[data-oc-preview-slot] .orthocal').waitFor();
    const copied={en_US:'Shortcode copied.',ru_RU:'Шорткод скопирован.',de_DE:'Shortcode kopiert.',uk:'Шорткод скопійовано.',pl_PL:'Krótki kod został skopiowany.'}[locale];
    assert.equal(await page.evaluate(()=>wp.i18n.__('Shortcode copied.','georg-kloster-calendar-workshop')),copied);
    assert.ok((await page.locator('[data-oc-tab="shortcodes"]').innerText()).includes(constructor));
    await page.screenshot({path:resolve('tmp/i18n-178-screenshots/admin-'+locale+'.png')});
    await page.goto(origin+'/wp-admin/post-new.php?post_type=page');await page.waitForFunction(()=>window.wp?.blocks?.getBlockType('orthocal/today'));
    assert.ok((await page.evaluate(()=>wp.blocks.getBlockType('orthocal/today').title)).includes(title));
    console.log('PASS browser '+locale+': admin JavaScript catalogue and Gutenberg title');
  }
} finally {
  execFileSync('php',[...args,'scripts/test-wordpress-i18n.php',site,'ru_RU'],{stdio:'ignore'});
  await browser?.close();server.kill();
}
