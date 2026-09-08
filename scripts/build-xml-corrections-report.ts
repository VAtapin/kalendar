import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";

type Rule = { startMonth: number; startDate: number; finishMonth: number; finishDate: number };
type Change = {
  sourceIndex: number; before: string | number | Rule; after: string | number | Rule;
  reason: string; sources: string[]; caveat?: string; scopeLimit?: string; classification?: string;
  addedNamedPeople?: string[];
  groupCompletion?: { addedNamedPeople: string[]; reason: string; source: string };
};
type Addition = Rule & { sourceIndex: number; title: string; typeCode: number; movedFrom: number; reason: string; sources: string[] };
const ledger: { changes: Change[]; dateChanges: Change[]; rankChanges: Change[]; descriptionChanges: Change[]; addedRecords: Addition[] } =
  JSON.parse(readFileSync("docs/audit-data/xml-corrections-2026-09-08.json", "utf8"));
const xml = readFileSync("public/data/MemoryDays.xml", "utf8");
const records = parseMemoryDaysXml(xml).records;
const sections = [
  ["Название / ссылка на Писание", ledger.changes], ["Правило даты", ledger.dateChanges],
  ["Чин", ledger.rankChanges], ["Подпись чтения", ledger.descriptionChanges],
] as const;
const ids = [...new Set(sections.flatMap(([, changes]) => changes.map(c => c.sourceIndex)))].sort((a,b) => a-b);
const escape = (text: string) => text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
const value = (input: Change["before"]) => typeof input === "object"
  ? `s_month=${input.startMonth}, s_date=${input.startDate}, f_month=${input.finishMonth}, f_date=${input.finishDate}`
  : escape(String(input));
const links = (urls: string[]) => urls.map((url, i) => `[Источник ${i + 1}](${url})`).join(" · ");
const text = [
  "# Исправления XML: было → стало", "", "Дата: 8 сентября 2026 года. База сравнения: `44c7bc3`.", "",
  `Число изменённых исходных записей: **${ids.length}**. Число отдельных записей, выделенных из групп с другой датой: **${ledger.addedRecords.length}**. Всего сейчас ${records.length} записей.`, "",
  "Разные поля одной записи считаются раздельно в разделах ниже, но один раз в итоговом числе. Существующие идентификаторы не сдвинуты. Пунктуационные поправки и допустимые варианты не объявляются историческими ошибками.", "",
  `SHA-256 текущего XML: \`${createHash("sha256").update(xml).digest("hex")}\`.`, "",
  "Этот журнал подтверждает перечисленные исправления, **не является сертификатом полноты и безошибочности всего корпуса**. [Заключение и незакрытые проверки](XML-AND-SLAVONIC-AUDIT-2026-09-08.md).", "",
  "Положительные месяцы в правилах XML означают старый стиль. Нулевой месяц — смещение от Пасхи; отрицательные месяцы — специальные правила, описанные в `resolve-record.ts`. Это внутренние коды, а не номера гражданских месяцев.", "",
];
for (const id of ids) {
  text.push(`## Запись ${id}`, "", escape(records[id - 1]!.title), "");
  for (const [label, changes] of sections) for (const change of changes.filter(c => c.sourceIndex === id)) {
    text.push(`### ${label}`, "", `Было: ${value(change.before)}`, "", `Стало: ${value(change.after)}`, "", change.reason, "", links(change.sources), "");
    if (change.caveat || change.scopeLimit) text.push(`Ограничение: ${change.caveat ?? change.scopeLimit}`, "");
    if (change.classification) text.push(`Классификация: \`${change.classification}\`.`, "");
    if (change.addedNamedPeople) text.push(`Восстановлены отсутствовавшие имена: ${change.addedNamedPeople.join(", ")}.`, "");
    if (change.groupCompletion) text.push(change.groupCompletion.reason, "",
      `Добавлены: ${change.groupCompletion.addedNamedPeople.join(", ")}. ${links([change.groupCompletion.source])}`, "");
  }
}
text.push("## Выделенные записи", "");
for (const addition of ledger.addedRecords) text.push(`### Запись ${addition.sourceIndex}`, "", escape(addition.title), "",
  `Выделена из записи ${addition.movedFrom}; внутренний тип записи ${addition.typeCode}; ${value(addition)}.`, "", addition.reason, "", links(addition.sources), "");
writeFileSync("docs/XML-CORRECTIONS-2026-09-08.md", text.join("\n"));
console.log(JSON.stringify({ changedOriginalRecords: ids.length, addedRecords: ledger.addedRecords.length,
  titles: ledger.changes.length, rules: ledger.dateChanges.length, ranks: ledger.rankChanges.length, descriptions: ledger.descriptionChanges.length }));
