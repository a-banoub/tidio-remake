// Generates solid-color PWA icons (192x192 and 512x512) using only Node stdlib.
// Produces a blue (#2563eb) background with a white "S" stamped roughly in the
// center via a small bitmap font that gets nearest-neighbor scaled into the canvas.
//
// Usage: node console/scripts/gen-icons.mjs
//
// The output PNGs are committed to public/icons/ so the build doesn't need to
// regenerate them. Re-run only when changing the design.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

// 7x9 bitmap "S" — 1 = white pixel, 0 = background
const GLYPH_S = [
  '0111110',
  '1000001',
  '1000000',
  '1000000',
  '0111110',
  '0000001',
  '0000001',
  '1000001',
  '0111110',
];
const GLYPH_W = 7;
const GLYPH_H = 9;

const BG = [0x25, 0x63, 0xeb]; // #2563eb
const FG = [0xff, 0xff, 0xff]; // white

function buildRGBA(width, height) {
  // The glyph is centered and scaled to ~60% of width.
  const targetGlyphW = Math.floor(width * 0.6);
  const scale = Math.max(1, Math.floor(targetGlyphW / GLYPH_W));
  const drawW = GLYPH_W * scale;
  const drawH = GLYPH_H * scale;
  const offsetX = Math.floor((width - drawW) / 2);
  const offsetY = Math.floor((height - drawH) / 2);

  // Each row has a leading filter byte (0 = None) followed by RGBA pixels.
  const rowSize = 1 + width * 4;
  const buf = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    buf[y * rowSize] = 0; // filter: None
    const gy = y - offsetY;
    const gRow = gy >= 0 && gy < drawH ? GLYPH_S[Math.floor(gy / scale)] : null;
    for (let x = 0; x < width; x++) {
      let r = BG[0], g = BG[1], b = BG[2];
      if (gRow) {
        const gx = x - offsetX;
        if (gx >= 0 && gx < drawW && gRow[Math.floor(gx / scale)] === '1') {
          r = FG[0]; g = FG[1]; b = FG[2];
        }
      }
      const off = y * rowSize + 1 + x * 4;
      buf[off] = r;
      buf[off + 1] = g;
      buf[off + 2] = b;
      buf[off + 3] = 0xff;
    }
  }
  return buf;
}

// CRC table for PNG chunk CRCs.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(width, height) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  const raw = buildRGBA(width, height);
  const idatData = deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const png = makePng(size, size);
  const out = resolve(OUT_DIR, `icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes)`);
}
