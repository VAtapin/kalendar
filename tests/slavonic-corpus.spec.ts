import { readFileSync } from "node:fs";
import fontkit from "@pdf-lib/fontkit";
import { describe, expect, it, vi } from "vitest";
import { installSlavonicCorpus, loadSlavonicCorpus, slavonicSourceKey, sourceAttestedSlavonicTitle } from "../src/calendar/localization/slavonic-corpus";
import { calendarCoverHeading, localizeCalendarEvent, localizeCalendarEventTitleWithStatus, localizedTextTitle } from "../src/calendar/localization/calendar-language";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { createCoverTemplatePage } from "../src/templates/calendar-templates";
import { setManualTextTitle } from "../src/document/text-title";
import { churchSlavonicTechnicalIssues } from "../scripts/lib/calendar-source-audit";
import type { ResolvedCalendarEvent } from "../src/calendar/types";
import { buildGeneratedLiturgicalEvents } from "../src/calendar/engine/liturgical-cycle";

const corpus = JSON.parse(readFileSync("public/data/church-slavonic/catalogue.json", "utf8"));
const dataset = parseMemoryDaysXml(readFileSync("public/data/MemoryDays.xml", "utf8"));
describe("separate source-attested Church Slavonic catalogue", () => {
  it("translates every generated-cycle title and both short alternatives in 1900–2199", () => {
    const titles = new Set<string>();
    for (let year = 1900; year <= 2199; year++) {
      for (const event of buildGeneratedLiturgicalEvents(year)) {
        for (const title of [event.title, event.shortTitle, event.veryShortTitle]) if (title) titles.add(title);
      }
    }
    for (const title of titles) {
      const result = localizeCalendarEventTitleWithStatus(title, "cu");
      expect(result.status, title).not.toBe("source-fallback");
      expect(churchSlavonicTechnicalIssues(result.title), title).toEqual([]);
    }
  });
  it("loads once on demand, with retry after network failure", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("failed", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(corpus)));
    await expect(loadSlavonicCorpus(fetcher)).rejects.toThrow("503");
    await Promise.all([loadSlavonicCorpus(fetcher), loadSlavonicCorpus(fetcher)]);
    await loadSlavonicCorpus(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("ships source provenance, license and undamaged glyphs for every entry", () => {
    installSlavonicCorpus(corpus);
    const font = fontkit.create(readFileSync("public/fonts/MonomakhUnicode.ttf"));
    const sources = JSON.parse(readFileSync("public/data/church-slavonic/sources.json", "utf8"));
    expect(corpus.entries.length).toBeGreaterThan(1100);
    expect(corpus.license).toBe("GPL-3.0-or-later");
    expect(readFileSync("public/data/church-slavonic/COPYING", "utf8")).toContain("GNU GENERAL PUBLIC LICENSE");
    for (const entry of corpus.entries) {
      expect(sources.records.some((source: { cid: string }) => source.cid === entry.sourceId)).toBe(true);
      expect(dataset.records.some(r => r.title === entry.ru), entry.ru).toBe(true);
      expect(churchSlavonicTechnicalIssues(entry.cu), entry.ru).toEqual([]);
      for (const letter of entry.cu as string) expect(font.hasGlyphForCodePoint(letter.codePointAt(0)!), `${entry.ru}: ${letter}`).toBe(true);
      expect(sourceAttestedSlavonicTitle(entry.ru)).toBe(entry.cu);
      expect(localizeCalendarEventTitleWithStatus(entry.ru, "cu").status).not.toBe("source-fallback");
    }
  });
  it("rejects ambiguous or damaged catalogues atomically", () => {
    const first = corpus.entries[0];
    expect(() => installSlavonicCorpus({ ...corpus, entries: [first, { ...first, cu: "С\u0099т҃о́е" }] })).toThrow();
    expect(() => installSlavonicCorpus({ ...corpus, entries: [first, { ...first, cu: "И҆но́е и҆́мѧ" }] })).toThrow("Ambiguous");
    expect(sourceAttestedSlavonicTitle(first.ru)).toBe(first.cu);
  });
  it("keeps source corrections explicit and does not alter the feminine form for Olga", () => {
    installSlavonicCorpus(corpus);
    const ledger = JSON.parse(readFileSync("public/data/church-slavonic/editorial-corrections.json", "utf8"));
    for (const correction of ledger.corrections) {
      expect(corpus.entries.find((entry: { sourceId: string }) => entry.sourceId === correction.sourceId)?.cu).toBe(correction.after);
      expect(correction.sources.length).toBeGreaterThan(0);
    }
    expect(sourceAttestedSlavonicTitle("Равноап. Ольги, вел. кн. Российской, во св. Крещении Елены (969)"))
      .toContain("нарече́нныѧ");
    expect(sourceAttestedSlavonicTitle("Бессребреников и чудотворцев Космы и Дамиана Азийских и матери их прп. Феодотии (III)"))
      .toContain("прпⷣбныѧ феодо́тїи");
  });
  it("never translates by similarity, removing a surname or changing a historical year", () => {
    expect(sourceAttestedSlavonicTitle("Прп. Марии Неизвестной (123)")).toBeUndefined();
    expect(slavonicSourceKey("Павла")).not.toBe(slavonicSourceKey("Павлы"));
    const entry = corpus.entries.find((row: { ru: string }) => /\d{4}/u.test(row.ru));
    expect(sourceAttestedSlavonicTitle(entry.ru.replace(/\d{4}/u, "9999"))).toBeUndefined();
  });
  it("does not replace the translated full name by the Russian short name in tight cells", () => {
    const entry = corpus.entries.find((row: { ru: string }) => row.ru.startsWith("Прп."));
    const event = { title: entry.ru, shortTitle: "Непереведённое сокращение", veryShortTitle: "Непереведённое" } as ResolvedCalendarEvent;
    const translated = localizeCalendarEvent(event, "cu");
    expect(translated.title).toBe(entry.cu);
    expect(translated.shortTitle).toBeUndefined();
    expect(translated.veryShortTitle).toBeUndefined();
    expect(event.shortTitle).toBe("Непереведённое сокращение");
  });
  it("localizes the cover but always honors manually entered text", () => {
    let nextId = 0;
    const page = createCoverTemplatePage("A3", "portrait", 2027, "Мой издатель", () => `cover-${++nextId}`, "cu");
    const title = page.elements.find(e => e.type === "text" && e.semanticRole === "calendar-cover-title");
    if (!title || title.type !== "text") throw new Error("Missing cover title");
    expect(localizedTextTitle(title, page, 2027, "cu")).toBe(calendarCoverHeading("cu"));
    setManualTextTitle(title, "Мой собственный заголовок");
    expect(localizedTextTitle(title, page, 2027, "cu")).toBe("Мой собственный заголовок");
    expect(title.manualTitle).toBe(true);
  });
});
