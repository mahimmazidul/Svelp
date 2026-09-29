import type { RecognitionStatus, RecognitionThresholdProfile } from '../../models/response_models';
import type { bal_MarkResult } from './reading_marks';

export interface bal_QualitySignals {
  blurStatus: string;
  exposureStatus: string;
  glareStatus: string;
  resolutionStatus: string;
  alignmentStatus: string;
}

export interface bal_OptionMark {
  optionId: string | null;
  optionCode: string | null;
  columnId: string | null;
  mark: bal_MarkResult;
}

export interface bal_ItemReading {
  itemId: string;
  variableName: string | null;
  itemType: string;
  kind: string;
  rowId: string | null;
  status: RecognitionStatus;
  value: { optionId: string | null; optionCode: string | null; columnId: string | null }[];
  codedValue: string[] | null;
  confidence: number | null;
  reason: string;
  markedCount: number;
}

export interface bal_SelectionRules {
  minSelections: number | null;
  maxSelections: number | null;
}

function bal_clamp01(bal_value: number): number {
  return Math.max(0, Math.min(1, bal_value));
}

function bal_depth_factor(bal_mark: { inkDepth: number }): number {
  const bal_factor = bal_clamp01((bal_mark.inkDepth - 0.15) / 0.45);
  return 0.4 + 0.6 * bal_factor;
}

export function bal_quality_factor(bal_quality: bal_QualitySignals): number {
  const bal_error =
    bal_quality.blurStatus === 'error' ||
    bal_quality.exposureStatus === 'error' ||
    bal_quality.resolutionStatus === 'error' ||
    bal_quality.alignmentStatus === 'error';
  if (bal_error) return 0;
  const bal_warning =
    bal_quality.blurStatus === 'warning' ||
    bal_quality.exposureStatus === 'warning' ||
    bal_quality.resolutionStatus === 'warning' ||
    bal_quality.alignmentStatus === 'warning';
  return bal_warning ? 0.85 : 1;
}

function bal_sorted_by_evidence(bal_options: bal_OptionMark[]): bal_OptionMark[] {
  return [...bal_options].sort(
    (bal_a, bal_b) => bal_b.mark.normalizedInkScore - bal_a.mark.normalizedInkScore
  );
}

export function bal_interpret_single_choice(
  bal_item_id: string,
  bal_variable_name: string | null,
  bal_item_type: string,
  bal_row_id: string | null,
  bal_options: bal_OptionMark[],
  bal_quality: bal_QualitySignals,
  bal_profile: RecognitionThresholdProfile
): bal_ItemReading {
  const bal_base = {
    itemId: bal_item_id,
    variableName: bal_variable_name,
    itemType: bal_item_type,
    kind: 'choice',
    rowId: bal_row_id
  };
  if (bal_options.some((bal_option) => bal_option.mark.glareExceeded)) {
    return {
      ...bal_base,
      status: 'unreadable',
      value: [],
      codedValue: null,
      confidence: null,
      reason: 'Glare or a bright spot covers part of this answer area.',
      markedCount: 0
    };
  }
  const bal_sorted = bal_sorted_by_evidence(bal_options);
  const bal_marked = bal_sorted.filter((bal_option) => bal_option.mark.markDetected);
  const bal_factor = bal_quality_factor(bal_quality);
  if (bal_marked.length >= 2) {
    return {
      ...bal_base,
      status: 'multiple-marks',
      value: bal_marked.map((bal_option) => ({
        optionId: bal_option.optionId,
        optionCode: bal_option.optionCode,
        columnId: bal_option.columnId
      })),
      codedValue: null,
      confidence: bal_clamp01(bal_marked[0].mark.normalizedInkScore) * (bal_factor || 0.4),
      reason:
        bal_marked.length === 2 &&
        bal_marked[1].mark.normalizedInkScore / Math.max(0.001, bal_marked[0].mark.normalizedInkScore) <
          bal_profile.ambiguitySeparation
          ? 'Two options are marked about equally strongly.'
          : `${bal_marked.length} options carry marks; the intended single answer is unclear.`,
      markedCount: bal_marked.length
    };
  }
  if (bal_marked.length === 1) {
    const bal_top = bal_marked[0];
    const bal_second = bal_sorted.find((bal_option) => !bal_option.mark.markDetected);
    const bal_s1 = bal_top.mark.normalizedInkScore;
    const bal_s2 = bal_second ? bal_second.mark.normalizedInkScore : 0;
    const bal_separation = bal_s1 <= 0 ? 0 : bal_clamp01((bal_s1 - bal_s2) / bal_s1);
    const bal_noise_term = bal_clamp01(1 - bal_top.mark.localNoiseEstimate * 10);
    const bal_confidence =
      bal_clamp01(0.5 * bal_s1 + 0.35 * bal_separation + 0.15 * bal_noise_term) *
      bal_factor *
      bal_depth_factor(bal_top.mark);
    const bal_status: RecognitionStatus =
      bal_s1 < 0.25
        ? 'needs-review'
        : bal_confidence >= bal_profile.acceptanceConfidence
          ? 'accepted'
          : 'needs-review';
    return {
      ...bal_base,
      status: bal_status,
      value: [
        { optionId: bal_top.optionId, optionCode: bal_top.optionCode, columnId: bal_top.columnId }
      ],
      codedValue: bal_top.optionCode ? [bal_top.optionCode] : null,
      confidence: bal_confidence,
      reason:
        bal_status === 'accepted'
          ? 'One clear mark.'
          : bal_s1 < 0.25
            ? 'The mark is very light.'
            : 'The mark is not clearly separated from other options.',
      markedCount: 1
    };
  }
  const bal_max_score = bal_sorted.length > 0 ? bal_sorted[0].mark.normalizedInkScore : 0;
  if (bal_max_score < bal_profile.ambiguousFloorRatio) {
    return {
      ...bal_base,
      status: 'blank',
      value: [],
      codedValue: null,
      confidence: bal_clamp01(1 - bal_max_score / Math.max(0.001, bal_profile.ambiguousFloorRatio)),
      reason: 'No mark detected.',
      markedCount: 0
    };
  }
  return {
    ...bal_base,
    status: 'ambiguous',
    value: [],
    codedValue: null,
    confidence: bal_max_score * bal_factor,
    reason: 'There is some ink but it is too light to read as a mark.',
    markedCount: 0
  };
}

export function bal_interpret_multiple_choice(
  bal_item_id: string,
  bal_variable_name: string | null,
  bal_item_type: string,
  bal_row_id: string | null,
  bal_options: bal_OptionMark[],
  bal_rules: bal_SelectionRules,
  bal_quality: bal_QualitySignals,
  bal_profile: RecognitionThresholdProfile
): bal_ItemReading {
  const bal_base = {
    itemId: bal_item_id,
    variableName: bal_variable_name,
    itemType: bal_item_type,
    kind: 'choice',
    rowId: bal_row_id
  };
  if (bal_options.some((bal_option) => bal_option.mark.glareExceeded)) {
    return {
      ...bal_base,
      status: 'unreadable',
      value: [],
      codedValue: null,
      confidence: null,
      reason: 'Glare or a bright spot covers part of this answer area.',
      markedCount: 0
    };
  }
  const bal_marked = bal_sorted_by_evidence(bal_options).filter((bal_option) => bal_option.mark.markDetected);
  const bal_factor = bal_quality_factor(bal_quality);
  const bal_value = bal_marked.map((bal_option) => ({
    optionId: bal_option.optionId,
    optionCode: bal_option.optionCode,
    columnId: bal_option.columnId
  }));
  if (bal_marked.length === 0) {
    const bal_max_score =
      bal_options.length > 0
        ? Math.max(...bal_options.map((bal_option) => bal_option.mark.normalizedInkScore))
        : 0;
    if (bal_max_score < bal_profile.ambiguousFloorRatio) {
      return {
        ...bal_base,
        status: 'blank',
        value: [],
        codedValue: null,
        confidence: bal_clamp01(1 - bal_max_score / Math.max(0.001, bal_profile.ambiguousFloorRatio)),
        reason: 'No mark detected.',
        markedCount: 0
      };
    }
    return {
      ...bal_base,
      status: 'ambiguous',
      value: [],
      codedValue: null,
      confidence: bal_max_score * bal_factor,
      reason: 'There is some ink but it is too light to read as a mark.',
      markedCount: 0
    };
  }
  if (bal_rules.maxSelections !== null && bal_marked.length > bal_rules.maxSelections) {
    return {
      ...bal_base,
      status: 'multiple-marks',
      value: bal_value,
      codedValue: null,
      confidence: null,
      reason: `${bal_marked.length} options are marked but at most ${bal_rules.maxSelections} selection${bal_rules.maxSelections === 1 ? '' : 's'} are allowed.`,
      markedCount: bal_marked.length
    };
  }
  if (bal_rules.minSelections !== null && bal_marked.length < bal_rules.minSelections) {
    return {
      ...bal_base,
      status: 'needs-review',
      value: bal_value,
      codedValue: null,
      confidence: null,
      reason: `At least ${bal_rules.minSelections} selection${bal_rules.minSelections === 1 ? '' : 's'} are expected.`,
      markedCount: bal_marked.length
    };
  }
  const bal_unmarked_max = Math.max(
    0,
    ...bal_options
      .filter((bal_option) => !bal_option.mark.markDetected)
      .map((bal_option) => bal_option.mark.normalizedInkScore)
  );
  const bal_weakest = bal_marked[bal_marked.length - 1].mark.normalizedInkScore;
  const bal_separation = bal_clamp01((bal_weakest - bal_unmarked_max) / Math.max(0.001, bal_weakest));
  const bal_avg_clarity =
    bal_marked.reduce((bal_sum, bal_option) => bal_sum + bal_option.mark.normalizedInkScore, 0) /
    bal_marked.length;
  const bal_depth =
    bal_marked.reduce((bal_sum, bal_option) => bal_sum + bal_depth_factor(bal_option.mark), 0) /
    bal_marked.length;
  const bal_confidence =
    bal_clamp01(0.6 * bal_avg_clarity + 0.3 * bal_separation + 0.1 * (1 - Math.min(1, bal_marked[0].mark.localNoiseEstimate * 10))) *
    bal_factor *
    bal_depth;
  return {
    ...bal_base,
    status: bal_confidence >= bal_profile.acceptanceConfidence ? 'accepted' : 'needs-review',
    value: bal_value,
    codedValue: null,
    confidence: bal_confidence,
    reason: bal_confidence >= bal_profile.acceptanceConfidence ? 'Marks are clear.' : 'Marks need a second look.',
    markedCount: bal_marked.length
  };
}

export function bal_interpret_consent(
  bal_item_id: string,
  bal_options: bal_OptionMark[],
  bal_quality: bal_QualitySignals
): bal_ItemReading {
  const bal_base = {
    itemId: bal_item_id,
    variableName: null,
    itemType: 'consent',
    kind: 'consent',
    rowId: null
  };
  const bal_option = bal_options[0];
  if (!bal_option) {
    return {
      ...bal_base,
      status: 'unreadable',
      value: [],
      codedValue: null,
      confidence: null,
      reason: 'No confirmation box was found.',
      markedCount: 0
    };
  }
  if (bal_option.mark.glareExceeded) {
    return {
      ...bal_base,
      status: 'unreadable',
      value: [],
      codedValue: null,
      confidence: null,
      reason: 'Glare covers the confirmation box.',
      markedCount: 0
    };
  }
  const bal_factor = bal_quality_factor(bal_quality);
  if (bal_option.mark.markDetected) {
    const bal_confidence = bal_clamp01(bal_option.mark.normalizedInkScore) * bal_factor * bal_depth_factor(bal_option.mark);
    return {
      ...bal_base,
      status: bal_confidence >= 0.5 ? 'accepted' : 'needs-review',
      value: [{ optionId: null, optionCode: 'confirmed', columnId: null }],
      codedValue: ['confirmed'],
      confidence: bal_confidence,
      reason: 'The confirmation box carries a mark.',
      markedCount: 1
    };
  }
  return {
    ...bal_base,
    status: 'blank',
    value: [],
    codedValue: null,
    confidence: bal_clamp01(1 - bal_option.mark.normalizedInkScore / Math.max(0.001, 0.025)),
    reason: 'The confirmation box appears empty.',
    markedCount: 0
  };
}
