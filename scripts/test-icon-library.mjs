import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const library=JSON.parse(readFileSync('public/data/icon-preview.json','utf8'));
assert.equal(library.status,'published');assert.ok(library.count>=39);assert.equal(library.cards.length,library.cardCount);
assert.ok(!JSON.stringify(library).toLowerCase().includes('azbyka.ru'));
assert.ok(library.publication&&Number.isInteger(library.publication.publishedImages));
let detailedHistories=0;
for(const card of library.cards){assert.ok(card.images.length);assert.ok(card.celebrations.length);assert.equal(typeof card.description,'string');assert.equal(typeof card.history,'string');if(card.history.length>100)detailedHistories++;for(const image of card.images)assert.ok(existsSync('public'+image.imageUrl));}
assert.ok(detailedHistories>0,'At least one source card must provide a detailed history');
const page=readFileSync('public/icons-of-mother-of-god.html','utf8');for(const text of ['Православные иконы','page: 1','size: 12','page-size','12 икон','lightbox','kind','place','theme','day','/api/v1/icons'])assert.ok(page.includes(text),text);
assert.ok(!page.includes('Азбука веры'));assert.ok(!page.includes('Тестовая партия'));console.log(`PASS icon library: ${library.count} images, ${library.cards.length} cards`);
