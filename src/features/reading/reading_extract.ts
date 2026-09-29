import type { bal_SyntheticPage } from './reading_fixtures';
import { bal_marker_radius_px, type bal_ReadingRegion } from './reading_fixtures';

export interface bal_RegionCrop {
  scan: bal_SyntheticPage;
  blank: bal_SyntheticPage;
}

function bal_percentile(bal_values: Uint8Array, bal_fraction: number): number {
  const bal_sorted = Uint8Array.from(bal_values).sort();
  const bal_index = Math.min(bal_sorted.length - 1, Math.floor(bal_sorted.length * bal_fraction));
  return bal_sorted[bal_index];
}

export function bal_crop_region(
  bal_image: bal_SyntheticPage,
  bal_region: bal_ReadingRegion,
  bal_ppm: number,
  bal_margin_mm: number
): bal_SyntheticPage {
  const bal_x0 = Math.round((bal_region.rectMm.x - bal_margin_mm) * bal_ppm);
  const bal_y0 = Math.round((bal_region.rectMm.y - bal_margin_mm) * bal_ppm);
  const bal_width = Math.round((bal_region.rectMm.width + bal_margin_mm * 2) * bal_ppm);
  const bal_height = Math.round((bal_region.rectMm.height + bal_margin_mm * 2) * bal_ppm);
  const bal_out: bal_SyntheticPage = {
    data: new Uint8ClampedArray(bal_width * bal_height * 4).fill(255),
    width: bal_width,
    height: bal_height
  };
  for (let bal_y = 0; bal_y < bal_height; bal_y++) {
    const bal_sy = bal_y0 + bal_y;
    if (bal_sy < 0 || bal_sy >= bal_image.height) continue;
    for (let bal_x = 0; bal_x < bal_width; bal_x++) {
      const bal_sx = bal_x0 + bal_x;
      if (bal_sx < 0 || bal_sx >= bal_image.width) continue;
      const bal_from = (bal_sy * bal_image.width + bal_sx) * 4;
      const bal_to = (bal_y * bal_width + bal_x) * 4;
      bal_out.data[bal_to] = bal_image.data[bal_from];
      bal_out.data[bal_to + 1] = bal_image.data[bal_from + 1];
      bal_out.data[bal_to + 2] = bal_image.data[bal_from + 2];
      bal_out.data[bal_to + 3] = 255;
    }
  }
  return bal_out;
}

export interface bal_RegionFeatures {
  addedRatio: number;
  centerRatio: number;
  strokeArea: number;
  strokeDarkArea: number;
  meanInkDepth: number;
  ringNoise: number;
  glareRatio: number;
  darknessDepth: number;
  blankInkRatio: number;
  componentCount: number;
}

function bal_gray_of(bal_image: bal_SyntheticPage): Uint8Array {
  const bal_gray = new Uint8Array(bal_image.width * bal_image.height);
  for (let bal_i = 0, bal_j = 0; bal_i < bal_image.data.length; bal_i += 4, bal_j++) {
    bal_gray[bal_j] = Math.round(
      0.299 * bal_image.data[bal_i] + 0.587 * bal_image.data[bal_i + 1] + 0.114 * bal_image.data[bal_i + 2]
    );
  }
  return bal_gray;
}

function bal_interior_bounds(bal_width: number, bal_height: number, bal_scale: number) {
  const bal_cx = bal_width / 2;
  const bal_cy = bal_height / 2;
  const bal_rx = (bal_width / 2) * bal_scale;
  const bal_ry = (bal_height / 2) * bal_scale;
  return { bal_cx, bal_cy, bal_rx, bal_ry };
}

export function bal_extract_region_features(
  bal_scan_crop: bal_SyntheticPage,
  bal_blank_crop: bal_SyntheticPage,
  bal_delta_gray: number
): bal_RegionFeatures {
  const bal_scan_gray = bal_gray_of(bal_scan_crop);
  const bal_blank_gray = bal_gray_of(bal_blank_crop);
  const bal_bg_scan = bal_percentile(bal_scan_gray, 0.85);
  const bal_bg_blank = bal_percentile(bal_blank_gray, 0.85);
  const bal_ink_scan_threshold = bal_bg_scan - bal_delta_gray;
  const bal_ink_blank_threshold = bal_bg_blank - bal_delta_gray;
  const bal_width = bal_scan_crop.width;
  const bal_height = bal_scan_crop.height;
  const bal_pixels = bal_width * bal_height;

  const bal_added = new Uint8Array(bal_pixels);
  const bal_weights = new Float32Array(bal_pixels);
  let bal_blank_ink_total = 0;
  let bal_missing_ink = 0;
  for (let bal_i = 0; bal_i < bal_pixels; bal_i++) {
    const bal_blank_is_ink = bal_blank_gray[bal_i] < bal_ink_blank_threshold;
    if (bal_blank_is_ink) bal_blank_ink_total += 1;
    if (bal_blank_is_ink && bal_scan_gray[bal_i] >= bal_bg_scan - 12) bal_missing_ink += 1;
    if (bal_scan_gray[bal_i] >= bal_ink_scan_threshold) continue;
    if (bal_blank_is_ink) continue;
    bal_added[bal_i] = 1;
    bal_weights[bal_i] = Math.min(1, (bal_bg_scan - bal_scan_gray[bal_i]) / Math.max(1, bal_bg_scan - 60));
  }

  const { bal_cx, bal_cy, bal_rx: bal_orx, bal_ry: bal_ory } = bal_interior_bounds(bal_width, bal_height, 0.46);
  const bal_center = bal_interior_bounds(bal_width, bal_height, 0.26);
  const bal_ring = bal_interior_bounds(bal_width, bal_height, 0.95);
  let bal_interior_area = 0;
  let bal_center_area = 0;
  let bal_interior_weighted = 0;
  let bal_center_weighted = 0;
  let bal_ring_area = 0;
  let bal_ring_weighted = 0;
  let bal_blank_ink = 0;
  for (let bal_y = 0; bal_y < bal_height; bal_y++) {
    for (let bal_x = 0; bal_x < bal_width; bal_x++) {
      const bal_index = bal_y * bal_width + bal_x;
      const bal_dx = (bal_x - bal_cx) / bal_orx;
      const bal_dy = (bal_y - bal_cy) / bal_ory;
      const bal_rdx = (bal_x - bal_cx) / bal_ring.bal_rx;
      const bal_rdy = (bal_y - bal_cy) / bal_ring.bal_ry;
      if (bal_dx * bal_dx + bal_dy * bal_dy > 1) continue;
      bal_interior_area += 1;
      bal_interior_weighted += bal_weights[bal_index];
      if (bal_blank_gray[bal_index] < bal_ink_blank_threshold) bal_blank_ink += 1;
      const bal_cdx = (bal_x - bal_center.bal_cx) / bal_center.bal_rx;
      const bal_cdy = (bal_y - bal_center.bal_cy) / bal_center.bal_ry;
      if (bal_cdx * bal_cdx + bal_cdy * bal_cdy > 1) continue;
      bal_center_area += 1;
      bal_center_weighted += bal_weights[bal_index];
      if (bal_rdx * bal_rdx + bal_rdy * bal_rdy <= 1) continue;
      bal_ring_area += 1;
      bal_ring_weighted += bal_weights[bal_index];
    }
  }

  let bal_ink_weight_sum = 0;
  let bal_ink_pixel_count = 0;
  for (let bal_i = 0; bal_i < bal_pixels; bal_i++) {
    if (bal_added[bal_i] !== 1) continue;
    bal_ink_weight_sum += bal_weights[bal_i];
    bal_ink_pixel_count += 1;
  }
  const bal_labels = new Int32Array(bal_pixels).fill(-1);
  const bal_stack: number[] = [];
  let bal_component_count = 0;
  let bal_stroke_area = 0;
  let bal_stroke_dark_area = 0;
  for (let bal_start = 0; bal_start < bal_pixels; bal_start++) {
    if (bal_added[bal_start] !== 1 || bal_labels[bal_start] !== -1) continue;
    bal_stack.length = 0;
    bal_stack.push(bal_start);
    bal_labels[bal_start] = bal_component_count;
    let bal_size = 0;
    let bal_dark_size = 0;
    while (bal_stack.length > 0) {
      const bal_index = bal_stack.pop() as number;
      bal_size += 1;
      if (bal_weights[bal_index] >= 0.6) bal_dark_size += 1;
      const bal_x = bal_index % bal_width;
      const bal_y = (bal_index - bal_x) / bal_width;
      if (bal_x > 0 && bal_added[bal_index - 1] === 1 && bal_labels[bal_index - 1] === -1) {
        bal_labels[bal_index - 1] = bal_component_count;
        bal_stack.push(bal_index - 1);
      }
      if (bal_x < bal_width - 1 && bal_added[bal_index + 1] === 1 && bal_labels[bal_index + 1] === -1) {
        bal_labels[bal_index + 1] = bal_component_count;
        bal_stack.push(bal_index + 1);
      }
      if (bal_y > 0 && bal_added[bal_index - bal_width] === 1 && bal_labels[bal_index - bal_width] === -1) {
        bal_labels[bal_index - bal_width] = bal_component_count;
        bal_stack.push(bal_index - bal_width);
      }
      if (bal_y < bal_height - 1 && bal_added[bal_index + bal_width] === 1 && bal_labels[bal_index + bal_width] === -1) {
        bal_labels[bal_index + bal_width] = bal_component_count;
        bal_stack.push(bal_index + bal_width);
      }
    }
    bal_component_count += 1;
    if (bal_size > bal_stroke_area) {
      bal_stroke_area = bal_size;
      bal_stroke_dark_area = bal_dark_size;
    }
  }

  return {
    addedRatio: bal_interior_area === 0 ? 0 : bal_interior_weighted / bal_interior_area,
    centerRatio: bal_center_area === 0 ? 0 : bal_center_weighted / bal_center_area,
    strokeArea: bal_stroke_area,
    strokeDarkArea: bal_stroke_dark_area,
    meanInkDepth: bal_ink_pixel_count === 0 ? 0 : bal_ink_weight_sum / bal_ink_pixel_count,
    ringNoise: bal_ring_area === 0 ? 0 : bal_ring_weighted / bal_ring_area,
    glareRatio: bal_blank_ink_total === 0 ? 0 : bal_missing_ink / bal_blank_ink_total,
    darknessDepth:
      bal_interior_weighted === 0 ? 0 : Math.min(1, bal_interior_weighted / Math.max(1, bal_interior_area * 0.02)),
    blankInkRatio: bal_interior_area === 0 ? 0 : bal_blank_ink / bal_interior_area,
    componentCount: bal_component_count
  };
}

export function bal_crop_region_pair(
  bal_scan: bal_SyntheticPage,
  bal_blank: bal_SyntheticPage,
  bal_region: bal_ReadingRegion,
  bal_ppm: number,
  bal_margin_mm: number
): bal_RegionCrop {
  return {
    scan: bal_crop_region(bal_scan, bal_region, bal_ppm, bal_margin_mm),
    blank: bal_crop_region(bal_blank, bal_region, bal_ppm, bal_margin_mm)
  };
}

export function bal_region_center_px(bal_region: bal_ReadingRegion, bal_ppm: number): { x: number; y: number } {
  return {
    x: (bal_region.rectMm.x + bal_region.rectMm.width / 2) * bal_ppm,
    y: (bal_region.rectMm.y + bal_region.rectMm.height / 2) * bal_ppm
  };
}

export function bal_marker_pixels(bal_region: bal_ReadingRegion, bal_ppm: number): number {
  const bal_r = bal_marker_radius_px(bal_region, bal_ppm);
  return Math.PI * bal_r * bal_r;
}
