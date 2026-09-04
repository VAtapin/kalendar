import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { PNG } from "pngjs";

const sheets = [
  ["bronze-medallions", "ChatGPT Image 4. Sept. 2026, 16_21_52.png"],
  ["jeweled-medallions", "ChatGPT Image 4. Sept. 2026, 16_18_43.png"],
  ["photographic-vignettes", "ChatGPT Image 4. Sept. 2026, 16_15_26.png"],
  ["gold-oval-medallions", "ChatGPT Image 4. Sept. 2026, 16_14_04.png"],
  ["minimal-dark", "ChatGPT Image 4. Sept. 2026, 16_12_48.png"],
  ["vintage-watercolor", "ChatGPT Image 4. Sept. 2026, 16_11_29.png"],
  ["light-watercolor", "ChatGPT Image 4. Sept. 2026, 16_07_22.png"],
  ["sticker-outline", "ChatGPT Image 4. Sept. 2026, 16_04_45.png"],
  ["soft-illustration", "ChatGPT Image 4. Sept. 2026, 15_45_34 (2).png"],
  ["clean-illustration", "ChatGPT Image 4. Sept. 2026, 15_45_35 (3).png"],
  ["blue-photo", "ChatGPT Image 4. Sept. 2026, 15_43_36 (1).png"],
  ["rustic-photo", "ChatGPT Image 4. Sept. 2026, 15_43_36 (2).png"],
  ["copper-photo", "ChatGPT Image 4. Sept. 2026, 15_43_36 (3).png"],
  ["gold-photo", "ChatGPT Image 4. Sept. 2026, 15_43_36 (4).png"],
] as const;

const markerFiles = [
  "fast-no-fish.png",
  "fish.png",
  "boiled-with-oil.png",
  "boiled-no-oil.png",
  "dry-eating.png",
  "strict-fast.png",
  "dairy-eggs.png",
  "memorial.png",
] as const;

const sourceDirectory = resolve(process.argv[2] ?? ".");
const outputRoot = resolve(process.argv[3] ?? "public/assets/markers");
const generatedFolders = new Set(sheets.map(([id]) => id));

function pixelFingerprint(image: PNG): string {
  return createHash("sha256")
    .update(`${image.width}x${image.height}:`)
    .update(image.data)
    .digest("hex");
}

interface OwnershipMap {
  width: number;
  height: number;
  owners: Int16Array;
}

/** Detects the four actual horizontal centres in each row and assigns pixels to them. */
function buildOwnershipMap(sheet: PNG, columnsPerRow: readonly [number, number]): OwnershipMap {
  const scale = 4;
  const width = sheet.width / scale;
  const height = sheet.height / scale;
  let maximumSheetAlpha = 0;
  for (let offset = 3; offset < sheet.data.length; offset += 4) {
    maximumSheetAlpha = Math.max(maximumSheetAlpha, sheet.data[offset] ?? 0);
  }
  const threshold = Math.max(220, maximumSheetAlpha - 2);
  const foreground = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let maximumAlpha = 0;
      for (let offsetY = 0; offsetY < scale; offsetY += 1) {
        for (let offsetX = 0; offsetX < scale; offsetX += 1) {
          const sourceOffset = ((y * scale + offsetY) * sheet.width + x * scale + offsetX) * 4 + 3;
          maximumAlpha = Math.max(maximumAlpha, sheet.data[sourceOffset] ?? 0);
        }
      }
      foreground[y * width + x] = maximumAlpha >= threshold ? 1 : 0;
    }
  }

  const owners = new Int16Array(width * height);
  owners.fill(-1);
  let ownerOffset = 0;
  for (let row = 0; row < 2; row += 1) {
    const startY = row * (height / 2);
    const finishY = (row + 1) * (height / 2);
    const columnCount = columnsPerRow[row];
    const centres = Array.from(
      { length: columnCount },
      (_, index) => width * (index * 2 + 1) / (columnCount * 2),
    );
    for (let iteration = 0; iteration < 16; iteration += 1) {
      const sums = [0, 0, 0, 0];
      const counts = [0, 0, 0, 0];
      for (let y = startY; y < finishY; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (!foreground[y * width + x]) continue;
          let nearest = 0;
          for (let candidate = 1; candidate < centres.length; candidate += 1) {
            if (Math.abs(x - centres[candidate]!) < Math.abs(x - centres[nearest]!)) nearest = candidate;
          }
          sums[nearest]! += x;
          counts[nearest]! += 1;
        }
      }
      centres.forEach((_, index) => {
        if (counts[index]) centres[index] = sums[index]! / counts[index]!;
      });
    }
    for (let y = startY; y < finishY; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!foreground[y * width + x]) continue;
        let nearest = 0;
        for (let candidate = 1; candidate < centres.length; candidate += 1) {
          if (Math.abs(x - centres[candidate]!) < Math.abs(x - centres[nearest]!)) nearest = candidate;
        }
        owners[y * width + x] = ownerOffset + nearest;
      }
    }
    ownerOffset += columnCount;
  }
  return { width, height, owners };
}

function extractMarker(sheet: PNG, ownership: OwnershipMap, owner: number): PNG {
  const radius = 3;
  const raw = new Uint8Array(ownership.owners.length);
  let ownerMinX = ownership.width;
  let ownerMaxX = -1;
  let ownerMinY = ownership.height;
  let ownerMaxY = -1;
  for (let index = 0; index < ownership.owners.length; index += 1) {
    if (ownership.owners[index] !== owner) continue;
    raw[index] = 1;
    const x = index % ownership.width;
    const y = Math.floor(index / ownership.width);
    ownerMinX = Math.min(ownerMinX, x);
    ownerMaxX = Math.max(ownerMaxX, x);
    ownerMinY = Math.min(ownerMinY, y);
    ownerMaxY = Math.max(ownerMaxY, y);
  }

  const labels = new Int32Array(raw.length);
  labels.fill(-1);
  const components: Array<{ area: number; minX: number; maxX: number; minY: number; maxY: number }> = [];
  const stack: number[] = [];
  for (let start = 0; start < raw.length; start += 1) {
    if (!raw[start] || labels[start] !== -1) continue;
    const label = components.length;
    const component = {
      area: 0,
      minX: ownership.width,
      maxX: -1,
      minY: ownership.height,
      maxY: -1,
    };
    labels[start] = label;
    stack.push(start);
    while (stack.length) {
      const offset = stack.pop()!;
      const x = offset % ownership.width;
      const y = Math.floor(offset / ownership.width);
      component.area += 1;
      component.minX = Math.min(component.minX, x);
      component.maxX = Math.max(component.maxX, x);
      component.minY = Math.min(component.minY, y);
      component.maxY = Math.max(component.maxY, y);
      const neighbours = [
        x > 0 ? offset - 1 : -1,
        x + 1 < ownership.width ? offset + 1 : -1,
        y > 0 ? offset - ownership.width : -1,
        y + 1 < ownership.height ? offset + ownership.width : -1,
      ];
      for (const neighbour of neighbours) {
        if (neighbour < 0 || !raw[neighbour] || labels[neighbour] !== -1) continue;
        labels[neighbour] = label;
        stack.push(neighbour);
      }
    }
    components.push(component);
  }
  const largestLabel = components.reduce(
    (best, component, index) => component.area > (components[best]?.area ?? -1) ? index : best,
    0,
  );
  const acceptedLabels = new Set<number>();
  components.forEach((component, index) => {
    const cutAtInternalBoundary =
      (ownerMinX > 0 && component.minX <= ownerMinX + 1) ||
      (ownerMaxX + 1 < ownership.width && component.maxX >= ownerMaxX - 1) ||
      (ownerMinY > 0 && component.minY <= ownerMinY + 1) ||
      (ownerMaxY + 1 < ownership.height && component.maxY >= ownerMaxY - 1);
    if (index === largestLabel || !cutAtInternalBoundary) acceptedLabels.add(index);
  });

  const kept = new Uint8Array(ownership.owners.length);
  for (let y = 0; y < ownership.height; y += 1) {
    for (let x = 0; x < ownership.width; x += 1) {
      const sourceIndex = y * ownership.width + x;
      if (!acceptedLabels.has(labels[sourceIndex] ?? -1)) continue;
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        const targetY = y + offsetY;
        if (targetY < ownerMinY || targetY > ownerMaxY) continue;
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const targetX = x + offsetX;
          if (targetX < ownerMinX || targetX > ownerMaxX) continue;
          kept[targetY * ownership.width + targetX] = 1;
        }
      }
    }
  }

  let minX = sheet.width;
  let minY = sheet.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < sheet.height; y += 1) {
    for (let x = 0; x < sheet.width; x += 1) {
      if (!kept[Math.floor(y / 4) * ownership.width + Math.floor(x / 4)]) continue;
      const alpha = sheet.data[(y * sheet.width + x) * 4 + 3] ?? 0;
      if (alpha <= 4) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error(`Не найден знак № ${owner + 1}`);

  const padding = 12;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(sheet.width - 1, maxX + padding);
  maxY = Math.min(sheet.height - 1, maxY + padding);
  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const marker = new PNG({ width: 512, height: 512, colorType: 6 });
  marker.data.fill(0);
  const scale = Math.min(1, 480 / cropWidth, 480 / cropHeight);
  const drawWidth = Math.max(1, Math.round(cropWidth * scale));
  const drawHeight = Math.max(1, Math.round(cropHeight * scale));
  const destinationX = Math.floor((512 - drawWidth) / 2);
  const destinationY = Math.floor((512 - drawHeight) / 2);
  for (let y = 0; y < drawHeight; y += 1) {
    for (let x = 0; x < drawWidth; x += 1) {
      const sourceX = minX + Math.min(cropWidth - 1, Math.floor(x / scale));
      const sourceY = minY + Math.min(cropHeight - 1, Math.floor(y / scale));
      if (!kept[Math.floor(sourceY / 4) * ownership.width + Math.floor(sourceX / 4)]) continue;
      const sourceOffset = (sourceY * sheet.width + sourceX) * 4;
      const destinationOffset = ((destinationY + y) * marker.width + destinationX + x) * 4;
      marker.data[destinationOffset] = sheet.data[sourceOffset] ?? 0;
      marker.data[destinationOffset + 1] = sheet.data[sourceOffset + 1] ?? 0;
      marker.data[destinationOffset + 2] = sheet.data[sourceOffset + 2] ?? 0;
      marker.data[destinationOffset + 3] = sheet.data[sourceOffset + 3] ?? 0;
    }
  }
  return marker;
}

async function existingFingerprints(): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const folders = await readdir(outputRoot, { withFileTypes: true });
  for (const folder of folders) {
    if (!folder.isDirectory() || generatedFolders.has(folder.name)) continue;
    const folderPath = join(outputRoot, folder.name);
    for (const entry of await readdir(folderPath, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".png")) continue;
      const path = join(folderPath, entry.name);
      const image = PNG.sync.read(await readFile(path));
      result.set(pixelFingerprint(image), path);
    }
  }
  return result;
}

async function main(): Promise<void> {
  const seenSheets = new Map<string, string>();
  const seenMarkers = await existingFingerprints();
  const duplicates: string[] = [];
  let written = 0;

  for (const [folder, fileName] of sheets) {
    const sourcePath = join(sourceDirectory, fileName);
    const sourceBytes = await readFile(sourcePath);
    const sourceHash = createHash("sha256").update(sourceBytes).digest("hex");
    const duplicateSheet = seenSheets.get(sourceHash);
    if (duplicateSheet) duplicates.push(`${fileName} = ${duplicateSheet}`);
    else seenSheets.set(sourceHash, fileName);

    const sheet = PNG.sync.read(sourceBytes);
    if (sheet.width !== 1536 || sheet.height !== 1024) {
      throw new Error(`${basename(sourcePath)}: ожидался лист 1536×1024, получено ${sheet.width}×${sheet.height}`);
    }
    const outputDirectory = join(outputRoot, folder);
    await mkdir(outputDirectory, { recursive: true });
    const columnsPerRow: readonly [number, number] = folder === "minimal-dark" ? [6, 4] : [4, 4];
    const sourceOwners = folder === "minimal-dark"
      ? [0, 2, 3, 4, 6, 7, 8, 9]
      : [0, 1, 2, 3, 4, 5, 6, 7];
    const ownership = buildOwnershipMap(sheet, columnsPerRow);

    for (let index = 0; index < markerFiles.length; index += 1) {
      let marker: PNG;
      try {
        marker = extractMarker(sheet, ownership, sourceOwners[index]!);
      } catch (error) {
        throw new Error(`${fileName} / ${markerFiles[index]}: ${error instanceof Error ? error.message : String(error)}`);
      }
      const fingerprint = pixelFingerprint(marker);
      const duplicate = seenMarkers.get(fingerprint);
      const destination = join(outputDirectory, markerFiles[index]!);
      if (duplicate) duplicates.push(`${destination} = ${duplicate}`);
      else seenMarkers.set(fingerprint, destination);
      await writeFile(destination, PNG.sync.write(marker, { colorType: 6 }));
      written += 1;
    }
  }

  if (duplicates.length) {
    throw new Error(`Обнаружены дубликаты:\n${duplicates.join("\n")}`);
  }
  console.log(`Готово: ${written} отдельных PNG, ${sheets.length} наборов; точных дубликатов нет.`);
}

await main();
