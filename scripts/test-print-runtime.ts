import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument, PDFName } from 'pdf-lib';
import sharp from 'sharp';
import { createBlankPage } from '../src/document/factories';
import { packagePrintPages } from '../src/export/print-raster';

// Exercise the production PHP -> Node -> PDF/X path after calendar API removal.
assert.ok(!existsSync('dist/api/calendar-runtime.json'));
const runtime = JSON.parse(readFileSync('dist/api/print-runtime.json', 'utf8'));
assert.ok(existsSync(runtime.nodeBinary));
mkdirSync('tmp', {recursive: true});
const directory = mkdtempSync(resolve('tmp/print-runtime-check-'));
const page = createBlankPage('A5', 'portrait');
page.width = 25.4; page.height = 25.4;
page.bleed = {left: 0, right: 0, top: 0, bottom: 0};
const image = await sharp({create: {width: 300, height: 300, channels: 3, background: '#db9045'}}).jpeg().toBuffer();
const input = resolve(directory, 'pages.bin');
const output = resolve(directory, 'print.pdf');
writeFileSync(input, Buffer.from(await packagePrintPages([page], [new Blob([image])], undefined).arrayBuffer()));
execFileSync(process.env.PHP_BINARY || 'php', ['-r',
  'require $argv[1]; calendar_build_print_pdf($argv[2], $argv[3], $argv[4], "ISO Coated v2 300% (ECI)");',
  resolve('public/api/lib.php'), input, output, resolve('public/icc/ISOcoated_v2_300_eci.icc'),
]);
const bytes = readFileSync(output);
assert.equal(bytes.toString('ascii', 0, 8), '%PDF-1.3');
const pdf = await PDFDocument.load(bytes);
assert.equal(pdf.getPageCount(), 1);
assert.ok(pdf.catalog.get(PDFName.of('OutputIntents')));
assert.ok(bytes.includes(Buffer.from('/GTS_PDFXVersion (PDF/X-1a:2001)')));
console.log('PASS production PHP print export builds a real CMYK PDF/X-1a without calendar API runtime');
