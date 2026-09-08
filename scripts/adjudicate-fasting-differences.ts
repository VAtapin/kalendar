import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const path = "docs/audit-data/fasting-independent-2026-09-08.json";
const original = JSON.parse(execFileSync("git", ["show", `3ec616e:${path}`], { encoding: "utf8" }));
const current = JSON.parse(readFileSync(path, "utf8"));
const official = JSON.parse(readFileSync("docs/audit-data/official-trapeza-2026-09-08.json", "utf8"));
const chapter = (n: number) => `https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/tipikon/${n}`;
const parishSource = "https://azbyka.ru/days/p-kalendar-postov-i-trapez";
type Decision = { dates: string[]; disposition: string; reason: string; sources: string[] };
const group = (dates: string, disposition: string, reason: string, sources: string[]): Decision =>
  ({ dates: dates.split(" "), disposition, reason, sources });
// Explicit reviewed dates, not a classifier that declares arbitrary future
// differences approved. Changing the engine invalidates the recorded outcomes.
const decisions: Decision[] = [
  group("2026-02-11 2026-02-13 2026-01-21 2026-01-23 2026-01-28 2026-01-30", "profile-rule-explained",
    "Зимний мясоед сам по себе не даёт рыбу по гл. 33. Строгий профиль сохраняет седмичную меру и разрешения по чину; приходской — масло. Рыбный вариант сайта не выдаётся за общую норму. Бдение Антонию 30 января в официальной таблице дано как выбор настоятеля.", [chapter(33), parishSource]),
  group("2026-02-23 2026-04-10", "corrected-category",
    "Полное воздержание выделено в собственную категорию; не сухоядение и не неопределённый строгий пост. Приходское смягчение подписано отдельно.", [chapter(32), chapter(49)]),
  group("2026-02-24", "source-variant-retained",
    "Глава 32 предписывает воздержание во вторник первой седмицы; гл. 49 приводит также афонский вариант хлеба и воды. Строгий профиль выбирает первые два дня по гл. 32, приходской — сухоядение. Это не ошибка календарной даты.", [chapter(32), chapter(49)]),
  group("2026-02-25", "source-variant-retained",
    "Глава 32 прямо указывает тёплую пищу после Преждеосвященной, а гл. 49 — сухоядение. Выбрана гл. 32 для первой среды. Официальное бм не разрешает отличить два варианта.", [chapter(32), chapter(49)]),
  group("2026-02-27", "rank-dependent-not-universal",
    "В программе горячая пища без масла возникает из полиелейного чина. Сайт даёт сухоядение; официальное бм не различает приготовленность. Это объяснение расчёта по заданному чину, не аттестация всех местных вариантов первой пятницы.", [chapter(32), chapter(49)]),
  group("2026-02-26 2026-03-03 2026-03-05 2026-03-10 2026-03-12 2026-03-17 2026-03-19 2026-03-24 2026-03-31 2026-04-02", "corrected-strict-parish-separation",
    "Обычные вторники и четверги Четыредесятницы: строгий профиль теперь следует сухоядению гл. 32; горячая пища без масла осталась в явно выбранном приходском профиле. Общая таблица Успенского поста больше не переносится сюда автоматически.", [chapter(32), parishSource]),
  group("2026-03-09", "corrected-specific-feast",
    "Маркова глава Обретения главы Предтечи разрешает масло в понедельник; в среду и пятницу — два варения без масла. Прежняя общая формула полиелейного понедельника теряла это исключение.", [chapter(48)]),
  group("2026-03-25 2026-03-26", "corrected-specific-service",
    "Глава 49 отдельно разрешает масло в среду перед бдением Великого канона и в четверг после него. Глава 32 и часть уставов строже; выбран конкретный вариант гл. 49, не объявленный единственным.", [chapter(32), chapter(49)]),
  group("2026-04-04", "corrected-category",
    "Икра — отдельное разрешение Лазаревой субботы, не рыба и не общий значок поста. Добавлены самостоятельные подпись, цвет и знак.", [official.summary.source, chapter(49)]),
  group("2026-04-06", "source-disagreement-primary-rule-selected",
    "Предпразднство Благовещения разрешает масло до Лазаревой субботы (гл. 32), но в 2026 оно совпадает с Великим понедельником. Сохраняется сухоядение Страстной седмицы; официальная таблица также бм. Разрешение самого Благовещения 7 апреля не переносится на канун.", [chapter(32), chapter(33), chapter(49), official.summary.source]),
  group("2026-04-09", "corrected-specific-service",
    "Выбрана трапеза Великого четверга с маслом по гл. 49. Другие перечисленные там уставы и более строгая гл. 32 записаны как варианты, а не молча смешаны.", [chapter(32), chapter(49)]),
  group("2026-04-11", "missing-label-resolved-from-primary",
    "На сайте нет подписи пищи. Официальная буква в означает разрешение вина, а не отсутствие еды. Глава 49 уточняет хлеб, плоды и вино; в обоих профилях сухоядение. Общая субботняя формула масла удалена для Великой субботы.", [chapter(49), official.summary.source]),
  group("2026-04-22 2026-04-24 2026-04-29 2026-05-01 2026-05-08 2026-05-13 2026-05-15 2026-05-22 2026-05-27 2026-05-29", "source-variant-retained",
    "Глава 33: обычные среды/пятницы Пятидесятницы — масло, Преполовение и отдание Пасхи — рыба; там же прямо упомянут более широкий рыбный вариант. Строгий и приходской профили показывают эти варианты раздельно.", [chapter(33)]),
  group("2026-06-08 2026-06-15", "corrected-strict-parish-separation",
    "Обычный понедельник Петрова поста: в строгом профиле сухоядение по гл. 33; приходская таблица разрешает рыбу. Прежнее варение без масла заменено последовательно выбранной нормой гл. 33.", [chapter(33), parishSource]),
  group("2026-06-22 2026-06-29 2026-07-06", "corrected-monday-feast",
    "Глава 33 прямо приравнивает славословный понедельник малых постов к праздничным вторнику/четвергу: рыба. Прежнее автоматическое масло по понедельникам этому не соответствовало.", [chapter(33)]),
  group("2026-07-15 2026-07-22 2026-07-24 2026-07-29 2026-07-31 2026-08-07 2026-08-12 2026-09-02 2026-09-04 2026-09-09 2026-09-16 2026-09-18 2026-09-23 2026-09-25 2026-09-30 2026-10-02 2026-10-07 2026-10-16 2026-10-21 2026-10-30 2026-11-11 2026-11-13 2026-11-18 2026-11-20 2026-11-25", "corrected-parish-profile",
    "Обычные среды и пятницы вне многодневных постов: строгая мера сухоядения сохранена, приходская исправлена на масло. Обе категории сохраняются раздельно, даже если внешний календарь печатает только приходскую.", [chapter(33), parishSource, official.summary.source]),
  group("2026-08-21 2026-08-26", "corrected-period-boundary",
    "Полиелейный чин больше не переносит послабление Четыредесятницы в Успенский пост. Глава 33 задаёт здесь сухоядение по средам и пятницам и отдельное исключение Преображения.", [chapter(33)]),
  group("2026-10-09", "source-disagreement-primary-rule-selected",
    "Для Иоанна Богослова гл. 33 прямо разрешает рыбу при совпадении со средой/пятницей. Масло внешнего календаря не основание стереть указанное праздничное разрешение.", [chapter(33)]),
  group("2026-11-30 2026-12-11 2026-12-16 2026-12-18 2026-12-22 2026-12-28", "rank-dependent-not-universal",
    "Разрешение рассчитано по чину в XML: славословие по Пн/Вт/Чт — рыба, по Ср/Пт — масло; бдение — рыба (гл. 33). Внешняя трапезная таблица не всегда применяет этот чин; бдение Савве Освященному обозначено как факультативное. Требуется проверка конкретной службы/местного выбора, не подмена всех календарей одним значением.", [chapter(33), chapter(48), official.summary.source]),
  group("2026-12-23 2026-12-25 2026-12-30 2027-01-01", "source-variant-retained",
    "Будние дни Рождественского поста: сухоядение гл. 33 в строгом профиле, варение без масла в приходской таблице. Разница приготовленности пищи сохранена.", [chapter(33), parishSource]),
  group("2026-12-07 2026-12-14 2026-12-21", "source-variant-retained",
    "Дополнительное расхождение после выбора последовательной нормы гл. 33: обычный понедельник — сухоядение, не варение без масла. Приходские фазы остаются отдельными.", [chapter(33), parishSource]),
  group("2027-01-06", "corrected-time-versus-food",
    "Глава 48, навечерие Рождества: после богослужения трапеза с маслом. Воздержание до службы не равняется полному воздержанию от еды на весь день.", [chapter(48)]),
];
const byDate = new Map<string, Decision>();
for (const d of decisions) for (const date of d.dates) {
  if (byDate.has(date)) throw new Error(`Duplicate decision ${date}`);
  byDate.set(date, d);
}
const initialDates = new Set(original.rows.filter((r: any) => r.strictComparison !== "same-food-category").map((r: any) => r.isoDate));
const allDates = new Set([...initialDates, ...current.rows.filter((r: any) => r.strictComparison !== "same-food-category").map((r: any) => r.isoDate)]);
const rows = [...allDates].sort().map(date => {
  const decision = byDate.get(date as string);
  if (!decision) throw new Error(`No editorial decision for ${date}`);
  const before = original.rows.find((r: any) => r.isoDate === date), after = current.rows.find((r: any) => r.isoDate === date);
  const sourceTable = official.rows.find((r: any) => r.isoDate === date);
  return { isoDate: date, originalDiscrepancy: initialDates.has(date), before: { strict: before.strict, parish: before.parish },
    after: { strict: after.strict, parish: after.parish }, externalLabel: after.externalLabel,
    externalUrl: after.url, pageSha256: after.pageSha256,
    officialTable: sourceTable ? { category: sourceTable.category, code: sourceTable.printedCode, footnote: sourceTable.footnote } : null,
    disposition: decision.disposition, reason: decision.reason, sources: decision.sources,
    unconditionalApproval: false };
});
const summary = { xmlSha256: current.summary.xmlSha256, fastingEngineSha256: current.summary.fastingEngineSha256,
  baselineCommit: "3ec616e", originalDifferences: 76, originalMissingLabel: 1,
  rows: rows.length, originalDatesAccountedFor: rows.filter(r => r.originalDiscrepancy).length,
  unresolvedLocalServiceChoices: rows.filter(r => r.disposition === "rank-dependent-not-universal").map(r => r.isoDate),
  note: "Every original difference has a scoped explanation. Rank-dependent cases are NOT closed by explaining the formula. This is not an unconditional Typikon certification or an all-years audit.",
  decisionsSha256: createHash("sha256").update(JSON.stringify(decisions)).digest("hex") };
if (summary.originalDatesAccountedFor !== 77) throw new Error("Original discrepancy coverage changed");
writeFileSync("docs/audit-data/fasting-adjudications-2026-09-08.json", JSON.stringify({ summary, rows }, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
