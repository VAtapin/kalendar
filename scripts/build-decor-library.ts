import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

type DecorCategory = "frames" | "corners" | "dividers" | "ornaments" | "religious" | "symbols";

interface SourceMeta {
  id: string;
  label: string;
  category: DecorCategory;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PieceMeta extends SourceMeta {
  sourceId: string;
  bounds?: Bounds;
  paddingRatio?: number;
}

interface ViewBox extends Bounds {}

const root = process.cwd();
const sourceDirectory = path.join(root, "public", "assets", "decor", "source");
const itemDirectory = path.join(root, "public", "assets", "decor", "items");
const catalogPath = path.join(root, "src", "decor", "decor-library.generated.ts");

const singleSources: SourceMeta[] = [
  { id: "36238", label: "Колокол", category: "symbols" },
  { id: "42367", label: "Каллиграфический завиток", category: "ornaments" },
  { id: "42840", label: "Угловой растительный узор", category: "corners" },
  { id: "48945", label: "Угловой растительный узор, вариант", category: "corners" },
  { id: "303550", label: "Рамка с плашкой и цветами", category: "frames" },
  { id: "322018", label: "Рамка с пасхальными яйцами", category: "frames" },
  { id: "332881", label: "Тонкая цветочная рамка", category: "frames" },
  { id: "334674", label: "Цветочная рамка с открытыми сторонами", category: "frames" },
  { id: "669760", label: "Скруглённая рамка с цветком", category: "frames" },
  { id: "669764", label: "Скруглённая рамка", category: "frames" },
  { id: "1191028", label: "Классическая квадратная рамка", category: "frames" },
  { id: "1210491", label: "Густая прямоугольная рамка", category: "frames" },
  { id: "1210506", label: "Фигурная прямоугольная рамка", category: "frames" },
  { id: "1237902", label: "Фоторамка с цветами", category: "frames" },
  { id: "1301811", label: "Классическая рамка, вариант", category: "frames" },
  { id: "1321370", label: "Лиственная квадратная рамка", category: "frames" },
  { id: "1321373", label: "Узорная квадратная рамка", category: "frames" },
  { id: "1689760", label: "Тонкая рамка с завитками", category: "frames" },
  { id: "1750894", label: "Цветочный бордюр", category: "corners" },
  { id: "1751088", label: "Цветочный разделитель", category: "dividers" },
  { id: "1781465", label: "Орнаментальная квадратная рамка", category: "frames" },
  { id: "1781625", label: "Тонкая линейная рамка", category: "frames" },
  { id: "1817589", label: "Крест с растительным контуром", category: "symbols" },
  { id: "2023289", label: "Святой с детьми", category: "religious" },
  { id: "2027568", label: "Православные храмы", category: "religious" },
  { id: "2028308", label: "Образ святителя", category: "religious" },
  { id: "2031150", label: "Крест с цветочным контуром", category: "symbols" },
  { id: "2031234", label: "Рамка с раздельными украшениями", category: "frames" },
  { id: "2031361", label: "Декоративный картуш", category: "ornaments" },
  { id: "2407334", label: "Густой цветочный угол", category: "corners" },
  { id: "2407423", label: "Свободный цветочный завиток", category: "ornaments" },
  { id: "2407426", label: "Угол с лентой и листом", category: "corners" },
  { id: "2407434", label: "Тонкий угловой завиток", category: "corners" },
  { id: "2407437", label: "Угловой листовой завиток", category: "corners" },
  { id: "2479757", label: "Цветочная прямоугольная рамка", category: "frames" },
  { id: "2773448", label: "Гильошная рамка", category: "frames" },
  { id: "2800269", label: "Овальная растительная рамка", category: "frames" },
];

const pieces: PieceMeta[] = [];

function addPieces(
  sourceId: string,
  category: DecorCategory,
  labelPrefix: string,
  bounds: Bounds[],
): void {
  bounds.forEach((box, index) => {
    pieces.push({
      id: `${sourceId}-${String(index + 1).padStart(2, "0")}`,
      sourceId,
      label: `${labelPrefix} ${index + 1}`,
      category,
      bounds: box,
    });
  });
}

addPieces("43842", "dividers", "Парный разделитель", [
  { x: 698.2, y: 197, width: 581.8, height: 245.5 },
  { x: 0, y: 197.1, width: 581.8, height: 245.5 },
]);
addPieces("48407", "corners", "Густой цветочный угол", [
  { x: 580, y: 0, width: 700, height: 680 },
  { x: 0, y: 580, width: 700, height: 682 },
]);
addPieces("770506", "corners", "Угол с розеткой", [
  { x: 0, y: 0, width: 640, height: 423 },
  { x: 640, y: 0, width: 640, height: 423 },
]);
addPieces("782469", "dividers", "Классический разделитель", [
  { x: 667.6, y: 36, width: 415.9, height: 225.5 },
  { x: 145.1, y: 36.1, width: 415.7, height: 225.4 },
  { x: 467.2, y: 323.5, width: 468.3, height: 171.5 },
  { x: 37.1, y: 557.1, width: 546.9, height: 170.7 },
  { x: 690.4, y: 557.4, width: 546.6, height: 170.5 },
]);
addPieces("2457091", "ornaments", "Каллиграфический элемент", [
  { x: 0, y: 0, width: 550, height: 590 },
  { x: 820, y: 65, width: 460, height: 390 },
  { x: 570, y: 250, width: 350, height: 335 },
  { x: 320, y: 450, width: 400, height: 300 },
  { x: 700, y: 650, width: 580, height: 325 },
]);
addPieces("2465064", "ornaments", "Геральдический флерон A", [
  { x: 82.6, y: 54.9, width: 350.3, height: 361.7 },
  { x: 621.5, y: 41.9, width: 370.1, height: 368.2 },
  { x: 101.2, y: 469, width: 322.6, height: 385.9 },
  { x: 554, y: 494.3, width: 461, height: 329.7 },
  { x: 78.6, y: 924.1, width: 392, height: 294.9 },
  { x: 598.5, y: 916, width: 398.9, height: 250.1 },
]);
addPieces("2465110", "ornaments", "Геральдический флерон B", [
  { x: 82.5, y: 54.2, width: 350, height: 362.4 },
  { x: 621.5, y: 42.3, width: 370.1, height: 368.2 },
  { x: 101, y: 468.9, width: 322.8, height: 386.1 },
  { x: 553.5, y: 493.6, width: 461.4, height: 330.4 },
  { x: 78.1, y: 924.1, width: 392.4, height: 294.9 },
  { x: 598.3, y: 916.1, width: 399.3, height: 250.3 },
]);
addPieces("2465156", "ornaments", "Симметричный флерон", [
  { x: 84.1, y: 111.1, width: 397.8, height: 238 },
  { x: 569, y: 97.5, width: 404, height: 242.4 },
  { x: 98.4, y: 479.5, width: 797.4, height: 739.3 },
]);
addPieces("2465163", "dividers", "Горизонтальный разделитель", [
  { x: 137.9, y: 87.8, width: 842.2, height: 114.1 },
  { x: 118, y: 254.1, width: 841.9, height: 54.4 },
  { x: 76.1, y: 359.2, width: 917.9, height: 103.9 },
  { x: 119, y: 547, width: 843, height: 52.8 },
  { x: 121.1, y: 676, width: 842.6, height: 55 },
  { x: 123, y: 822, width: 841.8, height: 79.9 },
  { x: 90, y: 956, width: 918, height: 78 },
  { x: 118, y: 1079.9, width: 842, height: 167.9 },
]);
addPieces("2465361", "corners", "Резной угол A", [
  { x: 29.4, y: 34.1, width: 403.5, height: 396.4 },
  { x: 651.1, y: 33.4, width: 401, height: 396.6 },
  { x: 29.4, y: 842.9, width: 403.3, height: 396 },
  { x: 654.9, y: 843, width: 401.8, height: 396 },
]);
addPieces("2465387", "corners", "Резной угол B", [
  { x: 34.5, y: 28.1, width: 377.8, height: 390.6 },
  { x: 662.2, y: 31.1, width: 390.3, height: 377.9 },
  { x: 33, y: 852.5, width: 377.7, height: 390.4 },
  { x: 661, y: 861.9, width: 390, height: 378 },
]);
addPieces("2465406", "corners", "Линейный угол", [
  { x: 28.9, y: 36.4, width: 426.1, height: 405.4 },
  { x: 629.2, y: 36.1, width: 426.4, height: 405.6 },
  { x: 34, y: 831, width: 425.8, height: 405.8 },
  { x: 632.3, y: 831, width: 426.4, height: 405.8 },
]);
addPieces("2479754", "ornaments", "Цветочный акцент", [
  { x: 119.2, y: 30, width: 839.1, height: 210.9 },
  { x: 6.3, y: 510.1, width: 740.8, height: 714.9 },
]);
addPieces("2479760", "corners", "Тонкий цветочный угол", [
  { x: 31.2, y: 39.2, width: 383.8, height: 414.6 },
  { x: 869, y: 39.2, width: 382.9, height: 414.6 },
  { x: 41.6, y: 608, width: 391.7, height: 387.8 },
  { x: 850, y: 608, width: 392.3, height: 387.8 },
]);
addPieces("2859012", "corners", "Ягодный угол", [
  { x: 0, y: 0.1, width: 567.7, height: 406.8 },
  { x: 712.2, y: 0.1, width: 567.7, height: 406.8 },
  { x: 0, y: 873.2, width: 567.7, height: 406.7 },
  { x: 712.2, y: 873.1, width: 567.7, height: 406.8 },
]);

const easterEggBounds: Bounds[] = [
  // The source sheet is staggered: four eggs in the first row and five in each following row.
  { x: 94.5, y: 0, width: 138, height: 203.3 },
  { x: 263.3, y: 0, width: 138, height: 195 },
  { x: 425.3, y: 0, width: 139.5, height: 194.3 },
  { x: 603.8, y: 0, width: 140.2, height: 195.8 },
  { x: 24.8, y: 186, width: 137.2, height: 220 },
  { x: 184.5, y: 201, width: 138, height: 194 },
  { x: 345, y: 199.5, width: 138, height: 194 },
  { x: 510, y: 186.8, width: 138.8, height: 194 },
  { x: 687.8, y: 186, width: 136.4, height: 196 },
  { x: 20.3, y: 430.5, width: 138, height: 196.5 },
  { x: 184.5, y: 416.3, width: 137.3, height: 195.7 },
  { x: 354, y: 411.8, width: 138.8, height: 195.7 },
  { x: 526.5, y: 402, width: 138.8, height: 196 },
  { x: 690.8, y: 399, width: 139.5, height: 202 },
  { x: 12.8, y: 640.5, width: 146.2, height: 210 },
  { x: 184.5, y: 640.5, width: 138.8, height: 196 },
  { x: 351.8, y: 633, width: 138, height: 197 },
  { x: 522.8, y: 624.8, width: 140.2, height: 197.2 },
  { x: 689.3, y: 626.3, width: 141.7, height: 198 },
  { x: 8.3, y: 865.5, width: 138.7, height: 194.2 },
  { x: 172.5, y: 858, width: 140.3, height: 195 },
  { x: 336.8, y: 859.5, width: 139.5, height: 198 },
  { x: 502.5, y: 854.3, width: 137.3, height: 198 },
  { x: 672, y: 846.8, width: 141, height: 199 },
  { x: 0, y: 1083, width: 141, height: 196 },
  { x: 165.8, y: 1079.3, width: 138.7, height: 196.4 },
  { x: 324.8, y: 1079.3, width: 139.5, height: 196.4 },
  { x: 489.8, y: 1077.8, width: 140.2, height: 198 },
  { x: 660, y: 1077, width: 141, height: 198 },
];

easterEggBounds.forEach((bounds, index) => {
  const number = index + 1;
  pieces.push({
    id: `3151525-${String(number).padStart(2, "0")}`,
    sourceId: "3151525",
    label: `Пасхальное яйцо ${number}`,
    category: "symbols",
    bounds,
    paddingRatio: 0,
  });
});

function parseViewBox(svg: string): ViewBox {
  const match = svg.match(/viewBox=["']\s*([-+\d.eE]+)[ ,]+([-+\d.eE]+)[ ,]+([-+\d.eE]+)[ ,]+([-+\d.eE]+)\s*["']/i);
  if (!match) throw new Error("SVG не содержит viewBox");
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    width: Number(match[3]),
    height: Number(match[4]),
  };
}

function paddedBounds(bounds: Bounds, viewBox: ViewBox, paddingRatio = 0.035): Bounds {
  const padding = Math.max(bounds.width, bounds.height) * paddingRatio;
  const x = Math.max(viewBox.x, bounds.x - padding);
  const y = Math.max(viewBox.y, bounds.y - padding);
  const right = Math.min(viewBox.x + viewBox.width, bounds.x + bounds.width + padding);
  const bottom = Math.min(viewBox.y + viewBox.height, bounds.y + bounds.height + padding);
  return { x, y, width: right - x, height: bottom - y };
}

function setSvgViewport(svg: string, bounds: Bounds): string {
  const clean = svg
    .replace(/<\?xml[\s\S]*?\?>\s*/i, "")
    .replace(/<!DOCTYPE[\s\S]*?>\s*/i, "");
  return clean
    .replace(/\bwidth=["'][^"']+["']/i, `width="${bounds.width.toFixed(3)}"`)
    .replace(/\bheight=["'][^"']+["']/i, `height="${bounds.height.toFixed(3)}"`)
    .replace(/\bviewBox=["'][^"']+["']/i, `viewBox="${bounds.x.toFixed(3)} ${bounds.y.toFixed(3)} ${bounds.width.toFixed(3)} ${bounds.height.toFixed(3)}"`);
}

async function build(): Promise<void> {
  await rm(itemDirectory, { recursive: true, force: true });
  await mkdir(itemDirectory, { recursive: true });
  await mkdir(path.dirname(catalogPath), { recursive: true });

  const catalog: Array<SourceMeta & { sourceId: string; source: string; aspectRatio: number }> = [];
  for (const item of singleSources) {
    const sourceId = item.id;
    const svg = await readFile(path.join(sourceDirectory, `${sourceId}.svg`), "utf8");
    const viewBox = parseViewBox(svg);
    const outputName = `${item.id}.svg`;
    await writeFile(path.join(itemDirectory, outputName), setSvgViewport(svg, viewBox), "utf8");
    catalog.push({ ...item, sourceId, source: `/assets/decor/items/${outputName}`, aspectRatio: viewBox.width / viewBox.height });
  }

  for (const item of pieces) {
    const svg = await readFile(path.join(sourceDirectory, `${item.sourceId}.svg`), "utf8");
    const viewBox = parseViewBox(svg);
    const bounds = paddedBounds(item.bounds ?? viewBox, viewBox, item.paddingRatio);
    const outputName = `${item.id}.svg`;
    await writeFile(path.join(itemDirectory, outputName), setSvgViewport(svg, bounds), "utf8");
    const { bounds: _bounds, paddingRatio: _paddingRatio, ...metadata } = item;
    catalog.push({ ...metadata, source: `/assets/decor/items/${outputName}`, aspectRatio: bounds.width / bounds.height });
  }

  catalog.sort((left, right) =>
    left.category.localeCompare(right.category) ||
    left.label.localeCompare(right.label, "ru", { numeric: true }),
  );
  const output = `/* Generated by scripts/build-decor-library.ts. */\n` +
    `import type { DecorLibraryItem } from "./decor-library";\n\n` +
    `export const DECOR_LIBRARY_ITEMS: readonly DecorLibraryItem[] = ${JSON.stringify(catalog, null, 2)} as const;\n`;
  await writeFile(catalogPath, output, "utf8");
  console.log(`Собрано элементов декора: ${catalog.length}`);
}

await build();
