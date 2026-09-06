export interface VideoLesson { id:string; title:string; url:string; enabled:boolean; duration:string }
export function youtubeId(url:string):string|undefined {
 try {const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)return;
 const host=u.hostname.toLowerCase();const id=host==='youtu.be'?u.pathname.slice(1):['youtube.com','www.youtube.com','m.youtube.com'].includes(host)?u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1]:undefined;
 return id&&/^[a-zA-Z0-9_-]{11}$/.test(id)?id:undefined;}catch{return;}
}
export async function videoRequest(admin=false,body?:unknown):Promise<{items:VideoLesson[];revision:number}>{
 const r=await fetch('/api/v1/'+(admin?'admin/':'')+'video-lessons',{method:body?'PUT':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const data=await r.json();if(!r.ok)throw Error(data.message??data.error??'Ошибка загрузки');return data;
}
