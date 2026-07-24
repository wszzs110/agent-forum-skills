import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const size = 64;
const pixels = Buffer.alloc(size * size * 4);
const and = Buffer.alloc(size * 8);
const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
function blend(x, y, color, coverage = 1) {
  if (x < 0 || x >= size || y < 0 || y >= size || coverage <= 0) return;
  const index = ((size - 1 - y) * size + x) * 4;
  const alpha = coverage * (color[3] ?? 1);
  pixels[index] = clamp(pixels[index] * (1 - alpha) + color[2] * alpha);
  pixels[index + 1] = clamp(pixels[index + 1] * (1 - alpha) + color[1] * alpha);
  pixels[index + 2] = clamp(pixels[index + 2] * (1 - alpha) + color[0] * alpha);
  pixels[index + 3] = 255;
}
function roundedRect(left, top, width, height, radius, color) {
  for (let y = Math.floor(top); y < Math.ceil(top + height); y += 1) for (let x = Math.floor(left); x < Math.ceil(left + width); x += 1) {
    const nearestX = Math.max(left + radius, Math.min(x + .5, left + width - radius));
    const nearestY = Math.max(top + radius, Math.min(y + .5, top + height - radius));
    const distance = Math.hypot(x + .5 - nearestX, y + .5 - nearestY) - radius;
    blend(x, y, color, Math.max(0, Math.min(1, .75 - distance)));
  }
}
function segment(from, to, width, color) {
  const dx = to[0] - from[0]; const dy = to[1] - from[1]; const length = dx * dx + dy * dy;
  const minX = Math.floor(Math.min(from[0], to[0]) - width); const maxX = Math.ceil(Math.max(from[0], to[0]) + width);
  const minY = Math.floor(Math.min(from[1], to[1]) - width); const maxY = Math.ceil(Math.max(from[1], to[1]) + width);
  for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
    const projection = Math.max(0, Math.min(1, ((x + .5 - from[0]) * dx + (y + .5 - from[1]) * dy) / length));
    const distance = Math.hypot(x + .5 - (from[0] + projection * dx), y + .5 - (from[1] + projection * dy));
    blend(x, y, color, Math.max(0, Math.min(1, width / 2 + .7 - distance)));
  }
}
roundedRect(3, 3, 58, 58, 14, [12, 16, 26, 1]);
const thread = (points, color) => { for (let index = 1; index < points.length; index += 1) segment(points[index - 1], points[index], 4, color); };
thread([[16, 17], [16, 23], [21, 28], [49, 28]], [103, 164, 255, 1]);
thread([[24, 28], [24, 32], [29, 38], [46, 38]], [104, 198, 227, 1]);
thread([[31, 38], [31, 41], [37, 46], [43, 46]], [112, 225, 208, 1]);
const bitmapHeader = Buffer.alloc(40);
bitmapHeader.writeUInt32LE(40, 0); bitmapHeader.writeInt32LE(size, 4); bitmapHeader.writeInt32LE(size * 2, 8);
bitmapHeader.writeUInt16LE(1, 12); bitmapHeader.writeUInt16LE(32, 14); bitmapHeader.writeUInt32LE(pixels.byteLength + and.byteLength, 20);
const directory = Buffer.alloc(22);
directory.writeUInt16LE(0, 0); directory.writeUInt16LE(1, 2); directory.writeUInt16LE(1, 4);
directory[6] = size; directory[7] = size; directory.writeUInt16LE(1, 10); directory.writeUInt16LE(32, 12);
directory.writeUInt32LE(bitmapHeader.byteLength + pixels.byteLength + and.byteLength, 14); directory.writeUInt32LE(directory.byteLength, 18);
const destination = resolve(root, "dashboard", "icon.ico");
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, Buffer.concat([directory, bitmapHeader, pixels, and]));

function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(name, data) {
  const type = Buffer.from(name, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 8 + data.length);
  return chunk;
}
const pngRows = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y += 1) {
  const row = y * (size * 4 + 1);
  pngRows[row] = 0;
  for (let x = 0; x < size; x += 1) {
    const source = ((size - 1 - y) * size + x) * 4;
    const target = row + 1 + x * 4;
    pngRows[target] = pixels[source + 2];
    pngRows[target + 1] = pixels[source + 1];
    pngRows[target + 2] = pixels[source];
    pngRows[target + 3] = pixels[source + 3];
  }
}
const pngHeader = Buffer.alloc(13);
pngHeader.writeUInt32BE(size, 0); pngHeader.writeUInt32BE(size, 4); pngHeader[8] = 8; pngHeader[9] = 6;
const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), pngChunk("IHDR", pngHeader), pngChunk("IDAT", deflateSync(pngRows)), pngChunk("IEND", Buffer.alloc(0))]);
const pngDestination = resolve(root, "dashboard", "icon.png");
await writeFile(pngDestination, png);
console.log(`Generated ${destination} and ${pngDestination} from docs/assets/agent-forum-logo.svg`);
