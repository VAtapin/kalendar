import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFHexString, PDFName, PDFOperator, rgb, type PDFFont, type PDFPage, type PDFContentStream, type PDFRef } from 'pdf-lib';
import { drawPdfText, embedShapingFont, pdfTextWidth } from './pdf-text-shaping';

/** A snapshot of the displayed reader, never a second composition of API blocks. */
export interface WorshipPdfRun { text: string; rubric?: boolean; language?: string }
export interface WorshipPdfBlock {
  kind: 'heading' | 'paragraph' | 'warning';
  runs: WorshipPdfRun[];
  language?: string;
  /** Metadata is retained for consumers; it does not add inferred spoken words. */
  role?: string;
  origin?: string;
  variableGroup?: string;
}
export interface WorshipPdfSnapshot {
  kind: 'book' | 'dated-service';
  title: string;
  titleLanguage?: string;
  subtitle?: string;
  information: string[];
  /** Localized, explicit completeness label supplied by the reader. */
  status: string;
  /** Daily-service completeness. Book scope is described by its own status/info. */
  complete: boolean;
  /** User-selected reader scale; 1 means the 16pt worship-reading baseline. */
  readingScale?: number;
  warnings: string[];
  sources: string[];
  blocks: WorshipPdfBlock[];
  /** Optional reader index, e.g. tone/day groups in a whole source book. */
  navigation?: { blockIndex: number; title: string; language?: string }[];
  /** Short printed contents; detailed navigation can remain in PDF bookmarks. */
  contents?: { blockIndex: number; title: string; language?: string }[];
  sourceMetadata?: unknown;
  labels: { contents: string; sources: string; incomplete: string; page: string };
}
export interface WorshipPdfOptions {
  fontBytes?: { civil: Uint8Array; cu: Uint8Array; fallback: Uint8Array };
  isCurrent?: () => boolean;
  signal?: AbortSignal;
  /** Cooperative yield keeps long source books cancellable in the browser. */
  onProgress?: (completed: number, total: number) => void;
  yieldControl?: () => Promise<void>;
  /** Diagnostic trace is opt-in; production does not retain a second copy of book text. */
  collectPlacements?: boolean;
}
export interface WorshipPdfPlacement { text: string; page: number; x: number; y: number; width: number; size: number }
export class StaleWorshipPdfError extends Error {
  constructor() { super('Worship PDF selection changed'); this.name = 'StaleWorshipPdfError'; }
}

const SIZE = [595.276, 841.89] as const;
const MARGIN = 46;
const FOOTER_LINE_Y = 35;
const BOTTOM = FOOTER_LINE_Y + 14;
const INK_PADDING = 4;
const WIDTH = SIZE[0] - MARGIN * 2;
const INK = rgb(.14, .13, .12), RED = rgb(.48, .13, .12), MUTED = rgb(.36, .34, .31);
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

async function fetchFont(file: string): Promise<Uint8Array> {
  const response = await fetch(`/fonts/${file}`);
  if (!response.ok) throw new Error(`PDF font HTTP ${response.status}: ${file}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** All user/source text remains Unicode text, including combining sequences. */
export async function exportWorshipPdf(input: WorshipPdfSnapshot, options: WorshipPdfOptions = {}) {
  // Clone before the first await: later edits cannot silently alter a PDF in flight.
  const snapshot: WorshipPdfSnapshot = structuredClone(input);
  const check = () => {
    if (options.signal?.aborted || options.isCurrent?.() === false) throw new StaleWorshipPdfError();
  };
  const yieldWork = async () => {
    await (options.yieldControl ?? (() => new Promise(resolve => setTimeout(resolve, 0))))();
    check();
  };
  check();
  if (!snapshot.title || !snapshot.status || !snapshot.blocks.length) throw new Error('Empty worship PDF snapshot');
  if (snapshot.readingScale !== undefined && (!Number.isFinite(snapshot.readingScale) || snapshot.readingScale < .75 || snapshot.readingScale > 2)) throw new Error('Invalid worship PDF text size');
  const data = options.fontBytes ?? await (async () => {
    const [civil, cu, fallback] = await Promise.all([
      fetchFont('DejaVuSerif.ttf'), fetchFont('Ponomar-Regular.ttf'), fetchFont('DejaVuSans.ttf'),
    ]);
    return { civil, cu, fallback };
  })();
  check();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const bookTitle = snapshot.kind === 'book' ? /^(.+?)\s+(\([^()]+\))$/u.exec(snapshot.title) : null;
  pdf.setTitle(bookTitle?.[1] ?? snapshot.title);
  pdf.setCreator('Kalendar');
  // Source provenance stays in application validation, not the exported document.
  const fonts = {
    civil: await embedShapingFont(pdf, data.civil),
    cu: await embedShapingFont(pdf, data.cu),
    fallback: await embedShapingFont(pdf, data.fallback),
  };
  const faces = { civil: fontkit.create(data.civil), cu: fontkit.create(data.cu), fallback: fontkit.create(data.fallback) };
  const placements: WorshipPdfPlacement[] = [];
  const pages: PDFPage[] = [];
  let page!: PDFPage, y = 0;
  let activeBox: { group: string; page: PDFPage; top: number } | undefined;
  function drawBox() {
    if (!activeBox) return;
    const bottom = Math.max(BOTTOM, y - 6), height = activeBox.top - bottom;
    if (height > 1) activeBox.page.drawRectangle({ x: MARGIN - 7, y: bottom, width: WIDTH + 14, height,
      borderColor: MUTED, borderWidth: .5 });
  }
  function sealPage(previous: PDFPage) {
    // pdf-lib 1.17 retains one JS object per glyph operator until save(). Compress
    // completed page streams now, and open a tiny new stream for later TOC/footer.
    // Isolate its internal stream access here (same pinned pdf-lib as the editor).
    const state = previous as unknown as { contentStream?: PDFContentStream; contentStreamRef?: PDFRef; getContentStream(useExisting: boolean): PDFContentStream };
    if (!state.contentStream || !state.contentStreamRef) return;
    pdf.context.assign(state.contentStreamRef, pdf.context.flateStream(state.contentStream.getUnencodedContents()));
    state.getContentStream(false);
  }
  function newPage() {
    if (page) { drawBox(); sealPage(page); }
    page = pdf.addPage([...SIZE]); pages.push(page); y = SIZE[1] - MARGIN;
    if (activeBox) activeBox = { group: activeBox.group, page, top: y };
  }
  newPage();
  function ensure(height: number) { if (y - height < BOTTOM) newPage(); }
  type Piece = { text: string; font: PDFFont; rubric: boolean };
  type Line = { pieces: Piece[]; width: number };
  function pieces(runs: WorshipPdfRun[], language?: string): Piece[] {
    const result: Piece[] = [];
    for (const run of runs) {
      const preferred = (run.language ?? language) === 'cu' ? 'cu' : 'civil';
      for (const { segment } of segmenter.segment(run.text)) {
        const supported = (key: keyof typeof faces) => [...segment].every(c => /[\r\n\t]/.test(c) || faces[key].hasGlyphForCodePoint(c.codePointAt(0)!));
        const key = supported(preferred) ? preferred : supported('fallback') ? 'fallback' : supported('cu') ? 'cu' : undefined;
        if (!key) throw new Error(`PDF font lacks Unicode ${[...segment].map(c => c.codePointAt(0)!.toString(16)).join('+')}`);
        const last = result.at(-1);
        if (last?.font === fonts[key] && last.rubric === Boolean(run.rubric)) last.text += segment;
        else result.push({ text: segment, font: fonts[key], rubric: Boolean(run.rubric) });
      }
    }
    return result;
  }
  function wrap(runs: WorshipPdfRun[], language: string | undefined, size: number, width = WIDTH): Line[] {
    const lines: Line[] = [];
    let line: Line = { pieces: [], width: 0 };
    const flush = () => { lines.push(line); line = { pieces: [], width: 0 }; };
    function append(text: string, piece: Piece) {
      const measured = pdfTextWidth(piece.font, text, size);
      const last = line.pieces.at(-1);
      if (last?.font === piece.font && last.rubric === piece.rubric) last.text += text;
      else line.pieces.push({ ...piece, text });
      line.width += measured;
    }
    for (const piece of pieces(runs, language)) {
      for (const token of piece.text.split(/(\r\n|\r|\n|[^\S\r\n]+|[^\s]+)/u).filter(Boolean)) {
        if (/^[\r\n]+$/.test(token)) { flush(); continue; }
        const measured = pdfTextWidth(piece.font, token, size);
        if (line.width && line.width + measured > width) flush();
        if (measured <= width) append(token, piece);
        else for (const { segment } of segmenter.segment(token)) {
          const advance = pdfTextWidth(piece.font, segment, size);
          if (advance > width) throw new Error('PDF grapheme exceeds page width');
          if (line.width && line.width + advance > width) flush();
          append(segment, piece);
        }
      }
    }
    if (line.pieces.length || !lines.length) flush();
    return lines;
  }
  function drawLine(line: Line, size: number, atPage = page!, atY = y, x = MARGIN, color = INK, body = false) {
    const text = line.pieces.map(p => p.text).join('');
    // ActualText preserves logical Unicode order even when GSUB/GPOS reorders marks.
    atPage.pushOperators(PDFOperator.of('BDC' as never, [PDFName.of('Span'), pdf.context.obj({ ActualText: PDFHexString.fromText(text), KalendarBody: body }) as unknown as PDFName]));
    for (const piece of line.pieces) {
      const width = pdfTextWidth(piece.font, piece.text, size);
      drawPdfText(atPage, piece.text.replace(/\t/g, ' '), { x, y: atY, font: piece.font, size, color: piece.rubric ? RED : color });
      if (options.collectPlacements) placements.push({ text: piece.text, page: pages.indexOf(atPage) + 1, x, y: atY, width, size });
      x += width;
    }
    atPage.pushOperators(PDFOperator.of('EMC' as never));
  }
  function descent(line: Line, size: number) {
    return Math.max(0, ...line.pieces.map(piece => piece.font.heightAtSize(size)
      - piece.font.heightAtSize(size, { descender: false })));
  }
  function paragraph(text: string, size = 10, color = MUTED, language?: string) {
    for (const line of wrap([{ text }], language, size)) {
      ensure(size * 1.65 + descent(line, size) + INK_PADDING); y -= size * 1.35; drawLine(line, size, page, y, MARGIN, color);
    }
    y -= 5;
  }
  // Eight-point Orthodox cross: stem, short upper bar, main bar, slanted footrest.
  const center = SIZE[0] / 2;
  for (const [x1, y1, x2, y2] of [[0, 1, 0, -21], [-3, -3, 3, -3], [-7, -9, 7, -9], [-4, -14, 4, -18]]) {
    page!.drawLine({ start: { x: center + x1!, y: y + y1! }, end: { x: center + x2!, y: y + y2! }, thickness: .9, color: RED });
  }
  y -= 30;
  paragraph(bookTitle?.[1] ?? snapshot.title, 20, INK, snapshot.titleLanguage);
  if (snapshot.subtitle) paragraph(snapshot.subtitle, 11, MUTED, snapshot.titleLanguage);
  for (const text of snapshot.information) paragraph(text, 9);
  const partialService = snapshot.kind === 'dated-service' && !snapshot.complete;
  paragraph(partialService ? `${snapshot.status}. ${snapshot.labels.incomplete}` : snapshot.status, 10, partialService ? RED : MUTED);
  const headings = snapshot.navigation
    ? snapshot.navigation.map(item => {
      if (!Number.isInteger(item.blockIndex) || !snapshot.blocks[item.blockIndex] || !item.title) throw new Error('Invalid PDF navigation target');
      return { index: item.blockIndex, block: { runs: [{ text: item.title }], language: item.language } };
    })
    : snapshot.blocks.map((block, index) => ({ block, index })).filter(({ block }) => block.kind === 'heading');
  const substantive = headings.filter(({ block }) => /^(?:млтва|молитва|псалом|псалмы|глас|канон|час|вечер|утрен|бж|божеств)/u.test(block.runs.map(r => r.text).join('').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()));
  const printed = snapshot.contents ? snapshot.contents.map(item => {
    if (!snapshot.blocks[item.blockIndex] || !item.title) throw new Error('Invalid printed PDF navigation');
    return { index: item.blockIndex, block: { runs: [{ text: item.title }], language: item.language } };
  }) : snapshot.navigation || headings.length <= 24 ? headings : substantive.length ? substantive : headings;
  const navigationTargets = new Set([...headings, ...printed].map(item => item.index));
  type TocSlot = { page: PDFPage; y: number; line: Line; blockIndex: number; last: boolean };
  const toc: TocSlot[] = [];
  if (printed.length) {
    paragraph(snapshot.labels.contents, 12, INK);
    for (const { block, index } of printed) {
      // Printed navigation uses the source's first heading line; full title stays
      // in the detailed PDF outline and in the unmodified body.
      const lines = wrap([{ text: block.runs.map(run => run.text).join('').split(/\r?\n/)[0]! }], block.language, 9, WIDTH - 40);
      lines.forEach((line, i) => { ensure(17 + descent(line, 9) + INK_PADDING); y -= 14; toc.push({ page: page!, y, line, blockIndex: index, last: i === lines.length - 1 }); });
    }
    y -= 15;
  }
  const targets = new Map<number, { page: PDFPage; y: number; number: number }>();
  for (let index = 0; index < snapshot.blocks.length; index++) {
    options.onProgress?.(index, snapshot.blocks.length);
    check();
    const block = snapshot.blocks[index]!;
    if (block.variableGroup !== activeBox?.group) {
      if (activeBox) { drawBox(); activeBox = undefined; y -= 12; }
      if (block.variableGroup) { ensure(20); y -= 10; activeBox = { group: block.variableGroup, page, top: y + 1 }; }
      else activeBox = undefined;
    }
    const size = snapshot.readingScale === undefined ? (block.kind === 'heading' ? 15 : 12)
      : (block.kind === 'heading' ? 18 : 16) * snapshot.readingScale * (block.language === 'cu' ? 2 : 1);
    const leading = size * (snapshot.readingScale === undefined || block.language === 'cu' ? 1.8 : 1.5);
    const lines = wrap(block.runs, block.language, size);
    if (block.kind === 'heading') { ensure(leading * Math.min(lines.length, 2) + 35); y -= 8; }
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      // y is a baseline: reserve the font's descent and mark clearance as well.
      ensure(leading + descent(lines[lineIndex]!, size) + INK_PADDING);
      y -= leading;
      if (!lineIndex && navigationTargets.has(index)) targets.set(index, { page: page!, y: y + size + 5, number: pages.length });
      drawLine(lines[lineIndex]!, size, page, y, MARGIN, block.kind === 'warning' ? RED : INK, true);
      if (lineIndex % 48 === 47) await yieldWork();
    }
    y -= block.kind === 'heading' ? 3 : snapshot.readingScale === undefined ? 7 : 0;
    if (index % 8 === 7) await yieldWork();
  }
  drawBox(); activeBox = undefined;
  if (snapshot.warnings.length) {
    y -= 16;
    const closingHeight = snapshot.warnings.reduce((sum, text) => sum + wrap([{ text }], undefined, 9).length * 9 * 1.35 + 5, 0);
    ensure(Math.min(closingHeight + 8, SIZE[1] - MARGIN - BOTTOM));
    for (const text of snapshot.warnings) paragraph(text, 9, RED);
  }
  sealPage(page);
  const destination = (target: { page: PDFPage; y: number }) => pdf.context.obj([target.page.ref, PDFName.of('XYZ'), null, target.y, null]);
  options.onProgress?.(snapshot.blocks.length, snapshot.blocks.length);
  for (const slot of toc) {
    const target = targets.get(slot.blockIndex)!;
    drawLine(slot.line, 9, slot.page, slot.y);
    if (slot.last) drawPdfText(slot.page, String(target.number), { x: SIZE[0] - MARGIN - pdfTextWidth(fonts.civil, String(target.number), 9), y: slot.y, font: fonts.civil, size: 9, color: MUTED });
    const link = pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [MARGIN, slot.y - 3, SIZE[0] - MARGIN, slot.y + 12], Border: [0, 0, 0], Dest: destination(target) }));
    slot.page.node.addAnnot(link);
  }
  if (headings.length) {
    const root = pdf.context.register(pdf.context.obj({ Type: 'Outlines' }));
    const refs = headings.map(() => pdf.context.nextRef());
    headings.forEach(({ block, index }, i) => {
      const item = pdf.context.obj({ Title: PDFHexString.fromText(block.runs.map(r => r.text).join('')), Parent: root, Dest: destination(targets.get(index)!), ...(i ? { Prev: refs[i - 1] } : {}), ...(i < refs.length - 1 ? { Next: refs[i + 1] } : {}) });
      pdf.context.assign(refs[i]!, item);
    });
    const outline = pdf.context.lookup(root) as import('pdf-lib').PDFDict;
    outline.set(PDFName.of('First'), refs[0]!); outline.set(PDFName.of('Last'), refs.at(-1)!);
    outline.set(PDFName.of('Count'), pdf.context.obj(refs.length));
    pdf.catalog.set(PDFName.of('Outlines'), root);
  }
  pages.forEach((p, index) => {
    p.drawLine({ start: { x: MARGIN, y: FOOTER_LINE_Y }, end: { x: SIZE[0] - MARGIN, y: FOOTER_LINE_Y }, thickness: .4, color: MUTED });
    const label = `${snapshot.labels.page} ${index + 1} / ${pages.length}`;
    drawPdfText(p, label, { x: (SIZE[0] - pdfTextWidth(fonts.civil, label, 8)) / 2, y: 23, size: 8, font: fonts.civil, color: MUTED });
  });
  check();
  const bytes = await pdf.save({ objectsPerTick: 50 });
  check();
  return { bytes, pageCount: pages.length, placements };
}
