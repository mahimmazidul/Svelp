import { describe, expect, it } from 'vitest';
import type { QuestionnaireRecord, ResponseScaleRecord } from '../../models/types';
import type { ResponseRecord } from '../../models/response_models';
import {
  bal_count_issues_by_severity,
  bal_export_warning_counts,
  bal_validate_dataset
} from './dataset_validation';

function bal_questionnaire(): QuestionnaireRecord {
  return {
    id: 'q-v',
    projectId: 'p-v',
    title: 'Validation study',
    description: null,
    version: 2,
    language: 'en',
    paperSize: 'a4',
    orientation: 'portrait',
    theme: null,
    status: 'draft',
    metadata: null,
    printSettings: null,
    sections: [
      {
        id: 's1',
        type: 'section',
        title: 'Household',
        description: null,
        printConfig: null,
        metadata: null,
        items: [
          {
            id: 'i-src',
            type: 'single_choice',
            variableName: 'water_source',
            label: 'Water source',
            required: true,
            options: [
              { id: 'o1', label: 'Piped', coding: '1' },
              { id: 'o2', label: 'Well', coding: '2' }
            ],
            coding: null,
            validation: null,
            scannerConfig: null,
            printConfig: null,
            metadata: null,
            scaleId: null,
            placeholder: null,
            heading: null,
            emphasis: 'normal',
            rows: [],
            columns: [],
            selectionMode: 'single',
            consent: null,
            signature: null,
            unitLabel: null
          },
          {
            id: 'i-multi',
            type: 'multiple_choice',
            variableName: 'crops',
            label: 'Crops',
            required: false,
            options: [
              { id: 'c1', label: 'Rice', coding: '1' },
              { id: 'c2', label: 'Jute', coding: '2' },
              { id: 'c3', label: 'Wheat', coding: '3' }
            ],
            coding: null,
            validation: { minSelections: 1, maxSelections: 2, maxLength: null, min: null, max: null, step: null, decimalAllowed: true, requireAllRows: null },
            scannerConfig: null,
            printConfig: null,
            metadata: null,
            scaleId: null,
            placeholder: null,
            heading: null,
            emphasis: 'normal',
            rows: [],
            columns: [],
            selectionMode: 'multiple',
            consent: null,
            signature: null,
            unitLabel: null
          },
          {
            id: 'i-matrix',
            type: 'matrix',
            variableName: 'ratings',
            label: 'Ratings',
            required: false,
            options: [],
            coding: null,
            validation: null,
            scannerConfig: null,
            printConfig: null,
            metadata: null,
            scaleId: null,
            placeholder: null,
            heading: null,
            emphasis: 'normal',
            rows: [{ id: 'r1', label: 'Taste' }],
            columns: [
              { id: 'col1', label: 'Good', coding: 'G' },
              { id: 'col2', label: 'Bad', coding: 'B' }
            ],
            selectionMode: 'single',
            consent: null,
            signature: null,
            unitLabel: null
          },
          {
            id: 'i-num',
            type: 'number',
            variableName: 'acres',
            label: 'Land size',
            required: false,
            options: [],
            coding: null,
            validation: { min: 0, max: 100, step: null, decimalAllowed: true, maxLength: null, minSelections: null, maxSelections: null, requireAllRows: null },
            scannerConfig: null,
            printConfig: null,
            metadata: null,
            scaleId: null,
            placeholder: null,
            heading: null,
            emphasis: 'normal',
            rows: [],
            columns: [],
            selectionMode: 'single',
            consent: null,
            signature: null,
            unitLabel: null
          }
        ]
      }
    ],
    createdAt: 0,
    updatedAt: 0
  };
}

function bal_response(bal_over: Partial<ResponseRecord>): ResponseRecord {
  return {
    id: 'R1::i-src',
    projectId: 'p-v',
    batchId: null,
    questionnaireId: 'q-v',
    questionnaireVersion: 2,
    respondentId: 'R1',
    itemId: 'i-src',
    variableName: 'water_source',
    itemType: 'single_choice',
    rowId: null,
    columnId: null,
    value: ['o1'],
    codedValue: ['1'],
    status: 'accepted',
    confidence: 0.9,
    machineValue: ['o1'],
    machineStatus: 'accepted',
    machineConfidence: 0.9,
    manuallyReviewed: false,
    validationIssues: [],
    sourcePageId: 'page-1',
    sourceRegionRect: null,
    algorithmVersion: 'R1',
    thresholdProfileName: 'default-v1',
    recognitionRunId: null,
    createdAt: 0,
    updatedAt: 0,
    ...bal_over
  };
}

function bal_pages() {
  return [
    { id: 'page-1', respondentId: 'R1', pageNumber: 1, questionnaireVersion: 2 },
    { id: 'page-2', respondentId: 'R2', pageNumber: 1, questionnaireVersion: 2 }
  ];
}

describe('dataset validation', () => {
  it('returns no issues for a clean dataset', () => {
    const bal_issues = bal_validate_dataset({
      questionnaire: bal_questionnaire(),
      scales: [],
      responses: [bal_response({})],
      readyPages: bal_pages(),
      expectedPages: 1
    });
    expect(bal_issues).toEqual([]);
  });

  it('detects values outside the current option set and schema orphans', () => {
    const bal_issues = bal_validate_dataset({
      questionnaire: bal_questionnaire(),
      scales: [],
      responses: [
        bal_response({ value: ['o9'], codedValue: null }),
        bal_response({ id: 'R1::gone', itemId: 'i-deleted', variableName: 'removed', value: [], status: 'blank', manuallyReviewed: true })
      ],
      readyPages: bal_pages(),
      expectedPages: 1
    });
    const bal_types = bal_issues.map((bal_i) => bal_i.type);
    expect(bal_types).toContain('invalid-coded-value');
    expect(bal_types).toContain('schema-mismatch');
    expect(bal_count_issues_by_severity(bal_issues).error).toBeGreaterThanOrEqual(2);
  });

  it('flags version mismatches as errors', () => {
    const bal_issues = bal_validate_dataset({
      questionnaire: bal_questionnaire(),
      scales: [],
      responses: [bal_response({ questionnaireVersion: 1 })],
      readyPages: bal_pages(),
      expectedPages: 1
    });
    expect(bal_issues.map((bal_i) => bal_i.type)).toContain('version-mismatch');
  });

  it('enforces multiple-choice minimum and maximum selections', () => {
    const bal_issues = bal_validate_dataset({
      questionnaire: bal_questionnaire(),
      scales: [],
      responses: [
        bal_response({ id: 'R1::i-multi', itemId: 'i-multi', itemType: 'multiple_choice', value: ['c1', 'c2', 'c3'] }),
        bal_response({ respondentId: 'R2', id: 'R2::i-multi', itemId: 'i-multi', itemType: 'multiple_choice', value: [], status: 'blank', manuallyReviewed: false, sourcePageId: 'page-2' })
      ],
      readyPages: bal_pages(),
      expectedPages: 1
    });
    const bal_max = bal_issues.find((bal_i) => bal_i.type === 'selection-rule-violation' && bal_i.expectedRule === 'At most 2 selections');
    expect(bal_max?.respondentId).toBe('R1');
    const bal_min = bal_issues.find((bal_i) => bal_i.type === 'missing-required');
    expect(bal_min).toBeDefined();
  });

  it('validates matrix rows, columns, and single-selection rows', () => {
    const bal_issues = bal_validate_dataset({
      questionnaire: bal_questionnaire(),
      scales: [],
      responses: [
        bal_response({ id: 'R1::i-matrix::r1', itemId: 'i-matrix', itemType: 'matrix', rowId: 'r1', value: ['col1', 'col2'] }),
        bal_response({ respondentId: 'R2', id: 'R2::i-matrix::r9', itemId: 'i-matrix', itemType: 'matrix', rowId: 'r9', value: ['col9'], sourcePageId: 'page-2' })
      ],
      readyPages: bal_pages(),
      expectedPages: 1
    });
    const bal_types = bal_issues.filter((bal_i) => bal_i.type === 'matrix-rule-violation');
    expect(bal_types.some((bal_i) => bal_i.expectedRule === 'This matrix row allows one selection')).toBe(true);
    expect(bal_types.some((bal_i) => bal_i.expectedRule === 'Matrix row exists in the current questionnaire')).toBe(true);
    expect(bal_issues.map((bal_i) => bal_i.type)).toContain('invalid-coded-value');
  });

  it('checks transcribed numbers against the validation range', () => {
    const bal_issues = bal_validate_dataset({
      questionnaire: bal_questionnaire(),
      scales: [],
      responses: [
        bal_response({ id: 'R1::i-num', itemId: 'i-num', itemType: 'number', variableName: 'acres', value: ['250'], status: 'accepted', manuallyReviewed: true }),
        bal_response({ respondentId: 'R2', id: 'R2::i-num', itemId: 'i-num', itemType: 'number', variableName: 'acres', value: ['many'], status: 'accepted', manuallyReviewed: true, sourcePageId: 'page-2' })
      ],
      readyPages: bal_pages(),
      expectedPages: 1
    });
    const bal_range = bal_issues.filter((bal_i) => bal_i.type === 'numeric-range-violation');
    expect(bal_range).toHaveLength(2);
    expect(bal_count_issues_by_severity(bal_range).warning).toBe(2);
  });

  it('reports unresolved review items and missing source pages', () => {
    const bal_issues = bal_validate_dataset({
      questionnaire: bal_questionnaire(),
      scales: [],
      responses: [
        bal_response({ status: 'ambiguous', value: [], manuallyReviewed: false }),
        bal_response({ id: 'R1::gone-page', itemId: 'i-multi', itemType: 'multiple_choice', value: ['c1'], sourcePageId: 'page-missing' })
      ],
      readyPages: bal_pages(),
      expectedPages: 1
    });
    expect(bal_issues.map((bal_i) => bal_i.type)).toContain('unresolved-review');
    expect(bal_issues.map((bal_i) => bal_i.type)).toContain('missing-source-page');
  });

  it('flags duplicate response records for the same logical variable', () => {
    const bal_issues = bal_validate_dataset({
      questionnaire: bal_questionnaire(),
      scales: [],
      responses: [bal_response({}), bal_response({ id: 'R1::i-src-copy', value: ['o2'] })],
      readyPages: bal_pages(),
      expectedPages: 1
    });
    expect(bal_issues.filter((bal_i) => bal_i.type === 'duplicate-response')).toHaveLength(1);
  });

  it('flags the same respondent page identified twice', () => {
    const bal_issues = bal_validate_dataset({
      questionnaire: bal_questionnaire(),
      scales: [],
      responses: [],
      readyPages: [...bal_pages(), { id: 'page-1-copy', respondentId: 'R1', pageNumber: 1, questionnaireVersion: 2 }],
      expectedPages: 1
    });
    expect(bal_issues.map((bal_i) => bal_i.type)).toContain('duplicate-respondent-page');
  });

  it('reports required blanks only when nothing confirmed the answer', () => {
    const bal_issues = bal_validate_dataset({
      questionnaire: bal_questionnaire(),
      scales: [],
      responses: [bal_response({ status: 'blank', value: [], manuallyReviewed: true })],
      readyPages: bal_pages(),
      expectedPages: 1
    });
    const bal_required = bal_issues.filter((bal_i) => bal_i.type === 'missing-required');
    expect(bal_required).toHaveLength(1);
    expect(bal_required[0].itemId).toBe('i-src');
  });

  it('summarizes export warning counts', () => {
    const bal_counts = bal_export_warning_counts([
      { id: '1', type: 'unresolved-review', severity: 'warning', respondentId: 'R1', itemId: null, variableName: null, currentValue: null, expectedRule: null, sourcePageId: null, resolution: 'open' },
      { id: '2', type: 'missing-source-page', severity: 'warning', respondentId: 'R1', itemId: null, variableName: null, currentValue: null, expectedRule: null, sourcePageId: 'p', resolution: 'open' },
      { id: '3', type: 'missing-required', severity: 'error', respondentId: 'R2', itemId: null, variableName: null, currentValue: null, expectedRule: null, sourcePageId: null, resolution: 'open' }
    ]);
    expect(bal_counts).toEqual({ unresolved: 1, missingSource: 1 });
  });

  it('uses scale options when validating scale-linked questions', () => {
    const bal_scales: ResponseScaleRecord[] = [
      {
        id: 'sc1',
        name: 'Frequency',
        options: [
          { id: 'f1', label: 'Never', coding: '0' },
          { id: 'f2', label: 'Daily', coding: '4' }
        ],
        createdAt: 0,
        updatedAt: 0
      }
    ];
    const bal_q = bal_questionnaire();
    bal_q.sections[0].items[0].scaleId = 'sc1';
    bal_q.sections[0].items[0].options = [];
    const bal_ok = bal_validate_dataset({
      questionnaire: bal_q,
      scales: bal_scales,
      responses: [bal_response({ value: ['f2'] })],
      readyPages: bal_pages(),
      expectedPages: 1
    });
    expect(bal_ok).toEqual([]);
    const bal_bad = bal_validate_dataset({
      questionnaire: bal_q,
      scales: bal_scales,
      responses: [bal_response({ value: ['o1'] })],
      readyPages: bal_pages(),
      expectedPages: 1
    });
    expect(bal_bad.map((bal_i) => bal_i.type)).toContain('invalid-coded-value');
  });
});
