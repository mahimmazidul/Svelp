import { bal_box_blur, type bal_SyntheticImage } from '../scan/scan_fixtures';

export type bal_Point2 = [number, number];

export type bal_DegradationOp =
  | { op: 'brightness'; delta: number }
  | { op: 'contrast'; scale: number }
  | { op: 'noise'; amplitude: number; seed: number }
  | { op: 'blur'; radius: number }
  | { op: 'perspective'; shifts: { tl: bal_Point2; tr: bal_Point2; br: bal_Point2; bl: bal_Point2 } }
  | { op: 'illumination'; gradient: number; angleDeg: number; vignette: number }
  | { op: 'crop'; left: number; top: number; right: number; bottom: number }
  | { op: 'quantize'; levels: number }
  | { op: 'glare'; spots: { cx: number; cy: number; r: number }[] }
  | { op: 'rotate'; degrees: 0 | 90 | 180 | 270 };

export type bal_QualityCategory = 'good' | 'acceptable' | 'poor' | 'unusable';

export interface bal_CapturePreset {
  id: string;
  label: string;
  category: bal_QualityCategory;
  ops: bal_DegradationOp[];
}

function bal_clamp8(bal_value: number): number {
  return bal_value < 0 ? 0 : bal_value > 255 ? 255 : bal_value;
}

function bal_lcg(bal_seed: number): () => number {
  let bal_state = bal_seed >>> 0;
  return () => {
    bal_state = (bal_state * 1664525 + 1013904223) >>> 0;
    return bal_state / 4294967296;
  };
}

export function bal_apply_brightness(
  bal_image: bal_SyntheticImage,
  bal_delta: number
): bal_SyntheticImage {
  const bal_out = new Uint8ClampedArray(bal_image.data.length);
  for (let bal_i = 0; bal_i < bal_image.data.length; bal_i += 4) {
    const bal_value = bal_clamp8(bal_image.data[bal_i] + bal_delta);
    bal_out[bal_i] = bal_value;
    bal_out[bal_i + 1] = bal_value;
    bal_out[bal_i + 2] = bal_value;
    bal_out[bal_i + 3] = 255;
  }
  return { data: bal_out, width: bal_image.width, height: bal_image.height };
}

export function bal_apply_contrast(
  bal_image: bal_SyntheticImage,
  bal_scale: number
): bal_SyntheticImage {
  const bal_out = new Uint8ClampedArray(bal_image.data.length);
  for (let bal_i = 0; bal_i < bal_image.data.length; bal_i += 4) {
    const bal_value = bal_clamp8((bal_image.data[bal_i] - 128) * bal_scale + 128);
    bal_out[bal_i] = bal_value;
    bal_out[bal_i + 1] = bal_value;
    bal_out[bal_i + 2] = bal_value;
    bal_out[bal_i + 3] = 255;
  }
  return { data: bal_out, width: bal_image.width, height: bal_image.height };
}

export function bal_apply_noise(
  bal_image: bal_SyntheticImage,
  bal_amplitude: number,
  bal_seed: number
): bal_SyntheticImage {
  const bal_random = bal_lcg(bal_seed);
  const bal_out = new Uint8ClampedArray(bal_image.data.length);
  for (let bal_i = 0; bal_i < bal_image.data.length; bal_i += 4) {
    const bal_value = bal_clamp8(bal_image.data[bal_i] + (bal_random() - 0.5) * 2 * bal_amplitude);
    bal_out[bal_i] = bal_value;
    bal_out[bal_i + 1] = bal_value;
    bal_out[bal_i + 2] = bal_value;
    bal_out[bal_i + 3] = 255;
  }
  return { data: bal_out, width: bal_image.width, height: bal_image.height };
}

export function bal_apply_quantize(
  bal_image: bal_SyntheticImage,
  bal_levels: number
): bal_SyntheticImage {
  const bal_step = 255 / Math.max(2, bal_levels - 1);
  const bal_out = new Uint8ClampedArray(bal_image.data.length);
  for (let bal_i = 0; bal_i < bal_image.data.length; bal_i += 4) {
    const bal_value = bal_clamp8(Math.round(bal_image.data[bal_i] / bal_step) * bal_step);
    bal_out[bal_i] = bal_value;
    bal_out[bal_i + 1] = bal_value;
    bal_out[bal_i + 2] = bal_value;
    bal_out[bal_i + 3] = 255;
  }
  return { data: bal_out, width: bal_image.width, height: bal_image.height };
}

function bal_solve_linear8(bal_matrix: number[], bal_rhs: number[]): number[] {
  const bal_a = bal_matrix.slice();
  const bal_b = bal_rhs.slice();
  for (let bal_col = 0; bal_col < 8; bal_col++) {
    let bal_pivot = bal_col;
    for (let bal_row = bal_col + 1; bal_row < 8; bal_row++) {
      if (Math.abs(bal_a[bal_row * 8 + bal_col]) > Math.abs(bal_a[bal_pivot * 8 + bal_col])) bal_pivot = bal_row;
    }
    if (bal_pivot !== bal_col) {
      for (let bal_k = 0; bal_k < 8; bal_k++) {
        const bal_tmp = bal_a[bal_col * 8 + bal_k];
        bal_a[bal_col * 8 + bal_k] = bal_a[bal_pivot * 8 + bal_k];
        bal_a[bal_pivot * 8 + bal_k] = bal_tmp;
      }
      const bal_tv = bal_b[bal_col];
      bal_b[bal_col] = bal_b[bal_pivot];
      bal_b[bal_pivot] = bal_tv;
    }
    const bal_diag = bal_a[bal_col * 8 + bal_col];
    if (Math.abs(bal_diag) < 1e-12) continue;
    for (let bal_row = 0; bal_row < 8; bal_row++) {
      if (bal_row === bal_col) continue;
      const bal_factor = bal_a[bal_row * 8 + bal_col] / bal_diag;
      if (bal_factor === 0) continue;
      for (let bal_k = bal_col; bal_k < 8; bal_k++) bal_a[bal_row * 8 + bal_k] -= bal_factor * bal_a[bal_col * 8 + bal_k];
      bal_b[bal_row] -= bal_factor * bal_b[bal_col];
    }
  }
  return bal_b.map((bal_v, bal_i) => (Math.abs(bal_a[bal_i * 8 + bal_i]) < 1e-12 ? 0 : bal_v / bal_a[bal_i * 8 + bal_i]));
}

export function bal_homography_from_quads(
  bal_src: bal_Point2[],
  bal_dst: bal_Point2[]
): number[] {
  const bal_matrix: number[] = [];
  const bal_rhs: number[] = [];
  for (let bal_i = 0; bal_i < 4; bal_i++) {
    const [bal_x, bal_y] = bal_src[bal_i];
    const [bal_u, bal_v] = bal_dst[bal_i];
    bal_matrix.push(bal_x, bal_y, 1, 0, 0, 0, -bal_u * bal_x, -bal_u * bal_y);
    bal_rhs.push(bal_u);
    bal_matrix.push(0, 0, 0, bal_x, bal_y, 1, -bal_v * bal_x, -bal_v * bal_y);
    bal_rhs.push(bal_v);
  }
  const bal_h = bal_solve_linear8(bal_matrix, bal_rhs);
  return [bal_h[0], bal_h[1], bal_h[2], bal_h[3], bal_h[4], bal_h[5], bal_h[6], bal_h[7], 1];
}

function bal_apply_homography(
  bal_h: number[],
  bal_x: number,
  bal_y: number
): bal_Point2 {
  const bal_w = bal_h[6] * bal_x + bal_h[7] * bal_y + bal_h[8];
  return [(bal_h[0] * bal_x + bal_h[1] * bal_y + bal_h[2]) / bal_w, (bal_h[3] * bal_x + bal_h[4] * bal_y + bal_h[5]) / bal_w];
}

export function bal_warp_perspective(
  bal_image: bal_SyntheticImage,
  bal_shifts: { tl: bal_Point2; tr: bal_Point2; br: bal_Point2; bl: bal_Point2 }
): bal_SyntheticImage {
  const bal_w = bal_image.width;
  const bal_h = bal_image.height;
  const bal_corners: bal_Point2[] = [
    [0, 0],
    [bal_w - 1, 0],
    [bal_w - 1, bal_h - 1],
    [0, bal_h - 1]
  ];
  const bal_quad: bal_Point2[] = [
    [bal_shifts.tl[0], bal_shifts.tl[1]],
    [bal_w - 1 + bal_shifts.tr[0], bal_shifts.tr[1]],
    [bal_w - 1 + bal_shifts.br[0], bal_h - 1 + bal_shifts.br[1]],
    [bal_shifts.bl[0], bal_h - 1 + bal_shifts.bl[1]]
  ];
  const bal_inverse = bal_homography_from_quads(bal_quad, bal_corners);
  const bal_out = new Uint8ClampedArray(bal_w * bal_h * 4).fill(255);
  for (let bal_y = 0; bal_y < bal_h; bal_y++) {
    for (let bal_x = 0; bal_x < bal_w; bal_x++) {
      const [bal_sx, bal_sy] = bal_apply_homography(bal_inverse, bal_x, bal_y);
      if (bal_sx < 0 || bal_sy < 0 || bal_sx > bal_w - 1 || bal_sy > bal_h - 1) continue;
      const bal_x0 = Math.floor(bal_sx);
      const bal_y0 = Math.floor(bal_sy);
      const bal_x1 = Math.min(bal_x0 + 1, bal_w - 1);
      const bal_y1 = Math.min(bal_y0 + 1, bal_h - 1);
      const bal_fx = bal_sx - bal_x0;
      const bal_fy = bal_sy - bal_y0;
      const bal_index = (bal_y * bal_w + bal_x) * 4;
      const bal_g00 = bal_image.data[(bal_y0 * bal_w + bal_x0) * 4];
      const bal_g10 = bal_image.data[(bal_y0 * bal_w + bal_x1) * 4];
      const bal_g01 = bal_image.data[(bal_y1 * bal_w + bal_x0) * 4];
      const bal_g11 = bal_image.data[(bal_y1 * bal_w + bal_x1) * 4];
      const bal_value =
        bal_g00 * (1 - bal_fx) * (1 - bal_fy) +
        bal_g10 * bal_fx * (1 - bal_fy) +
        bal_g01 * (1 - bal_fx) * bal_fy +
        bal_g11 * bal_fx * bal_fy;
      bal_out[bal_index] = bal_value;
      bal_out[bal_index + 1] = bal_value;
      bal_out[bal_index + 2] = bal_value;
      bal_out[bal_index + 3] = 255;
    }
  }
  return { data: bal_out, width: bal_w, height: bal_h };
}

export function bal_apply_illumination(
  bal_image: bal_SyntheticImage,
  bal_gradient: number,
  bal_angle_deg: number,
  bal_vignette: number
): bal_SyntheticImage {
  const bal_w = bal_image.width;
  const bal_h = bal_image.height;
  const bal_out = new Uint8ClampedArray(bal_image.data.length);
  const bal_dir_x = Math.cos((bal_angle_deg * Math.PI) / 180);
  const bal_dir_y = Math.sin((bal_angle_deg * Math.PI) / 180);
  const bal_center_x = bal_w / 2;
  const bal_center_y = bal_h / 2;
  const bal_max_r = Math.hypot(bal_center_x, bal_center_y);
  for (let bal_y = 0; bal_y < bal_h; bal_y++) {
    for (let bal_x = 0; bal_x < bal_w; bal_x++) {
      const bal_t = ((bal_x - bal_w / 2) * bal_dir_x + (bal_y - bal_h / 2) * bal_dir_y) / (bal_w / 2);
      const bal_v = 1 - bal_vignette * Math.pow(Math.hypot(bal_x - bal_center_x, bal_y - bal_center_y) / bal_max_r, 2);
      const bal_value = bal_clamp8((bal_image.data[(bal_y * bal_w + bal_x) * 4] - bal_gradient * bal_t) * bal_v);
      const bal_index = (bal_y * bal_w + bal_x) * 4;
      bal_out[bal_index] = bal_value;
      bal_out[bal_index + 1] = bal_value;
      bal_out[bal_index + 2] = bal_value;
      bal_out[bal_index + 3] = 255;
    }
  }
  return { data: bal_out, width: bal_w, height: bal_h };
}

export function bal_crop_image(
  bal_image: bal_SyntheticImage,
  bal_left: number,
  bal_top: number,
  bal_right: number,
  bal_bottom: number
): bal_SyntheticImage {
  const bal_x0 = Math.max(0, Math.round(bal_left));
  const bal_y0 = Math.max(0, Math.round(bal_top));
  const bal_x1 = Math.min(bal_image.width, bal_image.width - Math.round(bal_right));
  const bal_y1 = Math.min(bal_image.height, bal_image.height - Math.round(bal_bottom));
  const bal_w = Math.max(1, bal_x1 - bal_x0);
  const bal_h = Math.max(1, bal_y1 - bal_y0);
  const bal_out = new Uint8ClampedArray(bal_w * bal_h * 4).fill(255);
  for (let bal_y = 0; bal_y < bal_h; bal_y++) {
    for (let bal_x = 0; bal_x < bal_w; bal_x++) {
      const bal_src = ((bal_y0 + bal_y) * bal_image.width + bal_x0 + bal_x) * 4;
      const bal_dst = (bal_y * bal_w + bal_x) * 4;
      bal_out[bal_dst] = bal_image.data[bal_src];
      bal_out[bal_dst + 1] = bal_image.data[bal_src + 1];
      bal_out[bal_dst + 2] = bal_image.data[bal_src + 2];
      bal_out[bal_dst + 3] = 255;
    }
  }
  return { data: bal_out, width: bal_w, height: bal_h };
}

export function bal_apply_glare(
  bal_image: bal_SyntheticImage,
  bal_spots: { cx: number; cy: number; r: number }[]
): bal_SyntheticImage {
  const bal_out = new Uint8ClampedArray(bal_image.data);
  for (const bal_spot of bal_spots) {
    for (
      let bal_y = Math.round(bal_spot.cy - bal_spot.r);
      bal_y <= Math.round(bal_spot.cy + bal_spot.r);
      bal_y++
    ) {
      for (
        let bal_x = Math.round(bal_spot.cx - bal_spot.r);
        bal_x <= Math.round(bal_spot.cx + bal_spot.r);
        bal_x++
      ) {
        if (bal_x < 0 || bal_y < 0 || bal_x >= bal_image.width || bal_y >= bal_image.height) continue;
        const bal_d = Math.hypot(bal_x - bal_spot.cx, bal_y - bal_spot.cy) / bal_spot.r;
        if (bal_d > 1) continue;
        const bal_index = (bal_y * bal_image.width + bal_x) * 4;
        const bal_value = bal_out[bal_index] + (255 - bal_out[bal_index]) * (1 - bal_d);
        bal_out[bal_index] = bal_value;
        bal_out[bal_index + 1] = bal_value;
        bal_out[bal_index + 2] = bal_value;
      }
    }
  }
  return { data: bal_out, width: bal_image.width, height: bal_image.height };
}

export function bal_apply_degradations(
  bal_image: bal_SyntheticImage,
  bal_ops: bal_DegradationOp[]
): bal_SyntheticImage {
  let bal_current = bal_image;
  for (const bal_op of bal_ops) {
    switch (bal_op.op) {
      case 'brightness':
        bal_current = bal_apply_brightness(bal_current, bal_op.delta);
        break;
      case 'contrast':
        bal_current = bal_apply_contrast(bal_current, bal_op.scale);
        break;
      case 'noise':
        bal_current = bal_apply_noise(bal_current, bal_op.amplitude, bal_op.seed);
        break;
      case 'blur':
        if (bal_op.radius > 0) bal_current = bal_box_blur(bal_current, bal_op.radius);
        break;
      case 'perspective':
        bal_current = bal_warp_perspective(bal_current, bal_op.shifts);
        break;
      case 'illumination':
        bal_current = bal_apply_illumination(bal_current, bal_op.gradient, bal_op.angleDeg, bal_op.vignette);
        break;
      case 'crop':
        bal_current = bal_crop_image(bal_current, bal_op.left, bal_op.top, bal_op.right, bal_op.bottom);
        break;
      case 'quantize':
        bal_current = bal_apply_quantize(bal_current, bal_op.levels);
        break;
      case 'glare':
        bal_current = bal_apply_glare(bal_current, bal_op.spots);
        break;
      case 'rotate':
        if (bal_op.degrees !== 0) bal_current = bal_rotate_copy(bal_current, bal_op.degrees);
        break;
    }
  }
  return bal_current;
}

function bal_rotate_copy(
  bal_image: bal_SyntheticImage,
  bal_degrees: 90 | 180 | 270
): bal_SyntheticImage {
  if (bal_degrees === 180) {
    const bal_out = new Uint8ClampedArray(bal_image.data.length);
    for (let bal_y = 0; bal_y < bal_image.height; bal_y++) {
      for (let bal_x = 0; bal_x < bal_image.width; bal_x++) {
        const bal_src = ((bal_image.height - 1 - bal_y) * bal_image.width + (bal_image.width - 1 - bal_x)) * 4;
        const bal_dst = (bal_y * bal_image.width + bal_x) * 4;
        bal_out[bal_dst] = bal_image.data[bal_src];
        bal_out[bal_dst + 1] = bal_image.data[bal_src + 1];
        bal_out[bal_dst + 2] = bal_image.data[bal_src + 2];
      }
    }
    return { data: bal_out, width: bal_image.width, height: bal_image.height };
  }
  const bal_swap = bal_degrees === 90;
  const bal_w = bal_swap ? bal_image.height : bal_image.width;
  const bal_h = bal_swap ? bal_image.width : bal_image.height;
  const bal_out = new Uint8ClampedArray(bal_w * bal_h * 4);
  for (let bal_y = 0; bal_y < bal_h; bal_y++) {
    for (let bal_x = 0; bal_x < bal_w; bal_x++) {
      let bal_src_x: number;
      let bal_src_y: number;
      if (bal_degrees === 90) {
        bal_src_x = bal_x;
        bal_src_y = bal_image.height - 1 - bal_y;
      } else {
        bal_src_x = bal_image.width - 1 - bal_x;
        bal_src_y = bal_y;
      }
      const bal_src = (bal_src_y * bal_image.width + bal_src_x) * 4;
      const bal_dst = (bal_y * bal_w + bal_x) * 4;
      bal_out[bal_dst] = bal_image.data[bal_src];
      bal_out[bal_dst + 1] = bal_image.data[bal_src + 1];
      bal_out[bal_dst + 2] = bal_image.data[bal_src + 2];
      bal_out[bal_dst + 3] = 255;
    }
  }
  return { data: bal_out, width: bal_w, height: bal_h };
}

export const bal_CAPTURE_PRESETS: bal_CapturePreset[] = [
  { id: 'straight', label: 'Straight overhead', category: 'good', ops: [] },
  {
    id: 'straight-compressed',
    label: 'Straight capture, heavy camera compression',
    category: 'good',
    ops: [{ op: 'quantize', levels: 24 }, { op: 'noise', amplitude: 3, seed: 101 }]
  },
  {
    id: 'tilt-left',
    label: 'Slight left perspective',
    category: 'acceptable',
    ops: [{ op: 'perspective', shifts: { tl: [14, 6], tr: [0, 0], br: [0, 0], bl: [10, -4] } }]
  },
  {
    id: 'tilt-right',
    label: 'Slight right perspective',
    category: 'acceptable',
    ops: [{ op: 'perspective', shifts: { tl: [0, 0], tr: [-14, 8], br: [-8, 0], bl: [0, -2] } }]
  },
  {
    id: 'tilt-up',
    label: 'Slight top perspective',
    category: 'acceptable',
    ops: [{ op: 'perspective', shifts: { tl: [4, 10], tr: [-4, 12], br: [0, 0], bl: [0, 0] } }]
  },
  {
    id: 'tilt-down',
    label: 'Slight bottom perspective',
    category: 'acceptable',
    ops: [{ op: 'perspective', shifts: { tl: [0, 0], tr: [0, 0], br: [-5, -12], bl: [5, -10] } }]
  },
  {
    id: 'rotated-slight',
    label: 'Mild rotation',
    category: 'acceptable',
    ops: [{ op: 'perspective', shifts: { tl: [10, 2], tr: [-8, 10], br: [-10, -4], bl: [8, -8] } }]
  },
  {
    id: 'farther',
    label: 'Farther capture distance (lower effective resolution)',
    category: 'acceptable',
    ops: [{ op: 'blur', radius: 1 }, { op: 'quantize', levels: 40 }]
  },
  {
    id: 'closer',
    label: 'Closer capture (partial page crop)',
    category: 'poor',
    ops: [{ op: 'crop', left: 30, top: 40, right: 25, bottom: 35 }]
  },
  {
    id: 'indoor-dim',
    label: 'Indoor room light, slightly dim',
    category: 'acceptable',
    ops: [{ op: 'brightness', delta: -18 }, { op: 'noise', amplitude: 5, seed: 202 }]
  },
  {
    id: 'daylight-bright',
    label: 'Bright daylight',
    category: 'good',
    ops: [{ op: 'brightness', delta: 10 }, { op: 'contrast', scale: 1.05 }]
  },
  {
    id: 'shadow-corner',
    label: 'Mild corner shadow',
    category: 'acceptable',
    ops: [{ op: 'illumination', gradient: 26, angleDeg: 35, vignette: 0.08 }]
  },
  {
    id: 'glare-bubble',
    label: 'Glare over the answer column',
    category: 'poor',
    ops: [{ op: 'glare', spots: [{ cx: 620, cy: 500, r: 70 }] }]
  },
  {
    id: 'uneven-light',
    label: 'Uneven illumination across the page',
    category: 'poor',
    ops: [{ op: 'illumination', gradient: 40, angleDeg: 120, vignette: 0.14 }, { op: 'noise', amplitude: 4, seed: 303 }]
  },
  {
    id: 'slight-blur',
    label: 'Slightly blurred capture',
    category: 'acceptable',
    ops: [{ op: 'blur', radius: 2 }]
  },
  {
    id: 'heavy-blur',
    label: 'Heavily blurred capture',
    category: 'poor',
    ops: [{ op: 'blur', radius: 4 }]
  },
  {
    id: 'wrinkled',
    label: 'Slightly wrinkled paper (uneven shade plus softness)',
    category: 'poor',
    ops: [
      { op: 'illumination', gradient: 18, angleDeg: 70, vignette: 0.1 },
      { op: 'blur', radius: 1 },
      { op: 'noise', amplitude: 6, seed: 404 }
    ]
  },
  {
    id: 'not-flat',
    label: 'Page not perfectly flat (mixed mild warp and shade)',
    category: 'acceptable',
    ops: [
      { op: 'perspective', shifts: { tl: [6, 3], tr: [-6, 5], br: [-4, -6], bl: [5, -4] } },
      { op: 'illumination', gradient: 12, angleDeg: 100, vignette: 0.06 }
    ]
  },
  {
    id: 'cropped-marker',
    label: 'Partial crop cutting into the top marker band',
    category: 'unusable',
    ops: [{ op: 'crop', left: 0, top: 26, right: 0, bottom: 0 }]
  },
  {
    id: 'strong-perspective',
    label: 'Strong perspective tilt',
    category: 'poor',
    ops: [{ op: 'perspective', shifts: { tl: [40, 22], tr: [-30, 30], br: [-20, -18], bl: [30, -26] } }]
  }
];
