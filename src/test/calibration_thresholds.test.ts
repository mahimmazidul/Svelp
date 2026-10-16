import { describe, expect, it } from 'vitest';
import type { PrintSettings } from '../models/types';
import type { QuestionnaireRecord } from '../models/types';
import { bal_build_print_document, type bal_PrintDocument } from '../features/print/print_layout';
import { bal_compose_blank_photo } from '../features/calibration/page_frame';
import { bal_build_page_plan, bal_group_regions, type bal_AnswerPlan, type bal_MarkInstruction } from '../features/calibration/calibration_plan';
import { bal_evaluate_sample, type bal_SampleResult } from '../features/calibration/evaluate';
import { bal_aggregate_metrics, bal_collect_failures, bal_format_metrics } from '../features/calibration/report';
import { bal_CAPTURE_PRESETS, type bal_CapturePreset } from '../features/calibration/degradation';
import { BAL_DEFAULT_THRESHOLD_PROFILE, type RecognitionThresholdProfile } from '../models/response_models';
import { bal_food_wastage_benchmark, bal_benchmark_scales } from './print_benchmark_fixtures';

const BAL_PPM = 5.9;

function bal_preset(bal_id: string): bal_CapturePreset {
  const bal_found = bal_CAPTURE_PRESETS.find((bal_p) => bal_p.id === bal_id);
  if (!bal_found) throw new Error(`missing preset ${bal_id}`);
  return bal_found;
}

function bal_context(bal_density: 'comfortable' | 'compact' | 'dense'): {
  doc: bal_PrintDocument;
  questionnaire: QuestionnaireRecord;
} {
  const bal_q: QuestionnaireRecord = bal_food_wastage_benchmark();
  bal_q.printSettings = { ...bal_q.printSettings, density: bal_density, scannerMode: true } as PrintSettings;
  return {
    doc: bal_build_print_document({ questionnaire: bal_q, scales: bal_benchmark_scales(), respondentId: 'CAL-1' }),
    questionnaire: bal_q
  };
}

function bal_style_plan(
  bal_ctx: { doc: bal_PrintDocument },
  bal_page_number: number
): ReturnType<typeof bal_build_page_plan> {
  const bal_frame = bal_compose_blank_photo(bal_ctx.doc, bal_page_number, BAL_PPM)!;
  const bal_payload = bal_ctx.doc.pages[bal_page_number - 1].identifier?.payload ?? `S1|X|1|CAL-1|${bal_page_number}`;
  const bal_choices: string[] = [];
  for (const [bal_name, bal_group] of bal_group_regions(bal_frame.regions)) {
    if (bal_group.kind === 'choice' && bal_group.optionIds.length >= 3) bal_choices.push(bal_name);
  }
  bal_choices.sort();
  if (bal_choices.length < 3) throw new Error(`page ${bal_page_number} lacks three choice groups`);
  const bal_marks: bal_MarkInstruction[] = [
    { variableName: bal_choices[0], optionIndex: 1, style: 'fill' },
    { variableName: bal_choices[1], optionIndex: 0, style: 'faint' },
    { variableName: bal_choices[2], optionIndex: 2, style: 'pencil' }
  ];
  const bal_answers: bal_AnswerPlan[] = [
    { variableName: bal_choices[0], expected: 'accept', expectedOptionIndexes: [1] },
    { variableName: bal_choices[1], expected: 'accept', expectedOptionIndexes: [0] },
    { variableName: bal_choices[2], expected: 'review' }
  ];
  const bal_plan = bal_build_page_plan(bal_page_number, bal_payload, bal_frame.regions, bal_marks, bal_answers);
  if (bal_plan.issues.length > 0) throw new Error(`plan issues: ${bal_plan.issues.join('; ')}`);
  return bal_plan;
}

describe('confidence and threshold analysis (simulated captures)', () => {
  const bal_base = bal_context('compact');
  const bal_preset_ids = ['straight', 'tilt-left', 'slight-blur', 'indoor-dim', 'shadow-corner'];
  const bal_page_ids = [1, 2, 3];
  const bal_baseline: bal_SampleResult[] = [];

  for (const bal_page_number of bal_page_ids) {
    const bal_plan = bal_style_plan(bal_base, bal_page_number);
    for (const bal_preset_id of bal_preset_ids) {
      bal_baseline.push(
        bal_evaluate_sample({
          sampleId: `base-p${bal_page_number}-${bal_preset_id}`,
          density: 'compact',
          preset: bal_preset(bal_preset_id),
          doc: bal_base.doc,
          questionnaire: bal_base.questionnaire,
          pageNumber: bal_page_number,
          ppm: BAL_PPM,
          marks: bal_plan.marks,
          groundTruth: bal_plan.groundTruth
        })
      );
    }
  }

  it('keeps every auto-accept confidence clearly above the 0.75 floor', () => {
    for (const bal_s of bal_baseline) {
      for (const bal_conf of bal_s.acceptedConfidences) {
        expect(bal_conf, bal_s.sampleId).toBeGreaterThanOrEqual(0.75);
      }
      for (const bal_conf of bal_s.falseAcceptConfidences) {
        expect(bal_conf, bal_s.sampleId).toBe(0);
      }
    }
    const bal_all = bal_baseline.flatMap((bal_s) => bal_s.acceptedConfidences);
    expect(bal_all.length).toBeGreaterThan(0);
    const bal_min = Math.min(...bal_all);
    console.log(`CONFIDENCE min-accept=${bal_min.toFixed(3)} floor=0.750 margin=${(bal_min - 0.75).toFixed(3)} samples=${bal_all.length}`);
    expect(bal_min).toBeGreaterThanOrEqual(0.75);
  }, 120_000);

  it('finds no evidence to loosen the acceptance floor at 0.65', () => {
    const bal_loose: RecognitionThresholdProfile = {
      ...BAL_DEFAULT_THRESHOLD_PROFILE,
      acceptanceConfidence: 0.65
    };
    let bal_correct_base = 0;
    let bal_correct_loose = 0;
    let bal_false_loose = 0;
    for (const bal_page_number of bal_page_ids) {
      const bal_plan = bal_style_plan(bal_base, bal_page_number);
      for (const bal_preset_id of bal_preset_ids) {
        const bal_result = bal_evaluate_sample({
          sampleId: `loose-p${bal_page_number}-${bal_preset_id}`,
          density: 'compact',
          preset: bal_preset(bal_preset_id),
          doc: bal_base.doc,
          questionnaire: bal_base.questionnaire,
          pageNumber: bal_page_number,
          ppm: BAL_PPM,
          marks: bal_plan.marks,
          groundTruth: bal_plan.groundTruth,
          profile: bal_loose
        });
        bal_correct_loose += bal_result.counters.correctAutoAccepts;
        bal_false_loose += bal_result.counters.falseAutoAccepts;
      }
    }
    bal_correct_base = bal_baseline.reduce((bal_a, bal_s) => bal_a + bal_s.counters.correctAutoAccepts, 0);
    console.log(`FLOOR base(0.75)=${bal_correct_base} loose(0.65)=${bal_correct_loose} falseAccepts=${bal_false_loose}`);
    expect(bal_false_loose).toBe(0);
  }, 120_000);

  it('keeps recognition safe when the mark-center ratio shifts a step', () => {
    for (const bal_ratio of [0.045, 0.065]) {
      const bal_variant: RecognitionThresholdProfile = {
        ...BAL_DEFAULT_THRESHOLD_PROFILE,
        markCenterRatio: bal_ratio
      };
      let bal_false = 0;
      let bal_correct = 0;
      for (const bal_page_number of bal_page_ids) {
        const bal_plan = bal_style_plan(bal_base, bal_page_number);
        for (const bal_preset_id of bal_preset_ids) {
          const bal_result = bal_evaluate_sample({
            sampleId: `ratio-${bal_ratio}-p${bal_page_number}-${bal_preset_id}`,
            density: 'compact',
            preset: bal_preset(bal_preset_id),
            doc: bal_base.doc,
            questionnaire: bal_base.questionnaire,
            pageNumber: bal_page_number,
            ppm: BAL_PPM,
            marks: bal_plan.marks,
            groundTruth: bal_plan.groundTruth,
            profile: bal_variant
          });
          bal_false += bal_result.counters.falseAutoAccepts;
          bal_correct += bal_result.counters.correctAutoAccepts;
        }
      }
      console.log(`RATIO ${bal_ratio}: correct=${bal_correct} falseAccepts=${bal_false}`);
      expect(bal_false).toBe(0);
    }
  }, 120_000);

  it('builds a complete failure corpus from degraded captures', () => {
    const bal_corpus_ctx = bal_context('compact');
    const bal_corpus: bal_SampleResult[] = [];
    const bal_corpus_presets = ['slight-blur', 'heavy-blur', 'glare-bubble', 'wrinkled', 'cropped-marker', 'strong-perspective'];
    for (const bal_page_number of [1, 2]) {
      const bal_plan = bal_style_plan(bal_corpus_ctx, bal_page_number);
      for (const bal_preset_id of bal_corpus_presets) {
        bal_corpus.push(
          bal_evaluate_sample({
            sampleId: `corpus-p${bal_page_number}-${bal_preset_id}`,
            density: 'compact',
            preset: bal_preset(bal_preset_id),
            doc: bal_corpus_ctx.doc,
            questionnaire: bal_corpus_ctx.questionnaire,
            pageNumber: bal_page_number,
            ppm: BAL_PPM,
            marks: bal_plan.marks,
            groundTruth: bal_plan.groundTruth
          })
        );
      }
    }
    const bal_failures = bal_collect_failures(bal_corpus);
    console.log(`CORPUS samples=${bal_corpus.length} failure-lines=${bal_failures.length}`);
    for (const bal_line of bal_failures.slice(0, 12)) {
      console.log(`FAIL ${JSON.stringify(bal_line)}`);
    }
    for (const bal_s of bal_corpus) {
      for (const bal_f of bal_s.failures) {
        expect(bal_f.kind.length, bal_s.sampleId).toBeGreaterThan(0);
        expect(bal_f.detail.length, bal_s.sampleId).toBeGreaterThan(0);
      }
    }
    const bal_metrics = bal_aggregate_metrics('failure-corpus', bal_corpus);
    console.log(bal_format_metrics(bal_metrics));
    expect(bal_metrics.falseAutoAccepts).toBe(0);
    expect(bal_corpus.length).toBe(12);
  }, 120_000);
});
