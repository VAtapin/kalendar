import { describe, expect, it } from "vitest";
import { readFileSync } from 'node:fs';
import { localizeCalendarEvent } from '../src/calendar/localization/calendar-language';
import { installSlavonicCorpus } from '../src/calendar/localization/slavonic-corpus';
import {
  createCalendarPublicApi,
  createOrthodoxCalendarApiFromXml,
  parseCalendarApiDate,
} from "../src/calendar";

const xml = `<MemoryDays><event>
  <s_month>1</s_month><s_date>1</s_date><f_month>1</f_month><f_date>1</f_date>
  <name>Праздник</name><type>1</type>
</event></MemoryDays>`;

describe("public calendar API contract", () => {
  it('uses the same titles as the editor in every language, including loaded Slavonic texts', () => {
    installSlavonicCorpus(JSON.parse(readFileSync('public/data/church-slavonic/catalogue.json','utf8')));
    const engine = createOrthodoxCalendarApiFromXml(readFileSync('public/data/MemoryDays.xml','utf8'));
    const year = engine.getYear(2027);
    for (const language of ['de','uk','pl','cu'] as const) {
      const api = createCalendarPublicApi(engine, language);
      let translated = 0;
      for (const day of year.days) {
        const exposed = api.getDay(day.date)!;
        for (let i = 0; i < day.events.length; i++) {
          const display = localizeCalendarEvent(day.events[i]!, language);
          expect(exposed.events[i]!.title).toBe(display.title);
          expect(exposed.events[i]!.shortTitle).toBe(display.shortTitle);
          expect(exposed.events[i]!.veryShortTitle).toBe(display.veryShortTitle);
          expect(exposed.events[i]!.description).toBe(display.description ?? null);
          expect(exposed.events[i]!.localization, `${language}: ${day.events[i]!.title}`).not.toBe('source-fallback');
          if (day.events[i]!.shortTitle) expect(display.shortTitle, day.events[i]!.title).toBeTruthy();
          if (day.events[i]!.veryShortTitle) expect(display.veryShortTitle, day.events[i]!.title).toBeTruthy();
          if (day.events[i]!.description && !(language === 'uk' && day.events[i]!.description === 'Покров')) {
            expect(display.description).not.toBe(day.events[i]!.description);
          }
          if (language === 'pl') {
            expect([display.title, display.shortTitle, display.veryShortTitle, display.description].filter(Boolean).join(' '))
              .not.toMatch(/\p{Script=Cyrillic}/u);
          }
          if (exposed.events[i]!.localization !== 'source-fallback') translated++;
        }
      }
      expect(translated).toBeGreaterThan(0);
    }
  });
  it("validates civil ISO dates", () => {
    expect(parseCalendarApiDate("2027-02-28")).toEqual({ year: 2027, month: 2, day: 28 });
    expect(parseCalendarApiDate("2027-02-29")).toBeUndefined();
  });

  it("returns a versioned serializable day", () => {
    const api = createCalendarPublicApi(createOrthodoxCalendarApiFromXml(xml));
    const day = api.getDay({ year: 2027, month: 1, day: 14 });
    expect(day?.date).toBe("2027-01-14");
    expect(api.metadata().apiVersion).toBe("1.0.0");
    expect(JSON.parse(JSON.stringify(day))).toEqual(day);
    expect(day?.events[0]?.source?.raw.name).toBe('Праздник');
    expect(day?.events[0]?.typikonMark?.id).toBe('great');
  });

  it('returns every engine event for the whole year, including readings and minor memories', () => {
    const engine = createOrthodoxCalendarApiFromXml(readFileSync('public/data/MemoryDays.xml','utf8'));
    const api = createCalendarPublicApi(engine);
    for (const day of engine.getYear(2027).days) {
      const exposed = api.getDay(day.date)!;
      expect(exposed.events.map(e => e.id)).toEqual(day.events.map(e => e.id));
      expect(exposed.eventCount).toBe(day.events.length);
      expect(exposed.foodLabel.trim()).not.toBe('');
      for (const event of exposed.events) {
        if (event.source) expect(event.source.raw).toEqual(engine.dataset.records[event.sourceIndex - 1]!.raw);
        if (event.typeCode >= 7) expect(event.typikonMark).toBeNull();
      }
    }
    const pascha = api.getDay({ year: 2027, month: 5, day: 2 })!;
    expect(pascha.daysFromPascha).toBe(0);
    expect(pascha.weekdayName).toBe('Воскресенье');
    expect(pascha.foodMarkers.length).toBeGreaterThan(1);
    expect(api.getDay({year:2027,month:5,day:1})!.daysFromPascha).toBe(-1);
  });

  it('does not present missing translations or icon images as available', () => {
    const iconXml = xml.replace('Праздник', 'Неизвестной иконы Божией Матери').replace('<type>1</type>', '<type>17</type>');
    const api = createCalendarPublicApi(createOrthodoxCalendarApiFromXml(iconXml), 'de');
    const day = api.getDay({year:2027,month:1,day:14})!;
    const icon = day.events.find(e => e.sourceIndex === 1)!;
    expect(icon.localization).toBe('source-fallback');
    expect(icon.sourceTitle).toBe(icon.title);
    expect(icon.typikonMark).toBeNull();
    expect(day.icons).toContainEqual({eventId:icon.id,title:icon.title,imageUrl:null});
    expect(api.metadata().completeness.iconImages).toBe(false);
  });
});
