import type { bal_SyntheticImage } from './scan_fixtures';
import type { bal_SquareCandidate } from './scan_cv';
import { bal_detect_square_candidates } from './scan_cv';

export type RotationQuarter = 0 | 90 | 180 | 270;

export interface bal_CornerPoints {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}

export type bal_CornerName = keyof bal_CornerPoints;

export const BAL_CORNER_ORDER: bal_CornerName[] = [
  'topLeft',
  'topRight',
  'bottomRight',
  'bottomLeft'
];

export interface bal_AlignmentLabeling {
  confidence: 'high' | 'inferred' | 'manual';
  markersFound: number;
  corners: bal_CornerPoints;
  homography: number[];
  residualPx: number;
  rotationQuarter: RotationQuarter;
}

export interface bal_AlignmentOutcome {
  found: boolean;
  confidence: 'high' | 'inferred' | 'manual' | 'failed';
  markersFound: number;
  rotationApplied: RotationQuarter;
  corners: bal_CornerPoints | null;
  homography: number[] | null;
  residualPx: number;
  inferenceNote: string | null;
  labelings: bal_AlignmentLabeling[];
}

function bal_solve_linear(bal_matrix: number[][], bal_rhs: number[]): number[] | null {
  const bal_n = bal_rhs.length;
  const bal_a = bal_matrix.map((bal_row, bal_i) => [...bal_row, bal_rhs[bal_i]]);
  for (let bal_col = 0; bal_col < bal_n; bal_col++) {
    let bal_pivot = bal_col;
    for (let bal_row = bal_col + 1; bal_row < bal_n; bal_row++) {
      if (Math.abs(bal_a[bal_row][bal_col]) > Math.abs(bal_a[bal_pivot][bal_col])) bal_pivot = bal_row;
    }
    if (Math.abs(bal_a[bal_pivot][bal_col]) < 1e-9) return null;
    [bal_a[bal_col], bal_a[bal_pivot]] = [bal_a[bal_pivot], bal_a[bal_col]];
    const bal_pivot_value = bal_a[bal_col][bal_col];
    for (let bal_row = 0; bal_row < bal_n; bal_row++) {
      if (bal_row === bal_col) continue;
      const bal_factor = bal_a[bal_row][bal_col] / bal_pivot_value;
      if (bal_factor === 0) continue;
      for (let bal_k = bal_col; bal_k <= bal_n; bal_k++) {
        bal_a[bal_row][bal_k] -= bal_factor * bal_a[bal_col][bal_k];
      }
    }
  }
  const bal_solution: number[] = [];
  for (let bal_row = 0; bal_row < bal_n; bal_row++) {
    bal_solution.push(bal_a[bal_row][bal_n] / bal_a[bal_row][bal_row]);
  }
  return bal_solution;
}

export function bal_homography_from_pairs(
  bal_src: { x: number; y: number }[],
  bal_dst: { x: number; y: number }[]
): number[] | null {
  if (bal_src.length !== 4 || bal_dst.length !== 4) return null;
  const bal_matrix: number[][] = [];
  const bal_rhs: number[] = [];
  for (let bal_i = 0; bal_i < 4; bal_i++) {
    const { x: bal_x, y: bal_y } = bal_src[bal_i];
    const { x: bal_u, y: bal_v } = bal_dst[bal_i];
    bal_matrix.push([bal_x, bal_y, 1, 0, 0, 0, -bal_u * bal_x, -bal_u * bal_y]);
    bal_rhs.push(bal_u);
    bal_matrix.push([0, 0, 0, bal_x, bal_y, 1, -bal_v * bal_x, -bal_v * bal_y]);
    bal_rhs.push(bal_v);
  }
  const bal_solution = bal_solve_linear(bal_matrix, bal_rhs);
  if (!bal_solution) return null;
  return [...bal_solution, 1];
}

export function bal_apply_homography(
  bal_h: number[],
  bal_x: number,
  bal_y: number
): { x: number; y: number } {
  const bal_denominator = bal_h[6] * bal_x + bal_h[7] * bal_y + bal_h[8];
  return {
    x: (bal_h[0] * bal_x + bal_h[1] * bal_y + bal_h[2]) / bal_denominator,
    y: (bal_h[3] * bal_x + bal_h[4] * bal_y + bal_h[5]) / bal_denominator
  };
}

export function bal_invert_homography(bal_h: number[]): number[] | null {
  const bal_det =
    bal_h[0] * (bal_h[4] * bal_h[8] - bal_h[5] * bal_h[7]) -
    bal_h[1] * (bal_h[3] * bal_h[8] - bal_h[5] * bal_h[6]) +
    bal_h[2] * (bal_h[3] * bal_h[7] - bal_h[4] * bal_h[6]);
  if (Math.abs(bal_det) < 1e-12) return null;
  return [
    (bal_h[4] * bal_h[8] - bal_h[5] * bal_h[7]) / bal_det,
    (bal_h[2] * bal_h[7] - bal_h[1] * bal_h[8]) / bal_det,
    (bal_h[1] * bal_h[5] - bal_h[2] * bal_h[4]) / bal_det,
    (bal_h[5] * bal_h[6] - bal_h[3] * bal_h[8]) / bal_det,
    (bal_h[0] * bal_h[8] - bal_h[2] * bal_h[6]) / bal_det,
    (bal_h[2] * bal_h[3] - bal_h[0] * bal_h[5]) / bal_det,
    (bal_h[3] * bal_h[7] - bal_h[4] * bal_h[6]) / bal_det,
    (bal_h[1] * bal_h[6] - bal_h[0] * bal_h[7]) / bal_det,
    (bal_h[0] * bal_h[4] - bal_h[1] * bal_h[3]) / bal_det
  ];
}

function bal_cross(bal_a: { x: number; y: number }, bal_b: { x: number; y: number }, bal_c: { x: number; y: number }): number {
  return (bal_b.x - bal_a.x) * (bal_c.y - bal_a.y) - (bal_b.y - bal_a.y) * (bal_c.x - bal_a.x);
}

export function bal_is_convex_quadrilateral(bal_points: { x: number; y: number }[]): boolean {
  let bal_sign = 0;
  for (let bal_i = 0; bal_i < 4; bal_i++) {
    const bal_value = bal_cross(
      bal_points[bal_i],
      bal_points[(bal_i + 1) % 4],
      bal_points[(bal_i + 2) % 4]
    );
    if (Math.abs(bal_value) < 1e-9) return false;
    const bal_current = bal_value > 0 ? 1 : -1;
    if (bal_sign === 0) bal_sign = bal_current;
    else if (bal_sign !== bal_current) return false;
  }
  return true;
}

function bal_completion_for(
  bal_points: Partial<Record<bal_CornerName, { x: number; y: number }>>
): { corners: bal_CornerPoints; missing: bal_CornerName } | null {
  const bal_known = BAL_CORNER_ORDER.filter((bal_name) => bal_points[bal_name]);
  if (bal_known.length !== 3) return null;
  const bal_missing = BAL_CORNER_ORDER.find((bal_name) => !bal_points[bal_name]) as bal_CornerName;
  const bal_get = (bal_name: bal_CornerName) => bal_points[bal_name] as { x: number; y: number };
  const bal_opposite: Record<bal_CornerName, bal_CornerName> = {
    topLeft: 'bottomRight',
    topRight: 'bottomLeft',
    bottomRight: 'topLeft',
    bottomLeft: 'topRight'
  };
  const bal_adjacent: Record<bal_CornerName, bal_CornerName[]> = {
    topLeft: ['topRight', 'bottomLeft'],
    topRight: ['topLeft', 'bottomRight'],
    bottomRight: ['topRight', 'bottomLeft'],
    bottomLeft: ['topLeft', 'bottomRight']
  };
  const bal_p1 = bal_get(bal_adjacent[bal_missing][0]);
  const bal_p2 = bal_get(bal_opposite[bal_missing]);
  const bal_p3 = bal_get(bal_adjacent[bal_missing][1]);
  const bal_inferred = {
    x: bal_p1.x + bal_p3.x - bal_p2.x,
    y: bal_p1.y + bal_p3.y - bal_p2.y
  };
  const bal_corners = { ...(bal_points as Record<bal_CornerName, { x: number; y: number }>) };
  bal_corners[bal_missing] = bal_inferred;
  return { corners: bal_corners, missing: bal_missing };
}

export interface bal_MarkerSpec {
  centersMm: { x: number; y: number }[];
  widthMm: number;
  heightMm: number;
  qrCenterMm?: { x: number; y: number };
}

export function bal_marker_centers_canonical_order(
  bal_rects: { x: number; y: number; width: number; height: number }[]
): { x: number; y: number }[] {
  return [...bal_rects]
    .sort((bal_a, bal_b) => bal_a.y - bal_b.y || bal_a.x - bal_b.x)
    .map((bal_r) => ({ x: bal_r.x + bal_r.width / 2, y: bal_r.y + bal_r.height / 2 }));
}

function bal_candidate_combinations(bal_items: bal_SquareCandidate[], bal_size: number): bal_SquareCandidate[][] {
  const bal_results: bal_SquareCandidate[][] = [];
  const bal_current: bal_SquareCandidate[] = [];
  const bal_walk = (bal_start: number): void => {
    if (bal_current.length === bal_size) {
      bal_results.push([...bal_current]);
      return;
    }
    for (let bal_i = bal_start; bal_i < bal_items.length; bal_i++) {
      bal_current.push(bal_items[bal_i]);
      bal_walk(bal_i + 1);
      bal_current.pop();
    }
  };
  bal_walk(0);
  return bal_results;
}

export interface bal_AlignInput {
  image: bal_SyntheticImage;
  spec: bal_MarkerSpec;
  manualCorners?: bal_CornerPoints | null;
}

function bal_corners_to_mm(bal_spec: bal_MarkerSpec): Record<bal_CornerName, { x: number; y: number }> {
  return {
    topLeft: bal_spec.centersMm[0],
    topRight: bal_spec.centersMm[1],
    bottomRight: bal_spec.centersMm[2],
    bottomLeft: bal_spec.centersMm[3]
  };
}

function bal_rotation_from_quadrant(
  bal_point: { x: number; y: number },
  bal_centroid: { x: number; y: number }
): RotationQuarter {
  const bal_right = bal_point.x >= bal_centroid.x;
  const bal_top = bal_point.y < bal_centroid.y;
  if (bal_top && !bal_right) return 0;
  if (bal_top && bal_right) return 90;
  if (!bal_top && bal_right) return 180;
  return 270;
}

function bal_permutations(bal_items: number[]): number[][] {
  if (bal_items.length <= 1) return [bal_items];
  const bal_out: number[][] = [];
  for (let bal_i = 0; bal_i < bal_items.length; bal_i++) {
    const bal_rest = bal_items.filter((_bal_v, bal_j) => bal_j !== bal_i);
    for (const bal_tail of bal_permutations(bal_rest)) {
      bal_out.push([bal_items[bal_i], ...bal_tail]);
    }
  }
  return bal_out;
}

const BAL_INDEX_PERMUTATIONS = bal_permutations([0, 1, 2, 3]);

function bal_evaluate_labeling(
  bal_src_by_corner: Record<bal_CornerName, { x: number; y: number }>,
  bal_dst_mm: Record<bal_CornerName, { x: number; y: number }>,
  bal_diagonal_px: number
): { homography: number[]; residualPx: number } | null {
  const bal_quad = BAL_CORNER_ORDER.map((bal_name) => bal_src_by_corner[bal_name]);
  if (!bal_is_convex_quadrilateral(bal_quad)) return null;
  const bal_h = bal_homography_from_pairs(
    BAL_CORNER_ORDER.map((bal_name) => bal_dst_mm[bal_name]),
    bal_quad
  );
  if (!bal_h) return null;
  let bal_residual = 0;
  for (const bal_name of BAL_CORNER_ORDER) {
    const bal_projected = bal_apply_homography(bal_h, bal_dst_mm[bal_name].x, bal_dst_mm[bal_name].y);
    if (!Number.isFinite(bal_projected.x) || !Number.isFinite(bal_projected.y)) return null;
    const bal_src = bal_src_by_corner[bal_name];
    bal_residual = Math.max(bal_residual, Math.hypot(bal_projected.x - bal_src.x, bal_projected.y - bal_src.y));
  }
  if (bal_residual > bal_diagonal_px * 0.03) return null;
  return { homography: bal_h, residualPx: bal_residual };
}

export function bal_align_page(bal_input: bal_AlignInput): bal_AlignmentOutcome {
  const bal_failed = (bal_note: string, bal_markers: number): bal_AlignmentOutcome => ({
    found: false,
    confidence: 'failed',
    markersFound: bal_markers,
    rotationApplied: 0,
    corners: null,
    homography: null,
    residualPx: Number.POSITIVE_INFINITY,
    inferenceNote: bal_note,
    labelings: []
  });

  if (bal_input.manualCorners) {
    const bal_pairs = BAL_CORNER_ORDER.map((bal_name) => ({
      src: bal_input.manualCorners![bal_name],
      dstMm: bal_corners_to_mm(bal_input.spec)[bal_name]
    }));
    const bal_h = bal_homography_from_pairs(
      bal_pairs.map((bal_p) => bal_p.dstMm),
      bal_pairs.map((bal_p) => bal_p.src)
    );
    if (!bal_h) return bal_failed('The corrected corners do not form a valid page mapping.', 4);
    return {
      found: true,
      confidence: 'manual',
      markersFound: 4,
      rotationApplied: 0,
      corners: bal_input.manualCorners,
      homography: bal_h,
      residualPx: 0,
      inferenceNote: null,
      labelings: [
        {
          confidence: 'manual',
          markersFound: 4,
          corners: bal_input.manualCorners,
          homography: bal_h,
          residualPx: 0,
          rotationQuarter: 0
        }
      ]
    };
  }

  const bal_candidates = bal_detect_square_candidates(bal_input.image);
  if (bal_candidates.length < 3) {
    return bal_failed(
      bal_candidates.length === 0 ? 'No alignment markers detected.' : 'Too few alignment markers detected.',
      bal_candidates.length
    );
  }

  const bal_diagonal = Math.hypot(bal_input.image.width, bal_input.image.height);
  const bal_found: bal_AlignmentLabeling[] = [];
  const bal_combos = bal_candidate_combinations(bal_candidates.slice(0, 8), 4);
  for (const bal_combo of bal_combos) {
    for (const bal_perm of BAL_INDEX_PERMUTATIONS) {
      const bal_src_by_corner = {} as Record<bal_CornerName, { x: number; y: number }>;
      for (let bal_i = 0; bal_i < 4; bal_i++) {
        bal_src_by_corner[BAL_CORNER_ORDER[bal_i]] = {
          x: bal_combo[bal_perm[bal_i]].centerX,
          y: bal_combo[bal_perm[bal_i]].centerY
        };
      }
      const bal_evaluated = bal_evaluate_labeling(bal_src_by_corner, bal_corners_to_mm(bal_input.spec), bal_diagonal);
      if (!bal_evaluated) continue;
      const bal_centroid = {
        x: bal_combo.reduce((bal_s, bal_c) => bal_s + bal_c.centerX, 0) / 4,
        y: bal_combo.reduce((bal_s, bal_c) => bal_s + bal_c.centerY, 0) / 4
      };
      bal_found.push({
        confidence: 'high',
        markersFound: 4,
        corners: bal_src_by_corner,
        homography: bal_evaluated.homography,
        residualPx: bal_evaluated.residualPx,
        rotationQuarter: bal_rotation_from_quadrant(bal_src_by_corner.topLeft, bal_centroid)
      });
    }
  }
  if (bal_found.length > 0) {
    bal_found.sort((bal_a, bal_b) => bal_a.residualPx - bal_b.residualPx);
    const bal_best = bal_found[0];
    return {
      found: true,
      confidence: bal_best.confidence,
      markersFound: bal_best.markersFound,
      rotationApplied: bal_best.rotationQuarter,
      corners: bal_best.corners,
      homography: bal_best.homography,
      residualPx: bal_best.residualPx,
      inferenceNote: null,
      labelings: bal_found.slice(0, 8)
    };
  }

  const bal_threes = bal_candidate_combinations(bal_candidates.slice(0, 8), 3);
  for (const bal_trio of bal_threes) {
    for (const bal_perm of BAL_INDEX_PERMUTATIONS) {
      const bal_points: Partial<Record<bal_CornerName, { x: number; y: number }>> = {};
      for (let bal_i = 0; bal_i < 3; bal_i++) {
        bal_points[BAL_CORNER_ORDER[bal_perm[bal_i]]] = {
          x: bal_trio[bal_i].centerX,
          y: bal_trio[bal_i].centerY
        };
      }
      const bal_completed = bal_completion_for(bal_points);
      if (!bal_completed) continue;
      const bal_evaluated = bal_evaluate_labeling(bal_completed.corners, bal_corners_to_mm(bal_input.spec), bal_diagonal);
      if (!bal_evaluated) continue;
      const bal_centroid = {
        x:
          (bal_completed.corners.topLeft.x +
            bal_completed.corners.topRight.x +
            bal_completed.corners.bottomRight.x +
            bal_completed.corners.bottomLeft.x) /
          4,
        y:
          (bal_completed.corners.topLeft.y +
            bal_completed.corners.topRight.y +
            bal_completed.corners.bottomRight.y +
            bal_completed.corners.bottomLeft.y) /
          4
      };
      bal_found.push({
        confidence: 'inferred',
        markersFound: 3,
        corners: bal_completed.corners,
        homography: bal_evaluated.homography,
        residualPx: bal_evaluated.residualPx,
        rotationQuarter: bal_rotation_from_quadrant(bal_completed.corners.topLeft, bal_centroid)
      });
    }
  }
  if (bal_found.length > 0) {
    bal_found.sort((bal_a, bal_b) => bal_a.residualPx - bal_b.residualPx);
    const bal_best = bal_found[0];
    return {
      found: true,
      confidence: 'inferred',
      markersFound: 3,
      rotationApplied: bal_best.rotationQuarter,
      corners: bal_best.corners,
      homography: bal_best.homography,
      residualPx: bal_best.residualPx,
      inferenceNote: 'One alignment marker was inferred from the other three.',
      labelings: bal_found.slice(0, 8)
    };
  }

  return bal_failed('Markers were found but could not be matched to the expected page layout.', bal_candidates.length);
}

export function bal_warp_to_canonical(
  bal_image: bal_SyntheticImage,
  bal_homography: number[],
  bal_out_width: number,
  bal_out_height: number,
  bal_px_per_mm: number
): bal_SyntheticImage {
  const bal_out = new Uint8ClampedArray(bal_out_width * bal_out_height * 4).fill(255);
  for (let bal_y = 0; bal_y < bal_out_height; bal_y++) {
    for (let bal_x = 0; bal_x < bal_out_width; bal_x++) {
      const bal_source = bal_apply_homography(bal_homography, bal_x / bal_px_per_mm, bal_y / bal_px_per_mm);
      const bal_to = (bal_y * bal_out_width + bal_x) * 4;
      if (
        bal_source.x < 0 ||
        bal_source.y < 0 ||
        bal_source.x > bal_image.width - 1 ||
        bal_source.y > bal_image.height - 1
      ) {
        continue;
      }
      const bal_x0 = Math.floor(bal_source.x);
      const bal_y0 = Math.floor(bal_source.y);
      const bal_x1 = Math.min(bal_image.width - 1, bal_x0 + 1);
      const bal_y1 = Math.min(bal_image.height - 1, bal_y0 + 1);
      const bal_fx = bal_source.x - bal_x0;
      const bal_fy = bal_source.y - bal_y0;
      for (let bal_channel = 0; bal_channel < 3; bal_channel++) {
        const bal_top =
          bal_image.data[(bal_y0 * bal_image.width + bal_x0) * 4 + bal_channel] * (1 - bal_fx) +
          bal_image.data[(bal_y0 * bal_image.width + bal_x1) * 4 + bal_channel] * bal_fx;
        const bal_bottom =
          bal_image.data[(bal_y1 * bal_image.width + bal_x0) * 4 + bal_channel] * (1 - bal_fx) +
          bal_image.data[(bal_y1 * bal_image.width + bal_x1) * 4 + bal_channel] * bal_fx;
        bal_out[bal_to + bal_channel] = bal_top * (1 - bal_fy) + bal_bottom * bal_fy;
      }
      bal_out[bal_to + 3] = 255;
    }
  }
  return { data: bal_out, width: bal_out_width, height: bal_out_height };
}
