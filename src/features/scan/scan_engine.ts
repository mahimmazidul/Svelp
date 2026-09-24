import jsQR from 'jsqr';
import type { QualityResult } from '../../models/scan_models';
import { bal_align_and_normalize } from './scan_pipeline';
import { bal_assess_quality } from './scan_quality';

export interface bal_EngineInput {
  imageData: { data: Uint8ClampedArray; width: number; height: number };
  spec: {
    centersMm: { x: number; y: number }[];
    widthMm: number;
    heightMm: number;
    qrCenterMm?: { x: number; y: number };
  };
  outWidthPx: number;
  outHeightPx: number;
  pxPerMm: number;
  manualCorners?: { x: number; y: number }[] | null;
}

export interface bal_EngineResult {
  found: boolean;
  confidence: 'high' | 'inferred' | 'manual' | 'failed';
  markersFound: number;
  rotationApplied: 0 | 90 | 180 | 270;
  homography: number[] | null;
  normalized: { data: Uint8ClampedArray; width: number; height: number } | null;
  payloads: string[];
  orientationConfirmed: boolean;
  inferenceNote: string | null;
  residualPx: number;
  quadCoverage: number;
  quality: QualityResult;
}

function bal_decode_qr(bal_image: { data: Uint8ClampedArray; width: number; height: number }) {
  const bal_result = jsQR(bal_image.data, bal_image.width, bal_image.height, {
    inversionAttempts: 'attemptBoth'
  });
  if (!bal_result) return null;
  return { data: bal_result.data, location: bal_result.location };
}

export function bal_process_image(bal_input: bal_EngineInput): bal_EngineResult {
  const bal_outcome = bal_align_and_normalize({
    image: bal_input.imageData,
    spec: bal_input.spec,
    outWidthPx: bal_input.outWidthPx,
    outHeightPx: bal_input.outHeightPx,
    pxPerMm: bal_input.pxPerMm,
    decodeQr: bal_decode_qr,
    manualCorners: bal_input.manualCorners ?? null
  });
  const bal_key_regions: { rect: { x: number; y: number; width: number; height: number }; kind: 'marker' | 'qr' }[] = [];
  for (const bal_center of bal_input.spec.centersMm) {
    bal_key_regions.push({
      rect: {
        x: (bal_center.x - 3.5) * bal_input.pxPerMm,
        y: (bal_center.y - 3.5) * bal_input.pxPerMm,
        width: 7 * bal_input.pxPerMm,
        height: 7 * bal_input.pxPerMm
      },
      kind: 'marker'
    });
  }
  if (bal_input.spec.qrCenterMm) {
    bal_key_regions.push({
      rect: {
        x: (bal_input.spec.qrCenterMm.x - 11) * bal_input.pxPerMm,
        y: (bal_input.spec.qrCenterMm.y - 11) * bal_input.pxPerMm,
        width: 22 * bal_input.pxPerMm,
        height: 22 * bal_input.pxPerMm
      },
      kind: 'qr'
    });
  }
  const bal_quality = bal_assess_quality({
    normalized: bal_outcome.normalized,
    pxPerMm: bal_input.pxPerMm,
    alignmentConfidence: bal_outcome.confidence,
    markersFound: bal_outcome.markersFound,
    quadCoverage: bal_outcome.quadCoverage,
    keyRegionsPx: bal_key_regions
  });
  return {
    found: bal_outcome.found,
    confidence: bal_outcome.confidence,
    markersFound: bal_outcome.markersFound,
    rotationApplied: bal_outcome.rotationApplied,
    homography: bal_outcome.homography,
    normalized: bal_outcome.normalized,
    payloads: bal_outcome.payloads,
    orientationConfirmed: bal_outcome.orientationConfirmed,
    inferenceNote: bal_outcome.inferenceNote,
    residualPx: Number.isFinite(bal_outcome.residualPx) ? bal_outcome.residualPx : -1,
    quadCoverage: bal_outcome.quadCoverage,
    quality: bal_quality
  };
}
