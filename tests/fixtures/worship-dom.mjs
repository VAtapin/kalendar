// A minimal DOM adapter exercises reader events without opening a browser.
export function create(tag, text = '', className = '') {
  const node = { tag, textContent: text || '', className, children: [], dataset: {}, events: {},
    style: { setProperty() {} }, classList: { add() {}, contains(value) { return className.split(' ').includes(value); } },
    querySelector(selector) { return descendants(this).find(node => node.className.split(' ').includes(selector.slice(1))) || null; },
    querySelectorAll(tagName) { return descendants(this).filter(node => node !== this && node.tag === tagName); },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute() {}, addEventListener(name, handler) { this.events[name] = handler; },
    get childElementCount() { return this.children.length; } };
  return node;
}
export function descendants(node) { return [node, ...node.children.flatMap(descendants)]; }
