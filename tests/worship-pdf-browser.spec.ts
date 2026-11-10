import { describe, expect, it } from 'vitest';
import { captureWorshipPdf } from '../src/export/worship-pdf-browser';

// Small DOM fixture; no browser, network or source composition involved.
class NodeFixture {
  nodeType = 1;
  parentElement: NodeFixture | null = null;
  childNodes: NodeFixture[] = [];
  constructor(public tagName: string, public attributes: Record<string, string> = {}, public value = '') {}
  get children() { return this.childNodes.filter(n => n.nodeType === 1); }
  get textContent(): string { return this.value + this.childNodes.map(n => n.textContent).join(''); }
  get classList() { return { contains: (name: string) => (this.attributes.class || '').split(' ').includes(name) }; }
  getAttribute(name: string) { return this.attributes[name] ?? null; }
  append(...nodes: NodeFixture[]) { for (const n of nodes) { n.parentElement = this; this.childNodes.push(n); } return this; }
  matches(selector: string): boolean {
    return selector.split(',').some(part => {
      const s = part.trim();
      if (s === 'details > summary') return this.tagName === 'SUMMARY' && this.parentElement?.tagName === 'DETAILS';
      if (s.startsWith('[')) return Object.hasOwn(this.attributes, s.slice(1, -1));
      return this.tagName.toLowerCase() === s;
    });
  }
  closest(selector: string): NodeFixture | null { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
}
function element(tag: string, attributes = {}, ...children: (string | NodeFixture)[]) {
  const n = new NodeFixture(tag.toUpperCase(), attributes);
  return n.append(...children.map(child => {
    if (typeof child !== 'string') return child;
    const text = new NodeFixture('#text', {}, child); text.nodeType = 3; return text;
  }));
}
describe('displayed reader PDF snapshot', () => {
  it('retains exact mixed segments, repeated labels, user provenance and appendix, excluding other articles', () => {
    const body = element('article', {},
      element('section', { 'data-text-language': 'cu', 'data-origin': 'user-provided', 'data-role': 'priest', 'data-variable-group': 'daily-hymn' },
        element('h3', {}, 'Источник'),
        element('p', {}, element('span', {}, 'І҆ѡа́ннъ'), ' ', element('span', { class: 'rubric' }, '(трижды)'))),
      element('aside', { class: 'worship-missing' }, element('strong', {}, 'Часть'), element('p', {}, 'Не определена.')),
      element('details', {}, element('summary', {}, 'Приложение'), element('p', { 'data-text-language': 'cu-civil' }, 'Exact appendix.')),
      element('p', { hidden: '' }, 'Hidden UI'));
    element('section', {}, body, element('article', {}, element('p', {}, 'Unselected conditional variant')));
    const snapshot = captureWorshipPdf(body as unknown as Element, { kind: 'dated-service', title: 'Reader', information: [], status: 'Partial', complete: false,
      warnings: ['No assignment'], sources: [], labels: { contents: 'Contents', sources: 'Sources', incomplete: 'Incomplete', page: 'Page' } });
    expect(snapshot.blocks).toHaveLength(5);
    expect(snapshot.blocks[1]).toMatchObject({ language: 'cu', role: 'priest', origin: 'user-provided', variableGroup: 'daily-hymn', runs: [
      { text: 'І҆ѡа́ннъ', rubric: false, language: 'cu' }, { text: ' ', rubric: false, language: 'cu' }, { text: '(трижды)', rubric: true, language: 'cu' },
    ] });
    expect(snapshot.blocks[2]).toMatchObject({ kind: 'warning' });
    expect(snapshot.blocks.map(b => b.runs.map(r => r.text).join('')).join('|')).toBe('Источник|І҆ѡа́ннъ (трижды)|Часть\nНе определена.|Приложение|Exact appendix.');
    body.children[0]!.children[1]!.append(element('span', {}, 'Changed later'));
    expect(snapshot.blocks[1]!.runs.map(r => r.text).join('')).toBe('І҆ѡа́ннъ (трижды)');
  });
});
