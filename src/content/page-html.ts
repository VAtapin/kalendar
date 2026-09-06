import DOMPurify from 'dompurify';
import type { PageTranslation } from './site-pages';
export function cleanPageHtml(html:string):string {
  return DOMPurify.sanitize(html,{ALLOWED_TAGS:['p','div','span','br','h1','h2','h3','h4','h5','h6','strong','b','em','i','u','s','ul','ol','li','blockquote','a','img','hr','table','thead','tbody','tr','th','td'],ALLOWED_ATTR:['href','src','alt','title','colspan','rowspan'],ALLOW_DATA_ATTR:false,ALLOWED_URI_REGEXP:/^(?:https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i});
}
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function pageHtml(tr:PageTranslation):string {
  if(tr.html!==undefined)return cleanPageHtml(tr.html);
  return cleanPageHtml(tr.blocks.map(b=>{let text=escape(b.text).replace(/\n/g,'<br>');if(b.style?.bold)text=`<strong>${text}</strong>`;if(b.style?.italic)text=`<em>${text}</em>`;return b.type==='image'?`<img src="${escape(b.url)}" alt="${escape(b.text)}">`:b.type==='button'?`<p><a href="${escape(b.url)}">${text}</a></p>`:b.type==='heading'?`<h2>${text}</h2>`:`<p>${text}</p>`;}).join(''));
}
