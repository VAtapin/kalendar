import { expect, it } from "vitest";
import { compareIdentityParagraph } from "../scripts/lib/commemoration-identity-evidence";

const paragraph = 'Мч. <a href="https://days.pravoslavie.ru/name/14399.html" title="Василий Петров, мч.">Василия</a> (1942).';
it("preserves an epithet already present in the printed source", () => {
  const html = 'Прп. <a href="https://days.pravoslavie.ru/name/4.html" title="Сергий Радонежский">Сергия</a> Радонежского (1392).';
  const match = compareIdentityParagraph("Прп. Сергия Радонежского (1392)", html);
  expect(match.completeTextMatch).toBe(true);
  expect(match.identities).toEqual([]);
  expect(compareIdentityParagraph("Прп. Сергия Радонежского (1393)", html).completeTextMatch).toBe(false);
});
it("requires the same given name, source-linked surname and year", () => {
  expect(compareIdentityParagraph("Мч. Василия Петрова (1942)", paragraph).completeTextMatch).toBe(true);
  for (const title of ["Мч. Василия Петрова (1941)", "Мч. Иоанна Петрова (1942)", "Мч. Василия Петренко (1942)"]) {
    expect(compareIdentityParagraph(title, paragraph).completeTextMatch).toBe(false);
  }
});
it("never verifies a surname against an image or unrelated link", () => {
  for (const html of [paragraph.replace('/name/', '/Life/'), paragraph.replace('<a ', '<img ').replace('</a>', '')]) {
    expect(compareIdentityParagraph("Мч. Василия Петрова (1942)", html).completeTextMatch).toBe(false);
  }
});
it("handles parenthesized adjectival surnames without a similarity threshold", () => {
  const html = 'Сщмч. <a href="https://days.pravoslavie.ru/name/1.html" title="Василий (Холмогоров), священник">Василия</a> пресвитера (1938).';
  expect(compareIdentityParagraph("Сщмч. Василия Холмогорова пресвитера (1938)", html).completeTextMatch).toBe(true);
  expect(compareIdentityParagraph("Сщмч. Василия Холмогорского пресвитера (1938)", html).completeTextMatch).toBe(false);
  const adjective = 'Мц. <a href="https://days.pravoslavie.ru/name/2.html" title="Евгения (Доможирова), мученица">Евгении</a> (1933).';
  expect(compareIdentityParagraph("Мц. Евгении Доможировой (1933)", adjective).completeTextMatch).toBe(true);
  const male = 'Сщмч. <a href="https://days.pravoslavie.ru/name/3.html" title="Павел (Никольский), священник">Павла</a> (1943).';
  expect(compareIdentityParagraph("Сщмч. Павла Никольского (1943)", male).completeTextMatch).toBe(true);
});
