import {describe,it,expect} from 'vitest';
import {createMonthTemplatePageWithPreset} from '../src/templates/calendar-templates';
import {localizedTextTitle} from '../src/calendar/localization/calendar-language';
import {setManualTextTitle} from '../src/document/text-title';
import {updatePageCalendarYear} from '../src/templates/project-templates';
describe('manual month heading',()=>{
 it('keeps automatic headings until edited; preserves manual text across year, language and serialization',()=>{
  const page=createMonthTemplatePageWithPreset('A3','portrait',1,2027,'editorial-photo',undefined,'ru');
  const text=page.elements.find(e=>e.type==='text'&&e.semanticRole==='calendar-month-title');
  if(!text||text.type!=='text')throw Error('Missing heading');
  expect(localizedTextTitle(text,page,2027,'de')).toContain('Januar');
  setManualTextTitle(text,'Наш январь 2027!');
  updatePageCalendarYear(page,2027,2028,'de');
  const restored=JSON.parse(JSON.stringify(text));
  expect(localizedTextTitle(restored,page,2028,'de')).toBe('Наш январь 2027!');
  expect(restored.semanticRole).toBeUndefined();
  setManualTextTitle(text,'');expect(localizedTextTitle(text,page,2028,'ru')).toBe('');
 });
});
