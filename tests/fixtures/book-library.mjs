export function libraryFixture(slug = 'whole-cu-minea-03-25', count = 3) {
  const edition = { code: 'library-test-cu', title: 'Точная редакция', language: 'cu', orthography: 'traditional', reader_profile: 'full' };
  const work = { slug, title: 'Кни́га: те́стъ', editions: [edition], source_url: 'https://source.example/book' };
  const data = { slug, title: work.title, edition: edition.code, edition_title: edition.title, language: 'cu', orthography: 'traditional', reader_profile: 'full',
    content_hash: 'a'.repeat(64), source_url: work.source_url, credit: 'Источник теста', artifactType: 'source-book', bookCompleteness: 'whole-source-section',
    appointedForDate: false, cleanTemplate: false, sourceReviewBasis: 'whole-source-collation', sourceScope: 'whole-source-section',
    blocks: Array.from({ length: count }, (_, index) => ({ id: 'b' + index, kind: index === 0 ? 'heading' : 'text',
      text: index === 0 ? 'Заголо́вокъ' : 'Сло́во ' + index, segments: [{ text: index === 0 ? 'Заголо́вокъ' : 'Сло́во ' + index, style: index === 0 ? 'rubric' : 'text' }] })) };
  return { work, data, catalogue: { data: [work] } };
}
export function octoechosFixture() {
  const fixture = libraryFixture('octoechos-ponomar-whole'), blocks = [];
  const add = text => blocks.push({ id: 'b' + blocks.length, kind: 'text', text, segments: [{ text, style: 'text' }] });
  add('Предисловие');
  for (const numeral of ['а҃', 'в҃', 'г҃', 'д҃', 'є҃', 'ѕ҃', 'з҃', 'и҃']) {
    add('Гла́съ ' + numeral + '.'); add('Въ недѣ́лю оу҆́тра'); add('Сло́во воскре́сное');
    add('Въ понедѣ́льникъ ве́чера'); add('Сло́во понедѣ́льника'); add('Конецъ первому гласу.');
  }
  add('ПРИЛОЖЕНИЕ'); add('Сло́ва приложе́ния'); fixture.data.blocks = blocks;
  return fixture;
}
