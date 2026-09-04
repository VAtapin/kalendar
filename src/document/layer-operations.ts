import type {
  LayoutElementNode,
  PageLayerGroup,
  PageLayerNode,
  PageModel,
  PageObjectLayer,
} from "./types";

export class LayerOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LayerOperationError";
  }
}

export interface LayerLocation {
  node: PageLayerNode;
  siblings: PageLayerNode[];
  ancestors: PageLayerGroup[];
}

export interface ResolvedObjectLayer {
  layer: PageObjectLayer;
  effectiveVisible: boolean;
  effectiveLocked: boolean;
  stackOrder: number;
}

function highestOrder(nodes: PageLayerNode[]): number {
  return Math.max(-1, ...nodes.map((node) => node.order));
}

function topToBottom(nodes: PageLayerNode[]): PageLayerNode[] {
  return [...nodes].sort((left, right) => {
    if (Boolean(left.pinnedToFront) !== Boolean(right.pinnedToFront)) {
      return left.pinnedToFront ? -1 : 1;
    }
    return right.order - left.order;
  });
}

function normalizeOrdersTopToBottom(nodes: PageLayerNode[]): void {
  const ordered = topToBottom(nodes);
  const total = ordered.length;
  ordered.forEach((node, index) => {
    node.order = total - index - 1;
  });
}

function assignOrdersFromTopToBottom(nodes: PageLayerNode[]): void {
  const total = nodes.length;
  nodes.forEach((node, index) => {
    node.order = total - index - 1;
  });
}

export function findLayerLocation(
  page: PageModel,
  nodeId: string,
): LayerLocation | undefined {
  function visit(
    siblings: PageLayerNode[],
    ancestors: PageLayerGroup[],
  ): LayerLocation | undefined {
    for (const node of siblings) {
      if (node.id === nodeId) return { node, siblings, ancestors };
      if (node.kind === "group") {
        const found = visit(node.children, [...ancestors, node]);
        if (found) return found;
      }
    }
    return undefined;
  }

  return visit(page.layers, []);
}

export function createEmptyLayer(
  page: PageModel,
  id: string,
  name?: string,
  parentGroupId?: string,
): PageObjectLayer {
  if (findLayerLocation(page, id)) {
    throw new LayerOperationError(`Узел слоя ${id} уже существует`);
  }
  const parent = parentGroupId ? findLayerLocation(page, parentGroupId)?.node : undefined;
  if (parentGroupId && parent?.kind !== "group") {
    throw new LayerOperationError(`Папка ${parentGroupId} не найдена`);
  }
  const siblings = parent?.kind === "group" ? parent.children : page.layers;
  const layer: PageObjectLayer = {
    id,
    kind: "layer",
    name: name ?? `Слой ${countObjectLayers(page.layers) + 1}`,
    order: highestOrder(siblings) + 1,
    visible: true,
    locked: false,
    color: "#9868a8",
  };
  siblings.push(layer);
  normalizeOrdersTopToBottom(siblings);
  return layer;
}

export function createLayerGroup(
  page: PageModel,
  id: string,
  name = "Новая папка",
  parentGroupId?: string,
): PageLayerGroup {
  if (findLayerLocation(page, id)) {
    throw new LayerOperationError(`Узел слоя ${id} уже существует`);
  }
  const parent = parentGroupId ? findLayerLocation(page, parentGroupId)?.node : undefined;
  if (parentGroupId && parent?.kind !== "group") {
    throw new LayerOperationError(`Папка ${parentGroupId} не найдена`);
  }
  const siblings = parent?.kind === "group" ? parent.children : page.layers;
  const group: PageLayerGroup = {
    id,
    kind: "group",
    name,
    order: highestOrder(siblings) + 1,
    visible: true,
    locked: false,
    color: "#b79b5f",
    expanded: true,
    children: [],
  };
  siblings.push(group);
  normalizeOrdersTopToBottom(siblings);
  return group;
}

/** Attaches exactly one printable object to an empty object layer. */
export function attachElementToLayer(
  page: PageModel,
  layerId: string,
  element: LayoutElementNode,
): void {
  const location = findLayerLocation(page, layerId);
  if (!location) throw new LayerOperationError(`Слой ${layerId} не найден`);
  if (location.node.kind !== "layer") {
    throw new LayerOperationError("Объект нельзя поместить непосредственно в папку");
  }
  if (location.node.locked || location.ancestors.some((group) => group.locked)) {
    throw new LayerOperationError(`Слой ${location.node.name} заблокирован`);
  }
  if (location.node.elementId) {
    throw new LayerOperationError(`Слой ${location.node.name} уже содержит объект`);
  }
  if (page.elements.some((item) => item.id === element.id)) {
    throw new LayerOperationError(`Объект ${element.id} уже существует на странице`);
  }

  element.layerId = location.node.id;
  location.node.elementId = element.id;
  page.elements.push(element);
}

export function detachElementFromLayer(page: PageModel, layerId: string): LayoutElementNode | undefined {
  const location = findLayerLocation(page, layerId);
  if (!location || location.node.kind !== "layer" || !location.node.elementId) return undefined;
  const layer = location.node;
  if (layer.locked || location.ancestors.some((group) => group.locked)) {
    throw new LayerOperationError(`Слой ${layer.name} заблокирован`);
  }

  const elementIndex = page.elements.findIndex((item) => item.id === layer.elementId);
  if (elementIndex < 0) {
    layer.elementId = undefined;
    return undefined;
  }

  const [element] = page.elements.splice(elementIndex, 1);
  layer.elementId = undefined;
  return element;
}

export function moveLayerNode(
  page: PageModel,
  sourceId: string,
  targetId: string,
  placement: "before" | "after" | "inside",
): void {
  const source = findLayerLocation(page, sourceId);
  const target = findLayerLocation(page, targetId);
  if (!source || !target || sourceId === targetId) return;
  if (source.node.protected || source.node.pinnedToFront || source.node.locked || source.ancestors.some((group) => group.locked || group.protected)) {
    throw new LayerOperationError(`Слой ${source.node.name} заблокирован`);
  }
  if (target.node.protected || target.node.pinnedToFront || target.node.locked || target.ancestors.some((group) => group.locked || group.protected)) {
    throw new LayerOperationError(`Целевая папка или слой заблокированы`);
  }
  if (source.node.kind === "group" && containsNode(source.node, targetId)) {
    throw new LayerOperationError("Папку нельзя переместить внутрь самой себя");
  }

  const sourceIndex = source.siblings.indexOf(source.node);
  source.siblings.splice(sourceIndex, 1);
  normalizeOrdersTopToBottom(source.siblings);

  if (placement === "inside") {
    if (target.node.kind !== "group") {
      throw new LayerOperationError("Помещать внутрь можно только папки");
    }
    source.node.order = highestOrder(target.node.children) + 1;
    target.node.children.push(source.node);
    target.node.expanded = true;
    return;
  }

  const refreshedTarget = findLayerLocation(page, targetId);
  if (!refreshedTarget) return;
  const ordered = topToBottom(refreshedTarget.siblings);
  const targetIndex = ordered.findIndex((node) => node.id === targetId);
  ordered.splice(placement === "after" ? targetIndex + 1 : targetIndex, 0, source.node);
  refreshedTarget.siblings.splice(0, refreshedTarget.siblings.length, ...ordered);
  assignOrdersFromTopToBottom(refreshedTarget.siblings);
  normalizeOrdersTopToBottom(refreshedTarget.siblings);
}

export function moveLayerNodeToEdge(
  page: PageModel,
  nodeId: string,
  edge: "front" | "back",
): void {
  const location = findLayerLocation(page, nodeId);
  if (!location) return;
  if (location.node.protected || location.node.pinnedToFront || location.node.locked || location.ancestors.some((group) => group.locked || group.protected)) {
    throw new LayerOperationError(`Слой ${location.node.name} заблокирован`);
  }
  location.node.order =
    edge === "front"
      ? highestOrder(location.siblings) + 1
      : Math.min(1, ...location.siblings.map((node) => node.order)) - 1;
  normalizeOrdersTopToBottom(location.siblings);
}

export function removeLayerNode(page: PageModel, nodeId: string): string[] {
  const location = findLayerLocation(page, nodeId);
  if (!location) return [];
  if (
    location.node.protected ||
    location.node.pinnedToFront ||
    location.node.locked ||
    location.ancestors.some((group) => group.locked || group.protected) ||
    containsLockedNode(location.node)
  ) {
    throw new LayerOperationError(`Слой или папка ${location.node.name} заблокированы`);
  }
  const elementIds = collectElementIds(location.node);
  const index = location.siblings.indexOf(location.node);
  location.siblings.splice(index, 1);
  normalizeOrdersTopToBottom(location.siblings);
  if (elementIds.length > 0) {
    const removed = new Set(elementIds);
    page.elements.splice(
      0,
      page.elements.length,
      ...page.elements.filter((element) => !removed.has(element.id)),
    );
  }
  return elementIds;
}

export function groupLayerNodes(
  page: PageModel,
  nodeIds: string[],
  groupId: string,
  name = "Группа",
): PageLayerGroup {
  const uniqueIds = [...new Set(nodeIds)];
  if (uniqueIds.length < 2) {
    throw new LayerOperationError("Для объединения выберите не менее двух слоёв");
  }
  const locations = uniqueIds.map((id) => findLayerLocation(page, id));
  if (locations.some((location) => !location)) {
    throw new LayerOperationError("Один из выбранных слоёв не найден");
  }
  const resolved = locations as LayerLocation[];
  if (resolved.some((location) => location.node.protected || location.node.pinnedToFront || location.node.locked || location.ancestors.some((group) => group.locked || group.protected))) {
    throw new LayerOperationError("Защищённый слой нельзя объединить в папку");
  }
  const siblings = resolved[0]!.siblings;
  if (!resolved.every((location) => location.siblings === siblings)) {
    throw new LayerOperationError("Объединять можно слои одного уровня");
  }

  const selected = resolved
    .map((location) => location.node)
    .sort((a, b) => b.order - a.order);
  for (const node of selected) siblings.splice(siblings.indexOf(node), 1);

  const group: PageLayerGroup = {
    id: groupId,
    kind: "group",
    name,
    order: highestOrder(siblings) + 1,
    visible: true,
    locked: false,
    color: "#b79b5f",
    expanded: true,
    children: selected,
  };
  siblings.push(group);
  normalizeOrdersTopToBottom(group.children);
  normalizeOrdersTopToBottom(siblings);
  return group;
}

export function flattenObjectLayers(nodes: PageLayerNode[]): ResolvedObjectLayer[] {
  const result: ResolvedObjectLayer[] = [];
  let stackOrder = 0;

  function visit(
    siblings: PageLayerNode[],
    inheritedVisible: boolean,
    inheritedLocked: boolean,
  ): void {
    for (const node of [...siblings].sort((a, b) => a.order - b.order)) {
      const effectiveVisible = inheritedVisible && node.visible;
      const effectiveLocked = inheritedLocked || node.locked;
      if (node.kind === "group") {
        visit(node.children, effectiveVisible, effectiveLocked);
      } else {
        result.push({ layer: node, effectiveVisible, effectiveLocked, stackOrder });
        stackOrder += 1;
      }
    }
  }

  visit(nodes, true, false);
  return result;
}

export function countObjectLayers(nodes: PageLayerNode[]): number {
  return nodes.reduce(
    (count, node) => count + (node.kind === "group" ? countObjectLayers(node.children) : 1),
    0,
  );
}

function containsNode(group: PageLayerGroup, id: string): boolean {
  return group.children.some(
    (node) => node.id === id || (node.kind === "group" && containsNode(node, id)),
  );
}

function collectElementIds(node: PageLayerNode): string[] {
  if (node.kind === "layer") return node.elementId ? [node.elementId] : [];
  return node.children.flatMap(collectElementIds);
}

function containsLockedNode(node: PageLayerNode): boolean {
  return node.locked || (node.kind === "group" && node.children.some(containsLockedNode));
}
