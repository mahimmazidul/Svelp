import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import {
  bal_canonical_spec,
  bal_render_canonical_page,
  bal_rotate_image,
  bal_scale_image
} from './scan_fixtures';
import { bal_detect_square_candidates } from './scan_cv';
import {
  bal_align_page,
  bal_homography_from_pairs,
  bal_apply_homography,
  bal_invert_homography,
  bal_is_convex_quadrilateral,
  bal_warp_to_canonical
} from './scan_transform';
import { bal_align_and_normalize } from './scan_pipeline';

function bal_decode_with_jsqr(bal_image: { data: Uint8ClampedArray; width: number; height: number }) {
  const bal_result = jsQR(bal_image.data, bal_image.width, bal_image.height, { inversionAttempts: 'dontInvert' });
  if (!bal_result) return null;
  return { data: bal_result.data, location: bal_result.location };
}

const BAL_PPM = 5.9;

function bal_spec_centers_mm(bal_landscape = false) {
  const bal_rects = [...bal_canonical_spec('S1|FFQ|1|001|1', bal_landscape).markerRects].sort(
    (bal_a, bal_b) => bal_a.y - bal_b.y || bal_a.x - bal_b.x
  );
  const bal_centers = bal_rects.map((bal_r) => ({
    x: bal_r.x + bal_r.width / 2,
    y: bal_r.y + bal_r.height / 2
  }));
  return [bal_centers[0], bal_centers[1], bal_centers[3], bal_centers[2]];
}

describe('marker detection', () => {
  it('finds exactly four square candidates on a clean rendered page', () => {
    const bal_image = bal_render_canonical_page(
      bal_canonical_spec('S1|FFQ|1|001|1'),
      BAL_PPM
    );
    const bal_candidates = bal_detect_square_candidates(bal_image);
    expect(bal_candidates.length).toBe(4);
  });

  it('still finds the markers after a quarter rotation', () => {
    const bal_image = bal_rotate_image(
      bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM),
      90
    );
    expect(bal_detect_square_candidates(bal_image).length).toBe(4);
  });
});

describe('homography', () => {
  it('round-trips points through a homography and its inverse', () => {
    const bal_src = [
      { x: 41, y: 41 },
      { x: 1500, y: 60 },
      { x: 1480, y: 2100 },
      { x: 55, y: 2050 }
    ];
    const bal_dst = [
      { x: 8.5, y: 8.5 },
      { x: 201.5, y: 8.5 },
      { x: 201.5, y: 290.5 },
      { x: 8.5, y: 290.5 }
    ];
    const bal_h = bal_homography_from_pairs(bal_src, bal_dst);
    expect(bal_h).not.toBeNull();
    const bal_inverse = bal_invert_homography(bal_h as number[]);
    expect(bal_inverse).not.toBeNull();
    for (let bal_i = 0; bal_i < 4; bal_i++) {
      const bal_forward = bal_apply_homography(bal_h as number[], bal_src[bal_i].x, bal_src[bal_i].y);
      expect(bal_forward.x).toBeCloseTo(bal_dst[bal_i].x, 3);
      expect(bal_forward.y).toBeCloseTo(bal_dst[bal_i].y, 3);
      const bal_back = bal_apply_homography(bal_inverse as number[], bal_dst[bal_i].x, bal_dst[bal_i].y);
      expect(bal_back.x).toBeCloseTo(bal_src[bal_i].x, 3);
      expect(bal_back.y).toBeCloseTo(bal_src[bal_i].y, 3);
    }
  });

  it('rejects a singular correspondence set', () => {
    const bal_degenerate = bal_homography_from_pairs(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 }
      ],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 }
      ]
    );
    expect(bal_degenerate).toBeNull();
  });

  it('validates quadrilateral convexity', () => {
    expect(
      bal_is_convex_quadrilateral([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ])
    ).toBe(true);
    expect(
      bal_is_convex_quadrilateral([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
        { x: 10, y: 10 }
      ])
    ).toBe(false);
  });
});

describe('page alignment', () => {
  const bal_geometry = bal_canonical_spec('S1|FFQ|1|001|1');
  const bal_spec = {
    centersMm: bal_spec_centers_mm(),
    widthMm: 210,
    heightMm: 297,
    qrCenterMm: { x: bal_geometry.qrRect.x + 10, y: bal_geometry.qrRect.y + 10 }
  };

  it('aligns a straight photo with all four markers', () => {
    const bal_image = bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM);
    const bal_outcome = bal_align_page({ image: bal_image, spec: bal_spec });
    expect(bal_outcome.found).toBe(true);
    expect(bal_outcome.confidence).toBe('high');
    expect(bal_outcome.markersFound).toBe(4);
    expect(bal_outcome.rotationApplied).toBe(0);
    expect(bal_outcome.residualPx).toBeLessThan(4);
  });

  for (const bal_rotation of [90, 180, 270] as const) {
    it(`recovers rotation ${bal_rotation} through QR-confirmed normalization`, () => {
      const bal_geometry = bal_canonical_spec('S1|FFQ|1|001|1');
      const bal_image = bal_rotate_image(
        bal_render_canonical_page(bal_geometry, BAL_PPM),
        bal_rotation
      );
      const bal_result = bal_align_and_normalize({
        image: bal_image,
        spec: bal_spec,
        outWidthPx: Math.round(210 * BAL_PPM),
        outHeightPx: Math.round(297 * BAL_PPM),
        pxPerMm: BAL_PPM,
        decodeQr: bal_decode_with_jsqr
      });
      expect(bal_result.found).toBe(true);
      expect(bal_result.confidence).toBe('high');
      expect(bal_result.rotationApplied).toBe(bal_rotation);
      expect(bal_result.orientationConfirmed).toBe(true);
      expect(bal_result.payloads).toEqual(['S1|FFQ|1|001|1']);
      expect(bal_result.normalized).not.toBeNull();
      const bal_qr_center_px = Math.round((bal_geometry.qrRect.x + 10) * BAL_PPM);
      const bal_qr_center_py = Math.round((bal_geometry.qrRect.y + 10) * BAL_PPM);
      let bal_qr_dark = 0;
      for (let bal_dy = -6; bal_dy <= 6; bal_dy++) {
        for (let bal_dx = -6; bal_dx <= 6; bal_dx++) {
          if (
            bal_result.normalized!.data[
              ((bal_qr_center_py + bal_dy) * bal_result.normalized!.width + bal_qr_center_px + bal_dx) * 4
            ] < 100
          ) {
            bal_qr_dark += 1;
          }
        }
      }
      expect(bal_qr_dark).toBeGreaterThan(30);
    });
  }

  it('recovers a modest perspective tilt', () => {
    const bal_base = bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM);
    const bal_width = bal_base.width;
    const bal_height = bal_base.height;
    const bal_out = new Uint8ClampedArray(bal_width * bal_height * 4).fill(255);
    const bal_pull = (bal_x: number, bal_y: number): { x: number; y: number } => ({
      x: bal_x + (1 - bal_x / bal_width) * 18 * (1 - bal_y / bal_height),
      y: bal_y + (1 - bal_y / bal_height) * 10 * (1 - bal_x / bal_width)
    });
    for (let bal_y = 0; bal_y < bal_height; bal_y++) {
      for (let bal_x = 0; bal_x < bal_width; bal_x++) {
        const bal_from = bal_pull(bal_x, bal_y);
        const bal_sx = Math.min(bal_width - 1, Math.round(bal_from.x));
        const bal_sy = Math.min(bal_height - 1, Math.round(bal_from.y));
        const bal_to = (bal_y * bal_width + bal_x) * 4;
        out_copy(bal_out, bal_to, bal_base.data, (bal_sy * bal_width + bal_sx) * 4);
      }
    }
    const bal_image = { data: bal_out, width: bal_width, height: bal_height };
    const bal_outcome = bal_align_page({ image: bal_image, spec: bal_spec });
    expect(bal_outcome.found).toBe(true);
    expect(bal_outcome.confidence).toBe('high');
  });

  it('infers the fourth marker when one corner is missing', () => {
    const bal_full = bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM);
    const bal_spec_geometry = bal_canonical_spec('S1|FFQ|1|001|1');
    const bal_missing_rect = bal_spec_geometry.markerRects[3];
    const bal_out = new Uint8ClampedArray(bal_full.data);
    const bal_x0 = Math.round(bal_missing_rect.x * BAL_PPM) - 2;
    const bal_y0 = Math.round(bal_missing_rect.y * BAL_PPM) - 2;
    const bal_x1 = Math.round((bal_missing_rect.x + bal_missing_rect.width) * BAL_PPM) + 2;
    const bal_y1 = Math.round((bal_missing_rect.y + bal_missing_rect.height) * BAL_PPM) + 2;
    for (let bal_y = bal_y0; bal_y <= bal_y1; bal_y++) {
      for (let bal_x = bal_x0; bal_x <= bal_x1; bal_x++) {
        const bal_index = (bal_y * bal_full.width + bal_x) * 4;
        bal_out[bal_index] = 255;
        bal_out[bal_index + 1] = 255;
        bal_out[bal_index + 2] = 255;
      }
    }
    const bal_outcome = bal_align_page({ image: { data: bal_out, width: bal_full.width, height: bal_full.height }, spec: bal_spec });
    expect(bal_outcome.found).toBe(true);
    expect(bal_outcome.confidence).toBe('inferred');
    expect(bal_outcome.markersFound).toBe(3);
    expect(bal_outcome.inferenceNote).toContain('inferred');
  });

  it('reports failure when no markers are present', () => {
    const bal_blank = { data: new Uint8ClampedArray(400 * 560 * 4).fill(255), width: 400, height: 560 };
    const bal_outcome = bal_align_page({ image: bal_blank, spec: bal_spec });
    expect(bal_outcome.found).toBe(false);
    expect(bal_outcome.confidence).toBe('failed');
  });

  it('aligns from manual corners with manual confidence', () => {
    const bal_image = bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM);
    const bal_outcome = bal_align_page({
      image: bal_image,
      spec: bal_spec,
      manualCorners: {
        topLeft: { x: 41, y: 41 },
        topRight: { x: 1500, y: 41 },
        bottomRight: { x: 1500, y: 2100 },
        bottomLeft: { x: 41, y: 2100 }
      }
    });
    expect(bal_outcome.confidence).toBe('manual');
    expect(bal_outcome.homography).not.toBeNull();
  });
});

function out_copy(
  bal_target: Uint8ClampedArray,
  bal_to: number,
  bal_source: Uint8ClampedArray,
  bal_from: number
): void {
  bal_target[bal_to] = bal_source[bal_from];
  bal_target[bal_to + 1] = bal_source[bal_from + 1];
  bal_target[bal_to + 2] = bal_source[bal_from + 2];
  bal_target[bal_to + 3] = 255;
}

describe('canonical warp', () => {
  it('warps a rotated photo back to upright canonical dimensions', () => {
    const bal_geometry = bal_canonical_spec('S1|FFQ|1|001|1');
    const bal_page = bal_render_canonical_page(bal_geometry, BAL_PPM);
    const bal_rotated = bal_rotate_image(bal_page, 90);
    const bal_spec = { centersMm: bal_spec_centers_mm(), widthMm: 210, heightMm: 297 };
    const bal_outcome = bal_align_page({ image: bal_rotated, spec: bal_spec });
    expect(bal_outcome.found).toBe(true);
    const bal_out_width = Math.round(210 * BAL_PPM);
    const bal_out_height = Math.round(297 * BAL_PPM);
    const bal_warped = bal_warp_to_canonical(
      bal_rotated,
      bal_outcome.homography as number[],
      bal_out_width,
      bal_out_height,
      BAL_PPM
    );
    expect(bal_warped.width).toBe(bal_out_width);
    expect(bal_warped.height).toBe(bal_out_height);
    const bal_marker_px = bal_geometry.markerRects[0];
    const bal_px = Math.round((bal_marker_px.y + bal_marker_px.height / 2) * BAL_PPM);
    const bal_py = Math.round((bal_marker_px.x + bal_marker_px.width / 2) * BAL_PPM);
    let bal_dark = 0;
    for (let bal_dy = -3; bal_dy <= 3; bal_dy++) {
      for (let bal_dx = -3; bal_dx <= 3; bal_dx++) {
        if (bal_warped.data[((bal_py + bal_dy) * bal_out_width + bal_px + bal_dx) * 4] < 100) {
          bal_dark += 1;
        }
      }
    }
    expect(bal_dark).toBeGreaterThan(20);
  });

  it('normalizes a lower resolution photo to the fixed pixel size', () => {
    const bal_geometry = bal_canonical_spec('S1|FFQ|1|001|1');
    const bal_page = bal_render_canonical_page(bal_geometry, BAL_PPM);
    const bal_small = bal_scale_image(bal_page, 0.35);
    const bal_spec = { centersMm: bal_spec_centers_mm(), widthMm: 210, heightMm: 297 };
    const bal_outcome = bal_align_page({ image: bal_small, spec: bal_spec });
    expect(bal_outcome.found).toBe(true);
    const bal_warped = bal_warp_to_canonical(
      bal_small,
      bal_outcome.homography as number[],
      Math.round(210 * BAL_PPM),
      Math.round(297 * BAL_PPM),
      BAL_PPM
    );
    expect(bal_warped.width).toBe(1239);
    expect(bal_warped.height).toBe(1752);
    const bal_center_px = Math.round(bal_outcome.residualPx);
    expect(bal_center_px).toBeGreaterThanOrEqual(0);
  });

  it('keeps output aspect matching the print page', () => {
    const bal_geometry = bal_canonical_spec('S1|FFQ|1|001|1', true);
    const bal_page = bal_render_canonical_page(bal_geometry, BAL_PPM);
    const bal_spec = { centersMm: bal_spec_centers_mm(true), widthMm: 297, heightMm: 210 };
    const bal_outcome = bal_align_page({ image: bal_page, spec: bal_spec });
    expect(bal_outcome.found).toBe(true);
    const bal_warped = bal_warp_to_canonical(
      bal_page,
      bal_outcome.homography as number[],
      Math.round(297 * BAL_PPM),
      Math.round(210 * BAL_PPM),
      BAL_PPM
    );
    expect(bal_warped.width / bal_warped.height).toBeCloseTo(297 / 210, 2);
  });
});
