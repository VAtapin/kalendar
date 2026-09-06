import { ref } from 'vue';
import { catalogRequest } from '../collaboration/catalog-client';
export type BlockStyle = {align?:'left'|'center'|'right';fontSize?:number;color?:string;bold?:boolean;italic?:boolean};
export type ContentBlock = { type: 'heading' | 'text' | 'image' | 'button'; text: string; url: string; style?:BlockStyle };
export function blockStyle(style?:BlockStyle) {
  return {textAlign:style?.align,fontSize:style?.fontSize?`${Math.min(48,Math.max(10,style.fontSize))}px`:undefined,color:style?.color && /^#[0-9a-f]{6}$/i.test(style.color)?style.color:undefined,fontWeight:style?.bold===undefined?undefined:style.bold?'bold':'normal',fontStyle:style?.italic?'italic':undefined};
}
export type PageTranslation = { title: string; blocks: ContentBlock[] };
export type SitePage = { id: string; slug: string; order: number; published?: boolean; translations: Partial<Record<'ru'|'de'|'en'|'uk', PageTranslation>> };
export const sitePages = ref<SitePage[]>([]);
let loading: Promise<void> | undefined;
export async function loadSitePages(): Promise<void> {
  if (!loading) loading = catalogRequest<{items:SitePage[]}>('site-pages').then(r => { sitePages.value=r.items; }).finally(()=>{loading=undefined;});
  return loading;
}
export function safeContentUrl(url: string): string {
  try { const parsed=new URL(url); return parsed.protocol==='https:' && !parsed.username && !parsed.password ? url : ''; } catch { return ''; }
}
