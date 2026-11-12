// Small code-drawn clock glyph, encoded as a Windows ICO (32-bit DIB).
import { mkdirSync, writeFileSync } from 'node:fs';
const size = 32;
const dib = Buffer.alloc(40 + size * size * 4 + size * 4);
dib.writeUInt32LE(40, 0);
dib.writeInt32LE(size, 4);
dib.writeInt32LE(size * 2, 8);
dib.writeUInt16LE(1, 12);
dib.writeUInt16LE(32, 14);
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const visible = x >= 3 && x < 29 && y >= 3 && y < 29;
    const hand = (x >= 14 && x <= 17 && y >= 8 && y <= 17)
      || (x >= 14 && x <= 24 && y >= 14 && y <= 17);
    const offset = 40 + ((size - 1 - y) * size + x) * 4;
    dib.set(hand ? [28, 30, 20, 255] : [180, 224, 137, visible ? 255 : 0], offset);
  }
}
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = size; header[7] = size;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(dib.length, 14);
header.writeUInt32LE(22, 18);
const directory = new URL('../src-tauri/icons/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('icon.ico', directory), Buffer.concat([header, dib]));
