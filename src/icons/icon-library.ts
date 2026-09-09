export interface IconCelebration {
  label: string;
  date?: string;
  movable?: boolean;
}

export interface IconLibraryCard {
  id: string;
  title: string;
  kind: string;
  images: Array<{ imageUrl: string; alt: string }>;
  celebrations: IconCelebration[];
  history: string;
  places: string[];
  themes: string[];
}

export const iconKindLabel = (kind: string): string => ({
  "mother-of-god": "Богородичные",
  saint: "Святые и святители",
  savior: "Спаситель",
}[kind] ?? kind);

export function iconMatchesMonth(icon: IconLibraryCard, month: number | undefined): boolean {
  return !!month && icon.celebrations.some(item => item.date?.slice(5, 7) === String(month).padStart(2, "0"));
}
