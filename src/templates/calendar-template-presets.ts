export type CalendarTemplateId = "editorial-photo" | "classic-grid" | "photo-feature";

export interface CalendarTemplatePreset {
  id: CalendarTemplateId;
  name: string;
  description: string;
}

export const CALENDAR_TEMPLATE_PRESETS: readonly CalendarTemplatePreset[] = [
  {
    id: "editorial-photo",
    name: "Фото + издательская сетка",
    description: "Крупное фото, открытая газетная верстка и текст месяца.",
  },
  {
    id: "classic-grid",
    name: "Классическая таблица",
    description: "Больше места календарю, ячейки с полной рамкой.",
  },
  {
    id: "photo-feature",
    name: "Акцент на фотографии",
    description: "Половина страницы под фото, компактная сетка без рамок.",
  },
] as const;
