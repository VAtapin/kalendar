import assert from 'node:assert/strict';
import test from 'node:test';
import {acceptRecord, classifyRights, duplicateFor, isIconCandidate, normalizeRecord, perceptualHash} from './lib/open-access-icons.mjs';

test('accepts explicit CC0 icon metadata and rejects unclear rights', () => {
  const rights = classifyRights({license: 'CC0', rights: 'Public Domain'});
  assert.equal(rights.license, 'CC0');
  assert.equal(rights.commercialUse, true);
  assert.equal(classifyRights({rights: 'Usage Conditions Apply'}), null);
  assert.equal(classifyRights({rights: 'CC BY-NC'}), null);
});

test('iconography gate and normalized required fields work', () => {
  assert.equal(isIconCandidate({title: 'Byzantine icon of the Theotokos'}), true);
  assert.equal(isIconCandidate({title: 'Landscape with river'}), false);
  const record = normalizeRecord({sourceId: '42', sourceUrl: 'https://example.test/42', title: 'Orthodox icon', imageUrl: 'https://example.test/42.jpg', license: 'CC BY', rights: 'CC BY 4.0'}, 'met');
  assert.equal(acceptRecord(record).accepted, true);
  assert.equal(record.commercialUse, true);
  assert.equal(record.attributionRequired, true);
});

test('deduplication checks source identity, URL, SHA-256 and perceptual hash', () => {
  const catalog = {records: {
    first: {source: 'met', sourceId: '1', sourceUrl: 'https://met/1', sha256: 'a', phash: 'b'},
  }};
  assert.equal(duplicateFor({source: 'met', sourceId: '1', sourceUrl: 'other', sha256: 'x', phash: 'y'}, catalog).sourceId, '1');
  assert.equal(duplicateFor({source: 'aic', sourceId: '2', sourceUrl: 'https://met/1', sha256: 'x', phash: 'y'}, catalog).sourceId, '1');
  assert.equal(duplicateFor({source: 'aic', sourceId: '2', sourceUrl: 'other', sha256: 'a', phash: 'y'}, catalog).sourceId, '1');
  assert.equal(duplicateFor({source: 'aic', sourceId: '2', sourceUrl: 'other', sha256: 'x', phash: 'b'}, catalog).sourceId, '1');
});

test('PNG perceptual fingerprint is deterministic without network access', () => {
  assert.equal(perceptualHash(Buffer.from('not-png'), 'image/png'), null);
});
