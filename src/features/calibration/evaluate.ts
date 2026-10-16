import {
  BAL_DEFAULT_THRESHOLD_PROFILE,
  type RecognitionThresholdProfile
} from '../../models/response_models';
import type { bal_PrintDocument } from '../print/print_layout';
import { bal_process_image } from '../scan/scan_engine';
import { bal_read_page } from '../reading/reading_engine';
import type { bal_QualitySignals } from '../reading/reading_interpret';
import { bal_selection_rules_from_questionnaire } from '../reading/reading_geometry';
import type { bal_MarkSpec } from '../reading/reading_fixtures';
import { bal_apply_degradations, type bal_CapturePreset } from './degradation';
import { bal_compose_blank_photo, bal_paint_marks } from './page_frame';
import {
  bal_is_review_expected,
  type bal_GroundTruthAnswer,
  type bal_GroundTruthPage
} from './calibration_ground_truth';

export type bal_FailureKind =
  | 'false-accept-wrong-value'
  | 'false-accept-should-not-accept'
  | 'missed-mark'
  | 'unnecessary-review'
  | 'missed-review'
  | 'blank-routed-review'
  | 'manual-misroute';

export interface bal_SampleFailure {
  itemId: string;
  rowId: string | null;
  kind: bal_FailureKind;
  detail: string;
}

export interface bal_SampleCounters {
  answers: number;
  expectedAccepts: number;
  expectedBlanks: number;
  expectedReview: number;
  correctAutoAccepts: number;
  falseAutoAccepts: number;
  correctReviewRouting: number;
  unnecessaryReviews: number;
  missedReviews: number;
  correctBlanks: number;
  blankReviewRouted: number;
  missedMarks: number;
  unreadableDetections: number;
  manualOnlyExpected: number;
  manualOnlyRecognized: number;
}

export interface bal_SampleResult {
  sampleId: string;
  density: string;
  presetId: string;
  category: string;
  pageNumber: number;
  answerCount: number;
  regionCount: number;
  normalizationOk: boolean;
  markersFound: number;
  qrDecoded: boolean;
  durationMs: number;
  identifyMs: number;
  readMs: number;
  counters: bal_SampleCounters;
  failures: bal_SampleFailure[];
  acceptedConfidences: number[];
  falseAcceptConfidences: number[];
  reviewSeparations: number[];
}

const BAL_REVIEW_STATUSES = new Set(['needs-review', 'ambiguous', 'multiple-marks', 'unreadable']);

function bal_ids_match(bal_observed: { optionId: string | null; columnId: string | null }[], bal_expected: string[]): boolean {
  const bal_observed_ids = bal_observed
    .map((bal_v) => bal_v.columnId ?? bal_v.optionId ?? '')
    .slice()
    .sort();
  const bal_expected_ids = bal_expected.slice().sort();
  if (bal_observed_ids.length !== bal_expected_ids.length) return false;
  return bal_observed_ids.every((bal_id, bal_i) => bal_id === bal_expected_ids[bal_i]);
}

export interface bal_EvaluateSampleInput {
  sampleId: string;
  density: string;
  preset: bal_CapturePreset;
  doc: bal_PrintDocument;
  questionnaire: import('../../models/types').QuestionnaireRecord;
  pageNumber: number;
  ppm: number;
  marks: bal_MarkSpec[];
  groundTruth: bal_GroundTruthPage;
  profile?: RecognitionThresholdProfile;
}

export function bal_evaluate_sample(bal_input: bal_EvaluateSampleInput): bal_SampleResult {
  const bal_profile = bal_input.profile ?? BAL_DEFAULT_THRESHOLD_PROFILE;
  const bal_counters: bal_SampleCounters = {
    answers: 0,
    expectedAccepts: 0,
    expectedBlanks: 0,
    expectedReview: 0,
    correctAutoAccepts: 0,
    falseAutoAccepts: 0,
    correctReviewRouting: 0,
    unnecessaryReviews: 0,
    missedReviews: 0,
    correctBlanks: 0,
    blankReviewRouted: 0,
    missedMarks: 0,
    unreadableDetections: 0,
    manualOnlyExpected: 0,
    manualOnlyRecognized: 0
  };
  const bal_failures: bal_SampleFailure[] = [];
  const bal_accepted_confidences: number[] = [];
  const bal_false_accept_confidences: number[] = [];
  const bal_review_separations: number[] = [];

  const bal_frame = bal_compose_blank_photo(bal_input.doc, bal_input.pageNumber, bal_input.ppm);
  if (!bal_frame) {
    return {
      sampleId: bal_input.sampleId,
      density: bal_input.density,
      presetId: bal_input.preset.id,
      category: bal_input.preset.category,
      pageNumber: bal_input.pageNumber,
      answerCount: 0,
      regionCount: 0,
      normalizationOk: false,
      markersFound: 0,
      qrDecoded: false,
      durationMs: 0,
      identifyMs: 0,
      readMs: 0,
      counters: bal_counters,
      failures: [{ itemId: 'page', rowId: null, kind: 'false-accept-should-not-accept', detail: 'page frame missing' }],
      acceptedConfidences: [],
      falseAcceptConfidences: [],
      reviewSeparations: []
    };
  }
  const bal_scan = bal_paint_marks(bal_frame.blank, bal_frame.regions, bal_input.marks, bal_input.ppm);
  const bal_photo = bal_apply_degradations(bal_scan, bal_input.preset.ops);

  const bal_t0 = performance.now();
  const bal_engine = bal_process_image({
    imageData: bal_photo,
    spec: {
      centersMm: bal_frame.markerCentersMm,
      widthMm: bal_frame.widthMm,
      heightMm: bal_frame.heightMm,
      qrCenterMm: bal_frame.qrCenterMm
    },
    outWidthPx: bal_frame.blank.width,
    outHeightPx: bal_frame.blank.height,
    pxPerMm: bal_input.ppm
  });
  const bal_t1 = performance.now();
  const bal_qr_decoded = bal_engine.payloads.includes(bal_input.groundTruth.qrPayload);

  const bal_expected_by_key = new Map<string, bal_GroundTruthAnswer>();
  for (const bal_answer of bal_input.groundTruth.answers) {
    bal_expected_by_key.set(`${bal_answer.itemId}::${bal_answer.rowId ?? ''}`, bal_answer);
  }

  let bal_read_items: ReturnType<typeof bal_read_page>['items'] = [];
  let bal_manual_regions: { itemId: string }[] = [];
  let bal_read_ms = 0;
  if (bal_engine.found && bal_engine.normalized) {
    const bal_quality: bal_QualitySignals = {
      blurStatus: bal_engine.quality.blurStatus,
      exposureStatus: bal_engine.quality.exposureStatus,
      glareStatus: bal_engine.quality.glareStatus,
      resolutionStatus: bal_engine.quality.resolutionStatus,
      alignmentStatus: bal_engine.quality.alignmentStatus
    };
    const bal_rules = bal_selection_rules_from_questionnaire(bal_input.questionnaire);
    const bal_t2 = performance.now();
    const bal_read = bal_read_page({
      image: bal_engine.normalized,
      blank: bal_frame.blank,
      regions: bal_frame.regions,
      quality: bal_quality,
      pxPerMm: bal_input.ppm,
      profile: bal_profile,
      selectionRules: bal_rules
    });
    bal_read_ms = performance.now() - bal_t2;
    bal_read_items = bal_read.items;
    bal_manual_regions = bal_read.manualOnlyRegions;
  }

  const bal_read_by_key = new Map<string, (typeof bal_read_items)[number]>();
  for (const bal_item of bal_read_items) {
    bal_read_by_key.set(`${bal_item.itemId}::${bal_item.rowId ?? ''}`, bal_item);
  }

  for (const bal_answer of bal_expected_by_key.values()) {
    bal_counters.answers += 1;
    if (bal_answer.expectedStatus === 'manual-only') {
      bal_counters.manualOnlyExpected += 1;
      const bal_is_manual = bal_manual_regions.some((bal_region) => bal_region.itemId === bal_answer.itemId);
      if (bal_is_manual) bal_counters.manualOnlyRecognized += 1;
      else {
        bal_failures.push({
          itemId: bal_answer.itemId,
          rowId: bal_answer.rowId,
          kind: 'manual-misroute',
          detail: 'manual-only field was not preserved'
        });
      }
      continue;
    }
    const bal_observed = bal_read_by_key.get(`${bal_answer.itemId}::${bal_answer.rowId ?? ''}`);
    if (!bal_observed) {
      if (bal_answer.expectedStatus === 'blank') bal_counters.correctBlanks += 1;
      else bal_counters.missedMarks += 1;
      continue;
    }
    if (bal_answer.expectedStatus === 'accept') {
      bal_counters.expectedAccepts += 1;
      if (bal_observed.status === 'accepted') {
        if (bal_ids_match(bal_observed.value, bal_answer.expectedValue)) {
          bal_counters.correctAutoAccepts += 1;
          if (bal_observed.confidence !== null) bal_accepted_confidences.push(bal_observed.confidence);
        } else {
          bal_counters.falseAutoAccepts += 1;
          if (bal_observed.confidence !== null) bal_false_accept_confidences.push(bal_observed.confidence);
          bal_failures.push({
            itemId: bal_answer.itemId,
            rowId: bal_answer.rowId,
            kind: 'false-accept-wrong-value',
            detail: `accepted ${bal_observed.value.map((bal_v) => bal_v.columnId ?? bal_v.optionId).join('/')} expected ${bal_answer.expectedValue.join('/')}`
          });
        }
      } else if (BAL_REVIEW_STATUSES.has(bal_observed.status)) {
        bal_counters.unnecessaryReviews += 1;
        bal_failures.push({
          itemId: bal_answer.itemId,
          rowId: bal_answer.rowId,
          kind: 'unnecessary-review',
          detail: `${bal_observed.status}: ${bal_observed.reason}`
        });
      } else if (bal_observed.status === 'blank') {
        bal_counters.missedMarks += 1;
        bal_failures.push({
          itemId: bal_answer.itemId,
          rowId: bal_answer.rowId,
          kind: 'missed-mark',
          detail: 'mark not detected, question reads blank'
        });
      }
      continue;
    }
    if (bal_answer.expectedStatus === 'blank') {
      bal_counters.expectedBlanks += 1;
      if (bal_observed.status === 'blank') {
        bal_counters.correctBlanks += 1;
      } else if (bal_observed.status === 'accepted') {
        bal_counters.falseAutoAccepts += 1;
        if (bal_observed.confidence !== null) bal_false_accept_confidences.push(bal_observed.confidence);
        bal_failures.push({
          itemId: bal_answer.itemId,
          rowId: bal_answer.rowId,
          kind: 'false-accept-should-not-accept',
          detail: `blank expected but accepted ${bal_observed.value.map((bal_v) => bal_v.columnId ?? bal_v.optionId).join('/')}`
        });
      } else if (BAL_REVIEW_STATUSES.has(bal_observed.status)) {
        bal_counters.blankReviewRouted += 1;
        bal_failures.push({
          itemId: bal_answer.itemId,
          rowId: bal_answer.rowId,
          kind: 'blank-routed-review',
          detail: `${bal_observed.status}: ${bal_observed.reason}`
        });
      }
      continue;
    }
    if (bal_is_review_expected(bal_answer.expectedStatus)) {
      bal_counters.expectedReview += 1;
      if (BAL_REVIEW_STATUSES.has(bal_observed.status)) {
        bal_counters.correctReviewRouting += 1;
        if (bal_observed.status === 'unreadable') bal_counters.unreadableDetections += 1;
        if (bal_answer.expectedStatus === 'ambiguous' && bal_observed.status === 'needs-review') {
          bal_review_separations.push(bal_observed.markedCount);
        }
      } else if (bal_observed.status === 'accepted') {
        bal_counters.falseAutoAccepts += 1;
        if (bal_observed.confidence !== null) bal_false_accept_confidences.push(bal_observed.confidence);
        bal_failures.push({
          itemId: bal_answer.itemId,
          rowId: bal_answer.rowId,
          kind: 'false-accept-should-not-accept',
          detail: `expected ${bal_answer.expectedStatus} but accepted ${bal_observed.value.map((bal_v) => bal_v.columnId ?? bal_v.optionId).join('/')}`
        });
      } else if (bal_observed.status === 'blank') {
        bal_counters.missedReviews += 1;
        bal_failures.push({
          itemId: bal_answer.itemId,
          rowId: bal_answer.rowId,
          kind: 'missed-review',
          detail: `expected ${bal_answer.expectedStatus} but read as blank`
        });
      }
    }
  }

  return {
    sampleId: bal_input.sampleId,
    density: bal_input.density,
    presetId: bal_input.preset.id,
    category: bal_input.preset.category,
    pageNumber: bal_input.pageNumber,
    answerCount: bal_counters.answers,
    regionCount: bal_frame.regions.length,
    normalizationOk: bal_engine.found && bal_engine.normalized !== null,
    markersFound: bal_engine.markersFound,
    qrDecoded: bal_qr_decoded,
    durationMs: performance.now() - bal_t0,
    identifyMs: bal_t1 - bal_t0,
    readMs: bal_read_ms,
    counters: bal_counters,
    failures: bal_failures,
    acceptedConfidences: bal_accepted_confidences,
    falseAcceptConfidences: bal_false_accept_confidences,
    reviewSeparations: bal_review_separations
  };
}
