const robots=await(await fetch('https://azbyka.ru/robots.txt')).text();
console.log(robots.split('\n').filter(l=>/days|crawl|user-agent/i.test(l)).join('\n'));
for(const path of ['menology/ikons','menology/saints-with-ikon']){
const t=await(await fetch('https://azbyka.ru/days/'+path)).text();
console.log(path,t.length,'gallery',(t.match(/data-fancybox-href/g)||[]).length);
console.log(t.slice(t.indexOf('<tbody'),t.indexOf('<tbody')+2200));
console.log([...new Set(t.match(/href="[^"]*(?:icon-|sv-)[^"]+/g)||[])].slice(0,8));
}
