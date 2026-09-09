// Deliberately extracts catalogue metadata only, never a biography or recurrence rule.
const ENTITIES = { amp: '&', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  shy: '', lt: '<', gt: '>', ensp: ' ', emsp: ' ', thinsp: ' ', copy: '©', reg: '®' };
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
function decode(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, entity) => {
    if (!entity.startsWith('#')) return ENTITIES[entity] ?? whole;
    const code = /^#x/i.test(entity) ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code) : '\ufffd';
  });
}
function attributes(tag) {
  const attrs = {};
  for (const match of tag.replace(/^<\s*[\w:-]+/, '').matchAll(/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    attrs[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}
// A small structural tokenizer avoids truncating containers at a nested </div>.
function tree(html) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const input = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  for (const token of input.matchAll(/<[^>"']*(?:"[^"]*"|'[^']*'|[^>"']*)*>|[^<]+/g)) {
    const value = token[0];
    if (!value.startsWith('<')) { stack.at(-1).children.push(decode(value)); continue; }
    const end = value.match(/^<\/\s*([\w:-]+)/);
    if (end) {
      const index = stack.findLastIndex(node => node.tag === end[1].toLowerCase());
      if (index > 0) stack.length = index;
      continue;
    }
    const start = value.match(/^<\s*([\w:-]+)/);
    if (!start) continue;
    const node = { tag: start[1].toLowerCase(), attrs: attributes(value), children: [], parent: stack.at(-1) };
    stack.at(-1).children.push(node);
    if (!VOID.has(node.tag) && !/\/\s*>$/.test(value)) stack.push(node);
  }
  return root;
}
function all(node, predicate) {
  const result = [];
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    if (predicate(child)) result.push(child);
    result.push(...all(child, predicate));
  }
  return result;
}
const classes = node => (node.attrs.class ?? '').split(/\s+/);
const text = node => node.children.map(child => typeof child === 'string' ? child : text(child)).join(' ').replace(/\s+/g, ' ').trim();
function sourceUrl(raw, base, pattern) {
  if (!raw) return null;
  try {
    // Reject traversal before URL normalization erases dot segments.
    const decoded = decodeURIComponent(raw);
    if (decoded.includes('\\') || /(?:^|\/)\.{1,2}(?:\/|[?#]|$)/.test(decoded)) return null;
    const url = new URL(raw, base);
    if (url.origin !== 'https://azbyka.ru' || url.username || url.password || !pattern.test(url.pathname)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
function dateLink(node, base) {
  const url = sourceUrl(node.attrs.href, base, /^\/days\/\d{4}-\d{2}-\d{2}\/?$/);
  if (!url) return null;
  const date = new URL(url).pathname.match(/\d{4}-\d{2}-\d{2}/)[0];
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return { sourceUrl: url, exampleGregorianDate: date };
}

export function parseIconCard(html, url) {
  if (typeof html !== 'string') throw new TypeError('Expected card HTML string');
  const root = tree(html);
  const heading = all(root, node => node.tag === 'h1')[0];
  const title = heading ? text(heading) : '';
  if (!title) throw new Error(`Missing card title: ${url}`);
  const galleryRoots = all(root, node => node.attrs.id === 'slider');
  const galleryNodes = galleryRoots.length ? galleryRoots.flatMap(node => all(node, item => item.attrs['data-fancybox-href']))
    : all(root, node => node.attrs['data-fancybox-group'] === 'ikon' && node.attrs['data-fancybox-href']);
  const images = [...new Set(galleryNodes.map(node => sourceUrl(node.attrs['data-fancybox-href'], url,
    /^\/days\/storage\/images\/.+\.(?:jpe?g|png|webp|gif)$/i)).filter(Boolean))].map(sourceUrl => ({ sourceUrl }));
  const containers = all(root, node => classes(node).includes('brif') && classes(node).some(value => value === 'dates' || value === 'celebration'));
  const dates = [];
  const seen = new Set();
  for (const container of containers) {
    const paragraphs = all(container, node => node.tag === 'p');
    const entries = paragraphs.length ? paragraphs : [container];
    for (const entry of entries) {
      const links = all(entry, node => node.tag === 'a').map(node => dateLink(node, url)).filter(Boolean);
      const label = text(entry);
      if (!label) continue;
      const movable = classes(entry).includes('rolling') || all(entry, node => classes(node).includes('rolling')).length > 0 ? true : null;
      for (const link of links.length ? links : [{ sourceUrl: null, exampleGregorianDate: null }]) {
        const key = `${label}|${link.sourceUrl}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dates.push({ label, ...link, movable, status: 'source-displayed-not-a-recurrence-rule' });
      }
    }
  }
  return { title, images, dates };
}
