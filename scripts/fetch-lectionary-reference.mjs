import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Public, read-only source snapshots. Not imported as application content.
const directory = "tmp/xml-independent-audit/lectionary";
await mkdir(directory, { recursive: true });
for (const [id, url] of Object.entries({
  apostle: "https://azbyka.ru/shemy/spisok-vseh-bogosluzhebnyh-zachal-apostola.shtml",
  gospel: "https://azbyka.ru/shemy/spisok-vseh-bogosluzhebnyh-zachal-evangelija.shtml",
})) {
  const path = `${directory}/${id}.json`;
  try {
    const cache = JSON.parse(await readFile(path, "utf8"));
    if (cache.url === url && cache.html && cache.sha256) { console.log(`${id}: cached`); continue; }
  } catch { /* Missing source snapshot. */ }
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const html = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!html.includes("зачало") || !/<table\b/iu.test(html)) throw new Error(`No lectionary table at ${url}`);
  await writeFile(path, JSON.stringify({ url, fetchedAt: new Date().toISOString(),
    sha256: createHash("sha256").update(bytes).digest("hex"), html }));
  console.log(`${id}: retrieved`);
}
