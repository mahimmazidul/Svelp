import type { bal_SyntheticImage } from './scan_fixtures';
import { bal_to_gray } from './scan_fixtures';

export interface bal_SquareCandidate {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  area: number;
  fillRatio: number;
}

export function bal_binarize_dark(
  bal_image: bal_SyntheticImage,
  bal_window = 25,
  bal_tolerance = 0.12
): Uint8Array {
  const bal_gray = bal_to_gray(bal_image);
  const bal_width = bal_image.width;
  const bal_height = bal_image.height;
  const bal_integral = new Float64Array((bal_width + 1) * (bal_height + 1));
  for (let bal_y = 0; bal_y < bal_height; bal_y++) {
    let bal_row_sum = 0;
    for (let bal_x = 0; bal_x < bal_width; bal_x++) {
      bal_row_sum += bal_gray[bal_y * bal_width + bal_x];
      bal_integral[(bal_y + 1) * (bal_width + 1) + (bal_x + 1)] =
        bal_integral[bal_y * (bal_width + 1) + (bal_x + 1)] + bal_row_sum;
    }
  }
  const bal_out = new Uint8Array(bal_width * bal_height);
  const bal_half = Math.floor(bal_window / 2);
  for (let bal_y = 0; bal_y < bal_height; bal_y++) {
    for (let bal_x = 0; bal_x < bal_width; bal_x++) {
      const bal_x0 = Math.max(0, bal_x - bal_half);
      const bal_y0 = Math.max(0, bal_y - bal_half);
      const bal_x1 = Math.min(bal_width, bal_x + bal_half + 1);
      const bal_y1 = Math.min(bal_height, bal_y + bal_half + 1);
      const bal_count = (bal_x1 - bal_x0) * (bal_y1 - bal_y0);
      const bal_sum =
        bal_integral[bal_y1 * (bal_width + 1) + bal_x1] -
        bal_integral[bal_y0 * (bal_width + 1) + bal_x1] -
        bal_integral[bal_y1 * (bal_width + 1) + bal_x0] +
        bal_integral[bal_y0 * (bal_width + 1) + bal_x0];
      const bal_mean = bal_sum / bal_count;
      bal_out[bal_y * bal_width + bal_x] =
        bal_gray[bal_y * bal_width + bal_x] < bal_mean * (1 - bal_tolerance) ? 1 : 0;
    }
  }
  return bal_out;
}

export function bal_connected_components(
  bal_mask: Uint8Array,
  bal_width: number,
  bal_height: number,
  bal_min_area: number
): bal_SquareCandidate[] {
  const bal_labels = new Int32Array(bal_width * bal_height).fill(-1);
  const bal_stack: number[] = [];
  const bal_components: bal_SquareCandidate[] = [];
  let bal_label = 0;
  for (let bal_start = 0; bal_start < bal_mask.length; bal_start++) {
    if (bal_mask[bal_start] !== 1 || bal_labels[bal_start] !== -1) continue;
    bal_stack.length = 0;
    bal_stack.push(bal_start);
    bal_labels[bal_start] = bal_label;
    let bal_count = 0;
    let bal_min_x = bal_width;
    let bal_max_x = 0;
    let bal_min_y = bal_height;
    let bal_max_y = 0;
    while (bal_stack.length > 0) {
      const bal_index = bal_stack.pop() as number;
      const bal_x = bal_index % bal_width;
      const bal_y = (bal_index - bal_x) / bal_width;
      bal_count += 1;
      if (bal_x < bal_min_x) bal_min_x = bal_x;
      if (bal_x > bal_max_x) bal_max_x = bal_x;
      if (bal_y < bal_min_y) bal_min_y = bal_y;
      if (bal_y > bal_max_y) bal_max_y = bal_y;
      if (bal_x > 0 && bal_mask[bal_index - 1] === 1 && bal_labels[bal_index - 1] === -1) {
        bal_labels[bal_index - 1] = bal_label;
        bal_stack.push(bal_index - 1);
      }
      if (bal_x < bal_width - 1 && bal_mask[bal_index + 1] === 1 && bal_labels[bal_index + 1] === -1) {
        bal_labels[bal_index + 1] = bal_label;
        bal_stack.push(bal_index + 1);
      }
      if (bal_y > 0 && bal_mask[bal_index - bal_width] === 1 && bal_labels[bal_index - bal_width] === -1) {
        bal_labels[bal_index - bal_width] = bal_label;
        bal_stack.push(bal_index - bal_width);
      }
      if (
        bal_y < bal_height - 1 &&
        bal_mask[bal_index + bal_width] === 1 &&
        bal_labels[bal_index + bal_width] === -1
      ) {
        bal_labels[bal_index + bal_width] = bal_label;
        bal_stack.push(bal_index + bal_width);
      }
    }
    bal_label += 1;
    if (bal_count < bal_min_area) continue;
    const bal_box_width = bal_max_x - bal_min_x + 1;
    const bal_box_height = bal_max_y - bal_min_y + 1;
    const bal_box_area = bal_box_width * bal_box_height;
    bal_components.push({
      centerX: (bal_min_x + bal_max_x) / 2,
      centerY: (bal_min_y + bal_max_y) / 2,
      width: bal_box_width,
      height: bal_box_height,
      area: bal_count,
      fillRatio: bal_count / bal_box_area
    });
  }
  return bal_components;
}

export interface bal_MarkerDetectionOptions {
  minSideRatio?: number;
  maxSideRatio?: number;
  minFillRatio?: number;
  maxCandidates?: number;
}

export function bal_detect_square_candidates(
  bal_image: bal_SyntheticImage,
  bal_options: bal_MarkerDetectionOptions = {}
): bal_SquareCandidate[] {
  const bal_min_side_ratio = bal_options.minSideRatio ?? 0.012;
  const bal_max_side_ratio = bal_options.maxSideRatio ?? 0.09;
  const bal_min_fill = bal_options.minFillRatio ?? 0.68;
  const bal_max_candidates = bal_options.maxCandidates ?? 10;
  const bal_diag = Math.hypot(bal_image.width, bal_image.height);
  const bal_min_area = (bal_diag * bal_min_side_ratio * 0.5) ** 2;
  const bal_mask = bal_binarize_dark(bal_image);
  const bal_components = bal_connected_components(bal_mask, bal_image.width, bal_image.height, bal_min_area);
  const bal_min_side = bal_diag * bal_min_side_ratio;
  const bal_max_side = bal_diag * bal_max_side_ratio;
  const bal_squares = bal_components.filter((bal_c) => {
    if (bal_c.width < bal_min_side || bal_c.width > bal_max_side) return false;
    if (bal_c.height < bal_min_side || bal_c.height > bal_max_side) return false;
    const bal_ratio = bal_c.width / bal_c.height;
    if (bal_ratio < 0.6 || bal_ratio > 1.67) return false;
    return bal_c.fillRatio >= bal_min_fill;
  });
  bal_squares.sort((bal_a, bal_b) => bal_b.fillRatio - bal_a.fillRatio);
  return bal_squares.slice(0, bal_max_candidates);
}
