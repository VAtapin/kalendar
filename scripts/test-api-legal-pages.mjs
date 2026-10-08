import assert from 'node:assert/strict';

// No cookies, credentials or authorization headers: reviewers must have public access.
const bibleOrigin=process.env.BIBLE_LEGAL_ORIGIN || 'https://bible-desktop.com';
async function publicDocument(url) {
  const response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200,`${url}: HTTP ${response.status}`);
  assert.ok(!/\/login(?:[/?]|$)/.test(response.url),`${url}: redirected to login`);
  return response.text();
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
