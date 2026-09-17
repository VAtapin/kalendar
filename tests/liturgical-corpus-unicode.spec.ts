import { readFileSync } from "node:fs";
import fontkit from "@pdf-lib/fontkit";
import { describe, expect, it } from "vitest";

type LiturgicalBlock = {
  id: string;
  text: string;
  segments?: { text: string }[];
};

type LiturgicalWork = {
  slug: string;
  url: string;
  versions: Record<string, LiturgicalBlock[]>;
};

const corpus = JSON.parse(readFileSync("public/data/liturgical-corpus.json", "utf8")) as { works: LiturgicalWork[] };
const ucsSourceHosts = new Set([
  "xn--80ad6b1e.xn--j1amh",
  "xn----7sbahbba0chrecjllhdbcuymu3s.xn--p1ai",
  "lib.pravmir.ru",
]);
const legacyUcsCode = /[A-Za-z№¤¦§©®™]/u;

function ucsWorks(): LiturgicalWork[] {
  return corpus.works.filter(work => ucsSourceHosts.has(new URL(work.url).hostname));
}

describe("Unicode Church Slavonic liturgical corpus", () => {
  it("converts legacy UCS source text, including Church Slavonic verse numbers", () => {
    const kathisma = corpus.works.find(work => work.slug === "horologion---pravmir-22836");
    const psalm = kathisma?.versions.cu?.find(block => block.id === "b2");

    expect(psalm?.text).toContain("[а҃] Бл҃же́ни");
    expect(psalm?.text).toContain("[в҃] Бл҃же́ни");
    expect(psalm?.text).toContain("[і҃] Всѣ́мъ");
    expect(psalm?.text).not.toContain("[№]");
    expect(psalm?.segments?.[0]?.text).toBe("[а҃] Б");
  });

  it("contains no legacy UCS code points in the migrated liturgical sources", () => {
    for (const work of ucsWorks()) {
      for (const block of work.versions.cu ?? []) {
        expect(block.text, `${work.slug}/${block.id}`).not.toMatch(legacyUcsCode);
        for (const segment of block.segments ?? []) {
          expect(segment.text, `${work.slug}/${block.id}`).not.toMatch(legacyUcsCode);
        }
      }
    }
  });

  it("uses only glyphs supplied by Monomakh Unicode", () => {
    const font = fontkit.create(readFileSync("public/fonts/MonomakhUnicode.ttf"));
    const glyphs = new Set<string>();
    for (const work of ucsWorks()) {
      for (const block of work.versions.cu ?? []) {
        for (const character of block.text) glyphs.add(character);
      }
    }
    for (const character of glyphs) expect(font.hasGlyphForCodePoint(character.codePointAt(0)!), character).toBe(true);
  });
});
