import { XMLParser } from "fast-xml-parser";
import type {
  DatasetDiagnostic,
  MemoryDayRawFields,
  MemoryDayRecord,
  MemoryDaysDataset,
} from "../types";

const EXPECTED_FIELDS = new Set([
  "s_month",
  "s_date",
  "f_month",
  "f_date",
  "name",
  "type",
  "link",
  "discription",
]);

interface XmlEventInput {
  s_month?: unknown;
  s_date?: unknown;
  f_month?: unknown;
  f_date?: unknown;
  name?: unknown;
  type?: unknown;
  link?: unknown;
  discription?: unknown;
  [key: string]: unknown;
}

interface ParsedMemoryDaysXml {
  MemoryDays?: {
    event?: XmlEventInput | XmlEventInput[];
  };
}

export class MemoryDaysParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoryDaysParseError";
  }
}

function rawString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

function normalizedText(value: unknown): string {
  return rawString(value).replace(/\s+/gu, " ").trim();
}

function requiredInteger(value: unknown, field: string, recordIndex: number): number {
  const raw = normalizedText(value);
  if (!/^-?\d+$/u.test(raw)) {
    throw new MemoryDaysParseError(
      `Запись ${recordIndex}: поле ${field} должно быть целым числом, получено "${raw}"`,
    );
  }
  return Number.parseInt(raw, 10);
}

function optionalText(value: unknown): string | undefined {
  const text = normalizedText(value);
  return text.length > 0 ? text : undefined;
}

function toRawFields(input: XmlEventInput): MemoryDayRawFields {
  return {
    s_month: rawString(input.s_month),
    s_date: rawString(input.s_date),
    f_month: rawString(input.f_month),
    f_date: rawString(input.f_date),
    name: rawString(input.name),
    type: rawString(input.type),
    ...(input.link !== undefined ? { link: rawString(input.link) } : {}),
    ...(input.discription !== undefined
      ? { discription: rawString(input.discription) }
      : {}),
  };
}

function duplicateSignature(record: MemoryDayRecord): string {
  return JSON.stringify({
    startMonth: record.startMonth,
    startDate: record.startDate,
    finishMonth: record.finishMonth,
    finishDate: record.finishDate,
    title: record.title,
    typeCode: record.typeCode,
    link: record.link ?? "",
    description: record.description ?? "",
  });
}

export function parseMemoryDaysXml(
  xml: string,
  sourceName = "MemoryDays.xml",
): MemoryDaysDataset {
  if (xml.trim().length === 0) {
    throw new MemoryDaysParseError("XML-файл пуст");
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: false,
    processEntities: true,
  });

  let parsed: ParsedMemoryDaysXml;
  try {
    parsed = parser.parse(xml) as ParsedMemoryDaysXml;
  } catch (error) {
    throw new MemoryDaysParseError(
      `Не удалось разобрать XML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const inputEvents = parsed.MemoryDays?.event;
  if (!inputEvents) {
    throw new MemoryDaysParseError("В XML отсутствует MemoryDays/event");
  }

  const diagnostics: DatasetDiagnostic[] = [];
  const events = Array.isArray(inputEvents) ? inputEvents : [inputEvents];
  const records = events.map<MemoryDayRecord>((input, zeroBasedIndex) => {
    const sourceIndex = zeroBasedIndex + 1;
    const title = normalizedText(input.name);

    for (const field of Object.keys(input)) {
      if (!EXPECTED_FIELDS.has(field)) {
        diagnostics.push({
          severity: "warning",
          code: "unknown-field",
          message: `Неизвестное поле XML: ${field}`,
          recordIndex: sourceIndex,
        });
      }
    }

    if (!title) {
      diagnostics.push({
        severity: "error",
        code: "empty-title",
        message: "У записи отсутствует название",
        recordIndex: sourceIndex,
      });
    }

    return {
      id: `memory-day-${String(sourceIndex).padStart(4, "0")}`,
      sourceIndex,
      startMonth: requiredInteger(input.s_month, "s_month", sourceIndex),
      startDate: requiredInteger(input.s_date, "s_date", sourceIndex),
      finishMonth: requiredInteger(input.f_month, "f_month", sourceIndex),
      finishDate: requiredInteger(input.f_date, "f_date", sourceIndex),
      title,
      typeCode: requiredInteger(input.type, "type", sourceIndex),
      ...(optionalText(input.link) ? { link: optionalText(input.link) } : {}),
      ...(optionalText(input.discription)
        ? { description: optionalText(input.discription) }
        : {}),
      raw: toRawFields(input),
    };
  });

  const firstBySignature = new Map<string, number>();
  for (const record of records) {
    const signature = duplicateSignature(record);
    const firstIndex = firstBySignature.get(signature);
    if (firstIndex !== undefined) {
      diagnostics.push({
        severity: "info",
        code: "exact-duplicate",
        message: `Полный дубликат записи ${firstIndex}`,
        recordIndex: record.sourceIndex,
        relatedRecordIndex: firstIndex,
      });
    } else {
      firstBySignature.set(signature, record.sourceIndex);
    }
  }

  const typeCounts: Record<string, number> = {};
  for (const record of records) {
    const key = String(record.typeCode);
    typeCounts[key] = (typeCounts[key] ?? 0) + 1;
  }

  return {
    sourceName,
    records,
    diagnostics,
    statistics: {
      recordCount: records.length,
      recordsWithDescription: records.filter((record) => record.description !== undefined).length,
      recordsWithLink: records.filter((record) => record.link !== undefined).length,
      exactDuplicateCount: diagnostics.filter((item) => item.code === "exact-duplicate").length,
      specialRuleCount: records.filter((record) => record.startMonth < 0).length,
      typeCounts,
    },
  };
}

