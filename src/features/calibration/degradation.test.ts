import { describe, expect, it } from 'vitest';
import {
  bal_apply_degradations,
  bal_apply_noise,
  bal_CAPTURE_PRESETS,
  bal_crop_image,
  bal_homography_from_quads,
  bal_warp_perspective,
  type bal_DegradationOp
} from './degradation';
import type { bal_SyntheticImage } from '../scan/scan_fixtures';

function bal_gray(bal_width: number, bal_height: number, bal_value: number): bal_SyntheticImage {
  return {
    data: new Uint8ClampedArray(bal_width * bal_height * 4).fill(bal_value),
    width: bal_width,
    height: bal_height
  };
}

function bal_black_square(bal_width: number, bal_height: number): bal_SyntheticImage {
  const bal_image = bal_gray(bal_width, bal_height, 255);
  for (let bal_y = 40; bal_y < 60; bal_y++) {
    for (let bal_x = 40; bal_x < 60; bal_x++) {
      const bal_index = (bal_y * bal_width + bal_x) * 4;
      bal_image.data[bal_index] = 0;
      bal_image.data[bal_index + 1] = 0;
      bal_image.data[bal_index + 2] = 0;
    }
  }
  return bal_image;
}

describe('deterministic degradation', () => {
  it('produces byte-identical output for identical ops', () => {
    const bal_ops: bal_DegradationOp[] = [
      { op: 'noise', amplitude: 12, seed: 42 },
      { op: 'blur', radius: 2 },
      { op: 'illumination', gradient: 20, angleDeg: 45, vignette: 0.1 }
    ];
    const bal_a = bal_apply_degradations(bal_black_square(120, 120), bal_ops);
    const bal_b = bal_apply_degradations(bal_black_square(120, 120), bal_ops);
    expect(Array.from(bal_a.data)).toEqual(Array.from(bal_b.data));
  });

  it('changes output when the noise seed changes', () => {
    const bal_a = bal_apply_noise(bal_gray(50, 50, 128), 20, 1);
    const bal_b = bal_apply_noise(bal_gray(50, 50, 128), 20, 2);
    expect(Array.from(bal_a.data)).not.toEqual(Array.from(bal_b.data));
  });

  it('keeps white pages white through perspective and brightness', () => {
    const bal_out = bal_apply_degradations(bal_gray(80, 80, 255), [
      { op: 'perspective', shifts: { tl: [6, 3], tr: [-6, 4], br: [-5, -6], bl: [4, -3] } },
      { op: 'brightness', delta: -20 }
    ]);
    let bal_min = 255;
    for (let bal_i = 0; bal_i < bal_out.data.length; bal_i += 4) bal_min = Math.min(bal_min, bal_out.data[bal_i]);
    expect(bal_min).toBe(235);
  });

  it('moves content with the corner quad', () => {
    const bal_src = bal_black_square(100, 100);
    const bal_out = bal_warp_perspective(bal_src, {
      tl: [20, 20],
      tr: [0, 0],
      br: [0, 0],
      bl: [0, 0]
    });
    const bal_at = (bal_x: number, bal_y: number) => bal_out.data[(bal_y * 100 + bal_x) * 4];
    expect(bal_at(55, 55)).toBe(0);
    expect(bal_at(41, 41)).toBe(255);
  });

  it('solves the identity homography exactly', () => {
    const bal_h = bal_homography_from_quads(
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10]
      ],
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10]
      ]
    );
    expect(bal_h[0]).toBeCloseTo(1, 6);
    expect(bal_h[4]).toBeCloseTo(1, 6);
    expect(bal_h[2]).toBeCloseTo(0, 6);
  });

  it('crops reduce dimensions', () => {
    const bal_out = bal_crop_image(bal_gray(100, 100, 200), 10, 15, 5, 8);
    expect(bal_out.width).toBe(85);
    expect(bal_out.height).toBe(77);
  });

  it('exposes capture presets for every planned scenario category', () => {
    const bal_ids = bal_CAPTURE_PRESETS.map((bal_p) => bal_p.id);
    expect(bal_ids).toContain('straight');
    expect(bal_ids).toContain('tilt-left');
    expect(bal_ids).toContain('tilt-down');
    expect(bal_ids).toContain('rotated-slight');
    expect(bal_ids).toContain('farther');
    expect(bal_ids).toContain('closer');
    expect(bal_ids).toContain('indoor-dim');
    expect(bal_ids).toContain('daylight-bright');
    expect(bal_ids).toContain('shadow-corner');
    expect(bal_ids).toContain('glare-bubble');
    expect(bal_ids).toContain('uneven-light');
    expect(bal_ids).toContain('slight-blur');
    expect(bal_ids).toContain('wrinkled');
    expect(bal_ids).toContain('not-flat');
    for (const bal_preset of bal_CAPTURE_PRESETS) {
      expect(['good', 'acceptable', 'poor', 'unusable']).toContain(bal_preset.category);
    }
  });

  it('applies every preset op without throwing', () => {
    for (const bal_preset of bal_CAPTURE_PRESETS) {
      const bal_out = bal_apply_degradations(bal_black_square(200, 260), bal_preset.ops);
      expect(bal_out.data.length).toBeGreaterThan(0);
    }
  });
});
