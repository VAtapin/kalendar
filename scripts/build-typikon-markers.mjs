import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {PNG} from 'pngjs';
import assert from 'node:assert/strict';
const names=['great','vigil','polyeleos','doxology','six-stichera'];
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage();
 for(const name of names){
  const svg=await readFile(`public/assets/typikon/${name}.svg`,'utf8');
  const data=await page.evaluate(async svg=>{
   // Explicit dimensions prevent the browser's default 300x150 SVG viewport.
   const source=svg.replace('<svg ','<svg width="600" height="600" ');
   const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(source)));await img.decode();
   const canvas=document.createElement('canvas');canvas.width=600;canvas.height=600;
   canvas.getContext('2d').drawImage(img,0,0,600,600);
   return canvas.toDataURL('image/png').split(',')[1];
  },svg);
  const bytes=Buffer.from(data,'base64');
  const target=`public/assets/typikon/${name}-print.png`;
  if(process.argv.includes('--check')){
   const actual=PNG.sync.read(await readFile(target)),expected=PNG.sync.read(bytes);
   assert.equal(actual.width,expected.width);assert.equal(actual.height,expected.height);
   assert.deepEqual(actual.data,expected.data,`${name}: PNG must match the full SVG viewport`);
  } else await writeFile(target,bytes);
  console.log('PASS',target);
 }
 if(process.argv.includes('--proof')){
  const {PDFDocument,rgb}=await import('pdf-lib');
  const pdf=await PDFDocument.create(),sheet=pdf.addPage([600,380]);
  sheet.drawText('Typikon: complete markers at different sizes',{x:20,y:355,size:16});
  for(const [i,name] of names.entries()){
   const img=await pdf.embedPng(await readFile(`public/assets/typikon/${name}-print.png`));
   sheet.drawText(name,{x:20+i*116,y:320,size:10});
   for(const [row,size] of [16,32,80].entries()){
    const x=25+i*116,y=260-row*95;
    sheet.drawRectangle({x,y,width:size,height:size,borderColor:rgb(.8,.8,.8),borderWidth:.25});
    sheet.drawImage(img,{x,y,width:size,height:size});
   }
  }
  await mkdir('tmp/pdfs',{recursive:true});await writeFile('tmp/pdfs/typikon-proof.pdf',await pdf.save());
 }
}finally{await browser.close();}
