import type {
  CalendarProject,
  LayoutElementNode,
  PageLayerNode,
} from "./types";

export interface ProjectAssetCompactionResult {
  deduplicated: number;
  removed: number;
}

function visitLayerNodes(nodes: PageLayerNode[], visitAssetId: (assetId: string) => void): void {
  for (const node of nodes) {
    if (node.kind === "group") {
      visitLayerNodes(node.children, visitAssetId);
    } else if (node.mask?.assetId) {
      visitAssetId(node.mask.assetId);
    }
  }
}

function elementAssetId(element: LayoutElementNode): string | undefined {
  return element.type === "image" || element.type === "svg" ? element.assetId : undefined;
}

function remapProjectAssetReferences(project: CalendarProject, aliases: Map<string, string>): void {
  const remap = (assetId: string | undefined): string | undefined =>
    assetId ? (aliases.get(assetId) ?? assetId) : undefined;

  project.publisherProfile.logoAssetId = remap(project.publisherProfile.logoAssetId);
  for (const event of project.monasteryEvents) event.iconAssetId = remap(event.iconAssetId);
  for (const face of project.customFonts ?? []) face.assetId = remap(face.assetId) ?? face.assetId;
  if (project.printSettings) {
    project.printSettings.iccProfileAssetId = remap(project.printSettings.iccProfileAssetId);
  }
  if (project.foodMarkerAssets) {
    for (const rule of Object.keys(project.foodMarkerAssets) as Array<keyof typeof project.foodMarkerAssets>) {
      const assetId = remap(project.foodMarkerAssets[rule]);
      if (assetId) project.foodMarkerAssets[rule] = assetId;
    }
  }
  for (const page of project.document.pages) {
    for (const element of page.elements) {
      const assetId = elementAssetId(element);
      if (assetId && (element.type === "image" || element.type === "svg")) {
        element.assetId = remap(assetId) ?? assetId;
      }
    }
    const remapMasks = (nodes: PageLayerNode[]): void => {
      for (const node of nodes) {
        if (node.kind === "group") remapMasks(node.children);
        else if (node.mask) node.mask.assetId = remap(node.mask.assetId) ?? node.mask.assetId;
      }
    };
    remapMasks(page.layers);
  }
}

function referencedProjectAssetIds(project: CalendarProject): Set<string> {
  const result = new Set<string>();
  const add = (assetId: string | undefined): void => {
    if (assetId) result.add(assetId);
  };
  add(project.publisherProfile.logoAssetId);
  for (const event of project.monasteryEvents) add(event.iconAssetId);
  for (const face of project.customFonts ?? []) add(face.assetId);
  add(project.printSettings?.iccProfileAssetId);
  for (const assetId of Object.values(project.foodMarkerAssets ?? {})) add(assetId);
  for (const page of project.document.pages) {
    for (const element of page.elements) add(elementAssetId(element));
    visitLayerNodes(page.layers, add);
  }
  return result;
}

/**
 * Merges byte-identical embedded assets and removes assets no longer referenced
 * by pages or project settings. This keeps saved projects small after repeated
 * image replacement, page deletion and undoable editing.
 */
export function compactProjectAssets(project: CalendarProject): ProjectAssetCompactionResult {
  // Keep the potentially multi-megabyte source itself as a Map key. Building a
  // concatenated string key here would allocate another copy on every edit.
  const canonicalByType = new Map<string, Map<string, string>>();
  const assetsById = new Map(project.assets.map((asset) => [asset.id, asset]));
  const aliases = new Map<string, string>();
  let deduplicated = 0;

  for (const asset of project.assets) {
    const typeKey = `${asset.kind}\u0000${asset.mimeType}`;
    let canonicalBySource = canonicalByType.get(typeKey);
    if (!canonicalBySource) {
      canonicalBySource = new Map<string, string>();
      canonicalByType.set(typeKey, canonicalBySource);
    }
    const canonicalId = canonicalBySource.get(asset.source);
    if (canonicalId) {
      const canonicalAsset = assetsById.get(canonicalId);
      if (canonicalAsset && !canonicalAsset.libraryItemId && asset.libraryItemId) {
        canonicalAsset.libraryItemId = asset.libraryItemId;
      }
      aliases.set(asset.id, canonicalId);
      deduplicated += 1;
    } else {
      canonicalBySource.set(asset.source, asset.id);
    }
  }
  if (aliases.size > 0) remapProjectAssetReferences(project, aliases);

  const referenced = referencedProjectAssetIds(project);
  const before = project.assets.length;
  project.assets = project.assets.filter((asset) => !aliases.has(asset.id) && referenced.has(asset.id));
  return { deduplicated, removed: before - project.assets.length };
}
