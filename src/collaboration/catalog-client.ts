import { computed, ref } from 'vue';
import { DECOR_LIBRARY_ITEMS } from '../decor/decor-library';
import { FONT_OPTIONS } from '../typography/font-catalog';
import { CALENDAR_TEMPLATE_PRESETS } from '../templates/calendar-templates';
import { FOOD_MARKER_PACKS } from '../calendar/presentation/marker-packs';
export interface CatalogItem { id: string; name: string; kind: 'image' | 'svg' | 'font' | 'template'; category: string; enabled: boolean; uploaded?: boolean; family?: string; source?: string; widthPx?: number; heightPx?: number; bytes?: number; mimeType?: string }
export const fontCatalogId = (family: string) => {
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(family)) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 1099511628211n);
  return 'font-' + hash.toString(16);
};
const builtins: CatalogItem[] = [
  ...FOOD_MARKER_PACKS.map(pack => ({id: `food-pack-${pack.id}`, name: pack.label, kind: 'image' as const, category: 'Наборы знаков поста', source: pack.sources.fish, enabled: true})),
  ...DECOR_LIBRARY_ITEMS.map(item => ({ id: item.id, name: item.label, kind: item.kind ?? 'svg', category: item.category, source: item.source, enabled: true })),
  ...FONT_OPTIONS.map(font => ({ id: fontCatalogId(font.family), name: font.label, family: font.family, kind: 'font' as const, category: font.kind, enabled: true })),
  ...CALENDAR_TEMPLATE_PRESETS.map(item => ({id: `template-${item.id}`, name: item.name, kind: 'template' as const, category: 'calendar', enabled: true})),
];
export const catalogOverrides = ref<Partial<CatalogItem>[]>([]);
export const catalogItems = computed<CatalogItem[]>(() => {
  const merged = new Map(builtins.map(item => [item.id, { ...item }]));
  for (const item of catalogOverrides.value) {
    if (!item.id) continue;
    if (merged.has(item.id)) merged.set(item.id, { ...merged.get(item.id)!, ...item });
    else if (item.uploaded) merged.set(item.id, item as CatalogItem);
  }
  return [...merged.values()];
});
export function catalogEnabled(id: string): boolean { return catalogOverrides.value.find(item => item.id === id)?.enabled !== false; }
export async function catalogRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {method, credentials: 'same-origin', headers: body === undefined ? {} : {'Content-Type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)});
  if (response.status === 204) return undefined as T;
  const data = await response.json(); if (!response.ok) throw new Error(data.message || data.error || 'Ошибка каталога'); return data;
}
export async function refreshCatalog(): Promise<void> { catalogOverrides.value = (await catalogRequest<{items: CatalogItem[]}>('catalog')).items; }
export const catalogContentUrl = (id: string) => `/api/v1/catalog/${encodeURIComponent(id)}/content`;
