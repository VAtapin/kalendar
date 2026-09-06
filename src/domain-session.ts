export async function sessionRequest(action: string, body: unknown): Promise<{url:string}> {
  const response=await fetch(`/api/v1/domain-session/${action}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw new Error('Не удалось перенести вход между доменами. Повторите переключение языка.');
  const result=await response.json() as {url:string};
  const url=new URL(result.url);
  if(!['https://kalender.georg-kloster.ru','https://kalender.georg-kloster.de'].includes(url.origin))throw new Error('Invalid session destination');
  return result;
}
export async function completeDomainSession():Promise<boolean>{
  const match=/^#session-(bind|authorize|redeem)=([a-zA-Z0-9_-]+)$/.exec(location.hash);
  if(!match)return false;
  history.replaceState(history.state,'',location.pathname+location.search);
  const result=await sessionRequest(match[1]!,{id:match[2]});
  location.replace(result.url);return true;
}
