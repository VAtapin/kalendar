import { copyFile, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { PNG } from "pngjs";

const workspace = resolve(import.meta.dirname, "..");
const update = process.argv.includes("--update");
process.argv[2] = "2027";
await import("./generate-sample-pdf");

const pdf = resolve(workspace, "output/pdf/orthodox-calendar-2027-a3-preview.pdf");
const currentFolder = resolve(workspace, "output/visual-current");
const baselineFolder = resolve(workspace, "tests/visual-baselines");
await Promise.all([mkdir(currentFolder, { recursive: true }), mkdir(baselineFolder, { recursive: true })]);

function run(command: string, args: string[]): Promise<void> {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? done() : reject(new Error(`${command} exited with ${code}`)));
  });
}

const monthNames = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;
const pages = monthNames.map((name, index) => ({ page: index + 2, name: `a3-${name}` }));

for (const item of pages) {
  const outputPrefix = resolve(currentFolder, item.name);
  await run("pdftoppm", ["-f", String(item.page), "-l", String(item.page), "-r", "72", "-png", "-singlefile", pdf, outputPrefix]);
  const current = `${outputPrefix}.png`;
  const baseline = resolve(baselineFolder, `${item.name}.png`);
  if (update) {
    await copyFile(current, baseline);
    process.stdout.write(`updated ${baseline}\n`);
    continue;
  }
  const [actualBytes, expectedBytes] = await Promise.all([readFile(current), readFile(baseline)]);
  const actual = PNG.sync.read(actualBytes);
  const expected = PNG.sync.read(expectedBytes);
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(`${item.name}: image size changed from ${expected.width}x${expected.height} to ${actual.width}x${actual.height}`);
  }
  let changed = 0;
  const pixels = actual.width * actual.height;
  for (let index = 0; index < actual.data.length; index += 4) {
    if (
      Math.abs(actual.data[index]! - expected.data[index]!) > 12 ||
      Math.abs(actual.data[index + 1]! - expected.data[index + 1]!) > 12 ||
      Math.abs(actual.data[index + 2]! - expected.data[index + 2]!) > 12
    ) changed += 1;
  }
  const ratio = changed / pixels;
  if (ratio > 0.005) throw new Error(`${item.name}: ${(ratio * 100).toFixed(2)}% pixels changed`);
  process.stdout.write(`${item.name}: ${(ratio * 100).toFixed(3)}% pixels changed\n`);
}
