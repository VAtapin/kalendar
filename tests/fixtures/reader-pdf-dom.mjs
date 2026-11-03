class Element {
  nodeType = 1; children = []; dataset = {}; attributes = {}; parentElement = null; events = {}; hidden = false; className = ''; value = ''; ownText = '';
  style = { setProperty() {} };
  constructor(tag, text = '', className = '') { this.tagName = tag.toUpperCase(); this.ownText = text || ''; this.className = className; }
  get childNodes() { return [...(this.ownText ? [{ nodeType: 3, textContent: this.ownText, parentElement: this }] : []), ...this.children]; }
  get textContent() { return this.ownText + this.children.map(n => n.textContent).join(''); }
  set textContent(value) { this.ownText = value; this.children = []; }
  get classList() { return { contains: name => this.className.split(' ').includes(name), add: name => { this.className += ' ' + name; } }; }
  append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.ownText = ''; this.append(...nodes); }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? (name === 'lang' ? this.lang : name.startsWith('data-') ? this.dataset[name.slice(5).replace(/-([a-z])/g, (_,c) => c.toUpperCase())] : null) ?? null; }
  addEventListener(name, fn) { this.events[name] = fn; }
  matches(selector) { return selector.split(',').some(raw => { const part = raw.trim(); if (part === '[hidden]') return this.hidden; if (part === 'details > summary') return this.tagName === 'SUMMARY' && this.parentElement?.tagName === 'DETAILS'; if (part.startsWith('.')) return this.classList.contains(part.slice(1)); if (/^\[data-/.test(part)) return this.getAttribute(part.slice(1,-1)) != null; return this.tagName === part.toUpperCase(); }); }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
  querySelectorAll(selector) { return this.children.flatMap(node => node.nodeType === 1 ? [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)] : []); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
export function installReaderPdfDocument() { const previous = globalThis.document; globalThis.document = { fonts: { ready: Promise.resolve() }, createTextNode: text => ({ nodeType: 3, textContent: text }) };
  return () => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; };
}
export const create = (...args) => new Element(...args);
