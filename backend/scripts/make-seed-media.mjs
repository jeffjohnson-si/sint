/**
 * Renders the demo artwork used by scripts/seed.js.
 *
 * The seed used to point at https://picsum.photos, a third-party host that is
 * blocked on some networks (it times out here), which left every post with an
 * empty media frame. These tiles are generated locally instead, written to
 * backend/seed-media/ and copied into the uploads folder by the seed, so demo
 * media always resolves from our own API.
 *
 * Usage: node scripts/make-seed-media.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', 'seed-media');
const WIDTH = 1200;
const HEIGHT = 800;
const COUNT = 10;

/** Sky/sea palettes, one per tile. */
const THEMES = [
  { sky: [12, 74, 92], sea: [8, 46, 63], sun: [250, 204, 21] }, // lagoon
  { sky: [124, 45, 18], sea: [69, 26, 3], sun: [253, 186, 116] }, // sunset
  { sky: [22, 78, 55], sea: [10, 47, 34], sun: [190, 242, 100] }, // rainforest
  { sky: [30, 58, 138], sea: [17, 34, 87], sun: [147, 197, 253] }, // deep blue
  { sky: [88, 28, 135], sea: [49, 15, 78], sun: [233, 213, 255] }, // dusk
  { sky: [133, 77, 14], sea: [80, 45, 8], sun: [253, 224, 71] }, // gold
  { sky: [17, 94, 89], sea: [9, 54, 52], sun: [94, 234, 212] }, // teal
  { sky: [136, 19, 55], sea: [80, 7, 36], sun: [251, 113, 133] }, // coral
  { sky: [55, 65, 81], sea: [31, 41, 55], sun: [203, 213, 225] }, // slate
  { sky: [21, 94, 117], sea: [12, 58, 74], sun: [165, 243, 252] }, // harbour
];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Minimal 8-bit RGB PNG encoder: no dependencies, gradients compress tiny. */
function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const clamp = (n) => (n < 0 ? 0 : n > 255 ? 255 : n | 0);
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Sunset over water: soft sun, a rippled sea and the sun's reflection. */
function render(theme, seed) {
  const rgb = Buffer.alloc(WIDTH * HEIGHT * 3);
  const aspect = WIDTH / HEIGHT;
  const sunX = 0.3 + 0.18 * Math.sin(seed * 1.7);
  const sunY = 0.32 + 0.05 * Math.cos(seed);
  const sunR = 0.115 + 0.015 * (seed % 3);

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const u = x / WIDTH;
      const v = y / HEIGHT;

      // Horizon drifts slightly so tiles do not look stamped from one mould.
      const horizon = 0.58 + 0.03 * Math.sin(u * 4.5 + seed * 1.1);
      const seaMask = smoothstep(horizon - 0.006, horizon + 0.006, v);

      // Sky darkens toward the top, sea darkens with depth.
      const skyT = smoothstep(0, horizon, v);
      const depth = seaMask > 0 ? Math.min(1, Math.max(0, (v - horizon) / (1 - horizon))) : 0;

      let r = mix(mix(theme.sky[0] * 0.55, theme.sky[0], skyT), mix(theme.sea[0], theme.sea[0] * 1.6, depth), seaMask);
      let g = mix(mix(theme.sky[1] * 0.55, theme.sky[1], skyT), mix(theme.sea[1], theme.sea[1] * 1.6, depth), seaMask);
      let b = mix(mix(theme.sky[2] * 0.55, theme.sky[2], skyT), mix(theme.sea[2], theme.sea[2] * 1.6, depth), seaMask);

      // Sun disc with a soft halo.
      const d = Math.hypot((u - sunX) * aspect, v - sunY);
      if (d < sunR) {
        const a = 0.35 + 0.65 * Math.sqrt(1 - d / sunR);
        r = mix(r, theme.sun[0], a);
        g = mix(g, theme.sun[1], a);
        b = mix(b, theme.sun[2], a);
      } else if (d < sunR * 3) {
        const a = 0.16 * Math.pow(1 - (d - sunR) / (sunR * 2), 2);
        r = mix(r, theme.sun[0], a);
        g = mix(g, theme.sun[1], a);
        b = mix(b, theme.sun[2], a);
      }

      if (seaMask > 0) {
        // Broken reflection column directly under the sun.
        const width = 0.035 + depth * 0.13;
        const column = Math.exp(-(((u - sunX) / width) ** 2));
        const flicker = 0.55 + 0.45 * Math.sin(depth * 34 + seed * 2.1 + Math.sin(u * 18) * 2);
        const reflection = column * (1 - depth) * 0.75 * flicker;

        // Ripple crests, flattening out with distance from the camera.
        const ripple = Math.sin(depth * 24 - seed + Math.sin(u * 7 + seed) * 1.4) * 0.5 + 0.5;
        const crest = Math.pow(ripple, 5) * (1 - depth * 0.8) * 0.28;

        const light = (reflection + crest) * seaMask;
        r = mix(r, theme.sun[0], Math.min(0.95, light));
        g = mix(g, theme.sun[1], Math.min(0.95, light));
        b = mix(b, theme.sun[2], Math.min(0.95, light));
      }

      // Vignette to keep the frame from looking flat.
      const vig = 1 - 0.4 * Math.pow(Math.hypot(u - 0.5, v - 0.5) * 1.3, 2.2);
      r *= vig;
      g *= vig;
      b *= vig;

      const i = (y * WIDTH + x) * 3;
      rgb[i] = clamp(r);
      rgb[i + 1] = clamp(g);
      rgb[i + 2] = clamp(b);
    }
  }

  return encodePng(WIDTH, HEIGHT, rgb);
}

fs.mkdirSync(outDir, { recursive: true });
for (let i = 0; i < COUNT; i += 1) {
  const file = path.join(outDir, `seed-${String(i + 1).padStart(2, '0')}.png`);
  fs.writeFileSync(file, render(THEMES[i % THEMES.length], i + 1));
  console.log(`${path.basename(file)}  ${Math.round(fs.statSync(file).size / 1024)}KB`);
}
