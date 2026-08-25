const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function inRoundedRect(x, y, size, radius, margin) {
  const s = size - margin * 2;
  const lx = x - margin, ly = y - margin;
  if (lx < 0 || ly < 0 || lx >= s || ly >= s) return false;
  const cx = Math.min(Math.max(lx, radius), s - radius);
  const cy = Math.min(Math.max(ly, radius), s - radius);
  const dx = lx - cx, dy = ly - cy;
  return dx * dx + dy * dy <= radius * radius || (lx >= radius && lx < s - radius) || (ly >= radius && ly < s - radius);
}

// Brand: indigo rounded square, white storefront mark (roof + door)
function makeIcon(size) {
  const r = size * 0.18;
  const m = size * 0.02;
  return png(size, (x, y) => {
    if (!inRoundedRect(x, y, size, r, m)) return [0, 0, 0, 0];
    const t = (x / size + y / size) / 2;
    let base = [79 + Math.round(t * 30), 70 + Math.round(t * 10), 229]; // indigo gradient
    const u = size / 512; // unit scale
    const white = [255, 255, 255, 255];

    // awning: scalloped band across upper area
    const ay0 = 110 * u, ay1 = 210 * u;
    const scallop = 64 * u;
    if (y >= ay0 && y <= ay1) {
      const seg = Math.floor((x - 40 * u) / scallop);
      const sx = ((x - 40 * u) % scallop) - scallop / 2;
      const sy = y - ay1;
      const inScallopBottom = sy > 0 && sx * sx + sy * sy > scallop / 2 * (scallop / 2) * 0 === false;
      void inScallopBottom;
      const bottomEdge = ay1 + (seg % 2 === 0 ? 24 : 0) * u;
      if (y <= bottomEdge && x >= 40 * u && x <= 472 * u) return white;
    }
    // body sides
    if (y > ay1 && y <= 430 * u && (x >= 80 * u && x <= 118 * u || x >= 394 * u && x <= 432 * u)) return white;
    // floor line
    if (y > 404 * u && y <= 430 * u && x >= 80 * u && x <= 432 * u) return white;
    // door
    if (y > 260 * u && y <= 404 * u && x >= 216 * u && x <= 296 * u) return white;

    return [...base, 255];
  });
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), makeIcon(size));
  console.log(`icon-${size}.png written`);
}
