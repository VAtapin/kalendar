import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {describe,it,expect} from 'vitest';
import {TYPIKON_MARKERS} from '../src/calendar/presentation/typikon-markers';
describe('print typikon images',()=>{
 for(const asset of Object.values(TYPIKON_MARKERS))it(`${asset.id}: complete centered square raster`,()=>{
  const png=PNG.sync.read(readFileSync('public'+asset.pdfRasterSource));
  expect(png.width).toBe(600);expect(png.height).toBe(600);
  let minX=600,maxX=0,minY=600,maxY=0;
  for(let y=0;y<600;y++)for(let x=0;x<600;x++)if(png.data[(y*600+x)*4+3]!>128){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  expect(Math.abs((minX+maxX)/2-300)).toBeLessThan(30);
  expect(maxX-minX).toBeGreaterThan(350);
  expect(maxY-minY).toBeGreaterThan(350);
 });
});
