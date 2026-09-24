import type { bal_SyntheticImage } from './scan_fixtures';
import type { bal_MarkerSpec } from './scan_transform';
import {
  bal_align_page,
  bal_apply_homography,
  bal_warp_to_canonical,
  type RotationQuarter
} from './scan_transform';

export interface bal_QrLocation {
  topLeftCorner: { x: number; y: number };
  topRightCorner: { x: number; y: number };
  bottomRightCorner: { x: number; y: number };
  bottomLeftCorner: { x: number; y: number };
}

export type bal_QrDecodeFn = (
  bal_image: bal_SyntheticImage
) => { data: string; location: bal_QrLocation } | null;

export function bal_rotation_from_qr_location(bal_location: bal_QrLocation): RotationQuarter {
  const bal_vx = bal_location.topRightCorner.x - bal_location.topLeftCorner.x;
  const bal_vy = bal_location.topRightCorner.y - bal_location.topLeftCorner.y;
  if (Math.abs(bal_vx) >= Math.abs(bal_vy)) {
    return bal_vx >= 0 ? 0 : 180;
  }
  return bal_vy >= 0 ? 270 : 90;
}

export interface bal_NormalizeInput {
  image: bal_SyntheticImage;
  spec: bal_MarkerSpec;
  outWidthPx: number;
  outHeightPx: number;
  pxPerMm: number;
  decodeQr: bal_QrDecodeFn;
  manualCorners?: { x: number; y: number }[] | null;
}

export interface bal_NormalizeResult {
  found: boolean;
  confidence: 'high' | 'inferred' | 'manual' | 'failed';
  markersFound: number;
  rotationApplied: RotationQuarter;
  homography: number[] | null;
  normalized: bal_SyntheticImage | null;
  payloads: string[];
  orientationConfirmed: boolean;
  inferenceNote: string | null;
  residualPx: number;
}

function bal_qr_center(bal_location: bal_QrLocation): { x: number; y: number } {
  return {
    x:
      (bal_location.topLeftCorner.x +
        bal_location.topRightCorner.x +
        bal_location.bottomRightCorner.x +
        bal_location.bottomLeftCorner.x) /
      4,
    y:
      (bal_location.topLeftCorner.y +
        bal_location.topRightCorner.y +
        bal_location.bottomRightCorner.y +
        bal_location.bottomLeftCorner.y) /
      4
  };
}

function bal_pick_labeling_by_qr(
  bal_labelings: { homography: number[] }[],
  bal_qr_center_photo: { x: number; y: number },
  bal_spec: bal_MarkerSpec,
  bal_tolerance_px: number
): number {
  if (!bal_spec.qrCenterMm) return 0;
  let bal_best_index = 0;
  let bal_best_distance = Number.POSITIVE_INFINITY;
  for (let bal_i = 0; bal_i < bal_labelings.length; bal_i++) {
    const bal_projected = bal_apply_homography(
      bal_labelings[bal_i].homography,
      bal_spec.qrCenterMm.x,
      bal_spec.qrCenterMm.y
    );
    if (!Number.isFinite(bal_projected.x) || !Number.isFinite(bal_projected.y)) continue;
    const bal_distance = Math.hypot(
      bal_projected.x - bal_qr_center_photo.x,
      bal_projected.y - bal_qr_center_photo.y
    );
    if (bal_distance < bal_best_distance) {
      bal_best_distance = bal_distance;
      bal_best_index = bal_i;
    }
  }
  return bal_best_distance <= bal_tolerance_px ? bal_best_index : 0;
}

export function bal_align_and_normalize(bal_input: bal_NormalizeInput): bal_NormalizeResult {
  const bal_alignment = bal_align_page({
    image: bal_input.image,
    spec: bal_input.spec,
    manualCorners: bal_input.manualCorners
      ? {
          topLeft: bal_input.manualCorners[0],
          topRight: bal_input.manualCorners[1],
          bottomRight: bal_input.manualCorners[2],
          bottomLeft: bal_input.manualCorners[3]
        }
      : null
  });
  if (!bal_alignment.found || bal_alignment.labelings.length === 0) {
    const bal_raw_qr = bal_input.decodeQr(bal_input.image);
    return {
      found: false,
      confidence: 'failed',
      markersFound: bal_alignment.markersFound,
      rotationApplied: 0,
      homography: null,
      normalized: null,
      payloads: bal_raw_qr ? [bal_raw_qr.data] : [],
      orientationConfirmed: false,
      inferenceNote: bal_alignment.inferenceNote,
      residualPx: Number.POSITIVE_INFINITY
    };
  }

  const bal_labelings = bal_alignment.labelings;
  let bal_chosen_index = 0;
  let bal_orientation_confirmed = false;
  const bal_raw_qr = bal_input.decodeQr(bal_input.image);
  if (bal_raw_qr) {
    if (bal_spec_guard(bal_input.spec)) {
      bal_chosen_index = bal_pick_labeling_by_qr(
        bal_labelings,
        bal_qr_center(bal_raw_qr.location),
        bal_input.spec,
        Math.hypot(bal_input.image.width, bal_input.image.height) * 0.35
      );
    }
  } else {
    for (let bal_i = 0; bal_i < bal_labelings.length; bal_i++) {
      const bal_probe = bal_warp_to_canonical(
        bal_input.image,
        bal_labelings[bal_i].homography,
        bal_input.outWidthPx,
        bal_input.outHeightPx,
        bal_input.pxPerMm
      );
      if (bal_input.decodeQr(bal_probe)) {
        bal_chosen_index = bal_i;
        break;
      }
    }
  }

  const bal_chosen = bal_labelings[bal_chosen_index];
  const bal_normalized = bal_warp_to_canonical(
    bal_input.image,
    bal_chosen.homography,
    bal_input.outWidthPx,
    bal_input.outHeightPx,
    bal_input.pxPerMm
  );
  const bal_warp_qr = bal_input.decodeQr(bal_normalized);
  bal_orientation_confirmed = bal_warp_qr !== null;
  const bal_payloads: string[] = [];
  if (bal_warp_qr) bal_payloads.push(bal_warp_qr.data);
  else if (bal_raw_qr) bal_payloads.push(bal_raw_qr.data);
  return {
    found: true,
    confidence: bal_chosen.confidence,
    markersFound: bal_chosen.markersFound,
    rotationApplied: bal_chosen.rotationQuarter,
    homography: bal_chosen.homography,
    normalized: bal_normalized,
    payloads: bal_payloads,
    orientationConfirmed: bal_orientation_confirmed,
    inferenceNote: bal_alignment.inferenceNote,
    residualPx: bal_chosen.residualPx
  };
}

function bal_spec_guard(bal_spec: bal_MarkerSpec): boolean {
  return bal_spec.qrCenterMm !== undefined;
}

export function bal_sample_point_from_homography(
  bal_h: number[],
  bal_x_mm: number,
  bal_y_mm: number
): { x: number; y: number } {
  return bal_apply_homography(bal_h, bal_x_mm, bal_y_mm);
}
