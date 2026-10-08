import {mkdir, readdir, copyFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import sharp from 'sharp';

// Existing decorative assets only; no calendar data or HTTP runtime is bundled.
const source=resolve('public/assets/markers'), target=resolve('wordpress/orthocal/assets/markers');
async function copyMarkers(from,to) {
  await mkdir(to,{recursive:true});
  for(const entry of await readdir(from,{withFileTypes:true})) {
    const input=join(from,entry.name), output=join(to,entry.name);
    if(entry.isDirectory())await copyMarkers(input,output);
    else if(entry.name.endsWith('.png')) await sharp(input).resize({width:384,height:384,fit:'inside',withoutEnlargement:true}).png({palette:true,quality:95,compressionLevel:9}).toFile(output);
    else await copyFile(input,output);
  }
}
await copyMarkers(source,target);
await mkdir('wordpress/orthocal/assets/typikon',{recursive:true});
for(const name of await readdir('public/assets/typikon')) if(name.endsWith('.svg')) await copyFile('public/assets/typikon/'+name,'wordpress/orthocal/assets/typikon/'+name);
await mkdir('wordpress/orthocal/assets/fonts',{recursive:true});
for(const name of ['MonomakhUnicode.ttf','OFL-Monomakh.txt']) await copyFile('public/fonts/'+name,'wordpress/orthocal/assets/fonts/'+name);
console.log('Bundled all existing marker styles, Typikon symbols and licensed Monomakh font.');
