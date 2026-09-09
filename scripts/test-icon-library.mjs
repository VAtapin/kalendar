import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const library=JSON.parse(readFileSync('public/data/icon-preview.json','utf8'));
assert.equal(library.status,'published');assert.ok(library.count>=39);assert.equal(library.cards.length,library.cardCount);
assert.ok(!JSON.stringify(library).toLowerCase().includes('azbyka.ru'));
for(const card of library.cards){assert.ok(card.images.length);assert.ok(card.celebrations.length);assert.ok(card.history.length>100);for(const image of card.images)assert.ok(existsSync('public'+image.imageUrl));}
const page=readFileSync('public/icons-of-mother-of-god.html','utf8');for(const text of ['page: 1','size: 12','page-size','12 икон','lightbox','place','theme','day','/api/v1/icons/mother-of-god'])assert.ok(page.includes(text),text);
assert.ok(!page.includes('Азбука веры'));assert.ok(!page.includes('Тестовая партия'));console.log(`PASS icon library: ${library.count} images, ${library.cards.length} cards`);
