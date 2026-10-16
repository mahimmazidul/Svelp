import type { bal_SampleResult } from './evaluate';

export interface bal_CalibrationMetrics {
  label: string;
  samples: number;
  answers: number;
  expectedAccepts: number;
  expectedBlanks: number;
  expectedReview: number;
  correctAutoAccepts: number;
  falseAutoAccepts: number;
  falseAutoAcceptRate: number;
  autoAcceptRate: number;
  correctReviewRouting: number;
  unnecessaryReviews: number;
  missedReviews: number;
  reviewRouteRate: number;
  correctBlanks: number;
  blankReviewRouted: number;
  blankPrecision: number;
  blankRecall: number;
  missedMarks: number;
  unreadableDetections: number;
  manualOnlyExpected: number;
  manualOnlyRecognized: number;
  qrSuccessRate: number;
  normalizationSuccessRate: number;
  meanIdentifyMs: number;
  meanReadMs: number;
  meanMsPerPage: number;
}

export function bal_aggregate_metrics(bal_label: string, bal_samples: bal_SampleResult[]): bal_CalibrationMetrics {
  const bal_totals = {
    samples: bal_samples.length,
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
    manualOnlyRecognized: 0,
    qrDecoded: 0,
    normalized: 0,
    identifyMs: 0,
    readMs: 0,
    durationMs: 0
  };
  for (const bal_sample of bal_samples) {
    bal_totals.answers += bal_sample.counters.answers;
    bal_totals.expectedAccepts += bal_sample.counters.expectedAccepts;
    bal_totals.expectedBlanks += bal_sample.counters.expectedBlanks;
    bal_totals.expectedReview += bal_sample.counters.expectedReview;
    bal_totals.correctAutoAccepts += bal_sample.counters.correctAutoAccepts;
    bal_totals.falseAutoAccepts += bal_sample.counters.falseAutoAccepts;
    bal_totals.correctReviewRouting += bal_sample.counters.correctReviewRouting;
    bal_totals.unnecessaryReviews += bal_sample.counters.unnecessaryReviews;
    bal_totals.missedReviews += bal_sample.counters.missedReviews;
    bal_totals.correctBlanks += bal_sample.counters.correctBlanks;
    bal_totals.blankReviewRouted += bal_sample.counters.blankReviewRouted;
    bal_totals.missedMarks += bal_sample.counters.missedMarks;
    bal_totals.unreadableDetections += bal_sample.counters.unreadableDetections;
    bal_totals.manualOnlyExpected += bal_sample.counters.manualOnlyExpected;
    bal_totals.manualOnlyRecognized += bal_sample.counters.manualOnlyRecognized;
    if (bal_sample.qrDecoded) bal_totals.qrDecoded += 1;
    if (bal_sample.normalizationOk) bal_totals.normalized += 1;
    bal_totals.identifyMs += bal_sample.identifyMs;
    bal_totals.readMs += bal_sample.readMs;
    bal_totals.durationMs += bal_sample.durationMs;
  }
  const bal_div = (bal_a: number, bal_b: number): number => (bal_b === 0 ? 0 : bal_a / bal_b);
  return {
    label: bal_label,
    samples: bal_totals.samples,
    answers: bal_totals.answers,
    expectedAccepts: bal_totals.expectedAccepts,
    expectedBlanks: bal_totals.expectedBlanks,
    expectedReview: bal_totals.expectedReview,
    correctAutoAccepts: bal_totals.correctAutoAccepts,
    falseAutoAccepts: bal_totals.falseAutoAccepts,
    falseAutoAcceptRate: bal_div(bal_totals.falseAutoAccepts, bal_totals.answers),
    autoAcceptRate: bal_div(bal_totals.correctAutoAccepts + bal_totals.falseAutoAccepts, bal_totals.answers),
    correctReviewRouting: bal_totals.correctReviewRouting,
    unnecessaryReviews: bal_totals.unnecessaryReviews,
    missedReviews: bal_totals.missedReviews,
    reviewRouteRate: bal_div(
      bal_totals.correctReviewRouting + bal_totals.unnecessaryReviews + bal_totals.blankReviewRouted,
      bal_totals.answers
    ),
    correctBlanks: bal_totals.correctBlanks,
    blankReviewRouted: bal_totals.blankReviewRouted,
    blankPrecision: bal_div(bal_totals.correctBlanks, bal_totals.correctBlanks + bal_totals.blankReviewRouted),
    blankRecall: bal_div(bal_totals.correctBlanks, bal_totals.expectedBlanks),
    missedMarks: bal_totals.missedMarks,
    unreadableDetections: bal_totals.unreadableDetections,
    manualOnlyExpected: bal_totals.manualOnlyExpected,
    manualOnlyRecognized: bal_totals.manualOnlyRecognized,
    qrSuccessRate: bal_div(bal_totals.qrDecoded, bal_totals.samples),
    normalizationSuccessRate: bal_div(bal_totals.normalized, bal_totals.samples),
    meanIdentifyMs: bal_div(bal_totals.identifyMs, bal_totals.samples),
    meanReadMs: bal_div(bal_totals.readMs, bal_totals.samples),
    meanMsPerPage: bal_div(bal_totals.durationMs, bal_totals.samples)
  };
}

export function bal_group_samples(
  bal_samples: bal_SampleResult[],
  bal_key: (bal_sample: bal_SampleResult) => string
): Map<string, bal_SampleResult[]> {
  const bal_groups = new Map<string, bal_SampleResult[]>();
  for (const bal_sample of bal_samples) {
    const bal_group = bal_key(bal_sample);
    const bal_list = bal_groups.get(bal_group);
    if (bal_list) bal_list.push(bal_sample);
    else bal_groups.set(bal_group, [bal_sample]);
  }
  return bal_groups;
}

export function bal_format_metrics(bal_metrics: bal_CalibrationMetrics): string {
  const bal_pct = (bal_v: number): string => `${(bal_v * 100).toFixed(2)}%`;
  return [
    `${bal_metrics.label}: ${bal_metrics.samples} pages, ${bal_metrics.answers} answers`,
    `  false auto-accepts: ${bal_metrics.falseAutoAccepts} (${bal_pct(bal_metrics.falseAutoAcceptRate)})`,
    `  correct auto-accepts: ${bal_metrics.correctAutoAccepts} (rate ${bal_pct(bal_metrics.autoAcceptRate)})`,
    `  review routed: ${bal_metrics.correctReviewRouting} correct, ${bal_metrics.unnecessaryReviews} unnecessary, ${bal_metrics.blankReviewRouted} blank-caused`,
    `  missed marks: ${bal_metrics.missedMarks}, missed reviews: ${bal_metrics.missedReviews}`,
    `  blanks: ${bal_metrics.correctBlanks} correct (precision ${bal_pct(bal_metrics.blankPrecision)}, recall ${bal_pct(bal_metrics.blankRecall)})`,
    `  unreadable detections: ${bal_metrics.unreadableDetections}`,
    `  QR ${bal_pct(bal_metrics.qrSuccessRate)}, normalization ${bal_pct(bal_metrics.normalizationSuccessRate)}`,
    `  timing: identify ${bal_metrics.meanIdentifyMs.toFixed(0)} ms, read ${bal_metrics.meanReadMs.toFixed(0)} ms, total ${bal_metrics.meanMsPerPage.toFixed(0)} ms/page`
  ].join('\n');
}

export function bal_collect_failures(bal_samples: bal_SampleResult[]): bal_SampleFailureLine[] {
  const bal_lines: bal_SampleFailureLine[] = [];
  for (const bal_sample of bal_samples) {
    for (const bal_failure of bal_sample.failures) {
      bal_lines.push({
        sampleId: bal_sample.sampleId,
        density: bal_sample.density,
        presetId: bal_sample.presetId,
        pageNumber: bal_sample.pageNumber,
        itemId: bal_failure.itemId,
        rowId: bal_failure.rowId,
        kind: bal_failure.kind,
        detail: bal_failure.detail
      });
    }
  }
  return bal_lines;
}

export interface bal_SampleFailureLine {
  sampleId: string;
  density: string;
  presetId: string;
  pageNumber: number;
  itemId: string;
  rowId: string | null;
  kind: string;
  detail: string;
}
