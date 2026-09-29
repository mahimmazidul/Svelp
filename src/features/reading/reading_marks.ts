import type { RecognitionThresholdProfile } from '../../models/response_models';
import type { bal_RegionFeatures } from './reading_extract';

export interface bal_MarkDiagnostics {
  addedRatio: number;
  centerRatio: number;
  strokeArea: number;
  strokeDarkArea: number;
  meanInkDepth: number;
  glareRatio: number;
  effectiveCenterRatio: number;
  effectiveAddedRatio: number;
  noiseFloor: number;
  glareExceeded: boolean;
}

export interface bal_MarkResult {
  markDetected: boolean;
  rawInkScore: number;
  normalizedInkScore: number;
  localNoiseEstimate: number;
  inkDepth: number;
  confidence: number;
  glareExceeded: boolean;
  diagnostics: bal_MarkDiagnostics;
}

export interface bal_CalibratedThresholds {
  noiseFloor: number;
}

export function bal_page_noise_floor(bal_features: bal_RegionFeatures[]): number {
  if (bal_features.length === 0) return 0;
  const bal_sorted = [...bal_features].map((bal_f) => bal_f.ringNoise).sort((bal_a, bal_b) => bal_a - bal_b);
  const bal_mid = Math.floor(bal_sorted.length / 2);
  const bal_median =
    bal_sorted.length % 2 === 0 ? (bal_sorted[bal_mid - 1] + bal_sorted[bal_mid]) / 2 : bal_sorted[bal_mid];
  return bal_median;
}

export function bal_calibrate_thresholds(
  bal_features: bal_RegionFeatures[],
  _bal_profile: RecognitionThresholdProfile
): bal_CalibratedThresholds {
  return { noiseFloor: bal_page_noise_floor(bal_features) };
}

function bal_clamp01(bal_value: number): number {
  return Math.max(0, Math.min(1, bal_value));
}

export function bal_score_region(
  bal_features: bal_RegionFeatures,
  bal_calibrated: bal_CalibratedThresholds,
  bal_profile: RecognitionThresholdProfile
): bal_MarkResult {
  const bal_local_noise = Math.max(bal_features.ringNoise, bal_calibrated.noiseFloor);
  const bal_effective_center = Math.max(bal_profile.markCenterRatio, bal_local_noise * bal_profile.noiseMultiplier);
  const bal_effective_added = Math.max(bal_profile.markAddedRatio, bal_local_noise * bal_profile.noiseMultiplier * 1.6);
  const bal_glare_exceeded = bal_features.glareRatio > bal_profile.glareFractionMax;
  const bal_by_center = bal_features.centerRatio >= bal_effective_center && bal_features.addedRatio >= bal_effective_added;
  const bal_by_stroke = bal_features.strokeDarkArea >= bal_profile.strokeAreaPx;
  const bal_by_light_cover =
    bal_features.strokeArea >= bal_profile.strokeAreaPx * 8 && bal_features.centerRatio >= bal_effective_center;
  const bal_detected = !bal_glare_exceeded && (bal_by_center || bal_by_stroke || bal_by_light_cover);
  const bal_clarity = bal_clamp01(bal_features.centerRatio / 0.3);
  const bal_stroke_clarity = bal_clamp01(bal_features.strokeDarkArea / (bal_profile.strokeAreaPx * 8));
  const bal_evidence = Math.max(bal_clarity, bal_stroke_clarity);
  return {
    markDetected: bal_detected,
    rawInkScore: bal_features.addedRatio,
    normalizedInkScore: bal_evidence,
    localNoiseEstimate: bal_local_noise,
    inkDepth: bal_features.meanInkDepth,
    confidence: bal_evidence,
    glareExceeded: bal_glare_exceeded,
    diagnostics: {
      addedRatio: bal_features.addedRatio,
      centerRatio: bal_features.centerRatio,
      strokeArea: bal_features.strokeArea,
      strokeDarkArea: bal_features.strokeDarkArea,
      meanInkDepth: bal_features.meanInkDepth,
      glareRatio: bal_features.glareRatio,
      effectiveCenterRatio: bal_effective_center,
      effectiveAddedRatio: bal_effective_added,
      noiseFloor: bal_local_noise,
      glareExceeded: bal_glare_exceeded
    }
  };
}
