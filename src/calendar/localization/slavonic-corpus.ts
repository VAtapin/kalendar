/** Optional, separately distributed text catalogue. No external source code runs. */
export interface SlavonicCorpusEntry {
  ru: string;
  cu: string;
  sourceId: string;
  sourceUrl: string;
}

export interface SlavonicCorpus {
  schemaVersion: 1;
  language: "cu";
  license: string;
  copyright: string;
  entries: SlavonicCorpusEntry[];
}

export function slavonicSourceKey(text: string): string {
  // Preserve word boundaries, every name and every number; never fuzzy-match.
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("ru")
    .replace(/ё/gu, "е").replace(/[\s.,;:!—–\-"«»()]+/gu, " ").trim();
}

let catalogue = new Map<string, SlavonicCorpusEntry>();
let ready = false;
let pending: Promise<void> | undefined;

export function installSlavonicCorpus(value: unknown): void {
  if (!value || typeof value !== "object") throw new Error("Invalid Church Slavonic catalogue");
  const data = value as Partial<SlavonicCorpus>;
  if (data.schemaVersion !== 1 || data.language !== "cu" || !Array.isArray(data.entries)
    || typeof data.license !== "string" || typeof data.copyright !== "string") {
    throw new Error("Invalid Church Slavonic catalogue schema");
  }
  const next = new Map<string, SlavonicCorpusEntry>();
  for (const entry of data.entries) {
    if (typeof entry?.ru !== "string" || typeof entry.cu !== "string" || typeof entry.sourceId !== "string"
      || typeof entry.sourceUrl !== "string" || !entry.ru.trim() || !entry.cu.trim()
      || /[\u0000-\u001f\u007f-\u009f\ufffd<>]/u.test(entry.cu)
      || /(?:^|\s|[.,;:()])\p{M}/u.test(entry.cu) || !/\p{M}/u.test(entry.cu)) {
      throw new Error("Damaged Church Slavonic catalogue entry");
    }
    const key = slavonicSourceKey(entry.ru);
    if (next.has(key) && next.get(key)!.cu !== entry.cu) throw new Error(`Ambiguous Church Slavonic title: ${entry.ru}`);
    next.set(key, { ...entry });
  }
  catalogue = next;
  ready = true;
}

export function sourceAttestedSlavonicTitle(title: string): string | undefined {
  return catalogue.get(slavonicSourceKey(title))?.cu;
}

export async function loadSlavonicCorpus(fetcher: typeof fetch = fetch): Promise<void> {
  if (ready) return;
  pending ??= (async () => {
    const response = await fetcher("/data/church-slavonic/catalogue.json?v=2026-09-08-3");
    if (!response.ok) throw new Error(`Церковнославянский словарь: HTTP ${response.status}`);
    installSlavonicCorpus(await response.json());
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}
