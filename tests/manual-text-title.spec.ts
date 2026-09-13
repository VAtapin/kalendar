import {describe,it,expect} from 'vitest';
import {createMonthTemplatePageWithPreset} from '../src/templates/calendar-templates';
import {createBlankCalendarProject} from '../src/document/factories';
import {localizedTextTitle} from '../src/calendar/localization/calendar-language';
import {setManualTextTitle} from '../src/document/text-title';
import {updatePageCalendarYear} from '../src/templates/project-templates';
import {normalizeCalendarProject} from '../src/persistence/project-storage';
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
 it('localizes automatic headings from projects created before semantic roles existed',()=>{
  const page=createMonthTemplatePageWithPreset('A3','portrait',8,2027,'editorial-photo',undefined,'ru');
  const text=page.elements.find(e=>e.type==='text'&&e.semanticRole==='calendar-month-title');
  if(!text||text.type!=='text')throw Error('Missing heading');
  delete text.semanticRole;
  expect(localizedTextTitle(text,page,2027,'uk')).toBe('Серпень');
  expect(localizedTextTitle(text,page,2027,'de')).toBe('August');
  text.content.title='Мій серпень 2027!';
  expect(localizedTextTitle(text,page,2027,'de')).toBe('Мій серпень 2027!');
 });
 it('migrates legacy automatic month headings and page names without changing manual text',()=>{
  const page=createMonthTemplatePageWithPreset('A3','portrait',3,2027,'editorial-photo',undefined,'ru');
  const text=page.elements.find(e=>e.type==='text'&&e.semanticRole==='calendar-month-title');
  if(!text||text.type!=='text')throw Error('Missing heading');
  page.name='Март 2027';
  text.content.title='Март 2027';
  delete text.semanticRole;
  expect(localizedTextTitle(text,page,2027,'uk')).toBe('Березень');
  const project=createBlankCalendarProject();
  project.calendarLanguage='uk';
  project.document.pages=[page];
  normalizeCalendarProject(project);
  expect(page.name).toBe('Березень');
  expect(text.content.title).toBe('Березень');
  expect(text.semanticRole).toBe('calendar-month-title');

  const manualPage=createMonthTemplatePageWithPreset('A3','portrait',3,2027,'editorial-photo',undefined,'ru');
  const manualText=manualPage.elements.find(e=>e.type==='text'&&e.semanticRole==='calendar-month-title');
  if(!manualText||manualText.type!=='text')throw Error('Missing manual heading');
  manualPage.name='Мой март';
  setManualTextTitle(manualText,'Мой текст');
  const manualProject=createBlankCalendarProject();
  manualProject.document.pages=[manualPage];
  normalizeCalendarProject(manualProject);
  expect(manualPage.name).toBe('Мой март');
  expect(manualText.content.title).toBe('Мой текст');
 });
});
