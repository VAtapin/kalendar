import { exportWorshipPdf, StaleWorshipPdfError, type WorshipPdfSnapshot, type WorshipPdfRun, type WorshipPdfBlock, type WorshipPdfOptions } from './worship-pdf';

/** Capture only the chosen main article; never query all .worship-text in a reader. */
export function captureWorshipPdf(body: Element, metadata: Omit<WorshipPdfSnapshot, 'blocks'>): WorshipPdfSnapshot {
  const blocks: WorshipPdfBlock[] = [];
  const languageOf = (node: Element): string | undefined => node.getAttribute('data-text-language')
    || node.getAttribute('lang') || (node.parentElement ? languageOf(node.parentElement) : undefined);
  function runs(node: Node, rubric = false): WorshipPdfRun[] {
    if (node.nodeType === 3) return [{ text: node.textContent ?? '', rubric, language: node.parentElement ? languageOf(node.parentElement) : undefined }];
    if (node.nodeType !== 1) return [];
    const element = node as Element;
    if (element.matches('button, script, style, input, select, textarea, [hidden]')) return [];
    if (element.tagName === 'BR') return [{ text: '\n', rubric, language: languageOf(element) }];
    return [...node.childNodes].flatMap(child => runs(child, rubric || element.classList.contains('rubric')));
  }
  function visit(element: Element) {
    if (element.matches('button, script, style, [hidden]')) return;
    const missing = element.classList.contains('worship-missing');
    if (element.matches('h1,h2,h3,h4,h5,h6,p') || missing || element.matches('details > summary')) {
      const captured = missing ? [...element.children].flatMap((child, i) => [...(i ? [{ text: '\n' }] : []), ...runs(child)]) : runs(element);
      if (captured.some(run => run.text)) blocks.push({
        kind: missing ? 'warning' : element.matches('h1,h2,h3,h4,h5,h6,summary') ? 'heading' : 'paragraph',
        runs: captured, language: languageOf(element),
        role: element.closest('[data-role]')?.getAttribute('data-role') ?? undefined,
        origin: element.closest('[data-origin]')?.getAttribute('data-origin') ?? undefined,
        variableGroup: element.closest('[data-variable-group]')?.getAttribute('data-variable-group') ?? undefined,
      });
      return;
    }
    for (const child of element.children) visit(child);
  }
  visit(body);
  return structuredClone({ ...metadata, blocks });
}

/** Caller owns busy/error UI and supplies a render/selection token via isCurrent. */
export async function downloadWorshipPdf(snapshot: WorshipPdfSnapshot, filename: string, options: WorshipPdfOptions = {}) {
  const result = await exportWorshipPdf(snapshot, options);
  if (options.signal?.aborted || options.isCurrent?.() === false) throw new StaleWorshipPdfError();
  const url = URL.createObjectURL(new Blob([result.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\.pdf$/i, '') + '.pdf';
    link.click();
  } finally {
    // The browser needs the blob until its download task has consumed the link.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return { pageCount: result.pageCount };
}

export { exportWorshipPdf, StaleWorshipPdfError } from './worship-pdf';
