import { open, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString, cmyk } from 'pdf-lib';

const MM_TO_PT = 72 / 25.4;
const PIXELS_PER_MM = 300 / 25.4;
const MAGIC = 'KLPAGES1';

function requireNumber(value, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error('Invalid print page geometry');
  }
  return value;
}

async function readExactly(file, length, position) {
  const buffer = Buffer.allocUnsafe(length);
  let done = 0;
  while (done < length) {
    const { bytesRead } = await file.read(buffer, done, length - done, position + done);
    if (bytesRead === 0) throw new Error('Incomplete print page package');
    done += bytesRead;
  }
  return buffer;
}

function pageGeometry(page) {
  const width = requireNumber(page.widthMm, 20, 1000);
  const height = requireNumber(page.heightMm, 20, 1000);
  const bleed = Object.fromEntries(['left', 'right', 'top', 'bottom'].map((side) => [
    side, requireNumber(page.bleed?.[side], 0, 50),
  ]));
  return {
    width, height, bleed,
    mediaWidth: width + bleed.left + bleed.right,
    mediaHeight: height + bleed.top + bleed.bottom,
  };
}

function addPrintMarks(pdfPage, marks, geometry) {
  if (!Array.isArray(marks) || marks.length > 32) throw new Error('Invalid crop marks');
  for (const mark of marks) {
    const startX = requireNumber(mark?.start?.x, -50, geometry.width + 50);
    const startY = requireNumber(mark?.start?.y, -50, geometry.height + 50);
    const endX = requireNumber(mark?.end?.x, -50, geometry.width + 50);
    const endY = requireNumber(mark?.end?.y, -50, geometry.height + 50);
    pdfPage.drawLine({
      start: { x: (startX + geometry.bleed.left) * MM_TO_PT, y: (geometry.mediaHeight - startY - geometry.bleed.top) * MM_TO_PT },
      end: { x: (endX + geometry.bleed.left) * MM_TO_PT, y: (geometry.mediaHeight - endY - geometry.bleed.top) * MM_TO_PT },
      thickness: 0.15 * MM_TO_PT,
      color: cmyk(0, 0, 0, 1),
    });
  }
}

export async function buildPrintPdf(packagePath, profilePath, destination, profileName = 'Custom CMYK') {
  const profile = await readFile(profilePath);
  if (profile.length < 128 || profile.toString('ascii', 12, 16) !== 'prtr'
    || profile.toString('ascii', 16, 20) !== 'CMYK' || profile.toString('ascii', 36, 40) !== 'acsp') {
    throw new Error('Invalid CMYK output profile');
  }
  const file = await open(packagePath, 'r');
  try {
    const stat = await file.stat();
    const header = await readExactly(file, 12, 0);
    if (header.toString('ascii', 0, 8) !== MAGIC) throw new Error('Invalid print page package');
    const manifestLength = header.readUInt32BE(8);
    if (manifestLength < 20 || manifestLength > 1024 * 1024) throw new Error('Invalid print page manifest');
    const manifest = JSON.parse((await readExactly(file, manifestLength, 12)).toString('utf8'));
    if (manifest?.version !== 1 || !Array.isArray(manifest.pages)
      || manifest.pages.length < 1 || manifest.pages.length > 100) throw new Error('Invalid print page manifest');
    let offset = 12 + manifestLength;
    const pdf = await PDFDocument.create({ updateMetadata: false });
    const createdAt = new Date();
    pdf.setTitle('Calendar');
    pdf.setCreator('Календарная мастерская');
    pdf.setProducer('Календарная мастерская / pdf-lib');
    pdf.setCreationDate(createdAt);
    pdf.setModificationDate(createdAt);
    for (const page of manifest.pages) {
      const geometry = pageGeometry(page);
      const imageBytes = requireNumber(page.imageBytes, 100, 100 * 1024 * 1024);
      if (!Number.isInteger(imageBytes) || offset + imageBytes > stat.size) throw new Error('Invalid print page image');
      const source = await readExactly(file, imageBytes, offset);
      offset += imageBytes;
      const sourceInfo = await sharp(source).metadata();
      const expectedWidth = geometry.mediaWidth * PIXELS_PER_MM;
      const expectedHeight = geometry.mediaHeight * PIXELS_PER_MM;
      if (sourceInfo.format !== 'jpeg' || sourceInfo.channels !== 3
        || Math.abs(sourceInfo.width - expectedWidth) > 3 || Math.abs(sourceInfo.height - expectedHeight) > 3) {
        throw new Error('Print page is not an opaque 300 dpi JPEG');
      }
      const cmykJpeg = await sharp(source, { limitInputPixels: 150_000_000 })
        .toColourspace('cmyk')
        .withIccProfile(profilePath, { attach: false })
        .jpeg({ quality: 75, chromaSubsampling: '4:4:4', mozjpeg: true })
        .toBuffer();
      const convertedInfo = await sharp(cmykJpeg).metadata();
      if (convertedInfo.space !== 'cmyk' || convertedInfo.channels !== 4) {
        throw new Error('CMYK conversion failed');
      }
      const image = await pdf.embedJpg(cmykJpeg);
      const mediaWidthPt = geometry.mediaWidth * MM_TO_PT;
      const mediaHeightPt = geometry.mediaHeight * MM_TO_PT;
      const pdfPage = pdf.addPage([mediaWidthPt, mediaHeightPt]);
      pdfPage.setBleedBox(0, 0, mediaWidthPt, mediaHeightPt);
      pdfPage.setTrimBox(geometry.bleed.left * MM_TO_PT, geometry.bleed.bottom * MM_TO_PT,
        geometry.width * MM_TO_PT, geometry.height * MM_TO_PT);
      pdfPage.drawImage(image, { x: 0, y: 0, width: mediaWidthPt, height: mediaHeightPt });
      addPrintMarks(pdfPage, page.cropMarks ?? [], geometry);
    }
    if (offset !== stat.size) throw new Error('Trailing data in print page package');
    const profileStream = pdf.context.flateStream(profile, { N: PDFNumber.of(4) });
    const profileRef = pdf.context.register(profileStream);
    const outputCondition = profileName.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 100) || 'Custom CMYK';
    const intent = pdf.context.obj({
      Type: PDFName.of('OutputIntent'), S: PDFName.of('GTS_PDFX'),
      OutputCondition: PDFString.of(outputCondition),
      OutputConditionIdentifier: PDFString.of(outputCondition),
      Info: PDFString.of(outputCondition),
      RegistryName: PDFString.of('http://www.color.org'),
      DestOutputProfile: profileRef,
    });
    pdf.catalog.set(PDFName.of('OutputIntents'), pdf.context.obj([pdf.context.register(intent)]));
    const info = pdf.context.lookup(pdf.context.trailerInfo.Info);
    info.set(PDFName.of('GTS_PDFXVersion'), PDFString.of('PDF/X-1a:2001'));
    info.set(PDFName.of('Trapped'), PDFName.of('False'));
    const documentId = PDFHexString.of(randomBytes(16).toString('hex'));
    pdf.context.trailerInfo.ID = pdf.context.obj([documentId, documentId]);
    const bytes = await pdf.save({ useObjectStreams: false });
    // pdf-lib writes a fixed 1.7 header even with classic xrefs. The document
    // above uses only PDF 1.3 objects, so replace the same-length header.
    if (Buffer.from(bytes).toString('ascii', 0, 8) !== '%PDF-1.7') throw new Error('Unexpected PDF header');
    bytes.set(Buffer.from('%PDF-1.3'), 0);
    await writeFile(destination, bytes);
    return { pages: manifest.pages.length, bytes: bytes.length };
  } finally {
    await file.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , packagePath, profilePath, destination, profileName] = process.argv;
  buildPrintPdf(packagePath, profilePath, destination, profileName).then(
    (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
    (error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; },
  );
}
