import { describe, expect, it } from 'vitest';
import type { ResponseRecord } from '../../models/response_models';
import type { bal_ItemInfo } from './reading_ui_helpers';
import {
  BAL_TABLE_ROW_WINDOW,
  bal_next_row_limit,
  bal_respondent_matches_filter,
  bal_search_matches_nothing,
  bal_search_respondents,
  bal_search_variables,
  bal_sort_respondents,
  bal_table_variables
} from './response_table';

const BAL_REVIEW = new Set(['needs-review', 'ambiguous', 'multiple-marks', 'unreadable', 'manual-only']);

function bal_response(bal_overrides: Partial<ResponseRecord>): ResponseRecord {
  return {
    id: 'r',
    projectId: 'p1',
    batchId: null,
    questionnaireId: 'q1',
    questionnaireVersion: 1,
    respondentId: 'R-001',
    itemId: 'i1',
    variableName: 'water',
    itemType: 'single_choice',
    rowId: null,
    columnId: null,
    value: [],
    codedValue: null,
    status: 'accepted',
    confidence: null,
    machineValue: null,
    machineStatus: null,
    machineConfidence: null,
    manuallyReviewed: false,
    validationIssues: [],
    sourcePageId: null,
    sourceRegionRect: null,
    algorithmVersion: 'R1',
    thresholdProfileName: 'default',
    recognitionRunId: null,
    createdAt: 0,
    updatedAt: 0,
    ...bal_overrides
  };
}

function bal_item(bal_overrides: Partial<bal_ItemInfo>): bal_ItemInfo {
  return {
    itemId: 'i1',
    label: 'Water source',
    type_label: 'single choice',
    number: 'Q1',
    sectionTitle: 'Household',
    options: [],
    columns: [],
    rows: [],
    ...bal_overrides
  };
}

describe('table variables', () => {
  it('derives one column per item or matrix row with section names', () => {
    const bal_items = new Map([
      ['i1', bal_item({})],
      ['i2', bal_item({ itemId: 'i2', label: 'Food frequency', rows: [{ id: 'row1', label: 'Rice' }] })]
    ]);
    const bal_vars = bal_table_variables(
      [
        bal_response({ itemId: 'i1' }),
        bal_response({ itemId: 'i2', variableName: 'food', rowId: 'row1' }),
        bal_response({ itemId: 'i2', variableName: 'food', rowId: 'row1' })
      ],
      bal_items
    );
    expect(bal_vars).toHaveLength(2);
    expect(bal_vars[0]).toMatchObject({ key: 'i1', label: 'Q1 Water source', sectionTitle: 'Household' });
    expect(bal_vars[1]).toMatchObject({ key: 'i2::row1', variableName: 'food', label: 'Q1 Rice · Food frequency' });
  });

  it('handles one hundred respondents by one hundred variables', () => {
    const bal_items = new Map<string, bal_ItemInfo>();
    for (let bal_i = 0; bal_i < 100; bal_i += 1) {
      bal_items.set(`i${bal_i}`, bal_item({ itemId: `i${bal_i}`, label: `Question ${bal_i}` }));
    }
    const bal_responses: ResponseRecord[] = [];
    for (let bal_r = 0; bal_r < 100; bal_r += 1) {
      for (let bal_c = 0; bal_c < 100; bal_c += 1) {
        bal_responses.push(
          bal_response({ id: `r${bal_r}-${bal_c}`, respondentId: `R-${String(bal_r).padStart(3, '0')}`, itemId: `i${bal_c}` })
        );
      }
    }
    const bal_start = performance.now();
    const bal_vars = bal_table_variables(bal_responses, bal_items);
    expect(bal_vars).toHaveLength(100);
    expect(bal_search_variables(bal_vars, 'question 99')).toHaveLength(1);
    expect(performance.now() - bal_start).toBeLessThan(500);
  });
});

describe('filters and search', () => {
  it('filters respondents by cell or completeness state', () => {
    const bal_cells = [bal_response({ status: 'blank' })];
    expect(bal_respondent_matches_filter(bal_cells, 'blank', 'complete', BAL_REVIEW)).toBe(true);
    expect(bal_respondent_matches_filter(bal_cells, 'review', 'complete', BAL_REVIEW)).toBe(false);
    expect(bal_respondent_matches_filter(bal_cells, 'incomplete', 'complete', BAL_REVIEW)).toBe(false);
    expect(bal_respondent_matches_filter(bal_cells, 'incomplete', 'missing-page', BAL_REVIEW)).toBe(true);
  });

  it('matches respondent ids, variable names, labels, and section names', () => {
    const bal_respondents = ['R-001', 'R-002'];
    const bal_vars = [
      {
        key: 'i1',
        itemId: 'i1',
        rowId: null,
        variableName: 'water_source',
        label: 'Q1 Water source',
        sectionTitle: 'Household'
      },
      {
        key: 'i2',
        itemId: 'i2',
        rowId: null,
        variableName: 'village',
        label: 'Q2 Village',
        sectionTitle: 'Location'
      }
    ];
    expect(bal_search_respondents(bal_respondents, '002')).toEqual(['R-002']);
    expect(bal_search_respondents(bal_respondents, 'zzz')).toBeNull();
    expect(bal_search_variables(bal_vars, 'household')?.map((bal_v) => bal_v.key)).toEqual(['i1']);
    expect(bal_search_variables(bal_vars, 'location')?.map((bal_v) => bal_v.key)).toEqual(['i2']);
    expect(bal_search_variables(bal_vars, 'water_source')?.map((bal_v) => bal_v.key)).toEqual(['i1']);
    expect(bal_search_matches_nothing(bal_respondents, bal_vars, 'nonsense')).toBe(true);
    expect(bal_search_matches_nothing(bal_respondents, bal_vars, 'village')).toBe(false);
  });
});

describe('sorting and windowing', () => {
  it('sorts by cell text with empty values last in both directions', () => {
    const bal_respondents = ['R-1', 'R-2', 'R-3'];
    const bal_cells: Record<string, Record<string, string>> = {
      'R-1': { i1: '10' },
      'R-2': { i1: '9' },
      'R-3': { i1: '' }
    };
    const bal_text = (bal_respondent: string): string => bal_cells[bal_respondent].i1 ?? '';
    expect(bal_sort_respondents(bal_respondents, { key: 'i1', dir: 'asc' }, bal_text)).toEqual(['R-2', 'R-1', 'R-3']);
    expect(bal_sort_respondents(bal_respondents, { key: 'i1', dir: 'desc' }, bal_text)).toEqual(['R-1', 'R-2', 'R-3']);
    expect(bal_sort_respondents(bal_respondents, { key: null, dir: 'asc' }, bal_text)).toEqual(bal_respondents);
  });

  it('grows the row window by a fixed step', () => {
    expect(BAL_TABLE_ROW_WINDOW).toBe(100);
    expect(bal_next_row_limit(100)).toBe(200);
  });
});
