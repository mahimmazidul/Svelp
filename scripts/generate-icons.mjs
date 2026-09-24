import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const bal_root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bal_out_dir = join(bal_root, 'public', 'icons');

const bal_accent = [30, 64, 175];
const bal_ink = [23, 26, 33];
const bal_white = [255, 255, 255];

const bal_deg = Math.PI / 180;

const bal_shapes = [
  { kind: 'seg', a: [14, 24], b: [14, 18], w: 3.5, color: bal_accent },
  { kind: 'arc', c: [18, 18], r: 4, a0: 180, a1: 270, w: 3.5, color: bal_accent },
  { kind: 'seg', a: [18, 14], b: [24, 14], w: 3.5, color: bal_accent },
  { kind: 'seg', a: [40, 14], b: [46, 14], w: 3.5, color: bal_accent },
  { kind: 'arc', c: [46, 18], r: 4, a0: 270, a1: 360, w: 3.5, color: bal_accent },
  { kind: 'seg', a: [50, 18], b: [50, 24], w: 3.5, color: bal_accent },
  { kind: 'seg', a: [50, 40], b: [50, 46], w: 3.5, color: bal_accent },
  { kind: 'arc', c: [46, 46], r: 4, a0: 0, a1: 90, w: 3.5, color: bal_accent },
  { kind: 'seg', a: [46, 50], b: [40, 50], w: 3.5, color: bal_accent },
  { kind: 'seg', a: [24, 50], b: [18, 50], w: 3.5, color: bal_accent },
  { kind: 'arc', c: [18, 46], r: 4, a0: 90, a1: 180, w: 3.5, color: bal_accent },
  { kind: 'seg', a: [14, 46], b: [14, 40], w: 3.5, color: bal_accent },
  { kind: 'rrect', c: [32, 32], hw: 9, hh: 14, rad: 2.5, w: 3, color: bal_ink },
  { kind: 'seg', a: [27.5, 26], b: [36.5, 26], w: 2.5, color: bal_ink },
  { kind: 'seg', a: [27.5, 31.5], b: [36.5, 31.5], w: 2.5, color: bal_ink },
  { kind: 'seg', a: [27.5, 37], b: [33, 37], w: 2.5, color: bal_ink }
];

function bal_sd_segment(bal_px, bal_py, bal_a, bal_b) {
  const bal_abx = bal_b[0] - bal_a[0];
  const bal_aby = bal_b[1] - bal_a[1];
  const bal_apx = bal_px - bal_a[0];
  const bal_apy = bal_py - bal_a[1];
  const bal_len2 = bal_abx * bal_abx + bal_aby * bal_aby;
  let bal_t = bal_len2 === 0 ? 0 : (bal_apx * bal_abx + bal_apy * bal_aby) / bal_len2;
  bal_t = Math.max(0, Math.min(1, bal_t));
  const bal_dx = bal_apx - bal_abx * bal_t;
  const bal_dy = bal_apy - bal_aby * bal_t;
  return Math.hypot(bal_dx, bal_dy);
}

function bal_sd_arc(bal_px, bal_py, bal_shape) {
  const bal_dx = bal_px - bal_shape.c[0];
  const bal_dy = bal_py - bal_shape.c[1];
  let bal_angle = Math.atan2(bal_dy, bal_dx) / bal_deg;
  if (bal_angle < 0) bal_angle += 360;
  let bal_lo = bal_shape.a0;
  let bal_hi = bal_shape.a1;
  if (bal_lo > bal_hi) {
    if (bal_angle >= bal_lo || bal_angle <= bal_hi) {
      return Math.abs(Math.hypot(bal_dx, bal_dy) - bal_shape.r);
    }
  } else if (bal_angle >= bal_lo && bal_angle <= bal_hi) {
    return Math.abs(Math.hypot(bal_dx, bal_dy) - bal_shape.r);
  }
  const bal_clamped =
    Math.abs(bal_angle - bal_lo) < Math.abs(bal_angle - bal_hi) ? bal_lo : bal_hi;
  const bal_rad = bal_clamped * bal_deg;
  const bal_cx = bal_shape.c[0] + bal_shape.r * Math.cos(bal_rad);
  const bal_cy = bal_shape.c[1] + bal_shape.r * Math.sin(bal_rad);
  return Math.hypot(bal_px - bal_cx, bal_py - bal_cy);
}

function bal_sd_rrect(bal_px, bal_py, bal_shape) {
  const bal_qx = Math.abs(bal_px - bal_shape.c[0]) - (bal_shape.hw - bal_shape.rad);
  const bal_qy = Math.abs(bal_py - bal_shape.c[1]) - (bal_shape.hh - bal_shape.rad);
  const bal_ax = Math.max(bal_qx, 0);
  const bal_ay = Math.max(bal_qy, 0);
  return (
    Math.hypot(bal_ax, bal_ay) + Math.min(Math.max(bal_qx, bal_qy), 0) - bal_shape.rad
  );
}

function bal_sample_mark(bal_x, bal_y) {
  for (const bal_shape of bal_shapes) {
    let bal_d;
    if (bal_shape.kind === 'seg') {
      bal_d = bal_sd_segment(bal_x, bal_y, bal_shape.a, bal_shape.b);
    } else if (bal_shape.kind === 'arc') {
      bal_d = bal_sd_arc(bal_x, bal_y, bal_shape);
    } else {
      bal_d = Math.abs(bal_sd_rrect(bal_x, bal_y, bal_shape));
    }
    if (bal_d <= bal_shape.w / 2) return bal_shape.color;
  }
  return null;
}

function bal_content_bounds() {
  const bal_steps = 512;
  let bal_min_x = Infinity;
  let bal_min_y = Infinity;
  let bal_max_x = -Infinity;
  let bal_max_y = -Infinity;
  for (let bal_y = 0; bal_y <= bal_steps; bal_y++) {
    for (let bal_x = 0; bal_x <= bal_steps; bal_x++) {
      if (bal_sample_mark((bal_x / bal_steps) * 64, (bal_y / bal_steps) * 64) !== null) {
        if (bal_x < bal_min_x) bal_min_x = bal_x;
        if (bal_x > bal_max_x) bal_max_x = bal_x;
        if (bal_y < bal_min_y) bal_min_y = bal_y;
        if (bal_y > bal_max_y) bal_max_y = bal_y;
      }
    }
  }
  return {
    cx: ((bal_min_x + bal_max_x) / 2 / bal_steps) * 64,
    cy: ((bal_min_y + bal_max_y) / 2 / bal_steps) * 64,
    span: (Math.max(bal_max_x - bal_min_x, bal_max_y - bal_min_y) / bal_steps) * 64
  };
}

const BAL_CONTENT = bal_content_bounds();

function bal_render(bal_size, bal_fill) {
  const bal_pixels = Buffer.alloc(bal_size * bal_size * 4);
  const bal_scale = (bal_size * bal_fill) / BAL_CONTENT.span;
  const bal_offset_x = bal_size / 2 - BAL_CONTENT.cx * bal_scale;
  const bal_offset_y = bal_size / 2 - BAL_CONTENT.cy * bal_scale;
  const bal_sub = 4;
  for (let bal_y = 0; bal_y < bal_size; bal_y++) {
    for (let bal_x = 0; bal_x < bal_size; bal_x++) {
      let bal_r = 0;
      let bal_g = 0;
      let bal_b = 0;
      for (let bal_sy = 0; bal_sy < bal_sub; bal_sy++) {
        for (let bal_sx = 0; bal_sx < bal_sub; bal_sx++) {
          const bal_px = (bal_x + (bal_sx + 0.5) / bal_sub - bal_offset_x) / bal_scale;
          const bal_py = (bal_y + (bal_sy + 0.5) / bal_sub - bal_offset_y) / bal_scale;
          const bal_color = bal_sample_mark(bal_px, bal_py) ?? bal_white;
          bal_r += bal_color[0];
          bal_g += bal_color[1];
          bal_b += bal_color[2];
        }
      }
      const bal_count = bal_sub * bal_sub;
      const bal_index = (bal_y * bal_size + bal_x) * 4;
      bal_pixels[bal_index] = Math.round(bal_r / bal_count);
      bal_pixels[bal_index + 1] = Math.round(bal_g / bal_count);
      bal_pixels[bal_index + 2] = Math.round(bal_b / bal_count);
      bal_pixels[bal_index + 3] = 255;
    }
  }
  return bal_pixels;
}

const bal_crc_table = new Int32Array(256);
for (let bal_n = 0; bal_n < 256; bal_n++) {
  let bal_c = bal_n;
  for (let bal_k = 0; bal_k < 8; bal_k++) {
    bal_c = bal_c & 1 ? 0xedb88320 ^ (bal_c >>> 1) : bal_c >>> 1;
  }
  bal_crc_table[bal_n] = bal_c;
}

function bal_crc32(bal_buf) {
  let bal_c = 0xffffffff;
  for (let bal_i = 0; bal_i < bal_buf.length; bal_i++) {
    bal_c = bal_crc_table[(bal_c ^ bal_buf[bal_i]) & 0xff] ^ (bal_c >>> 8);
  }
  return (bal_c ^ 0xffffffff) >>> 0;
}

function bal_chunk(bal_type, bal_data) {
  const bal_len = Buffer.alloc(4);
  bal_len.writeUInt32BE(bal_data.length, 0);
  const bal_body = Buffer.concat([Buffer.from(bal_type, 'ascii'), bal_data]);
  const bal_crc = Buffer.alloc(4);
  bal_crc.writeUInt32BE(bal_crc32(bal_body), 0);
  return Buffer.concat([bal_len, bal_body, bal_crc]);
}

function bal_encode_png(bal_size, bal_pixels) {
  const bal_raw = Buffer.alloc((bal_size * 4 + 1) * bal_size);
  for (let bal_y = 0; bal_y < bal_size; bal_y++) {
    bal_raw[bal_y * (bal_size * 4 + 1)] = 0;
    bal_pixels.copy(
      bal_raw,
      bal_y * (bal_size * 4 + 1) + 1,
      bal_y * bal_size * 4,
      (bal_y + 1) * bal_size * 4
    );
  }
  const bal_ihdr = Buffer.alloc(13);
  bal_ihdr.writeUInt32BE(bal_size, 0);
  bal_ihdr.writeUInt32BE(bal_size, 4);
  bal_ihdr[8] = 8;
  bal_ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bal_chunk('IHDR', bal_ihdr),
    bal_chunk('IDAT', deflateSync(bal_raw, { level: 9 })),
    bal_chunk('IEND', Buffer.alloc(0))
  ]);
}

mkdirSync(bal_out_dir, { recursive: true });

const bal_outputs = [
  { name: 'pwa-192.png', size: 192, fill: 0.76 },
  { name: 'pwa-512.png', size: 512, fill: 0.76 },
  { name: 'maskable-512.png', size: 512, fill: 0.58 },
  { name: 'apple-touch-icon.png', size: 180, fill: 0.72 }
];

for (const bal_out of bal_outputs) {
  const bal_pixels = bal_render(bal_out.size, bal_out.fill);
  writeFileSync(join(bal_out_dir, bal_out.name), bal_encode_png(bal_out.size, bal_pixels));
  console.log(`wrote ${bal_out.name}`);
}
