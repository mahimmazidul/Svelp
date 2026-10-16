import { describe, expect, it } from 'vitest';
import type { PrintSettings } from '../models/types';
import type { QuestionnaireRecord, ResponseScaleRecord } from '../models/types';
import { bal_build_print_document, type bal_PrintDocument } from '../features/print/print_layout';
import { bal_compose_blank_photo } from '../features/calibration/page_frame';
import { bal_build_page_plan, bal_group_regions, type bal_AnswerPlan, type bal_MarkInstruction } from '../features/calibration/calibration_plan';
import { bal_evaluate_sample, type bal_SampleResult } from '../features/calibration/evaluate';
import { bal_aggregate_metrics, bal_format_metrics, bal_group_samples } from '../features/calibration/report';
import { bal_CAPTURE_PRESETS, type bal_CapturePreset } from '../features/calibration/degradation';
import { bal_food_wastage_benchmark, bal_benchmark_scales } from './print_benchmark_fixtures';
import { bal_bangla_survey, bal_frequency_scale_bn } from './bangla_fixtures';
import { bal_ffq } from '../features/print/print_fixtures';

const BAL_PPM = 5.9;
const BAL_COMPARISON_PRESETS = [
  'straight',
  'straight-compressed',
  'tilt-left',
  'rotated-slight',
  'indoor-dim',
  'shadow-corner',
  'slight-blur',
  'uneven-light'
];

interface bal_DocContext {
  name: string;
  doc: bal_PrintDocument;
  questionnaire: QuestionnaireRecord;
  density: string;
}

function bal_density_settings(bal_q: QuestionnaireRecord, bal_density: string): PrintSettings {
  return { ...bal_q.printSettings, density: bal_density, scannerMode: true } as PrintSettings;
}

function bal_build_context(
  bal_name: string,
  bal_questionnaire: QuestionnaireRecord,
  bal_scales: ResponseScaleRecord[],
  bal_density: 'comfortable' | 'compact' | 'dense'
): bal_DocContext {
  const bal_q = { ...bal_questionnaire, printSettings: bal_density_settings(bal_questionnaire, bal_density) };
  return {
    name: bal_name,
    doc: bal_build_print_document({ questionnaire: bal_q, scales: bal_scales, respondentId: 'CAL-1' }),
    questionnaire: bal_q,
    density: bal_density
  };
}

function bal_preset(bal_id: string): bal_CapturePreset {
  const bal_found = bal_CAPTURE_PRESETS.find((bal_p) => bal_p.id === bal_id);
  if (!bal_found) throw new Error(`missing preset ${bal_id}`);
  return bal_found;
}

function bal_matrix_pages(bal_ctx: bal_DocContext): number[] {
  const bal_pages: number[] = [];
  for (const bal_page of bal_ctx.doc.pages) {
    const bal_frame = bal_compose_blank_photo(bal_ctx.doc, bal_page.pageNumber, BAL_PPM);
    if (bal_frame && bal_frame.regions.some((bal_r) => bal_r.kind === 'matrix')) bal_pages.push(bal_page.pageNumber);
  }
  return bal_pages;
}

function bal_auto_page_plan(
  bal_ctx: bal_DocContext,
  bal_page_number: number,
  bal_mark_seed: number
): ReturnType<typeof bal_build_page_plan> {
  const bal_frame = bal_compose_blank_photo(bal_ctx.doc, bal_page_number, BAL_PPM);
  if (!bal_frame) throw new Error(`no frame for page ${bal_page_number} of ${bal_ctx.name}`);
  const bal_groups = bal_group_regions(bal_frame.regions);
  const bal_choices: string[] = [];
  let bal_matrix: { name: string; columns: number } | null = null;
  for (const [bal_name, bal_group] of bal_groups) {
    if (bal_group.kind === 'choice' && bal_group.optionIds.length >= 3) bal_choices.push(bal_name);
    if (bal_group.kind === 'matrix' && !bal_matrix) {
      bal_matrix = { name: bal_name, columns: bal_group.columnIds.length };
    }
  }
  bal_choices.sort();
  const bal_marks: bal_MarkInstruction[] = [];
  const bal_answers: bal_AnswerPlan[] = [];
  if (bal_choices.length > 0) {
    const bal_target = bal_choices[bal_mark_seed % bal_choices.length];
    const bal_option_count = bal_groups.get(bal_target)!.optionIds.length;
    const bal_option_index = bal_mark_seed % bal_option_count;
    bal_marks.push({ variableName: bal_target, optionIndex: bal_option_index, style: 'fill' });
    bal_answers.push({
      variableName: bal_target,
      expected: 'accept',
      expectedOptionIndexes: [bal_option_index]
    });
    const bal_blank_target = bal_choices[(bal_mark_seed + 1) % bal_choices.length];
    if (bal_blank_target !== bal_target) {
      bal_answers.push({ variableName: bal_blank_target, expected: 'blank' });
    }
  }
  if (bal_matrix) {
    bal_marks.push({ variableName: bal_matrix.name, row: 0, column: bal_mark_seed % bal_matrix.columns, style: 'tick' });
    bal_answers.push({
      variableName: bal_matrix.name,
      row: 0,
      expected: 'accept',
      expectedOptionIndexes: [bal_mark_seed % bal_matrix.columns]
    });
    bal_answers.push({ variableName: bal_matrix.name, row: 1, expected: 'blank' });
  }
  const bal_payload = bal_ctx.doc.pages[bal_page_number - 1].identifier?.payload ?? `S1|X|1|CAL-1|${bal_page_number}`;
  return bal_build_page_plan(bal_page_number, bal_payload, bal_frame.regions, bal_marks, bal_answers);
}

function bal_run_sample(
  bal_ctx: bal_DocContext,
  bal_page_number: number,
  bal_preset: bal_CapturePreset,
  bal_marks: bal_MarkInstruction[],
  bal_answers: bal_AnswerPlan[],
  bal_sample_id: string
): bal_SampleResult {
  const bal_plan = bal_build_page_plan(
    bal_page_number,
    bal_ctx.doc.pages[bal_page_number - 1].identifier?.payload ?? `S1|X|1|CAL-1|${bal_page_number}`,
    bal_compose_blank_photo(bal_ctx.doc, bal_page_number, BAL_PPM)!.regions,
    bal_marks,
    bal_answers
  );
  expect(bal_plan.issues, `${bal_ctx.name} p${bal_page_number}`).toEqual([]);
  return bal_evaluate_sample({
    sampleId: bal_sample_id,
    density: bal_ctx.density,
    preset: bal_preset,
    doc: bal_ctx.doc,
    questionnaire: bal_ctx.questionnaire,
    pageNumber: bal_page_number,
    ppm: BAL_PPM,
    marks: bal_plan.marks,
    groundTruth: bal_plan.groundTruth
  });
}

describe('density comparison calibration (simulated captures)', () => {
  const bal_samples: bal_SampleResult[] = [];

  for (const bal_density of ['comfortable', 'compact', 'dense'] as const) {
    const bal_ctx = bal_build_context('benchmark', bal_food_wastage_benchmark(), bal_benchmark_scales(), bal_density);
    const bal_matrix_pages_list = bal_matrix_pages(bal_ctx);
    const bal_probe_pages = [1, 2, bal_matrix_pages_list[0] ?? 3];
    for (const bal_page_number of bal_probe_pages) {
      for (const bal_preset_id of BAL_COMPARISON_PRESETS) {
        const bal_plan = bal_auto_page_plan(bal_ctx, bal_page_number, bal_page_number + bal_probe_pages.indexOf(bal_page_number));
        bal_samples.push(
          bal_evaluate_sample({
            sampleId: `${bal_density}-p${bal_page_number}-${bal_preset_id}`,
            density: bal_density,
            preset: bal_preset(bal_preset_id),
            doc: bal_ctx.doc,
            questionnaire: bal_ctx.questionnaire,
            pageNumber: bal_page_number,
            ppm: BAL_PPM,
            marks: bal_plan.marks,
            groundTruth: bal_plan.groundTruth
          })
        );
      }
    }
  }

  it('never auto-accepts a wrong answer on good or acceptable captures at any density', () => {
    const bal_safe = bal_samples.filter((bal_s) => bal_s.category === 'good' || bal_s.category === 'acceptable');
    const bal_false_accepts = bal_safe.reduce((bal_a, bal_s) => bal_a + bal_s.counters.falseAutoAccepts, 0);
    expect(bal_false_accepts).toBe(0);
  });

  it('keeps poor-capture false accepts at or below the recorded bound', () => {
    const bal_poor = bal_samples.filter((bal_s) => bal_s.category === 'poor' || bal_s.category === 'unusable');
    const bal_false_accepts = bal_poor.reduce((bal_a, bal_s) => bal_a + bal_s.counters.falseAutoAccepts, 0);
    const bal_answers = bal_poor.reduce((bal_a, bal_s) => bal_a + bal_s.counters.answers, 0);
    expect(bal_false_accepts / Math.max(1, bal_answers)).toBeLessThanOrEqual(0.02);
  });

  it('decodes QR and normalizes every straight and compressed capture', () => {
    const bal_straight = bal_samples.filter(
      (bal_s) => bal_s.presetId === 'straight' || bal_s.presetId === 'straight-compressed'
    );
    for (const bal_s of bal_straight) {
      expect(bal_s.qrDecoded, bal_s.sampleId).toBe(true);
      expect(bal_s.normalizationOk, bal_s.sampleId).toBe(true);
    }
  });

  it('routes injected multi-mark cases to review at every density', () => {
    for (const bal_density of ['comfortable', 'compact', 'dense'] as const) {
      const bal_ctx = bal_build_context('benchmark', bal_food_wastage_benchmark(), bal_benchmark_scales(), bal_density);
      const bal_result = bal_run_sample(
        bal_ctx,
        1,
        bal_preset('straight'),
        [
          { variableName: 'sex', optionIndex: 0, style: 'fill' },
          { variableName: 'sex', optionIndex: 2, style: 'fill' }
        ],
        [{ variableName: 'sex', expected: 'review', expectedOptionIndexes: [0, 2] }],
        `${bal_density}-dual-mark`
      );
      expect(bal_result.counters.correctReviewRouting).toBe(1);
      expect(bal_result.counters.falseAutoAccepts).toBe(0);
    }
  });

  it('reports per-density metrics in descending safety margin', () => {
    const bal_groups = bal_group_samples(bal_samples, (bal_s) => bal_s.density);
    const bal_lines: string[] = [];
    for (const [bal_density, bal_list] of bal_groups) {
      bal_lines.push(bal_format_metrics(bal_aggregate_metrics(bal_density, bal_list)));
    }
    console.log(`CALIBRATION-DENSITY\n${bal_lines.join('\n')}`);
    const bal_dense = bal_aggregate_metrics('dense', bal_groups.get('dense') ?? []);
    const bal_compact = bal_aggregate_metrics('compact', bal_groups.get('compact') ?? []);
    expect(bal_compact.falseAutoAccepts).toBeLessThanOrEqual(bal_dense.falseAutoAccepts + 0);
    expect(bal_compact.qrSuccessRate).toBeGreaterThanOrEqual(bal_dense.qrSuccessRate - 0.01);
  });

  it('fails normalization loudly when markers are cropped away', () => {
    const bal_ctx = bal_build_context('benchmark', bal_food_wastage_benchmark(), bal_benchmark_scales(), 'compact');
    const bal_plan = bal_auto_page_plan(bal_ctx, 1, 1);
    const bal_result = bal_evaluate_sample({
      sampleId: 'compact-cropped-marker',
      density: 'compact',
      preset: bal_preset('cropped-marker'),
      doc: bal_ctx.doc,
      questionnaire: bal_ctx.questionnaire,
      pageNumber: 1,
      ppm: BAL_PPM,
      marks: bal_plan.marks,
      groundTruth: bal_plan.groundTruth
    });
    expect(bal_result.normalizationOk === false || bal_result.markersFound <= 3).toBe(true);
    expect(bal_result.counters.falseAutoAccepts).toBe(0);
    expect(bal_result.counters.correctAutoAccepts).toBe(0);
  }, 60_000);
});

describe('mark style calibration (compact, straight capture)', () => {
  interface bal_StyleCase {
    id: string;
    marks: bal_MarkInstruction[];
    expected: bal_AnswerPlan;
  }

  const bal_cases: bal_StyleCase[] = [
    {
      id: 'fill',
      marks: [{ variableName: 'sex', optionIndex: 1, style: 'fill' }],
      expected: { variableName: 'sex', expected: 'accept', expectedOptionIndexes: [1] }
    },
    {
      id: 'partial',
      marks: [{ variableName: 'sex', optionIndex: 2, style: 'partial' }],
      expected: { variableName: 'sex', expected: 'accept', expectedOptionIndexes: [2] }
    },
    {
      id: 'tick',
      marks: [{ variableName: 'sex', optionIndex: 0, style: 'tick' }],
      expected: { variableName: 'sex', expected: 'accept', expectedOptionIndexes: [0] }
    },
    {
      id: 'cross',
      marks: [{ variableName: 'sex', optionIndex: 2, style: 'cross' }],
      expected: { variableName: 'sex', expected: 'accept', expectedOptionIndexes: [2] }
    },
    {
      id: 'slash',
      marks: [{ variableName: 'sex', optionIndex: 1, style: 'slash' }],
      expected: { variableName: 'sex', expected: 'accept', expectedOptionIndexes: [1] }
    },
    {
      id: 'faint-pen',
      marks: [{ variableName: 'sex', optionIndex: 0, style: 'faint' }],
      expected: { variableName: 'sex', expected: 'accept', expectedOptionIndexes: [0] }
    },
    {
      id: 'scribble',
      marks: [{ variableName: 'sex', optionIndex: 2, style: 'scribble' }],
      expected: { variableName: 'sex', expected: 'accept', expectedOptionIndexes: [2] }
    },
    {
      id: 'pencil-review',
      marks: [{ variableName: 'sex', optionIndex: 1, style: 'pencil' }],
      expected: { variableName: 'sex', expected: 'review' }
    },
    {
      id: 'stray-nearby',
      marks: [{ variableName: 'sex', optionIndex: 1, style: 'stray' }],
      expected: { variableName: 'sex', expected: 'blank' }
    },
    {
      id: 'edge-touch',
      marks: [{ variableName: 'sex', optionIndex: 2, style: 'edge' }],
      expected: { variableName: 'sex', expected: 'blank' }
    },
    {
      id: 'two-strong-marks',
      marks: [
        { variableName: 'sex', optionIndex: 0, style: 'fill' },
        { variableName: 'sex', optionIndex: 2, style: 'fill' }
      ],
      expected: { variableName: 'sex', expected: 'review' }
    },
    {
      id: 'cross-out-correction',
      marks: [
        { variableName: 'sex', optionIndex: 1, style: 'slash' },
        { variableName: 'sex', optionIndex: 2, style: 'fill' }
      ],
      expected: { variableName: 'sex', expected: 'review' }
    }
  ];

  for (const bal_case of bal_cases) {
    it(`marks style ${bal_case.id} routes safely`, () => {
      const bal_ctx = bal_build_context('benchmark', bal_food_wastage_benchmark(), bal_benchmark_scales(), 'compact');
      const bal_result = bal_run_sample(
        bal_ctx,
        1,
        bal_preset('straight'),
        bal_case.marks,
        [bal_case.expected],
        `style-${bal_case.id}`
      );
      const bal_false = bal_result.counters.falseAutoAccepts;
      expect(bal_false, `${bal_case.id} false accepts`).toBe(0);
      if (bal_case.expected.expected === 'accept') {
        expect(bal_result.counters.correctAutoAccepts, bal_case.id).toBe(1);
      }
      if (bal_case.expected.expected === 'review') {
        expect(bal_result.counters.correctReviewRouting + bal_result.counters.missedReviews, bal_case.id).toBeGreaterThanOrEqual(1);
        expect(bal_result.counters.correctReviewRouting, bal_case.id).toBe(1);
      }
      if (bal_case.expected.expected === 'blank') {
        expect(
          bal_result.counters.correctBlanks + bal_result.counters.blankReviewRouted,
          bal_case.id
        ).toBe(1);
      }
    });
  }
});

describe('bangla calibration (simulated captures)', () => {
  for (const bal_density of ['compact', 'dense'] as const) {
    it(`reads marked bangla pages at ${bal_density} without false accepts`, () => {
      const bal_q = bal_bangla_survey();
      const bal_ctx = bal_build_context('bangla', bal_q, [bal_frequency_scale_bn()], bal_density);
      const bal_samples: bal_SampleResult[] = [];
      for (const bal_page_number of [1, 2]) {
        for (const bal_preset_id of ['straight', 'tilt-left', 'slight-blur']) {
          const bal_plan = bal_auto_page_plan(bal_ctx, bal_page_number, bal_page_number);
          bal_samples.push(
            bal_evaluate_sample({
              sampleId: `bangla-${bal_density}-p${bal_page_number}-${bal_preset_id}`,
              density: bal_density,
              preset: bal_preset(bal_preset_id),
              doc: bal_ctx.doc,
              questionnaire: bal_ctx.questionnaire,
              pageNumber: bal_page_number,
              ppm: BAL_PPM,
              marks: bal_plan.marks,
              groundTruth: bal_plan.groundTruth
            })
          );
        }
      }
      const bal_metrics = bal_aggregate_metrics(`bangla-${bal_density}`, bal_samples);
      console.log(bal_format_metrics(bal_metrics));
      expect(bal_metrics.falseAutoAccepts).toBe(0);
      const bal_straight = bal_samples.filter((bal_s) => bal_s.presetId === 'straight');
      expect(bal_straight.every((bal_s) => bal_s.qrDecoded)).toBe(true);
      expect(bal_metrics.qrSuccessRate).toBeGreaterThanOrEqual(0.5);
      expect(bal_metrics.normalizationSuccessRate).toBe(1);
      expect(bal_metrics.correctAutoAccepts).toBeGreaterThan(0);
    }, 90_000);
  }
});

describe('matrix-heavy calibration (simulated captures)', () => {
  const bal_freq7: ResponseScaleRecord = {
    id: 'scale-freq',
    name: 'freq7',
    options: [
      { id: 'f1', label: 'Never', coding: '0' },
      { id: 'f2', label: 'Rarely', coding: '1' },
      { id: 'f3', label: 'Monthly', coding: '2' },
      { id: 'f4', label: 'Weekly', coding: '3' },
      { id: 'f5', label: 'Daily', coding: '4' },
      { id: 'f6', label: 'Twice daily', coding: '5' },
      { id: 'f7', label: 'With every meal', coding: '6' }
    ],
    createdAt: 0,
    updatedAt: 0
  };

  for (const bal_density of ['compact', 'dense'] as const) {
    it(`reads the 60x7 ffq matrix at ${bal_density} with tight column separation`, () => {
      const bal_q = bal_ffq(60);
      bal_q.printSettings = bal_density_settings(bal_q, bal_density);
      const bal_ctx = bal_build_context('ffq60', bal_q, [bal_freq7], bal_density);
      const bal_matrix_page = bal_matrix_pages(bal_ctx)[0];
      const bal_frame = bal_compose_blank_photo(bal_ctx.doc, bal_matrix_page, BAL_PPM)!;
      const bal_plan = bal_build_page_plan(
        bal_matrix_page,
        bal_ctx.doc.pages[bal_matrix_page - 1].identifier?.payload ?? `S1|X|1|CAL-1|${bal_matrix_page}`,
        bal_frame.regions,
        [
          { variableName: 'food_frequency', row: 0, column: 3, style: 'fill' },
          { variableName: 'food_frequency', row: 1, column: 0, style: 'tick' }
        ],
        [
          { variableName: 'food_frequency', row: 0, expected: 'accept', expectedOptionIndexes: [3] },
          { variableName: 'food_frequency', row: 1, expected: 'accept', expectedOptionIndexes: [0] },
          { variableName: 'food_frequency', row: 2, expected: 'blank' }
        ]
      );
      expect(bal_plan.issues).toEqual([]);
      const bal_result = bal_evaluate_sample({
        sampleId: `ffq60-${bal_density}`,
        density: bal_density,
        preset: bal_preset('straight'),
        doc: bal_ctx.doc,
        questionnaire: bal_ctx.questionnaire,
        pageNumber: bal_matrix_page,
        ppm: BAL_PPM,
        marks: bal_plan.marks,
        groundTruth: bal_plan.groundTruth
      });
      expect(bal_result.counters.falseAutoAccepts).toBe(0);
      expect(bal_result.counters.correctAutoAccepts).toBe(2);
      expect(bal_result.counters.correctBlanks).toBeGreaterThanOrEqual(1);
    });
  }
});

describe('simulated large batch', () => {
  it('processes a fifty-plus page simulated batch and reports totals', () => {
    const bal_samples: bal_SampleResult[] = [];
    const bal_presets = ['straight', 'tilt-left', 'indoor-dim'];
    for (const bal_density of ['comfortable', 'compact', 'dense'] as const) {
      const bal_ctx = bal_build_context('benchmark', bal_food_wastage_benchmark(), bal_benchmark_scales(), bal_density);
      const bal_page_count = Math.min(bal_ctx.doc.pageCount, 6);
      for (let bal_page_number = 1; bal_page_number <= bal_page_count; bal_page_number++) {
      for (const bal_preset_id of bal_presets) {
        const bal_capture = bal_preset(bal_preset_id);
        const bal_plan = bal_auto_page_plan(bal_ctx, bal_page_number, bal_page_number);
        bal_samples.push(
          bal_evaluate_sample({
            sampleId: `batch-${bal_density}-p${bal_page_number}-${bal_preset_id}`,
            density: bal_density,
            preset: bal_capture,
            doc: bal_ctx.doc,
            questionnaire: bal_ctx.questionnaire,
            pageNumber: bal_page_number,
            ppm: BAL_PPM,
            marks: bal_plan.marks,
            groundTruth: bal_plan.groundTruth
          })
        );
      }
      }
    }
    expect(bal_samples.length).toBeGreaterThanOrEqual(50);
    const bal_metrics = bal_aggregate_metrics('simulated-batch', bal_samples);
    console.log(
      `BATCH pages=${bal_metrics.samples} answers=${bal_metrics.answers} falseAutoAccepts=${bal_metrics.falseAutoAccepts} qr=${(bal_metrics.qrSuccessRate * 100).toFixed(1)}% norm=${(bal_metrics.normalizationSuccessRate * 100).toFixed(1)}% ms/page=${bal_metrics.meanMsPerPage.toFixed(0)}`
    );
    expect(bal_metrics.falseAutoAccepts).toBe(0);
    expect(bal_metrics.qrSuccessRate).toBeGreaterThanOrEqual(0.95);
  }, 180_000);
});
