/**
 * Compare all date-cell images extracted by inspect-calendar-pdf.py with both
 * fasting profiles. Read-only: writes its machine-readable evidence to stdout.
 *
 * npx tsx scripts/compare-pdf-fasting.ts tmp/audit-2027/pages.json [baseline-ref]
 * The baseline changes only fasting-api.ts; both versions receive the current
 * XML/engine day data. This is not a reconstruction of an old project document.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { buildOrthodoxCalendarYear } from "../src/calendar/engine/build-calendar-year";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { calculateFastingDay, resolveFoodRuleForDay } from "../src/calendar/fasting/fasting-api";
import type { FastingProfileId, FoodRuleId } from "../src/calendar/fasting/fasting-api";

interface PdfIcon {
  marker_match?: { assets: string[]; mean_rgb_error?: number };
}
interface PdfCell { date: string; icons: PdfIcon[] }
interface PdfPage { page: number; cells?: PdfCell[] }

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = resolve(repo, process.argv[2] ?? "tmp/audit-2027/pages.json");
const baselineRef = process.argv[3] ?? "HEAD";
const baselineCommit = execFileSync("git", ["rev-parse", "--verify", `${baselineRef}^{commit}`], { cwd: repo, encoding: "utf8" }).trim();
const apiPath = "src/calendar/fasting/fasting-api.ts";
const baselineSource = execFileSync("git", ["show", `${baselineCommit}:${apiPath}`], { cwd: repo, encoding: "utf8" });
// A data-URL module avoids creating or replacing a source file in the worktree.
// tsx resolves the explicit file URLs of this revision's unchanged dependencies.
const baselineJs = ts.transpileModule(baselineSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(/from\s+(["'])(\.{1,2}\/[^"']+)\1/g, (_match, _quote, specifier: string) =>
  `from ${JSON.stringify(pathToFileURL(resolve(repo, dirname(apiPath), `${specifier}.ts`)).href)}`);
const baseline = await import(`data:text/javascript;base64,${Buffer.from(baselineJs).toString("base64")}`) as typeof import("../src/calendar/fasting/fasting-api");

const inputBytes = readFileSync(input);
const xmlBytes = readFileSync(resolve(repo, "public/data/MemoryDays.xml"));
const pages = JSON.parse(inputBytes.toString("utf8")) as PdfPage[];
const cells = pages.flatMap((page) => (page.cells ?? []).map((cell) => ({ ...cell, page: page.page })));
if (cells.length !== 365 || new Set(cells.map((cell) => cell.date)).size !== 365) {
  throw new Error(`Expected 365 unique date cells, received ${cells.length}.`);
}
const year = buildOrthodoxCalendarYear(2027, parseMemoryDaysXml(xmlBytes.toString("utf8")));
const assetRules: Record<string, FoodRuleId> = {
  "no-fast.png": "no-fast", "fast-no-fish.png": "fast", "fish.png": "fish",
  "boiled-with-oil.png": "oil", "boiled-no-oil.png": "boiled-no-oil",
  "dry-eating.png": "dry-eating", "strict-fast.png": "strict-fast",
  "dairy-eggs.png": "dairy-eggs", "memorial.png": "memorial",
};
const profiles: FastingProfileId[] = ["typikon-strict", "parish"];
const visible = (rule: FoodRuleId): FoodRuleId | null => rule === "no-fast" ? null : rule;
const images = cells.flatMap((cell) => cell.icons);
if (!images.length) throw new Error("No date-cell images found; extraction is incomplete.");
const rows = cells.map((cell) => {
  const day = year.daysByIsoDate[cell.date];
  if (!day) throw new Error(`Unexpected date ${cell.date}.`);
  if (cell.icons.length > 1) throw new Error(`More than one image in ${cell.date}; inspect the extraction.`);
  const assets = cell.icons.flatMap((icon) => {
    if (!icon.marker_match?.assets.length) throw new Error(`Unmatched image on ${cell.date}; repeat image extraction.`);
    return icon.marker_match.assets;
  });
  const actualRules = [...new Set(assets.map((asset) => {
    const filename = asset.replaceAll("\\", "/").split("/").at(-1)!;
    if (!assetRules[filename]) throw new Error(`Unknown marker asset: ${asset}`);
    return assetRules[filename];
  }))];
  if (actualRules.length > 1) throw new Error(`Ambiguous marker match on ${cell.date}.`);
  const actual = actualRules[0] ?? null;
  const expected = Object.fromEntries(profiles.map((profile) => {
    const currentFood = calculateFastingDay(day, profile);
    return [profile, {
      marker: visible(resolveFoodRuleForDay(day, profile).id),
      food: currentFood.foodRule.id,
      memorial: currentFood.memorial,
      reason: currentFood.reason,
      baselineMarker: visible(baseline.resolveFoodRuleForDay(day, profile).id),
      baselineFood: baseline.calculateFastingDay(day, profile).foodRule.id,
    }];
  })) as Record<FastingProfileId, {
    marker: FoodRuleId | null; food: FoodRuleId; memorial: boolean; reason: string;
    baselineMarker: FoodRuleId | null; baselineFood: FoodRuleId;
  }>;
  return { date: cell.date, page: cell.page, actual, assets, expected };
});
const count = (items: Array<string | null>) => Object.fromEntries(
  [...new Set(items)].map((key) => [key ?? "no-image", items.filter((item) => item === key).length]),
);
console.log(JSON.stringify({
  input: input.replaceAll("\\", "/"),
  inputSha256: createHash("sha256").update(inputBytes).digest("hex"),
  xmlSha256: createHash("sha256").update(xmlBytes).digest("hex"),
  currentFastingSourceSha256: createHash("sha256").update(readFileSync(resolve(repo, apiPath))).digest("hex"),
  baselineCommit,
  baselineScope: "Previous fasting-api.ts logic applied to CURRENT XML/engine date objects; not the PDF project settings.",
  cells: rows.length,
  recognizedImages: images.length,
  maxMeanRgbError: Math.max(...images.map((icon) => icon.marker_match?.mean_rgb_error ?? Number.POSITIVE_INFINITY)),
  actualCounts: count(rows.map((row) => row.actual)),
  profileSummary: Object.fromEntries(profiles.map((profile) => [profile, {
    matches: rows.filter((row) => row.actual === row.expected[profile].marker).length,
    mismatches: rows.filter((row) => row.actual !== row.expected[profile].marker).length,
    baselineMatches: rows.filter((row) => row.actual === row.expected[profile].baselineMarker).length,
    baselineMismatches: rows.filter((row) => row.actual !== row.expected[profile].baselineMarker).length,
  }])),
  mismatches: rows.filter((row) => profiles.some((profile) => row.actual !== row.expected[profile].marker)),
  rulesChanged: rows.filter((row) => profiles.some((profile) => row.expected[profile].food !== row.expected[profile].baselineFood)),
  memorialMasking: rows.filter((row) => row.actual === "memorial" || profiles.some((profile) => row.expected[profile].memorial)),
}, null, 2));
