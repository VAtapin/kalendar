import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { PDFDocument, PDFName } from 'pdf-lib';

// A separate headless test process with a fresh profile, never the user's browser.
mkdirSync('tmp', { recursive: true });
const directory = mkdtempSync(resolve('tmp/print-font-recovery-'));
writeFileSync(resolve(directory, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="/src/styles.css"></head><body><div id="capture"></div></body></html>');
writeFileSync(resolve(directory, 'entry.ts'), `
export {createApp,h,nextTick,ref} from 'vue';
export {default as PageScene} from '../../src/components/PageScene.vue';
export {createBlankCalendarProject} from '../../src/document/factories';
export {createFullCalendarTemplate} from '../../src/templates/calendar-templates';
export {snapshotCalendar} from '../../src/calendar/api/editor-snapshot';
export {preparePrintFontCss} from '../../src/export/print-fonts';
export {inlinePrintSvgStyles,flattenPrintSvgTextShadows} from '../../src/export/print-svg-styles';
export {packagePrintPages} from '../../src/export/print-raster';
export {toCanvas} from 'html-to-image';
`);
const path = '/' + relative(process.cwd(), directory).replaceAll('\\', '/');
const fixture = JSON.parse(gunzipSync(readFileSync('tests/fixtures/editor-calendar-2027-ru.json.gz')));
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 18986, strictPort: true } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:18986${path}/index.html`);
  const result = await page.evaluate(async ({ path, fixture }) => {
    const { createApp, h, nextTick, ref, PageScene, createBlankCalendarProject, createFullCalendarTemplate,
      snapshotCalendar, preparePrintFontCss, inlinePrintSvgStyles, flattenPrintSvgTextShadows, packagePrintPages, toCanvas } = await import(`${path}/entry.ts`);
    // A failed screen face reproduced the exact user-visible NetworkError before
    // the fix, even though preparePrintFontCss fetched valid embedded font bytes.
    document.fonts.add(new FontFace('Cormorant Garamond', 'url(/missing-print-recovery-font.ttf)'));
    let originalError;
    try { await document.fonts.load('12px "Cormorant Garamond"'); } catch (error) { originalError = error.name; }
    const project = createBlankCalendarProject(2027);
    project.document.pages = createFullCalendarTemplate('A3', 'portrait', 2027, 'Тест').slice(0, 3);
    // The actual owner calendar failed on this bundled legacy font, independently
    // of the synthetic failed-screen-face scenario above.
    const heading = project.document.pages[1].elements.find(element => element.type === 'text' || element.type === 'month-text');
    if (!heading) throw new Error('Missing regression heading');
    heading.typography.fontFamily = 'TauernInlineCTT';
    const calendar = snapshotCalendar(fixture);
    const root = document.querySelector('#capture');
    root.className = 'print-capture-page';
    root.style.cssText = 'width:1145.2px;height:1610.1px';
    const current = ref(project.document.pages[0]);
    const app = createApp({ render: () => h(PageScene, { page: current.value, assets: project.assets,
      calendarYear: calendar, pixelsPerMm: 96 / 25.4, showGuides: false, activeTool: 'selection', calendarLanguage: 'ru' }) });
    app.mount(root);
    const images = [];
    const dimensions = [];
    let preview;
    try {
      for (const [index, model] of project.document.pages.entries()) {
        const fontEmbedCSS = await preparePrintFontCss(model, project);
        current.value = model;
        await nextTick();
        const svg = root.querySelector('svg');
        inlinePrintSvgStyles(svg);
        const restore = flattenPrintSvgTextShadows(svg);
        let canvas;
        try { canvas = await toCanvas(root, { pixelRatio: 300 / 96, backgroundColor: '#ffffff', skipAutoScale: true, fontEmbedCSS }); }
        finally { restore(); }
        dimensions.push([canvas.width, canvas.height]);
        const image = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.96));
        if (!image || image.size < 100) throw new Error('Missing rasterized page');
        images.push(image);
        if (index === 1) preview = canvas.toDataURL('image/png').split(',')[1];
        canvas.width = 0; canvas.height = 0;
      }
      const bundle = packagePrintPages(project.document.pages, images, project.printSettings);
      if (!Array.from(document.fonts).some(face => face.family === 'TauernInlineCTT' && face.status === 'loaded')) throw new Error('Tauern did not load');
      const bytes = new Uint8Array(await bundle.arrayBuffer());
      let binary = '';
      for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
      return { originalError, dimensions, bundle: btoa(binary), preview };
    } finally { app.unmount(); }
  }, { path, fixture });
  assert.equal(result.originalError, 'NetworkError');
  assert.equal(result.dimensions.length, 3);
  assert.ok(result.dimensions.every(([width, height]) => width >= 3500 && height >= 5000));
  const input = resolve(directory, 'pages.bin');
  writeFileSync(input, Buffer.from(result.bundle, 'base64'));
  writeFileSync(resolve(directory, 'january.png'), Buffer.from(result.preview, 'base64'));
  for (const profile of ['ISOcoated_v2_300_eci', 'PSO_Uncoated_ISO12647_eci', 'ISOuncoatedyellowish']) {
    const output = resolve(directory, profile + '.pdf');
    execFileSync(process.execPath, ['scripts/build-print-pdf.mjs', input, resolve('public/icc', profile + '.icc'), output, profile]);
    const bytes = readFileSync(output);
    assert.equal(bytes.toString('ascii', 0, 8), '%PDF-1.3');
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 3);
    assert.ok(pdf.catalog.get(PDFName.of('OutputIntents')));
    assert.ok(bytes.includes(Buffer.from('/GTS_PDFXVersion (PDF/X-1a:2001)')));
  }
  console.log('PASS: failed screen font reproduces NetworkError; embedded print fonts recover, three real A3 pages at 300 dpi, all three CMYK profiles produce PDF/X-1a:2001. Preview: ' + resolve(directory, 'january.png'));
} finally { if (browser) await browser.close(); await server.close(); }
