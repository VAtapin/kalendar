import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const bundle = await build({
  entryPoints: [resolve('src/export/print-svg-styles.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'printSvgStyles',
  write: false,
});
const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge' } : {});
try {
  const page = await browser.newPage({ viewport: { width: 520, height: 220 } });
  await page.setContent(`
    <div id="capture" style="width:500px;height:180px">
      <svg width="500" height="180" viewBox="0 0 500 180" xmlns="http://www.w3.org/2000/svg">
        <defs><filter id="text-shadow"><feDropShadow dx="5" dy="5" stdDeviation="3"
          flood-color="#000000" flood-opacity="0.42"/></filter></defs>
        <rect width="500" height="180" fill="#5b646a"/>
        <g id="year"><text x="36" y="52" font-size="48" fill="#e5bc65" filter="url(#text-shadow)">2027</text></g>
        <g id="month">
          <text class="large-text-extrusion" x="38" y="130" font-size="90" fill="white">Декабрь</text>
          <text id="main" x="34" y="126" font-size="90" fill="#26468f" filter="url(#text-shadow)">Декабрь</text>
        </g>
      </svg>
    </div>
  `);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.addScriptTag({ path: resolve('node_modules/html-to-image/dist/html-to-image.js') });
  const result = await page.evaluate(async () => {
    const svg = document.querySelector('svg');
    const main = document.querySelector('#main');
    const year = document.querySelector('#year text');
    const capture = document.querySelector('#capture');
    main.removeAttribute('filter');
    year.removeAttribute('filter');
    const baseline = await window.htmlToImage.toCanvas(capture, { pixelRatio: 1, backgroundColor: '#ffffff' });
    main.setAttribute('filter', 'url(#text-shadow)');
    year.setAttribute('filter', 'url(#text-shadow)');
    const restore = window.printSvgStyles.flattenPrintSvgTextShadows(svg);
    const children = Array.from(document.querySelector('#month').children);
    const layers = children.filter((child) => child.getAttribute('aria-hidden') === 'true');
    const structure = {
      layers: layers.length,
      yearLayers: document.querySelectorAll('#year text[aria-hidden="true"]').length,
      behindExtrusion: layers.every((layer) => children.indexOf(layer) < children.indexOf(children.find((child) => child.classList.contains('large-text-extrusion')))),
      noLiveFilter: !main.hasAttribute('filter') && !year.hasAttribute('filter'),
    };
    const flattened = await window.htmlToImage.toCanvas(capture, { pixelRatio: 1, backgroundColor: '#ffffff' });
    restore();
    return {
      ...structure,
      restored: main.getAttribute('filter') === 'url(#text-shadow)'
        && year.getAttribute('filter') === 'url(#text-shadow)'
        && !document.querySelector('[aria-hidden="true"]'),
      baseline: baseline.toDataURL('image/png').split(',')[1],
      flattened: flattened.toDataURL('image/png').split(',')[1],
    };
  });
  assert.equal(result.layers, 9);
  assert.equal(result.yearLayers, 9);
  assert.equal(result.behindExtrusion, true);
  assert.equal(result.noLiveFilter, true);
  assert.equal(result.restored, true);
  const before = await sharp(Buffer.from(result.baseline, 'base64')).raw().toBuffer();
  const after = await sharp(Buffer.from(result.flattened, 'base64')).raw().toBuffer();
  assert.equal(before.length, after.length);
  let darkenedPixels = 0;
  let darkenedWhitePixels = 0;
  for (let index = 0; index < before.length; index += 3) {
    if (before[index] - after[index] > 15) darkenedPixels += 1;
    if (before[index] > 240 && before[index + 1] > 240 && before[index + 2] > 240
      && after[index] < 220) darkenedWhitePixels += 1;
  }
  assert.ok(darkenedPixels > 100, `Flattened shadow is not visible (${darkenedPixels} darkened pixels)`);
  assert.ok(darkenedWhitePixels < 100, `Shadow darkened the white extrusion (${darkenedWhitePixels} pixels)`);
  process.stdout.write(`Print shadow layers and rendering passed (${darkenedPixels} darkened pixels)\n`);
} finally {
  await browser.close();
}
