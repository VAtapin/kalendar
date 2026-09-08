import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

// Public read-only evidence acquisition. Slow, resumable, no login, no hidden API.
// Dates in this publisher's /Days/YYYYMMDD.html URLs are OLD STYLE.
const directory = "tmp/xml-independent-audit/pravoslavie-days";
const limit = Number(process.argv[2] ?? 366);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
await mkdir(directory, { recursive: true });
const dates = [];
for (let month = 1; month <= 12; month++) {
  const days = new Date(Date.UTC(2024, month, 0)).getUTCDate();
  for (let day = 1; day <= days; day++) {
    const year = month === 2 && day === 29 ? 2024 : 2026;
    dates.push(`${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`);
  }
}
const result = [];
for (const oldStyle of dates.slice(0, limit)) {
  const url = `https://days.pravoslavie.ru/Days/${oldStyle}.html`;
  const path = join(directory, `${oldStyle}.json`);
  try {
    const cached = JSON.parse(await readFile(path, "utf8"));
    if (cached.url === url && cached.memoriesHtml && cached.pageSha256) {
      result.push({ oldStyle, cached: true });
      continue;
    }
  } catch { /* Cache miss; do not interpret a failed read as verified data. */ }
  const response = await fetch(url, {
    headers: { "User-Agent": "CalendarSourceAudit/1.0 (read-only; sequential requests)" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}; stopped without retry flood`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const html = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const pageDate = /"ymd"\s*:\s*"(\d{8})"/u.exec(html)?.[1];
  if (pageDate !== oldStyle) throw new Error(`${url}: returned ${pageDate ?? "no date"}, not requested date`);
  const memoriesHtml = /<DIV\s+CLASS=["']DD_TEXT["']\s*>([\s\S]*?)<\/DIV>/iu.exec(html)?.[1];
  if (!memoriesHtml) throw new Error(`${url}: no validated DD_TEXT commemoration block`);
  const evidence = {
    url, oldStyle, fetchedAt: new Date().toISOString(),
    pageSha256: createHash("sha256").update(bytes).digest("hex"),
    pageTitle: /<TITLE>([\s\S]*?)<\/TITLE>/iu.exec(html)?.[1],
    memoriesHtml,
    fastingHtml: /<SPAN\s+CLASS=["']DD_TPTXT["']\s*>([\s\S]*?)<\/SPAN>/iu.exec(html)?.[1],
    note: "Only calendar evidence retained. Sermons, prayers and articles are not copied into the application.",
  };
  await writeFile(path, JSON.stringify(evidence, null, 2));
  result.push({ oldStyle, cached: false });
  if (result.length % 10 === 0) console.log(`Retrieved ${result.length}/${Math.min(limit, dates.length)} dates; latest ${oldStyle}`);
  await sleep(450);
}
console.log(JSON.stringify({ dates: result.length, fresh: result.filter(item => !item.cached).length, cache: directory }));
