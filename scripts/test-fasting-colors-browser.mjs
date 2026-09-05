import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1200,height:900}});
  await page.goto('http://127.0.0.1:5178');
  await page.evaluate(async () => {
    const {createApp} = await import('/node_modules/.vite/deps/vue.js');
    const {default:PageScene} = await import('/src/components/PageScene.vue');
    const {createMonthTemplatePage} = await import('/src/templates/calendar-templates.ts');
    const {defaultGlobalCalendarGridTemplates} = await import('/src/templates/calendar-grid-presets.ts');
    const {copyCalendarGridPresentation} = await import('/src/templates/calendar-grid-settings.ts');
    const {buildOrthodoxCalendarYear,parseMemoryDaysXml} = await import('/src/calendar/index.ts');
    const calendar = buildOrthodoxCalendarYear(2027,parseMemoryDaysXml(await(await fetch('/data/MemoryDays.xml')).text()));
    const model = createMonthTemplatePage('A3','landscape',1,2027);
    const grid = model.elements.find(e=>e.type==='calendar-grid');
    copyCalendarGridPresentation(defaultGlobalCalendarGridTemplates().find(t=>t.id==='fasting-colors').grid,grid);
    grid.x=10;grid.y=15;grid.width=400;grid.height=235;
    const legend = model.elements.find(e=>e.type==='legend');
    legend.x=10;legend.y=260;legend.width=400;legend.height=15;
    model.elements = [grid,legend];
    document.querySelector('#app').remove();
    const host=document.createElement('div');document.body.append(host);
    createApp(PageScene,{page:model,assets:[],calendarYear:calendar,calendarLanguage:'ru',pixelsPerMm:2.7,showGuides:false,activeTool:'selection'}).mount(host);
  });
  const colored=page.locator('.calendar-cell > rect[style]');
  await expect(colored).toHaveCount(31);
  await expect(page.locator('.legend-item > rect')).not.toHaveCount(0);
  await page.screenshot({path:'tmp/fasting-colors-preview.png',fullPage:true});
  console.log('PASS: 31 color-coded days and matching legend render in the browser.');
} finally {await browser.close();}
