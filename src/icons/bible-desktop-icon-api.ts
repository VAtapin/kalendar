import type {IconLibraryCard} from "./icon-library";

const endpoint = "https://bible-desktop.com/api/calendar/icons";

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

/** Reads the public, standard Bible Desktop icon API; no Calendar-specific endpoint is involved. */
export async function loadBibleDesktopIconLibrary(): Promise<IconLibraryCard[]> {
  const cards: IconLibraryCard[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  const perPage = 100;
  while ((page - 1) * perPage < total) {
    const params = new URLSearchParams({with_images: "1", page: String(page), per_page: String(perPage)});
    const response = await fetch(`${endpoint}?${params}`, {headers: {Accept: "application/json"}});
    if (!response.ok) throw new Error(`Каталог недоступен: ${response.status}`);
    const result = await response.json() as ApiPage;
    const data = Array.isArray(result.data) ? result.data : [];
    cards.push(...data.map(cardFromApi));
    total = Number(result.total ?? cards.length);
    if (!data.length) break;
    page++;
  }
  return cards;
}
