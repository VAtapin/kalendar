import { readFile, writeFile } from "node:fs/promises";

const PNG_SIGNATURE_BYTES = 8;
const PIXELS_PER_METRE_AT_300_DPI = Math.round(300 / 0.0254);

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPhysicalPixelChunk(): Buffer {
  const type = Buffer.from("pHYs", "ascii");
  const data = Buffer.alloc(9);
  data.writeUInt32BE(PIXELS_PER_METRE_AT_300_DPI, 0);
  data.writeUInt32BE(PIXELS_PER_METRE_AT_300_DPI, 4);
  data.writeUInt8(1, 8);
  const chunk = Buffer.alloc(4 + type.length + data.length + 4);
  chunk.writeUInt32BE(data.length, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 17);
  return chunk;
}

async function setPngDpi(filePath: string): Promise<void> {
  const source = await readFile(filePath);
  const signature = source.subarray(0, PNG_SIGNATURE_BYTES);
  const chunks: Buffer[] = [];
  let offset = PNG_SIGNATURE_BYTES;
  while (offset < source.length) {
    const length = source.readUInt32BE(offset);
    const end = offset + 12 + length;
    const type = source.toString("ascii", offset + 4, offset + 8);
    if (type !== "pHYs") chunks.push(source.subarray(offset, end));
    offset = end;
  }
  const ihdr = chunks.shift();
  if (!ihdr || ihdr.toString("ascii", 4, 8) !== "IHDR") throw new Error(`${filePath}: повреждён PNG`);
  await writeFile(filePath, Buffer.concat([signature, ihdr, createPhysicalPixelChunk(), ...chunks]));
}

const paths = process.argv.slice(2);
if (paths.length === 0) throw new Error("Укажите PNG-файлы");
await Promise.all(paths.map(setPngDpi));
console.log(`Записано 300 dpi: ${paths.length}`);
