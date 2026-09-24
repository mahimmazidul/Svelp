import { describe, expect, it } from 'vitest';
import {
  bal_add_glare_spot,
  bal_box_blur,
  bal_canonical_spec,
  bal_crop_image,
  bal_render_canonical_page,
  bal_scale_image,
  bal_shift_exposure
} from './scan_fixtures';
import { bal_assess_quality, bal_downscale_gray } from './scan_quality';

const BAL_PPM = 5.9;

function bal_key_regions() {
  const bal_geometry = bal_canonical_spec('S1|FFQ|1|001|1');
  return [
    ...bal_geometry.markerRects.map((bal_r) => ({
      rect: {
        x: bal_r.x * BAL_PPM,
        y: bal_r.y * BAL_PPM,
        width: bal_r.width * BAL_PPM,
        height: bal_r.height * BAL_PPM
      },
      kind: 'marker' as const
    })),
    {
      rect: {
        x: bal_geometry.qrRect.x * BAL_PPM,
        y: bal_geometry.qrRect.y * BAL_PPM,
        width: bal_geometry.qrRect.width * BAL_PPM,
        height: bal_geometry.qrRect.height * BAL_PPM
      },
      kind: 'qr' as const
    }
  ];
}

function bal_assess(bal_normalized: ReturnType<typeof bal_render_canonical_page>, bal_overrides = {}) {
  return bal_assess_quality({
    normalized: bal_normalized,
    pxPerMm: BAL_PPM,
    alignmentConfidence: 'high',
    markersFound: 4,
    quadCoverage: 0.9,
    keyRegionsPx: bal_key_regions(),
    ...bal_overrides
  });
}

describe('quality assessment', () => {
  it('rates a clean page good on every aspect', () => {
    const bal_result = bal_assess(bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM));
    expect(bal_result.overallStatus).toBe('good');
    expect(bal_result.blurStatus).toBe('good');
    expect(bal_result.exposureStatus).toBe('good');
    expect(bal_result.glareStatus).toBe('good');
    expect(bal_result.resolutionStatus).toBe('good');
    expect(bal_result.croppingStatus).toBe('good');
    expect(bal_result.alignmentStatus).toBe('good');
    expect(bal_result.qualityIssues).toEqual([]);
  });

  it('produces the same result for the same input', () => {
    const bal_image = bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM);
    expect(JSON.stringify(bal_assess(bal_image))).toBe(JSON.stringify(bal_assess(bal_image)));
  });

  it('flags blur as confidence rises with smoothing', () => {
    const bal_page = bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM);
    expect(bal_assess(bal_box_blur(bal_page, 3)).blurStatus).toBe('warning');
    const bal_heavy = bal_assess(bal_box_blur(bal_page, 5));
    expect(bal_heavy.blurStatus).toBe('error');
    expect(bal_heavy.qualityIssues.some((bal_issue) => bal_issue.includes('blurry'))).toBe(true);
  });

  it('flags dark photos as an exposure error', () => {
    const bal_page = bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM);
    expect(bal_assess(bal_shift_exposure(bal_page, -190)).exposureStatus).toBe('error');
  });

  it('passes a moderately dim photo with no error', () => {
    const bal_page = bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM);
    expect(bal_assess(bal_shift_exposure(bal_page, -110)).exposureStatus).toBe('good');
  });

  it('flags washed-out photos as an exposure error', () => {
    const bal_page = bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM);
    expect(bal_assess(bal_shift_exposure(bal_page, 80)).exposureStatus).toBe('error');
  });

  it('rejects glare over the QR but allows margin glare', () => {
    const bal_geometry = bal_canonical_spec('S1|FFQ|1|001|1');
    const bal_page = bal_render_canonical_page(bal_geometry, BAL_PPM);
    const bal_glared = bal_add_glare_spot(
      bal_page,
      Math.round((bal_geometry.qrRect.x + 10) * BAL_PPM),
      Math.round((bal_geometry.qrRect.y + 10) * BAL_PPM),
      Math.round(9 * BAL_PPM)
    );
    expect(bal_assess(bal_glared).glareStatus).toBe('error');

    const bal_margin = bal_add_glare_spot(bal_page, Math.round(105 * BAL_PPM), Math.round(60 * BAL_PPM), Math.round(6 * BAL_PPM));
    expect(bal_assess(bal_margin).glareStatus).toBe('good');
  });

  it('flags insufficient resolution', () => {
    const bal_page = bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM);
    expect(bal_assess(bal_page, { pxPerMm: 2.2 }).resolutionStatus).toBe('error');
    expect(bal_assess(bal_page, { pxPerMm: 3.6 }).resolutionStatus).toBe('warning');
    expect(bal_assess(bal_page, { pxPerMm: 5 }).resolutionStatus).toBe('good');
  });

  it('flags small page coverage as a cropping warning', () => {
    const bal_page = bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM);
    expect(bal_assess(bal_page, { quadCoverage: 0.2 }).croppingStatus).toBe('warning');
  });

  it('warns when alignment was inferred', () => {
    const bal_page = bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM);
    const bal_result = bal_assess(bal_page, { alignmentConfidence: 'inferred', markersFound: 3 });
    expect(bal_result.alignmentStatus).toBe('warning');
    expect(bal_result.overallStatus).toBe('warning');
  });

  it('reports unknown aspects and error overall when no normalized page exists', () => {
    const bal_result = bal_assess_quality({
      normalized: null,
      pxPerMm: 0,
      alignmentConfidence: 'failed',
      markersFound: 1,
      quadCoverage: 0,
      keyRegionsPx: []
    });
    expect(bal_result.overallStatus).toBe('error');
    expect(bal_result.blurStatus).toBe('unknown');
    expect(bal_result.exposureStatus).toBe('unknown');
  });
});

describe('analysis helper', () => {
  it('downscales to at most the target width', () => {
    const bal_page = bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM);
    const bal_small = bal_downscale_gray(bal_page, 420);
    expect(bal_small.width).toBeLessThanOrEqual(420);
    expect(bal_small.width).toBeGreaterThan(300);
    const bal_page_small = bal_scale_image(bal_page, 0.1);
    expect(bal_downscale_gray(bal_page_small, 420).width).toBe(bal_page_small.width);
  });

  it('keeps cropped images width-aware', () => {
    const bal_page = bal_render_canonical_page(bal_canonical_spec('S1|FFQ|1|001|1'), BAL_PPM);
    const bal_cut = bal_crop_image(bal_page, 40);
    expect(bal_cut.width).toBe(bal_page.width - 40);
  });
});
