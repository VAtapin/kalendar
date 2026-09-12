import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Called by the real WordPress/SQLite browser suite after administrator login.
export async function testDisplayOptions({page,origin,site,phpArgs,screenshotRoot}) {
  // Each phase is a separate local test scenario; production rate limits stay unchanged.
  const resetRateWindow=()=>execFileSync('php',[...phpArgs,'-r',`require '${site.replaceAll('\\','/')}/wp-load.php'; foreach(['global',hash('sha256','127.0.0.1'.wp_salt())] as $id)delete_transient('oc_rate_'.md5($id.gmdate('YmdHi')));`]);
  resetRateWindow();
  const preview=page.locator('[data-oc-preview-slot]');
  const field=name=>page.locator(`[data-oc-build="${name}"]`);
  const year=JSON.parse(readFileSync(site+'/wp-content/calendar-fixture.json','utf8'));
  const noFast=year.days.find(day=>day.foodMarkers[0].source.endsWith('/no-fast.png'));
  assert.ok(noFast,'fixture has a day without a fast');
  await field('mode').selectOption('day');
  await field('date').fill(noFast.date);
  const packs=await field('image_pack').locator('option').evaluateAll(options=>options.map(option=>option.value));
  assert.equal(packs.length,16);
  const shortcodes=[];
  const expected=new Map();
  for(const pack of packs) {
    const marker=noFast.foodMarkers.find(marker=>marker.packId===pack);
    assert.ok(marker,`${pack}: API mapping exists`);
    const bytes=readFileSync(resolve('public',marker.source.slice(1)));
    expected.set(pack,createHash('sha256').update(bytes).digest('hex')+'.png');
    await field('image_pack').selectOption(pack);
    await page.locator('[data-oc-preview]').click();
    await page.waitForFunction(({pack,date})=>{
      const root=document.querySelector('[data-oc-preview-slot] .orthocal');
      const cfg=JSON.parse(root?.dataset.orthocal||'{}');
      return cfg.image_pack===pack && cfg.date===date;
    },{pack,date:noFast.date});
    const image=preview.locator('.oc-fast img');
    await image.waitFor();
    assert.ok((await image.getAttribute('src')).endsWith(expected.get(pack)),`${pack}: selected file in admin preview`);
    assert.equal(await image.evaluate(async img=>{await img.decode();return img.naturalWidth>0;}),true,`${pack}: decoded image`);
    shortcodes.push(await page.locator('#oc-generated-code').inputValue());
  }
  // Save the actual generated shortcodes in WordPress, then read them on a public page.
  const save=site+'/save-display-test.php';
  writeFileSync(site+'/display-shortcodes.json',JSON.stringify(shortcodes));
  writeFileSync(save,`<?php
require __DIR__.'/wp-load.php';
$codes=json_decode(file_get_contents(__DIR__.'/display-shortcodes.json'),true);
foreach(array_keys(Orthocal_Admin::packs()) as $pack) {
    update_option('orthocal_options',Orthocal_Plugin::sanitize_options(['image_pack'=>$pack]));
    if(Orthocal_Plugin::config([])['image_pack']!==$pack)throw new Exception('Saved pack lost: '.$pack);
}
$id=wp_insert_post(['post_title'=>'Display options regression','post_content'=>implode("\\n",$codes),'post_type'=>'page','post_status'=>'publish']);
echo $id;
`);
  const id=Number(execFileSync('php',[...phpArgs,save],{encoding:'utf8'}).trim());
  assert.ok(id);
  const publicPage=await page.context().browser().newPage();
  await publicPage.goto(origin+'/?page_id='+id);
  for(const pack of packs) {
    const image=publicPage.locator(`.oc-fast img[src$="${expected.get(pack)}"]`);
    assert.equal(await image.count(),1,`${pack}: saved frontend card`);
    await image.scrollIntoViewIfNeeded();
    assert.equal(await image.evaluate(async img=>{await img.decode();return img.naturalWidth>0;}),true,`${pack}: decoded public image`);
  }
  await publicPage.screenshot({path:resolve(screenshotRoot,'orthocal-all-packs.png'),fullPage:true});
  await publicPage.reload();
  assert.equal(await publicPage.locator('.oc-fast img').count(),16);
  console.log('PASS all 16 packs on a no-fast day: API mapping, local bytes, admin preview, saved settings/shortcodes, public page and reload');

  // Deliberately return an older preview after the most recent selection.
  let release,started;
  const held=new Promise(resolve=>release=resolve), captured=new Promise(resolve=>started=resolve);
  const match=url=>url.searchParams.get('rest_route')==='/orthocal/v1/render'&&url.searchParams.get('image_pack')==='blue-photo';
  await page.route(match,async route=>{const response=await route.fetch();started();await held;await route.fulfill({response});});
  await field('image_pack').selectOption('blue-photo');
  await page.locator('[data-oc-preview]').click();
  await captured;
  await field('image_pack').selectOption('gold-photo');
  await page.locator('[data-oc-preview]').click();
  await preview.locator(`.oc-fast img[src$="${expected.get('gold-photo')}"]`).waitFor();
  const finished=page.waitForResponse(response=>match(new URL(response.url())));
  release();await finished;
  await page.unroute(match);
  // A later browser task allows the released response's JSON/render continuation to finish.
  await page.waitForTimeout(100);
  assert.ok((await preview.locator('.oc-fast img').getAttribute('src')).endsWith(expected.get('gold-photo')));
  console.log('PASS delayed preview cannot replace the latest selected image pack');

  resetRateWindow();
  for(const mode of ['horologion','kontakia','troparia','canons','akathists','prayers','magnifications','texts']) {
    await field('mode').selectOption(mode);
    for(const language of ['cu','cu-civil']) {
      await field('text_language').selectOption(language);
      await page.locator('[data-oc-preview]').click();
      await page.waitForFunction(({mode,language})=>{
        const root=document.querySelector('[data-oc-preview-slot] .orthocal');
        const cfg=JSON.parse(root?.dataset.orthocal||'{}');
        return cfg.mode===mode&&cfg.text_language===language;
      },{mode,language});
      const text=preview.locator('.oc-library-content').first();
      if(language==='cu'&&mode!=='horologion') {
        assert.equal(await text.count(),0,`${mode}: absent cu edition must not be replaced by cu-civil`);
        continue;
      }
      const family=await text.evaluate(el=>getComputedStyle(el).fontFamily);
      assert.equal(family.includes('OrthocalMonomakh'),language==='cu',`${mode}/${language}: ${family}`);
      if(language==='cu') {
        await page.evaluate(()=>document.fonts.ready);
        assert.equal(await page.evaluate(()=>[...document.fonts].some(font=>font.family==='OrthocalMonomakh'&&font.status==='loaded')),true);
        await preview.screenshot({path:resolve(screenshotRoot,'orthocal-slavonic-font.png')});
      }
    }
    // Switch inside the reader using its existing AJAX control; the document stays in place.
    const before=await page.evaluate(()=>performance.timeOrigin);
    const civilText=await preview.locator('.oc-library-content').first().textContent();
    if(mode==='horologion') {
      await preview.locator('[data-oc-library-language]').selectOption('cu');
      await preview.locator('.oc-library-content[data-orthography="traditional"]').first().waitFor({state:'attached'});
      assert.equal(await page.evaluate(()=>performance.timeOrigin),before);
      assert.notEqual(await preview.locator('.oc-library-content').first().textContent(),civilText,'cu and cu-civil must load separate editions');
    }
    console.log(`Browser: ${mode} language isolation and fonts verified`);
  }
  resetRateWindow();
  for(const mode of ['horologion','kontakia','troparia','canons','akathists','prayers','magnifications']) {
    await publicPage.locator('.orthocal').first().locator(`[data-oc-library="${mode}"]`).click();
    const dialog=publicPage.locator('dialog[open]');
    if(mode==='horologion') {
      await dialog.locator('[data-oc-library-language]').selectOption('cu');
      await dialog.locator('.oc-library-content[data-orthography="traditional"]').first().waitFor({state:'attached'});
      assert.match(await dialog.locator('.oc-library-content').first().evaluate(el=>getComputedStyle(el).fontFamily),/OrthocalMonomakh/);
    }
    const documentOrigin=await publicPage.evaluate(()=>performance.timeOrigin);
    await dialog.locator('[data-oc-library-language]').selectOption('cu-civil');
    await dialog.locator('.oc-library-content[data-orthography="civil"]').first().waitFor({state:'attached'});
    assert.doesNotMatch(await dialog.locator('.oc-library-content').first().evaluate(el=>getComputedStyle(el).fontFamily),/Monomakh/);
    assert.equal(await publicPage.evaluate(()=>performance.timeOrigin),documentOrigin);
    if(mode==='canons')await dialog.screenshot({path:resolve(screenshotRoot,'orthocal-canon-civil.png')});
    await dialog.locator('.oc-dialog-close').click();
  }
  await publicPage.close();
  resetRateWindow();
  await field('mode').selectOption('day');
  await field('text_language').selectOption('');
  await page.locator('[data-oc-preview]').click();
  await preview.locator('.oc-day').waitFor();
  console.log('PASS eight liturgical modes: civil fonts, no replacement of absent cu editions, real cu/Monomakh in Horologion and public AJAX readers');
}
