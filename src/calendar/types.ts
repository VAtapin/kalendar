export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface MemoryDayRawFields {
  s_month: string;
  s_date: string;
  f_month: string;
  f_date: string;
  name: string;
  type: string;
  link?: string;
  discription?: string;
}

export interface MemoryDayRecord {
  id: string;
  sourceIndex: number;
  startMonth: number;
  startDate: number;
  finishMonth: number;
  finishDate: number;
  title: string;
  shortTitle?: string;
  veryShortTitle?: string;
  typeCode: number;
  link?: string;
  description?: string;
  raw: MemoryDayRawFields;
}

export type DatasetDiagnosticCode =
  | "exact-duplicate"
  | "unknown-field"
  | "empty-title";

export interface DatasetDiagnostic {
  severity: "info" | "warning" | "error";
  code: DatasetDiagnosticCode;
  message: string;
  recordIndex: number;
  relatedRecordIndex?: number;
}

export interface MemoryDaysDatasetStatistics {
  recordCount: number;
  recordsWithDescription: number;
  recordsWithLink: number;
  exactDuplicateCount: number;
  specialRuleCount: number;
  typeCounts: Record<string, number>;
}

export interface MemoryDaysDataset {
  sourceName: string;
  records: MemoryDayRecord[];
  diagnostics: DatasetDiagnostic[];
  statistics: MemoryDaysDatasetStatistics;
}

export type CalendarRuleKind =
  | "fixed-julian"
  | "pascha-relative"
  | "pascha-to-fixed-julian"
  | "weekday-relative"
  | "weekday-conditional"
  | "nearest-sunday"
  | "generated-liturgical"
  | "project-event";

export interface ResolvedEventSpan {
  sourceRecord: MemoryDayRecord;
  ruleKind: CalendarRuleKind;
  start: CalendarDate;
  finish: CalendarDate;
}

export interface ResolvedCalendarEvent {
  id: string;
  sourceId: string;
  sourceIndex: number;
  title: string;
  shortTitle?: string;
  veryShortTitle?: string;
  typeCode: number;
  description?: string;
  occurrenceDate: CalendarDate;
  spanStart: CalendarDate;
  spanFinish: CalendarDate;
  dayIndexInSpan: number;
  ruleKind: CalendarRuleKind;
  priority: number;
  styleToken?: string;
}

export interface OrthodoxCalendarDay {
  date: CalendarDate;
  isoDate: string;
  oldStyleDate: CalendarDate;
  weekday: number;
  events: ResolvedCalendarEvent[];
}

export interface OrthodoxCalendarYear {
  year: number;
  pascha: CalendarDate;
  days: OrthodoxCalendarDay[];
  daysByIsoDate: Record<string, OrthodoxCalendarDay>;
  diagnostics: DatasetDiagnostic[];
}
