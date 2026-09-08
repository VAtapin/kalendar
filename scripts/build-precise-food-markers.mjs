import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { PNG } from 'pngjs';
import assert from 'node:assert/strict';

// Original code-native symbols. Shared deliberately across the photographic
// packs: neither a fish nor a bread photograph describes these two categories.
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage();
  for (const name of ['caviar', 'total-abstinence']) {
    const svg = await readFile(`public/assets/markers/shared/${name}.svg`, 'utf8');
    for (const [folder, size] of [['markers', 600], ['marker-previews', 120]]) {
      const data = await page.evaluate(async ({ svg, size }) => {
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg.replace('<svg ', `<svg width="${size}" height="${size}" `))));
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        canvas.getContext('2d').drawImage(img, 0, 0, size, size);
        return canvas.toDataURL('image/png').split(',')[1];
      }, { svg, size });
      const directory = `public/assets/${folder}/shared`;
      const path = `${directory}/${name}.png`, bytes = Buffer.from(data, 'base64');
      if (process.argv.includes('--check')) {
        assert.deepEqual(PNG.sync.read(await readFile(path)).data, PNG.sync.read(bytes).data);
      } else {
        await mkdir(directory, { recursive: true });
        await writeFile(path, bytes);
      }
      console.log('PASS', path);
    }
  }
} finally { await browser.close(); }
