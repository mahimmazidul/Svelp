import type { AnswerRegionKind } from '../print/print_layout';
import type { AnswerMarkerType } from '../../models/item_catalog';
import { bal_box_blur } from '../scan/scan_fixtures';

export interface bal_ReadingRegion {
  itemId: string;
  variableName: string | null;
  itemType: string;
  kind: AnswerRegionKind | 'choice' | 'matrix' | 'consent' | 'text' | 'number' | 'date';
  selection: 'single' | 'multiple' | 'written';
  markerType: AnswerMarkerType;
  optionId: string | null;
  optionCode: string | null;
  rowId: string | null;
  columnId: string | null;
  rectMm: { x: number; y: number; width: number; height: number };
}

export interface bal_SyntheticPage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export type bal_MarkStyle = 'fill' | 'tick' | 'cross' | 'slash' | 'partial' | 'faint' | 'pencil';

export interface bal_MarkSpec {
  regionIndex: number;
  style: bal_MarkStyle;
}

export interface bal_PageEffects {
  exposureShift?: number;
  shadowStrength?: number;
  blurRadius?: number;
  glareSpots?: { cx: number; cy: number; r: number }[];
  noiseSeed?: number;
  noiseAmount?: number;
}

function bal_lcg(bal_seed: number): () => number {
  let bal_state = bal_seed >>> 0;
  return () => {
    bal_state = (bal_state * 1664525 + 1013904223) >>> 0;
    return bal_state / 4294967296;
  };
}

function bal_fill_ellipse(
  bal_page: bal_SyntheticPage,
  bal_cx: number,
  bal_cy: number,
  bal_rx: number,
  bal_ry: number,
  bal_value: number
): void {
  for (let bal_y = Math.round(bal_cy - bal_ry) - 1; bal_y <= Math.round(bal_cy + bal_ry) + 1; bal_y++) {
    for (let bal_x = Math.round(bal_cx - bal_rx) - 1; bal_x <= Math.round(bal_cx + bal_rx) + 1; bal_x++) {
      const bal_dx = (bal_x - bal_cx) / bal_rx;
      const bal_dy = (bal_y - bal_cy) / bal_ry;
      if (bal_dx * bal_dx + bal_dy * bal_dy > 1) continue;
      if (bal_x < 0 || bal_y < 0 || bal_x >= bal_page.width || bal_y >= bal_page.height) continue;
      const bal_index = (bal_y * bal_page.width + bal_x) * 4;
      bal_page.data[bal_index] = bal_value;
      bal_page.data[bal_index + 1] = bal_value;
      bal_page.data[bal_index + 2] = bal_value;
    }
  }
}

function bal_stroke_line(
  bal_page: bal_SyntheticPage,
  bal_x0: number,
  bal_y0: number,
  bal_x1: number,
  bal_y1: number,
  bal_width: number,
  bal_value: number
): void {
  const bal_steps = Math.max(2, Math.ceil(Math.hypot(bal_x1 - bal_x0, bal_y1 - bal_y0)));
  for (let bal_i = 0; bal_i <= bal_steps; bal_i++) {
    const bal_t = bal_i / bal_steps;
    const bal_x = bal_x0 + (bal_x1 - bal_x0) * bal_t;
    const bal_y = bal_y0 + (bal_y1 - bal_y0) * bal_t;
    bal_fill_ellipse(bal_page, bal_x, bal_y, bal_width / 2, bal_width / 2, bal_value);
  }
}

export function bal_marker_radius_px(bal_region: bal_ReadingRegion, bal_ppm: number): number {
  const bal_side = Math.min(bal_region.rectMm.width, bal_region.rectMm.height);
  return (bal_side * 0.63 * bal_ppm) / 2;
}

export function bal_render_blank_instrument(
  bal_regions: bal_ReadingRegion[],
  bal_ppm: number,
  bal_page_width_mm = 210,
  bal_page_height_mm = 297
): bal_SyntheticPage {
  const bal_width = Math.round(bal_page_width_mm * bal_ppm);
  const bal_height = Math.round(bal_page_height_mm * bal_ppm);
  const bal_page: bal_SyntheticPage = {
    data: new Uint8ClampedArray(bal_width * bal_height * 4).fill(255),
    width: bal_width,
    height: bal_height
  };
  for (const bal_region of bal_regions) {
    const bal_cx = (bal_region.rectMm.x + bal_region.rectMm.width / 2) * bal_ppm;
    const bal_cy = (bal_region.rectMm.y + bal_region.rectMm.height / 2) * bal_ppm;
    if (bal_region.markerType === 'bubble') {
      bal_stroke_circle(bal_page, bal_cx, bal_cy, bal_marker_radius_px(bal_region, bal_ppm), 1.3, 30);
    } else if (bal_region.markerType === 'checkbox') {
      const bal_half = (Math.min(bal_region.rectMm.width, bal_region.rectMm.height) * 0.45 * bal_ppm) / 2;
      bal_stroke_rect(bal_page, bal_cx - bal_half, bal_cy - bal_half, bal_half * 2, bal_half * 2, 1.3, 30);
    }
  }
  return bal_page;
}

function bal_stroke_circle(
  bal_page: bal_SyntheticPage,
  bal_cx: number,
  bal_cy: number,
  bal_r: number,
  bal_width: number,
  bal_value: number
): void {
  const bal_steps = Math.max(24, Math.ceil(bal_r * 6));
  for (let bal_i = 0; bal_i < bal_steps; bal_i++) {
    const bal_angle = (bal_i / bal_steps) * Math.PI * 2;
    bal_fill_ellipse(
      bal_page,
      bal_cx + Math.cos(bal_angle) * bal_r,
      bal_cy + Math.sin(bal_angle) * bal_r,
      bal_width / 2 + 0.4,
      bal_width / 2 + 0.4,
      bal_value
    );
  }
}

function bal_stroke_rect(
  bal_page: bal_SyntheticPage,
  bal_x: number,
  bal_y: number,
  bal_w: number,
  bal_h: number,
  bal_width: number,
  bal_value: number
): void {
  bal_stroke_line(bal_page, bal_x, bal_y, bal_x + bal_w, bal_y, bal_width, bal_value);
  bal_stroke_line(bal_page, bal_x + bal_w, bal_y, bal_x + bal_w, bal_y + bal_h, bal_width, bal_value);
  bal_stroke_line(bal_page, bal_x + bal_w, bal_y + bal_h, bal_x, bal_y + bal_h, bal_width, bal_value);
  bal_stroke_line(bal_page, bal_x, bal_y + bal_h, bal_x, bal_y, bal_width, bal_value);
}

export function bal_render_marked_scan(
  bal_blank: bal_SyntheticPage,
  bal_regions: bal_ReadingRegion[],
  bal_marks: bal_MarkSpec[],
  bal_ppm: number,
  bal_effects: bal_PageEffects = {}
): bal_SyntheticPage {
  const bal_scan: bal_SyntheticPage = {
    data: new Uint8ClampedArray(bal_blank.data),
    width: bal_blank.width,
    height: bal_blank.height
  };
  for (const bal_mark of bal_marks) {
    const bal_region = bal_regions[bal_mark.regionIndex];
    if (!bal_region) continue;
    const bal_cx = (bal_region.rectMm.x + bal_region.rectMm.width / 2) * bal_ppm;
    const bal_cy = (bal_region.rectMm.y + bal_region.rectMm.height / 2) * bal_ppm;
    const bal_r = bal_marker_radius_px(bal_region, bal_ppm);
    bal_draw_mark(bal_scan, bal_mark.style, bal_cx, bal_cy, bal_r, bal_effects.noiseSeed ?? 7);
  }
  if (bal_effects.blurRadius) {
    const bal_blurred = bal_box_blur(bal_scan, bal_effects.blurRadius);
    bal_scan.data.set(bal_blurred.data);
  }
  if (bal_effects.shadowStrength) {
    for (let bal_y = 0; bal_y < bal_scan.height; bal_y++) {
      const bal_drop = bal_effects.shadowStrength * (bal_y / bal_scan.height);
      for (let bal_x = 0; bal_x < bal_scan.width; bal_x++) {
        const bal_index = (bal_y * bal_scan.width + bal_x) * 4;
        const bal_value = Math.max(0, bal_scan.data[bal_index] - bal_drop);
        bal_scan.data[bal_index] = bal_value;
        bal_scan.data[bal_index + 1] = bal_value;
        bal_scan.data[bal_index + 2] = bal_value;
      }
    }
  }
  if (bal_effects.exposureShift) {
    for (let bal_i = 0; bal_i < bal_scan.data.length; bal_i += 4) {
      const bal_value = Math.max(0, Math.min(255, bal_scan.data[bal_i] + bal_effects.exposureShift));
      bal_scan.data[bal_i] = bal_value;
      bal_scan.data[bal_i + 1] = bal_value;
      bal_scan.data[bal_i + 2] = bal_value;
    }
  }
  for (const bal_spot of bal_effects.glareSpots ?? []) {
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
        if (bal_x < 0 || bal_y < 0 || bal_x >= bal_scan.width || bal_y >= bal_scan.height) continue;
        if (Math.hypot(bal_x - bal_spot.cx, bal_y - bal_spot.cy) > bal_spot.r) continue;
        const bal_index = (bal_y * bal_scan.width + bal_x) * 4;
        bal_scan.data[bal_index] = 255;
        bal_scan.data[bal_index + 1] = 255;
        bal_scan.data[bal_index + 2] = 255;
      }
    }
  }
  if (bal_effects.noiseAmount) {
    const bal_random = bal_lcg(bal_effects.noiseSeed ?? 11);
    for (let bal_i = 0; bal_i < bal_scan.data.length; bal_i += 4) {
      const bal_noise = (bal_random() - 0.5) * 2 * bal_effects.noiseAmount;
      const bal_value = Math.max(0, Math.min(255, bal_scan.data[bal_i] + bal_noise));
      bal_scan.data[bal_i] = bal_value;
      bal_scan.data[bal_i + 1] = bal_value;
      bal_scan.data[bal_i + 2] = bal_value;
    }
  }
  return bal_scan;
}

function bal_draw_mark(
  bal_page: bal_SyntheticPage,
  bal_style: bal_MarkStyle,
  bal_cx: number,
  bal_cy: number,
  bal_r: number,
  bal_seed: number
): void {
  if (bal_style === 'fill') {
    bal_fill_ellipse(bal_page, bal_cx, bal_cy, bal_r - 1.5, bal_r - 1.5, 25);
  } else if (bal_style === 'tick') {
    bal_stroke_line(bal_page, bal_cx - bal_r * 0.6, bal_cy + bal_r * 0.05, bal_cx - bal_r * 0.15, bal_cy + bal_r * 0.5, 2.6, 40);
    bal_stroke_line(bal_page, bal_cx - bal_r * 0.15, bal_cy + bal_r * 0.5, bal_cx + bal_r * 0.65, bal_cy - bal_r * 0.55, 2.6, 40);
  } else if (bal_style === 'cross') {
    bal_stroke_line(bal_page, bal_cx - bal_r * 0.65, bal_cy - bal_r * 0.65, bal_cx + bal_r * 0.65, bal_cy + bal_r * 0.65, 2.6, 40);
    bal_stroke_line(bal_page, bal_cx + bal_r * 0.65, bal_cy - bal_r * 0.65, bal_cx - bal_r * 0.65, bal_cy + bal_r * 0.65, 2.6, 40);
  } else if (bal_style === 'slash') {
    bal_stroke_line(bal_page, bal_cx - bal_r * 0.7, bal_cy + bal_r * 0.7, bal_cx + bal_r * 0.7, bal_cy - bal_r * 0.7, 2.6, 40);
  } else if (bal_style === 'partial') {
    bal_fill_ellipse(bal_page, bal_cx + bal_r * 0.2, bal_cy - bal_r * 0.15, bal_r * 0.5, bal_r * 0.5, 60);
  } else if (bal_style === 'faint') {
    bal_fill_ellipse(bal_page, bal_cx, bal_cy, bal_r - 1.5, bal_r - 1.5, 168);
  } else if (bal_style === 'pencil') {
    bal_fill_ellipse(bal_page, bal_cx, bal_cy, bal_r - 1.5, bal_r - 1.5, 208);
    const bal_random = bal_lcg(bal_seed + 31);
    for (let bal_i = 0; bal_i < 220; bal_i++) {
      const bal_angle = bal_random() * Math.PI * 2;
      const bal_distance = bal_random() * (bal_r - 1.5);
      bal_fill_ellipse(
        bal_page,
        bal_cx + Math.cos(bal_angle) * bal_distance,
        bal_cy + Math.sin(bal_angle) * bal_distance,
        1.1,
        1.1,
        bal_random() > 0.5 ? 176 : 232
      );
    }
  }
}
