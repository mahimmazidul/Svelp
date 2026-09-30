import { BAL_DEFAULT_THRESHOLD_PROFILE } from '../../models/response_models';
import type { QuestionnaireRecord } from '../../models/types';
import { bal_build_print_document, type bal_PrintDocument } from '../print/print_layout';
import { bal_reading_regions_for_page, bal_selection_rules_from_questionnaire } from './reading_geometry';
import {
  bal_marker_radius_px,
  bal_render_blank_instrument,
  bal_render_marked_scan,
  type bal_MarkStyle,
  type bal_PageEffects,
  type bal_ReadingRegion
} from './reading_fixtures';
import { bal_read_page } from './reading_engine';
import type { bal_ItemReading } from './reading_interpret';
import { dhon_banaitesi_item, dhon_banaitesi_questionnaire } from '../../models/factories';

export const BAL_BENCHMARK_PPM = 5.9;

export function bal_benchmark_questionnaire(): QuestionnaireRecord {
  const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p-bench', title: 'Benchmark survey' });
  const bal_single = dhon_banaitesi_item('single_choice', 'main_water_source');
  bal_single.label = 'Main water source';
  bal_single.required = true;
  bal_single.options = [
    { id: 's-piped', label: 'Piped water', coding: '1' },
    { id: 's-tubewell', label: 'Tubewell', coding: '2' },
    { id: 's-rain', label: 'Rainwater', coding: '3' },
    { id: 's-other', label: 'Other', coding: '4' }
  ];
  const bal_multi = dhon_banaitesi_item('multiple_choice', 'information_channels');
  bal_multi.label = 'Which information channels do you use?';
  bal_multi.options = [
    { id: 'm-radio', label: 'Radio', coding: '1' },
    { id: 'm-tv', label: 'Television', coding: '2' },
    { id: 'm-paper', label: 'Newspaper', coding: '3' },
    { id: 'm-internet', label: 'Internet', coding: '4' }
  ];
  bal_multi.validation = {
    minSelections: null,
    maxSelections: 2,
    maxLength: null,
    min: null,
    max: null,
    step: null,
    decimalAllowed: true,
    requireAllRows: undefined
  };
  const bal_yesno = dhon_banaitesi_item('yes_no', 'household_checked');
  bal_yesno.label = 'Was the household visited before?';
  const bal_likert = dhon_banaitesi_item('likert_scale', 'service_satisfaction');
  bal_likert.label = 'How satisfied are you with the water service?';
  bal_likert.options = [
    { id: 'l1', label: 'Very dissatisfied', coding: '1' },
    { id: 'l2', label: 'Dissatisfied', coding: '2' },
    { id: 'l3', label: 'Neutral', coding: '3' },
    { id: 'l4', label: 'Satisfied', coding: '4' },
    { id: 'l5', label: 'Very satisfied', coding: '5' }
  ];
  const bal_matrix_single = dhon_banaitesi_item('matrix', 'treatment_practice');
  bal_matrix_single.label = 'How does the household treat drinking water?';
  bal_matrix_single.options = [];
  bal_matrix_single.rows = [
    { id: 'w-boil', label: 'Boiling' },
    { id: 'w-filter', label: 'Cloth filter' },
    { id: 'w-chem', label: 'Chlorine tablets' }
  ];
  bal_matrix_single.columns = [
    { id: 'c-always', label: 'Always', coding: 'A' },
    { id: 'c-sometimes', label: 'Sometimes', coding: 'S' },
    { id: 'c-never', label: 'Never', coding: 'N' }
  ];
  bal_matrix_single.selectionMode = 'single';
  const bal_matrix_multi = dhon_banaitesi_item('matrix', 'observed_issues');
  bal_matrix_multi.label = 'Which issues were observed for each source?';
  bal_matrix_multi.options = [];
  bal_matrix_multi.rows = [
    { id: 'x-source1', label: 'Main source' },
    { id: 'x-source2', label: 'Reserve source' }
  ];
  bal_matrix_multi.columns = [
    { id: 'd-rust', label: 'Rust', coding: 'R' },
    { id: 'd-sediment', label: 'Sediment', coding: 'S' },
    { id: 'd-odor', label: 'Odor', coding: 'O' }
  ];
  bal_matrix_multi.selectionMode = 'multiple';
  bal_matrix_multi.validation = {
    minSelections: null,
    maxSelections: 2,
    maxLength: null,
    min: null,
    max: null,
    step: null,
    decimalAllowed: true,
    requireAllRows: undefined
  };
  const bal_text = dhon_banaitesi_item('short_text', 'village_name');
  bal_text.label = 'Village name';
  bal_q.sections = [
    {
      id: 'bench-s1',
      type: 'section',
      title: 'Benchmark section',
      description: null,
      printConfig: null,
      metadata: null,
      items: [bal_single, bal_multi, bal_yesno, bal_likert, bal_matrix_single, bal_matrix_multi, bal_text]
    }
  ];
  return bal_q;
}

export interface bal_BenchmarkMark {
  item: string;
  optionIndex?: number;
  row?: number;
  column?: number;
  style: bal_MarkStyle;
}

export type bal_BenchmarkOutcome = 'accept' | 'review' | 'blank' | 'manual-only';

export interface bal_BenchmarkExpectation {
  item: string;
  row?: number;
  outcome: bal_BenchmarkOutcome;
  selections?: { optionIndex?: number; column?: number }[];
}

export interface bal_BenchmarkScenario {
  id: string;
  description: string;
  marks: bal_BenchmarkMark[];
  effects?: bal_PageEffects;
  expectations: bal_BenchmarkExpectation[];
}

export interface bal_BenchmarkCounters {
  scenarioCount: number;
  regionsProcessed: number;
  expectationChecks: number;
  correctAutoAccepted: number;
  incorrectAutoAccepted: number;
  clearAcceptsRoutedToReview: number;
  correctReviewRouting: number;
  missedReviewAccepted: number;
  correctBlanks: number;
  blanksRoutedToReview: number;
  blanksAccepted: number;
  manualOnlyRecognized: number;
}

export interface bal_BenchmarkScenarioResult {
  id: string;
  description: string;
  pass: boolean;
  details: string[];
}

export interface bal_BenchmarkReport {
  counters: bal_BenchmarkCounters;
  scenarios: bal_BenchmarkScenarioResult[];
}

const BAL_REVIEW_STATUSES = new Set(['needs-review', 'ambiguous', 'multiple-marks', 'unreadable']);

interface bal_LayoutEntry {
  page: number;
  regions: bal_ReadingRegion[];
  blank: ReturnType<typeof bal_render_blank_instrument>;
  index_by_key: Map<string, number>;
}

interface bal_Layout {
  doc: bal_PrintDocument;
  entries: bal_LayoutEntry[];
  rules: Record<string, { minSelections: number | null; maxSelections: number | null }>;
  item_options: Map<string, string[]>;
  item_rows: Map<string, string[]>;
  item_columns: Map<string, string[]>;
  item_ids: Map<string, string>;
}

function bal_push_unique(bal_list: string[] | undefined, bal_value: string): string[] {
  if (!bal_list) return [bal_value];
  if (!bal_list.includes(bal_value)) bal_list.push(bal_value);
  return bal_list;
}

function bal_build_layout(): bal_Layout {
  const bal_questionnaire = bal_benchmark_questionnaire();
  const bal_doc = bal_build_print_document({
    questionnaire: bal_questionnaire,
    scales: [],
    respondentId: 'BENCH-R1'
  });
  const bal_entries: bal_LayoutEntry[] = [];
  const bal_item_options = new Map<string, string[]>();
  const bal_item_rows = new Map<string, string[]>();
  const bal_item_columns = new Map<string, string[]>();
  const bal_item_ids = new Map<string, string>();
  for (const bal_page of bal_doc.pages) {
    const bal_regions = bal_reading_regions_for_page(bal_doc, bal_page.pageNumber);
    if (bal_regions.length === 0) continue;
    const bal_index_by_key = new Map<string, number>();
    bal_regions.forEach((bal_region, bal_index) => {
      const bal_item_key = bal_region.variableName ?? bal_region.itemId;
      if (!bal_item_ids.has(bal_item_key)) bal_item_ids.set(bal_item_key, bal_region.itemId);
      if (bal_region.kind === 'matrix') {
        const bal_row_id = bal_region.rowId ?? '';
        const bal_column_id = bal_region.columnId ?? '';
        bal_index_by_key.set(`${bal_item_key}|r${bal_row_id}|c${bal_column_id}`, bal_index);
        bal_item_rows.set(bal_item_key, bal_push_unique(bal_item_rows.get(bal_item_key), bal_row_id));
        bal_item_columns.set(bal_item_key, bal_push_unique(bal_item_columns.get(bal_item_key), bal_column_id));
      } else if (bal_region.optionId) {
        bal_index_by_key.set(`${bal_item_key}|${bal_region.optionId}`, bal_index);
        bal_item_options.set(bal_item_key, bal_push_unique(bal_item_options.get(bal_item_key), bal_region.optionId));
      }
    });
    bal_entries.push({
      page: bal_page.pageNumber,
      regions: bal_regions,
      blank: bal_render_blank_instrument(bal_regions, BAL_BENCHMARK_PPM),
      index_by_key: bal_index_by_key
    });
  }
  return {
    doc: bal_doc,
    entries: bal_entries,
    rules: bal_selection_rules_from_questionnaire(bal_questionnaire),
    item_options: bal_item_options,
    item_rows: bal_item_rows,
    item_columns: bal_item_columns,
    item_ids: bal_item_ids
  };
}

function bal_option_key(bal_layout: bal_Layout, bal_item: string, bal_option_index: number): string {
  const bal_options = bal_layout.item_options.get(bal_item);
  if (!bal_options || bal_option_index >= bal_options.length) {
    throw new Error(`benchmark item ${bal_item} has no option region ${bal_option_index}`);
  }
  return `${bal_item}|${bal_options[bal_option_index]}`;
}

function bal_matrix_key(bal_layout: bal_Layout, bal_item: string, bal_row: number, bal_column: number): string {
  const bal_rows = bal_layout.item_rows.get(bal_item);
  const bal_columns = bal_layout.item_columns.get(bal_item);
  if (!bal_rows || !bal_columns || bal_row >= bal_rows.length || bal_column >= bal_columns.length) {
    throw new Error(`benchmark item ${bal_item} has no matrix cell r${bal_row} c${bal_column}`);
  }
  return `${bal_item}|r${bal_rows[bal_row]}|c${bal_columns[bal_column]}`;
}

function bal_resolve_mark(bal_layout: bal_Layout, bal_mark: bal_BenchmarkMark): { page: number; index: number } {
  const bal_key =
    bal_mark.row !== undefined
      ? bal_matrix_key(bal_layout, bal_mark.item, bal_mark.row, bal_mark.column ?? 0)
      : bal_option_key(bal_layout, bal_mark.item, bal_mark.optionIndex ?? 0);
  for (const bal_entry of bal_layout.entries) {
    const bal_index = bal_entry.index_by_key.get(bal_key);
    if (bal_index !== undefined) return { page: bal_entry.page, index: bal_index };
  }
  throw new Error(`benchmark mark key ${bal_key} is not on any page`);
}

function bal_identity(
  bal_layout: bal_Layout,
  bal_expectation: bal_BenchmarkExpectation
): { itemId: string; rowId: string | null } {
  const bal_resolved_item = bal_layout.item_ids.get(bal_expectation.item) ?? bal_expectation.item;
  if (bal_expectation.row !== undefined) {
    const bal_rows = bal_layout.item_rows.get(bal_expectation.item);
    if (!bal_rows || bal_expectation.row >= bal_rows.length) {
      throw new Error(`benchmark expectation row not found for ${bal_expectation.item}`);
    }
    return { itemId: bal_resolved_item, rowId: bal_rows[bal_expectation.row] };
  }
  return { itemId: bal_resolved_item, rowId: null };
}

function bal_expected_ids(bal_layout: bal_Layout, bal_expectation: bal_BenchmarkExpectation): string[] {
  return (bal_expectation.selections ?? []).map((bal_selection) => {
    if (bal_expectation.row !== undefined) {
      const bal_columns = bal_layout.item_columns.get(bal_expectation.item);
      return bal_columns?.[bal_selection.column ?? 0] ?? '';
    }
    const bal_options = bal_layout.item_options.get(bal_expectation.item);
    return bal_options?.[bal_selection.optionIndex ?? 0] ?? '';
  });
}

function bal_reading_ids(bal_reading: bal_ItemReading): string[] {
  return bal_reading.value.map((bal_value) =>
    bal_reading.rowId !== null ? (bal_value.columnId ?? '') : (bal_value.optionId ?? '')
  );
}

export function bal_glare_over_option(
  bal_layout: bal_Layout,
  bal_item: string,
  bal_option_index: number
): { cx: number; cy: number; r: number } {
  const bal_key = bal_option_key(bal_layout, bal_item, bal_option_index);
  for (const bal_entry of bal_layout.entries) {
    const bal_index = bal_entry.index_by_key.get(bal_key);
    if (bal_index === undefined) continue;
    const bal_region = bal_entry.regions[bal_index];
    return {
      cx: (bal_region.rectMm.x + bal_region.rectMm.width / 2) * BAL_BENCHMARK_PPM,
      cy: (bal_region.rectMm.y + bal_region.rectMm.height / 2) * BAL_BENCHMARK_PPM,
      r: bal_marker_radius_px(bal_region, BAL_BENCHMARK_PPM) * 1.3
    };
  }
  throw new Error(`no region for ${bal_key}`);
}

export function bal_benchmark_scenarios(): bal_BenchmarkScenario[] {
  return [
    {
      id: 'blank-page',
      description: 'An untouched page produces only blank results and no false marks',
      marks: [],
      expectations: [
        { item: 'main_water_source', outcome: 'blank' },
        { item: 'information_channels', outcome: 'blank' },
        { item: 'household_checked', outcome: 'blank' },
        { item: 'service_satisfaction', outcome: 'blank' },
        { item: 'treatment_practice', row: 0, outcome: 'blank' },
        { item: 'treatment_practice', row: 1, outcome: 'blank' },
        { item: 'treatment_practice', row: 2, outcome: 'blank' },
        { item: 'observed_issues', row: 0, outcome: 'blank' },
        { item: 'observed_issues', row: 1, outcome: 'blank' }
      ]
    },
    {
      id: 'filled-bubble',
      description: 'A fully filled bubble is auto-accepted',
      marks: [{ item: 'main_water_source', optionIndex: 1, style: 'fill' }],
      expectations: [{ item: 'main_water_source', outcome: 'accept', selections: [{ optionIndex: 1 }] }]
    },
    {
      id: 'partial-bubble',
      description: 'A partial bubble fill is auto-accepted',
      marks: [{ item: 'main_water_source', optionIndex: 2, style: 'partial' }],
      expectations: [{ item: 'main_water_source', outcome: 'accept', selections: [{ optionIndex: 2 }] }]
    },
    {
      id: 'tick-mark',
      description: 'A tick stroke is auto-accepted',
      marks: [{ item: 'main_water_source', optionIndex: 0, style: 'tick' }],
      expectations: [{ item: 'main_water_source', outcome: 'accept', selections: [{ optionIndex: 0 }] }]
    },
    {
      id: 'cross-mark',
      description: 'An X cross is auto-accepted',
      marks: [{ item: 'main_water_source', optionIndex: 3, style: 'cross' }],
      expectations: [{ item: 'main_water_source', outcome: 'accept', selections: [{ optionIndex: 3 }] }]
    },
    {
      id: 'slash-mark',
      description: 'A slash stroke is auto-accepted',
      marks: [{ item: 'main_water_source', optionIndex: 2, style: 'slash' }],
      expectations: [{ item: 'main_water_source', outcome: 'accept', selections: [{ optionIndex: 2 }] }]
    },
    {
      id: 'faint-pen',
      description: 'A light but complete pen fill is detected and accepted',
      marks: [{ item: 'main_water_source', optionIndex: 1, style: 'faint' }],
      expectations: [{ item: 'main_water_source', outcome: 'accept', selections: [{ optionIndex: 1 }] }]
    },
    {
      id: 'rough-pencil',
      description: 'Rough pencil shading is not silently accepted',
      marks: [{ item: 'main_water_source', optionIndex: 0, style: 'pencil' }],
      expectations: [{ item: 'main_water_source', outcome: 'review' }]
    },
    {
      id: 'strong-pen-with-noise',
      description: 'A strong pen fill survives sensor noise and exposure shift',
      marks: [{ item: 'main_water_source', optionIndex: 2, style: 'fill' }],
      effects: { noiseAmount: 14, exposureShift: -6, noiseSeed: 23 },
      expectations: [{ item: 'main_water_source', outcome: 'accept', selections: [{ optionIndex: 2 }] }]
    },
    {
      id: 'two-single-choice-marks',
      description: 'Two marked mutually exclusive options never auto-accept',
      marks: [
        { item: 'main_water_source', optionIndex: 0, style: 'fill' },
        { item: 'main_water_source', optionIndex: 2, style: 'fill' }
      ],
      expectations: [{ item: 'main_water_source', outcome: 'review' }]
    },
    {
      id: 'near-tie',
      description: 'A strong mark plus a faint second mark goes to review',
      marks: [
        { item: 'main_water_source', optionIndex: 3, style: 'fill' },
        { item: 'main_water_source', optionIndex: 1, style: 'faint' }
      ],
      expectations: [{ item: 'main_water_source', outcome: 'review' }]
    },
    {
      id: 'multi-valid',
      description: 'Two selections within the maximum are auto-accepted',
      marks: [
        { item: 'information_channels', optionIndex: 0, style: 'fill' },
        { item: 'information_channels', optionIndex: 3, style: 'fill' }
      ],
      expectations: [
        {
          item: 'information_channels',
          outcome: 'accept',
          selections: [{ optionIndex: 0 }, { optionIndex: 3 }]
        }
      ]
    },
    {
      id: 'multi-over-max',
      description: 'More selections than allowed are never silently trimmed',
      marks: [
        { item: 'information_channels', optionIndex: 0, style: 'fill' },
        { item: 'information_channels', optionIndex: 1, style: 'fill' },
        { item: 'information_channels', optionIndex: 3, style: 'fill' }
      ],
      expectations: [{ item: 'information_channels', outcome: 'review' }]
    },
    {
      id: 'yes-marked',
      description: 'A marked Yes is auto-accepted',
      marks: [{ item: 'household_checked', optionIndex: 0, style: 'fill' }],
      expectations: [{ item: 'household_checked', outcome: 'accept', selections: [{ optionIndex: 0 }] }]
    },
    {
      id: 'no-marked',
      description: 'A marked No is auto-accepted',
      marks: [{ item: 'household_checked', optionIndex: 1, style: 'fill' }],
      expectations: [{ item: 'household_checked', outcome: 'accept', selections: [{ optionIndex: 1 }] }]
    },
    {
      id: 'both-yes-no',
      description: 'Both Yes and No marked goes to review',
      marks: [
        { item: 'household_checked', optionIndex: 0, style: 'fill' },
        { item: 'household_checked', optionIndex: 1, style: 'fill' }
      ],
      expectations: [{ item: 'household_checked', outcome: 'review' }]
    },
    {
      id: 'likert-clear',
      description: 'A clear Likert response is auto-accepted',
      marks: [{ item: 'service_satisfaction', optionIndex: 3, style: 'fill' }],
      expectations: [{ item: 'service_satisfaction', outcome: 'accept', selections: [{ optionIndex: 3 }] }]
    },
    {
      id: 'matrix-clear-rows',
      description: 'One mark per matrix row is auto-accepted per row',
      marks: [
        { item: 'treatment_practice', row: 0, column: 0, style: 'fill' },
        { item: 'treatment_practice', row: 1, column: 1, style: 'tick' },
        { item: 'treatment_practice', row: 2, column: 2, style: 'cross' }
      ],
      expectations: [
        { item: 'treatment_practice', row: 0, outcome: 'accept', selections: [{ column: 0 }] },
        { item: 'treatment_practice', row: 1, outcome: 'accept', selections: [{ column: 1 }] },
        { item: 'treatment_practice', row: 2, outcome: 'accept', selections: [{ column: 2 }] }
      ]
    },
    {
      id: 'matrix-blank-row',
      description: 'An untouched matrix row stays blank while marked rows accept',
      marks: [
        { item: 'treatment_practice', row: 0, column: 1, style: 'fill' },
        { item: 'treatment_practice', row: 1, column: 2, style: 'fill' }
      ],
      expectations: [
        { item: 'treatment_practice', row: 0, outcome: 'accept', selections: [{ column: 1 }] },
        { item: 'treatment_practice', row: 1, outcome: 'accept', selections: [{ column: 2 }] },
        { item: 'treatment_practice', row: 2, outcome: 'blank' }
      ]
    },
    {
      id: 'matrix-multiple-marks',
      description: 'Two marks in a single-selection matrix row go to review',
      marks: [
        { item: 'treatment_practice', row: 1, column: 0, style: 'fill' },
        { item: 'treatment_practice', row: 1, column: 2, style: 'fill' }
      ],
      expectations: [{ item: 'treatment_practice', row: 1, outcome: 'review' }]
    },
    {
      id: 'matrix-multi-valid',
      description: 'A multi-selection matrix row within the maximum is accepted',
      marks: [
        { item: 'observed_issues', row: 0, column: 0, style: 'fill' },
        { item: 'observed_issues', row: 0, column: 2, style: 'fill' }
      ],
      expectations: [
        {
          item: 'observed_issues',
          row: 0,
          outcome: 'accept',
          selections: [{ column: 0 }, { column: 2 }]
        }
      ]
    },
    {
      id: 'matrix-multi-over-max',
      description: 'A multi-selection matrix row beyond the maximum goes to review',
      marks: [
        { item: 'observed_issues', row: 1, column: 0, style: 'fill' },
        { item: 'observed_issues', row: 1, column: 1, style: 'fill' },
        { item: 'observed_issues', row: 1, column: 2, style: 'fill' }
      ],
      expectations: [{ item: 'observed_issues', row: 1, outcome: 'review' }]
    },
    {
      id: 'mild-shadow',
      description: 'A filled mark survives a mild page shadow',
      marks: [{ item: 'main_water_source', optionIndex: 1, style: 'fill' }],
      effects: { shadowStrength: 22 },
      expectations: [{ item: 'main_water_source', outcome: 'accept', selections: [{ optionIndex: 1 }] }]
    },
    {
      id: 'mild-blur',
      description: 'A filled mark survives mild blur',
      marks: [{ item: 'main_water_source', optionIndex: 2, style: 'fill' }],
      effects: { blurRadius: 2 },
      expectations: [{ item: 'main_water_source', outcome: 'accept', selections: [{ optionIndex: 2 }] }]
    },
    {
      id: 'glare-away',
      description: 'Glare away from the answer area does not block acceptance',
      marks: [{ item: 'main_water_source', optionIndex: 1, style: 'fill' }],
      effects: { glareSpots: [{ cx: 60, cy: 60, r: 45 }] },
      expectations: [{ item: 'main_water_source', outcome: 'accept', selections: [{ optionIndex: 1 }] }]
    },
    {
      id: 'glare-over-region',
      description: 'Glare over the answer area routes the question to review, never a silent guess',
      marks: [{ item: 'main_water_source', optionIndex: 2, style: 'fill' }],
      expectations: [{ item: 'main_water_source', outcome: 'review' }]
    },
    {
      id: 'crossed-out-correction',
      description: 'A corrected answer with ink on two options goes to review',
      marks: [
        { item: 'main_water_source', optionIndex: 0, style: 'slash' },
        { item: 'main_water_source', optionIndex: 2, style: 'fill' }
      ],
      expectations: [{ item: 'main_water_source', outcome: 'review' }]
    },
    {
      id: 'manual-only-field',
      description: 'A handwritten text field is never machine-interpreted',
      marks: [],
      expectations: [{ item: 'village_name', outcome: 'manual-only' }]
    }
  ];
}

export function bal_run_benchmark(): bal_BenchmarkReport {
  const bal_layout = bal_build_layout();
  const bal_counters: bal_BenchmarkCounters = {
    scenarioCount: 0,
    regionsProcessed: 0,
    expectationChecks: 0,
    correctAutoAccepted: 0,
    incorrectAutoAccepted: 0,
    clearAcceptsRoutedToReview: 0,
    correctReviewRouting: 0,
    missedReviewAccepted: 0,
    correctBlanks: 0,
    blanksRoutedToReview: 0,
    blanksAccepted: 0,
    manualOnlyRecognized: 0
  };
  const bal_results: bal_BenchmarkScenarioResult[] = [];

  for (const bal_scenario of bal_benchmark_scenarios()) {
    bal_counters.scenarioCount += 1;
    const bal_details: string[] = [];
    const bal_effects: bal_PageEffects =
      bal_scenario.id === 'glare-over-region'
        ? { glareSpots: [bal_glare_over_option(bal_layout, 'main_water_source', 2)] }
        : (bal_scenario.effects ?? {});
    const bal_marks_by_page = new Map<number, { regionIndex: number; style: bal_MarkStyle }[]>();
    for (const bal_mark of bal_scenario.marks) {
      const bal_resolved = bal_resolve_mark(bal_layout, bal_mark);
      const bal_list = bal_marks_by_page.get(bal_resolved.page) ?? [];
      bal_list.push({ regionIndex: bal_resolved.index, style: bal_mark.style });
      bal_marks_by_page.set(bal_resolved.page, bal_list);
    }
    const bal_readings: bal_ItemReading[] = [];
    let bal_manual_only_seen = false;
    for (const bal_entry of bal_layout.entries) {
      const bal_scan = bal_render_marked_scan(
        bal_entry.blank,
        bal_entry.regions,
        bal_marks_by_page.get(bal_entry.page) ?? [],
        BAL_BENCHMARK_PPM,
        bal_effects
      );
      bal_counters.regionsProcessed += bal_entry.regions.length;
      const bal_output = bal_read_page({
        image: bal_scan,
        blank: bal_entry.blank,
        regions: bal_entry.regions,
        quality: {
          blurStatus: 'good',
          exposureStatus: 'good',
          glareStatus: 'good',
          resolutionStatus: 'good',
          alignmentStatus: 'good'
        },
        pxPerMm: BAL_BENCHMARK_PPM,
        profile: BAL_DEFAULT_THRESHOLD_PROFILE,
        selectionRules: bal_layout.rules
      });
      bal_readings.push(...bal_output.items);
      if (
        bal_output.manualOnlyRegions.some(
          (bal_region) => bal_region.variableName === 'village_name' || bal_region.itemId === 'village_name'
        )
      ) {
        bal_manual_only_seen = true;
      }
    }
    if (bal_manual_only_seen) bal_counters.manualOnlyRecognized += 1;

    for (const bal_expectation of bal_scenario.expectations) {
      bal_counters.expectationChecks += 1;
      const bal_reading_identity = bal_identity(bal_layout, bal_expectation);
      const bal_reading = bal_readings.find(
        (bal_candidate) =>
          bal_candidate.itemId === bal_reading_identity.itemId && bal_candidate.rowId === bal_reading_identity.rowId
      );
      if (!bal_reading) {
        if (bal_expectation.outcome === 'manual-only' && bal_manual_only_seen) {
          bal_counters.correctReviewRouting += 1;
          continue;
        }
        bal_details.push(`${bal_reading_identity.itemId}:${bal_reading_identity.rowId ?? ''} produced no reading`);
        continue;
      }
      const bal_actual = bal_reading_ids(bal_reading).join(';');
      const bal_expected = bal_expected_ids(bal_layout, bal_expectation).join(';');
      if (bal_expectation.outcome === 'accept') {
        if (bal_reading.status === 'accepted' && bal_actual === bal_expected) {
          bal_counters.correctAutoAccepted += 1;
        } else if (bal_reading.status === 'accepted') {
          bal_counters.incorrectAutoAccepted += 1;
          bal_details.push(`accepted [${bal_actual}] but ground truth is [${bal_expected}]`);
        } else if (BAL_REVIEW_STATUSES.has(bal_reading.status)) {
          bal_counters.clearAcceptsRoutedToReview += 1;
          bal_details.push(`clear answer routed to review (${bal_reading.status})`);
        } else {
          bal_counters.clearAcceptsRoutedToReview += 1;
          bal_details.push(`clear answer read as ${bal_reading.status}`);
        }
      } else if (bal_expectation.outcome === 'review') {
        if (BAL_REVIEW_STATUSES.has(bal_reading.status)) {
          bal_counters.correctReviewRouting += 1;
        } else if (bal_reading.status === 'accepted') {
          bal_counters.missedReviewAccepted += 1;
          bal_counters.incorrectAutoAccepted += 1;
          bal_details.push(`uncertain case auto-accepted as [${bal_actual}]`);
        } else {
          bal_details.push(`expected review but read as ${bal_reading.status}`);
        }
      } else if (bal_expectation.outcome === 'blank') {
        if (bal_reading.status === 'blank') {
          bal_counters.correctBlanks += 1;
        } else if (bal_reading.status === 'accepted') {
          bal_counters.blanksAccepted += 1;
          bal_counters.incorrectAutoAccepted += 1;
          bal_details.push(`blank accepted as [${bal_actual}]`);
        } else if (BAL_REVIEW_STATUSES.has(bal_reading.status)) {
          bal_counters.blanksRoutedToReview += 1;
          bal_details.push(`blank routed to review (${bal_reading.status})`);
        } else {
          bal_details.push(`expected blank but read as ${bal_reading.status}`);
        }
      } else if (bal_expectation.outcome === 'manual-only') {
        if (bal_reading === undefined && bal_manual_only_seen) bal_counters.correctReviewRouting += 1;
        else if (bal_reading) bal_details.push(`manual-only item was machine-interpreted as ${bal_reading.status}`);
      }
    }
    if (bal_expectations_include_manual_only(bal_scenario) && !bal_manual_only_seen) {
      bal_details.push('manual-only region was not reported');
    }

    bal_results.push({
      id: bal_scenario.id,
      description: bal_scenario.description,
      pass: bal_details.length === 0,
      details: bal_details
    });
  }

  return { counters: bal_counters, scenarios: bal_results };
}

function bal_expectations_include_manual_only(bal_scenario: bal_BenchmarkScenario): boolean {
  return bal_scenario.expectations.some((bal_expectation) => bal_expectation.outcome === 'manual-only');
}
