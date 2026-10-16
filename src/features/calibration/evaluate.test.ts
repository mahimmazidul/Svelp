import { describe, expect, it } from 'vitest';
import type { PrintSettings } from '../../models/types';
import { bal_food_wastage_benchmark, bal_benchmark_scales } from '../../test/print_benchmark_fixtures';
import { bal_build_print_document } from '../print/print_layout';
import { bal_build_page_plan, bal_group_regions, type bal_AnswerPlan, type bal_MarkInstruction } from './calibration_plan';
import { bal_evaluate_sample } from './evaluate';
import { bal_aggregate_metrics, bal_collect_failures } from './report';
import { bal_CAPTURE_PRESETS } from './degradation';

const BAL_PPM = 5.9;

function bal_benchmark_doc(bal_density: 'comfortable' | 'compact' | 'dense') {
  const bal_q = bal_food_wastage_benchmark();
  bal_q.printSettings = {
    ...bal_q.printSettings,
    density: bal_density,
    scannerMode: true
  } as PrintSettings;
  const bal_doc = bal_build_print_document({
    questionnaire: bal_q,
    scales: bal_benchmark_scales(),
    respondentId: 'CAL-R1'
  });
  return { doc: bal_doc, questionnaire: bal_q };
}

describe('recognition evaluation harness', () => {
  it('reads a straight compact capture with a filled mark end to end', () => {
    const bal_ctx = bal_benchmark_doc('compact');
    const bal_page_number = 1;
    const bal_marks: bal_MarkInstruction[] = [{ variableName: 'sex', optionIndex: 1, style: 'fill' }];
    const bal_answers: bal_AnswerPlan[] = [
      { variableName: 'sex', expected: 'accept', expectedOptionIndexes: [1] },
      { variableName: 'age_group', expected: 'blank' },
      { variableName: 'education', expected: 'blank' }
    ];
    const bal_plan = bal_build_page_plan(
      bal_page_number,
      bal_ctx.doc.pages[0].identifier?.payload ?? 'S1|X|1|R|1',
      require_page_regions(bal_ctx.doc, bal_page_number),
      bal_marks,
      bal_answers
    );
    expect(bal_plan.issues).toEqual([]);
    const bal_result = bal_evaluate_sample({
      sampleId: 'sanity-compact-straight',
      density: 'compact',
      preset: bal_CAPTURE_PRESETS.find((bal_p) => bal_p.id === 'straight')!,
      doc: bal_ctx.doc,
      questionnaire: bal_ctx.questionnaire,
      pageNumber: bal_page_number,
      ppm: BAL_PPM,
      marks: bal_plan.marks,
      groundTruth: bal_plan.groundTruth
    });
    expect(bal_result.normalizationOk).toBe(true);
    expect(bal_result.qrDecoded).toBe(true);
    expect(bal_result.counters.correctAutoAccepts).toBe(1);
    expect(bal_result.counters.falseAutoAccepts).toBe(0);
    expect(bal_result.counters.correctBlanks).toBe(2);
    expect(bal_result.failures).toEqual([]);
  });

  it('counts a false auto-accept when two marks exist in a single-choice question', () => {
    const bal_ctx = bal_benchmark_doc('compact');
    const bal_marks: bal_MarkInstruction[] = [
      { variableName: 'sex', optionIndex: 0, style: 'fill' },
      { variableName: 'sex', optionIndex: 2, style: 'fill' }
    ];
    const bal_answers: bal_AnswerPlan[] = [
      { variableName: 'sex', expected: 'review', expectedOptionIndexes: [0, 2] }
    ];
    const bal_plan = bal_build_page_plan(
      1,
      bal_ctx.doc.pages[0].identifier?.payload ?? 'S1|X|1|R|1',
      require_page_regions(bal_ctx.doc, 1),
      bal_marks,
      bal_answers
    );
    const bal_result = bal_evaluate_sample({
      sampleId: 'sanity-compact-multi',
      density: 'compact',
      preset: bal_CAPTURE_PRESETS.find((bal_p) => bal_p.id === 'straight')!,
      doc: bal_ctx.doc,
      questionnaire: bal_ctx.questionnaire,
      pageNumber: 1,
      ppm: BAL_PPM,
      marks: bal_plan.marks,
      groundTruth: bal_plan.groundTruth
    });
    expect(bal_result.counters.correctReviewRouting).toBe(1);
    expect(bal_result.counters.falseAutoAccepts).toBe(0);
  });

  it('aggregates sample results into metrics with explicit false-accept accounting', () => {
    const bal_ctx = bal_benchmark_doc('compact');
    const bal_samples = [1, 2].map((bal_page_number) => {
      const bal_regions = require_page_regions(bal_ctx.doc, bal_page_number);
      const bal_groups = bal_group_regions(bal_regions);
      let bal_target: string | null = null;
      let bal_option_count = 0;
      for (const [bal_name, bal_group] of bal_groups) {
        if (bal_group.kind === 'choice' && bal_group.optionIds.length >= 3) {
          bal_target = bal_name;
          bal_option_count = bal_group.optionIds.length;
          break;
        }
      }
      if (!bal_target) throw new Error(`no choice item on page ${bal_page_number}`);
      const bal_option_index = bal_page_number % bal_option_count;
      const bal_marks: bal_MarkInstruction[] = [
        { variableName: bal_target, optionIndex: bal_option_index, style: 'fill' }
      ];
      const bal_answers: bal_AnswerPlan[] = [
        { variableName: bal_target, expected: 'accept', expectedOptionIndexes: [bal_option_index] }
      ];
      const bal_plan = bal_build_page_plan(
        bal_page_number,
        bal_ctx.doc.pages[bal_page_number - 1].identifier?.payload ?? `S1|X|1|R|${bal_page_number}`,
        bal_regions,
        bal_marks,
        bal_answers
      );
      expect(bal_plan.issues).toEqual([]);
      return bal_evaluate_sample({
        sampleId: `agg-${bal_page_number}`,
        density: 'compact',
        preset: bal_CAPTURE_PRESETS.find((bal_p) => bal_p.id === 'straight')!,
        doc: bal_ctx.doc,
        questionnaire: bal_ctx.questionnaire,
        pageNumber: bal_page_number,
        ppm: BAL_PPM,
        marks: bal_plan.marks,
        groundTruth: bal_plan.groundTruth
      });
    });
    const bal_metrics = bal_aggregate_metrics('aggregate', bal_samples);
    expect(bal_metrics.samples).toBe(2);
    expect(bal_metrics.correctAutoAccepts).toBe(2);
    expect(bal_metrics.falseAutoAccepts).toBe(0);
    expect(bal_metrics.falseAutoAcceptRate).toBe(0);
    expect(bal_metrics.qrSuccessRate).toBe(1);
    expect(bal_metrics.normalizationSuccessRate).toBe(1);
    const bal_failure_lines = bal_collect_failures(bal_samples);
    expect(bal_failure_lines).toEqual([]);
  });
});

function require_page_regions(bal_doc: Parameters<typeof bal_compose_blank_photo>[0], bal_page_number: number) {
  const bal_frame = bal_compose_blank_photo(bal_doc, bal_page_number, BAL_PPM);
  if (!bal_frame) throw new Error(`no frame for page ${bal_page_number}`);
  return bal_frame.regions;
}

import { bal_compose_blank_photo } from './page_frame';
