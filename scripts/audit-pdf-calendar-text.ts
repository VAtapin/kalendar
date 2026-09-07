import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildOrthodoxCalendarYear, parseMemoryDaysXml, type ResolvedCalendarEvent } from "../src/calendar";
import { calendarContentCategory, isRequiredCalendarEvent, selectCalendarCellEvents } from "../src/calendar/presentation/calendar-content-policy";
import type { CalendarGridElement } from "../src/document/types";

// Integrity check of extracted PDF cells against OUR XML/engine, not an external
// verification of the truth of every date/name. The PDF project is not available;
// current default print selection is only a comparison baseline, not its settings.
// Usage: node --import tsx scripts/audit-pdf-calendar-text.ts [pages.json] [output.json]
const inputPath = process.argv[2] ?? "tmp/audit-2027/pages.json";
const outputPath = process.argv[3] ?? "tmp/audit-2027/text-comparison.json";
const extractedBytes = readFileSync(inputPath);
const pages = JSON.parse(extractedBytes.toString("utf8")) as Array<{
  page: number; cells?: Array<{ date: string; text: string; icons?: unknown[] }>;
}>;
const xml = readFileSync("public/data/MemoryDays.xml", "utf8");
const calendar = buildOrthodoxCalendarYear(2027, parseMemoryDaysXml(xml));
const normalize = (text: string) => text.normalize("NFC").toLocaleLowerCase("ru")
  .replace(/ё/gu, "е").replace(/\.{3}/gu, "…").replace(/[^\p{L}\p{N}…]/gu, "");
type Match = { start: number; end: number; eventId: string; sourceId: string; sourceIndex: number;
  title: string; variant: string; kind: "complete-variant" | "ellipsis-prefix" };
type Candidate = { event: ResolvedCalendarEvent; variant: string; normalized: string };

function align(text: string, events: ResolvedCalendarEvent[]) {
  const normalized = normalize(text);
  const candidates: Candidate[] = events.flatMap((event) =>
    [...new Set([event.title, event.shortTitle, event.veryShortTitle].filter((title): title is string => Boolean(title)))]
      .map((variant) => ({ event, variant, normalized: normalize(variant) })));
  const options = Array.from({ length: normalized.length + 1 }, (): Match[] => []);
  for (let start = 0; start < normalized.length; start++) {
    for (const candidate of candidates) {
      let length = 0;
      let kind: Match["kind"] = "complete-variant";
      if (candidate.normalized.length >= 4 && normalized.startsWith(candidate.normalized, start)) {
        length = candidate.normalized.length;
        if (candidate.normalized.includes("…")) kind = "ellipsis-prefix";
      }
      const ellipsisAt = normalized.indexOf("…", start);
      // Do not accept arbitrary prefixes without an actual printed ellipsis.
      if (ellipsisAt >= start + 10 && candidate.normalized.startsWith(normalized.slice(start, ellipsisAt))) {
        if (ellipsisAt + 1 - start > length) { length = ellipsisAt + 1 - start; kind = "ellipsis-prefix"; }
      }
      if (length) options[start]!.push({ start, end: start + length, eventId: candidate.event.id, sourceId: candidate.event.sourceId,
        sourceIndex: candidate.event.sourceIndex, title: candidate.event.title, variant: candidate.variant, kind });
    }
  }
  // Maximize explained characters, then prefer fewer segments. This does not
  // force a unique event identity if multiple same-day variants share text.
  const best = Array.from({ length: normalized.length + 1 }, () => ({ covered: 0, matches: [] as Match[] }));
  for (let start = normalized.length - 1; start >= 0; start--) {
    best[start] = { covered: best[start + 1]!.covered, matches: best[start + 1]!.matches };
    for (const match of options[start]!) {
      const tail = best[match.end]!;
      const next = { covered: tail.covered + match.end - start, matches: [match, ...tail.matches] };
      if (next.covered > best[start]!.covered || (next.covered === best[start]!.covered && next.matches.length < best[start]!.matches.length)) best[start] = next;
    }
  }
  const matches = best[0]!.matches;
  const gaps: string[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) gaps.push(normalized.slice(cursor, match.start));
    cursor = match.end;
  }
  if (cursor < normalized.length) gaps.push(normalized.slice(cursor));
  const ambiguous = matches.filter((match) => new Set(options[match.start]!
    .filter((item) => item.end === match.end).map((item) => item.eventId)).size > 1).length;
  const ambiguousCandidates = matches.flatMap((match) => {
    const alternatives = [...new Map(options[match.start]!.filter((item) => item.end === match.end)
      .map((item) => [item.eventId, { eventId: item.eventId, title: item.title }])).values()];
    return alternatives.length > 1 ? [{ printedNormalized: normalized.slice(match.start, match.end), alternatives }] : [];
  });
  return { normalized, matches, gaps, ambiguous, ambiguousCandidates, covered: best[0]!.covered };
}

const defaultGrid = { commemorationDetail: "standard", minorCommemorationFallback: 2 } as CalendarGridElement;
const rows = pages.flatMap((page) => (page.cells ?? []).map((cell) => {
  const day = calendar.daysByIsoDate[cell.date];
  if (!day) throw new Error(`Unknown date: ${cell.date}`);
  const events = day.events.filter((event) => calendarContentCategory(event) === "commemoration");
  const result = align(cell.text, events);
  const category = !result.normalized ? "empty-extracted-cell" : result.gaps.length ? "unmatched-fragments"
    : result.matches.some((match) => match.kind === "ellipsis-prefix") ? "truncation-sequence" : "full-variant-sequence";
  const legacySaints = /Свт\.\s*й/iu.test(cell.text);
  const repairedDiagnostic = legacySaints ? align(cell.text.replace(/Свт\.\s*й/giu, "Свтт."), events) : undefined;
  const legacyRules: Record<string, { pattern: RegExp; replacement: string; description: string }> = {
    "2027-02-07": { pattern: /новоМч\./gu, replacement: "Новомчч.", description: "old replacement inside новомучеников" },
    "2027-02-12": { pattern: /Свт\.\s*й/giu, replacement: "Свтт.", description: "old partial replacement inside святителей" },
    "2027-03-22": { pattern: /40 Мч\./gu, replacement: "40 Мчч.", description: "plural мучеников previously abbreviated as singular" },
    "2027-07-13": { pattern: /12-ти Ап\./gu, replacement: "12-ти Апп.", description: "plural апостолов previously abbreviated as singular" },
  };
  const legacyRule = legacyRules[cell.date];
  const legacyComparison = legacyRule ? align(cell.text.replace(legacyRule.pattern, legacyRule.replacement), events) : undefined;
  const identityWarnings: string[] = [];
  if (cell.date === "2027-05-03" && /День\s+кончины\s+Святейшего/u.test(cell.text)
    && !normalize(cell.text).includes("пимена")) identityWarnings.push("The printed death commemoration omits Patriarch Pimen's name; even an exact short-variant match does not establish semantic completeness");
  if (cell.date === "2027-09-10" && /Обретение\s+мощей\s+прп/u.test(cell.text)
    && !normalize(cell.text).includes("иова")) identityWarnings.push("The printed relic-discovery title stops before St Job's name; the XML identity cannot be read from this fragment alone");
  if (cell.date === "2027-04-05" && !normalize(cell.text).includes("199"))
    identityWarnings.push("The printed Nikon commemoration omits the 199 disciples from the source title");
  if (cell.date === "2027-07-29" && !/десяти|10/u.test(normalize(cell.text)))
    identityWarnings.push("The printed Athenogenes commemoration omits the ten disciples from the source title");
  if (cell.date === "2027-11-16" && !normalize(cell.text).includes("аифала"))
    identityWarnings.push("The printed group of martyrs omits Aithalas, present in the source title");
  if (cell.date === "2027-10-13" && !normalize(cell.text).includes("киевского"))
    identityWarnings.push("The qualifier 'first' remains without the source title Metropolitan of Kiev");
  const defaultSelected = selectCalendarCellEvents(defaultGrid, day.events);
  const defaultRequired = defaultSelected.filter(isRequiredCalendarEvent);
  const ids = new Set(result.matches.map((match) => match.eventId));
  const missingRequired = defaultRequired.filter((event) => !ids.has(event.id)).map((event) => {
    const variants = [event.title, event.shortTitle, event.veryShortTitle].filter((value): value is string => Boolean(value));
    const prefixPresent = variants.some((variant) => {
      const normalized = normalize(variant).replace(/…/gu, "");
      return normalized.length >= 12 && result.normalized.includes(normalized.slice(0, Math.min(20, normalized.length)));
    });
    return { sourceId: event.sourceId, sourceIndex: event.sourceIndex, title: event.title, typeCode: event.typeCode,
      sourceKind: event.ruleKind, prefixPresent, interpretation: prefixPresent ? "possibly partial/edited title; review" : "not identified against current default selection; review" };
  });
  return { date: cell.date, page: page.page, category, printedText: cell.text,
    printedEllipsis: /…|\.{3}/u.test(cell.text), normalizedLength: result.normalized.length,
    coveredCharacters: result.covered, matches: result.matches, unmatchedNormalizedFragments: result.gaps,
    ambiguousMatchCount: result.ambiguous, ambiguousCandidates: result.ambiguousCandidates,
    knownLegacySaintsAbbreviation: legacySaints,
    legacySaintsDiagnostic: repairedDiagnostic ? { coveredCharacters: repairedDiagnostic.covered, gaps: repairedDiagnostic.gaps } : undefined,
    knownLegacyAbbreviationDiagnostic: legacyComparison ? { description: legacyRule!.description,
      coveredCharacters: legacyComparison.covered, normalizedLength: legacyComparison.normalized.length,
      gaps: legacyComparison.gaps, warning: "diagnostic only; original PDF text is not repaired or reclassified" } : undefined,
    currentDefaultSelection: defaultSelected.map((event) => ({ eventId: event.id, sourceIndex: event.sourceIndex,
      title: event.title, typeCode: event.typeCode, required: isRequiredCalendarEvent(event) })),
    manuallyReviewedIdentityWarnings: identityWarnings,
    currentDefaultRequiredNotIdentified: missingRequired,
    note: cell.date === "2027-05-06" ? "Престольный праздник is local monastery text absent from the base XML; not automatically a calendar error" : undefined,
  };
}));
const byCategory = rows.reduce((counts, row) => { counts[row.category] = (counts[row.category] ?? 0) + 1; return counts; }, {} as Record<string, number>);
const dates = new Set(rows.map((row) => row.date));
const missingDates = calendar.days.filter((day) => !dates.has(day.isoDate)).map((day) => day.isoDate);
if (rows.length !== 365 || dates.size !== 365 || missingDates.length) throw new Error("The extraction does not contain exactly all 365 dates");
const summary = {
  year: 2027, totalCells: rows.length, distinctDates: dates.size, missingDates,
  byCategory, cellsWithEllipsis: rows.filter((row) => row.printedEllipsis).length,
  cellsWithAmbiguousIdentity: rows.filter((row) => row.ambiguousMatchCount > 0).length,
  cellsWithCurrentDefaultRequiredNotIdentified: rows.filter((row) => row.currentDefaultRequiredNotIdentified.length).length,
  knownLegacySaintsAbbreviationDates: rows.filter((row) => row.knownLegacySaintsAbbreviation).map((row) => row.date),
  manuallyReviewedIdentityWarningDates: rows.filter((row) => row.manuallyReviewedIdentityWarnings.length).map((row) => row.date),
};
mkdirSync(dirname(outputPath), { recursive: true });
// outputPath is a caller-supplied audit artifact path; never modify the PDF/XML.
writeFileSync(outputPath, JSON.stringify({
  extractionSha256: createHash("sha256").update(extractedBytes).digest("hex"),
  xmlSha256: createHash("sha256").update(xml).digest("hex"),
  method: "NFC, lowercase, ё=е, punctuation/whitespace removed, ellipses kept; maximum-covered exact current title/short/very-short variant segmentation plus explicit ellipsis prefixes of at least 10 characters. Partial unmarked text is NOT counted as equality.",
  warning: "Comparison to our XML and current engine only. Whole-day completeness and independent liturgical correctness are NOT established. Default selection differs from unknown PDF project settings. Ambiguous same-day matches are reported.",
  summary, rows,
}, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`Detailed result: ${outputPath}`);
