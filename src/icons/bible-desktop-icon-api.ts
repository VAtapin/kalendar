import type {IconLibraryCard} from "./icon-library";

const endpoint = "https://bible-desktop.com/api/calendar/icons";

export type IconLibraryFilters = {
  query: string;
  kind: string;
  month?: number;
  movable?: boolean;
  withHistory: boolean;
};

export type IconLibraryPage = {
  items: IconLibraryCard[];
  total: number;
  page: number;
  perPage: number;
};

type ApiDate = { label?: string | null; exampleGregorianDate?: string | null; movable?: boolean | null };
type ApiImage = { url?: string | null };
type ApiCard = {
  id: number;
  title: string;
  kind: string;
  description?: string | null;
  dates?: ApiDate[];
  images?: ApiImage[];
};
type ApiPage = { total?: number; page?: number; perPage?: number; data?: ApiCard[] };

function cardFromApi(card: ApiCard): IconLibraryCard {
  return {
    id: String(card.id), title: card.title, kind: card.kind,
    history: card.description ?? "", places: [], themes: [],
    celebrations: (card.dates ?? []).map(date => ({
      label: date.label || "Дата не указана", date: date.exampleGregorianDate ?? undefined,
      movable: date.movable ?? undefined,
    })),
    images: (card.images ?? []).flatMap(image => image.url ? [{imageUrl: image.url, alt: card.title}] : []),
  };
}

/** Reads one standard, filtered page of the public Bible Desktop icon API. */
export async function loadBibleDesktopIconLibrary(
  filters: IconLibraryFilters,
  page = 1,
  perPage = 48,
): Promise<IconLibraryPage> {
  const params = new URLSearchParams({with_images: "1", page: String(page), per_page: String(perPage)});
  if (filters.query.trim()) params.set("query", filters.query.trim());
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.month) params.set("month", String(filters.month));
  if (filters.movable !== undefined) params.set("movable", filters.movable ? "1" : "0");
  if (filters.withHistory) params.set("with_history", "1");
  const response = await fetch(`${endpoint}?${params}`, {headers: {Accept: "application/json"}});
  if (!response.ok) throw new Error(`Каталог недоступен: ${response.status}`);
  const result = await response.json() as ApiPage;
  const data = Array.isArray(result.data) ? result.data : [];
  return {
    items: data.map(cardFromApi),
    total: Number(result.total ?? data.length),
    page: Math.max(1, Number(result.page ?? page)),
    perPage: Math.max(1, Number(result.perPage ?? perPage)),
  };
}
