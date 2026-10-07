import assert from 'node:assert/strict';

// No cookies, credentials or authorization headers: reviewers must have public access.
const calendarOrigin=process.env.CALENDAR_LEGAL_ORIGIN || 'https://kalender.georg-kloster.ru';
const bibleOrigin=process.env.BIBLE_LEGAL_ORIGIN || 'https://bible-desktop.com';
async function publicDocument(url) {
  const response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200,`${url}: HTTP ${response.status}`);
  assert.ok(!/\/login(?:[/?]|$)/.test(response.url),`${url}: redirected to login`);
  return response.text();
}
const pages=JSON.parse(await publicDocument(`${calendarOrigin}/api/v1/site-pages`));
for(const [slug,marker] of [['agb','1900–2200'],['datenschutz','X-Calendar-Client']]) {
  await publicDocument(`${calendarOrigin}/${slug}`);
  const page=pages.items.find(item=>item.slug===slug);
  assert.ok(page,`${slug}: published CMS page missing`);
  for(const language of ['ru','de','en','uk']) {
    const translation=page.translations[language];
    if (!translation) continue;
    const text=(translation.html||'')+' '+(translation.blocks||[]).map(block=>block.text).join(' ');
    assert.ok(text.includes(marker),`${slug}/${language}: public API disclosure missing`);
    assert.ok(text.includes('bible-desktop.com/pages/api-'),`${slug}/${language}: provider policy link missing`);
  }
  console.log(`PASS anonymous calendar document: ${slug}`);
}
for(const [slug,markers] of [
  ['api-terms',['Terms of Service','bible-desktop.com/api/','rights','atapin@gmail.com']],
  ['api-privacy',['Privacy Policy','IP address','retention','atapin@gmail.com']],
]) {
  const html=await publicDocument(`${bibleOrigin}/pages/${slug}`);
  assert.ok(/<article\b/.test(html),`${slug}: document body missing`);
  const article=html.slice(html.indexOf('<article'),html.indexOf('</article>'));
  for(const marker of markers) assert.ok(article.includes(marker),`${slug}: missing ${marker}`);
  console.log(`PASS anonymous Bible Desktop document: ${slug}`);
}
