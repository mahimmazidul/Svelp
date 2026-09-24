import type { QualityAspectStatus, QualityResult } from '../../models/scan_models';
import type { bal_SyntheticImage } from './scan_fixtures';

export interface bal_QualityThresholds {
  blurHigh: number;
  blurLow: number;
  darkMeanError: number;
  brightMeanError: number;
  darkMeanWarning: number;
  brightMeanWarning: number;
  markerInkFraction: number;
  qrInkFraction: number;
  minGoodPxPerMm: number;
  minWarningPxPerMm: number;
  minQuadCoverage: number;
}

export const BAL_DEFAULT_QUALITY_THRESHOLDS: bal_QualityThresholds = {
  blurHigh: 11.2,
  blurLow: 9.2,
  darkMeanError: 80,
  brightMeanError: 249,
  darkMeanWarning: 120,
  brightMeanWarning: 247.5,
  markerInkFraction: 0.5,
  qrInkFraction: 0.08,
  minGoodPxPerMm: 4.5,
  minWarningPxPerMm: 3,
  minQuadCoverage: 0.45
};

export interface bal_QualityInput {
  normalized: bal_SyntheticImage | null;
  pxPerMm: number;
  alignmentConfidence: 'high' | 'inferred' | 'manual' | 'failed';
  markersFound: number;
  quadCoverage: number;
  keyRegionsPx: { rect: { x: number; y: number; width: number; height: number }; kind: 'marker' | 'qr' }[];
  thresholds?: Partial<bal_QualityThresholds>;
}

function bal_gradient_energy(bal_gray: Uint8Array, bal_width: number, bal_height: number): number {
  let bal_sum = 0;
  let bal_count = 0;
  for (let bal_y = 1; bal_y < bal_height - 1; bal_y++) {
    for (let bal_x = 1; bal_x < bal_width - 1; bal_x++) {
      const bal_index = bal_y * bal_width + bal_x;
      const bal_gx = Math.abs(bal_gray[bal_index + 1] - bal_gray[bal_index - 1]);
      const bal_gy = Math.abs(bal_gray[bal_index + bal_width] - bal_gray[bal_index - bal_width]);
      bal_sum += bal_gx + bal_gy;
      bal_count += 1;
    }
  }
  return bal_count === 0 ? 0 : bal_sum / bal_count;
}

export function bal_downscale_gray(
  bal_image: bal_SyntheticImage,
  bal_target_width: number
): { gray: Uint8Array; width: number; height: number } {
  const bal_scale = Math.max(1, Math.ceil(bal_image.width / bal_target_width));
  const bal_width = Math.floor(bal_image.width / bal_scale);
  const bal_height = Math.floor(bal_image.height / bal_scale);
  const bal_gray = new Uint8Array(bal_width * bal_height);
  for (let bal_y = 0; bal_y < bal_height; bal_y++) {
    for (let bal_x = 0; bal_x < bal_width; bal_x++) {
      let bal_sum = 0;
      for (let bal_dy = 0; bal_dy < bal_scale; bal_dy++) {
        for (let bal_dx = 0; bal_dx < bal_scale; bal_dx++) {
          const bal_index = ((bal_y * bal_scale + bal_dy) * bal_image.width + bal_x * bal_scale + bal_dx) * 4;
          bal_sum +=
            0.299 * bal_image.data[bal_index] + 0.587 * bal_image.data[bal_index + 1] + 0.114 * bal_image.data[bal_index + 2];
        }
      }
      const bal_pixels = bal_scale * bal_scale;
      bal_gray[bal_y * bal_width + bal_x] = Math.round(bal_sum / bal_pixels);
    }
  }
  return { gray: bal_gray, width: bal_width, height: bal_height };
}

function bal_region_ink_fraction(
  bal_image: bal_SyntheticImage,
  bal_region: { x: number; y: number; width: number; height: number }
): number {
  const bal_x0 = Math.max(0, Math.round(bal_region.x));
  const bal_y0 = Math.max(0, Math.round(bal_region.y));
  const bal_x1 = Math.min(bal_image.width, Math.round(bal_region.x + bal_region.width));
  const bal_y1 = Math.min(bal_image.height, Math.round(bal_region.y + bal_region.height));
  let bal_ink = 0;
  let bal_total = 0;
  for (let bal_y = bal_y0; bal_y < bal_y1; bal_y++) {
    for (let bal_x = bal_x0; bal_x < bal_x1; bal_x++) {
      if (bal_image.data[(bal_y * bal_image.width + bal_x) * 4] < 128) bal_ink += 1;
      bal_total += 1;
    }
  }
  return bal_total === 0 ? 0 : bal_ink / bal_total;
}

export function bal_assess_quality(bal_input: bal_QualityInput): QualityResult {
  const bal_t = { ...BAL_DEFAULT_QUALITY_THRESHOLDS, ...bal_input.thresholds };
  const bal_issues: string[] = [];

  let bal_mean_gray = 255;
  const bal_blur_status: QualityAspectStatus = bal_input.normalized
    ? (() => {
        const bal_analysis = bal_downscale_gray(bal_input.normalized, 420);
        let bal_sum = 0;
        for (let bal_i = 0; bal_i < bal_analysis.gray.length; bal_i++) bal_sum += bal_analysis.gray[bal_i];
        bal_mean_gray = bal_sum / bal_analysis.gray.length;
        const bal_energy = bal_gradient_energy(bal_analysis.gray, bal_analysis.width, bal_analysis.height);
        if (bal_energy >= bal_t.blurHigh) return 'good';
        if (bal_energy >= bal_t.blurLow) {
          bal_issues.push('The page looks soft; text may be hard to read.');
          return 'warning';
        }
        bal_issues.push('The page is too blurry to read reliably.');
        return 'error';
      })()
    : 'unknown';

  const bal_exposure_status: QualityAspectStatus = bal_input.normalized
    ? (() => {
        if (bal_mean_gray < bal_t.darkMeanError) {
          bal_issues.push('The photo is too dark across most of the page.');
          return 'error';
        }
        if (bal_mean_gray > bal_t.brightMeanError) {
          bal_issues.push('The photo is washed out; ink has faded into the paper.');
          return 'error';
        }
        if (bal_mean_gray < bal_t.darkMeanWarning || bal_mean_gray > bal_t.brightMeanWarning) {
          bal_issues.push('The photo brightness is extreme; check readability.');
          return 'warning';
        }
        return 'good';
      })()
    : 'unknown';

  const bal_glare_status: QualityAspectStatus = bal_input.normalized
    ? (() => {
        for (const bal_key of bal_input.keyRegionsPx) {
          const bal_ink = bal_region_ink_fraction(bal_input.normalized!, bal_key.rect);
          if (bal_key.kind === 'marker' && bal_ink < bal_t.markerInkFraction) {
            bal_issues.push('An alignment marker is washed out by glare or fading.');
            return 'error';
          }
          if (bal_key.kind === 'qr' && bal_ink < bal_t.qrInkFraction) {
            bal_issues.push('The code area looks washed out by glare.');
            return 'error';
          }
        }
        return 'good';
      })()
    : 'unknown';

  const bal_resolution_status: QualityAspectStatus = (() => {
    if (bal_input.pxPerMm >= bal_t.minGoodPxPerMm) return 'good';
    if (bal_input.pxPerMm >= bal_t.minWarningPxPerMm) {
      bal_issues.push('The photo resolution is low; small text may be unclear.');
      return 'warning';
    }
    bal_issues.push('The photo resolution is too low for reliable reading.');
    return 'error';
  })();

  const bal_cropping_status: QualityAspectStatus = (() => {
    if (bal_input.quadCoverage < bal_t.minQuadCoverage) {
      bal_issues.push('The page fills only a small part of the photo.');
      return 'warning';
    }
    return 'good';
  })();

  const bal_alignment_status: QualityAspectStatus = (() => {
    if (bal_input.alignmentConfidence === 'high' || bal_input.alignmentConfidence === 'manual') return 'good';
    if (bal_input.alignmentConfidence === 'inferred') {
      bal_issues.push('One alignment marker was inferred; check the page edges.');
      return 'warning';
    }
    bal_issues.push('The page edges could not be recovered.');
    return 'error';
  })();

  const bal_statuses = [
    bal_blur_status,
    bal_exposure_status,
    bal_glare_status,
    bal_resolution_status,
    bal_cropping_status,
    bal_alignment_status
  ];
  const bal_overall = bal_statuses.includes('error')
    ? 'error'
    : bal_statuses.includes('warning')
      ? 'warning'
      : 'good';

  return {
    overallStatus: bal_overall,
    blurStatus: bal_blur_status,
    exposureStatus: bal_exposure_status,
    glareStatus: bal_glare_status,
    alignmentStatus: bal_alignment_status,
    resolutionStatus: bal_resolution_status,
    croppingStatus: bal_cropping_status,
    qualityIssues: bal_issues
  };
}
