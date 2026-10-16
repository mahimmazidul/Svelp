import { describe, expect, it } from 'vitest';
import { bal_build_page_plan, bal_group_regions, type bal_AnswerPlan, type bal_MarkInstruction } from './calibration_plan';
import type { bal_ReadingRegion } from '../reading/reading_fixtures';
import { bal_ground_truth_issues, bal_parse_ground_truth } from './calibration_ground_truth';

function bal_region(bal_part: Partial<bal_ReadingRegion>): bal_ReadingRegion {
  return {
    itemId: bal_part.itemId ?? 'item-x',
    variableName: bal_part.variableName ?? 'item_x',
    itemType: bal_part.itemType ?? 'single_choice',
    kind: bal_part.kind ?? 'choice',
    selection: bal_part.selection ?? 'single',
    markerType: bal_part.markerType ?? 'bubble',
    optionId: bal_part.optionId ?? null,
    optionCode: bal_part.optionCode ?? null,
    rowId: bal_part.rowId ?? null,
    columnId: bal_part.columnId ?? null,
    rectMm: bal_part.rectMm ?? { x: 10, y: 10, width: 7, height: 7 }
  };
}

function bal_choice_regions(): bal_ReadingRegion[] {
  return [
    bal_region({ itemId: 'i-1', variableName: 'q1', optionId: 'o-a', rectMm: { x: 10, y: 10, width: 7, height: 7 } }),
    bal_region({ itemId: 'i-1', variableName: 'q1', optionId: 'o-b', rectMm: { x: 10, y: 20, width: 7, height: 7 } }),
    bal_region({ itemId: 'i-1', variableName: 'q1', optionId: 'o-c', rectMm: { x: 10, y: 30, width: 7, height: 7 } })
  ];
}

function bal_matrix_regions(): bal_ReadingRegion[] {
  return [
    bal_region({ itemId: 'i-2', variableName: 'm1', kind: 'matrix', itemType: 'matrix', rowId: 'r-1', columnId: 'c-1' }),
    bal_region({ itemId: 'i-2', variableName: 'm1', kind: 'matrix', itemType: 'matrix', rowId: 'r-1', columnId: 'c-2' }),
    bal_region({ itemId: 'i-2', variableName: 'm1', kind: 'matrix', itemType: 'matrix', rowId: 'r-2', columnId: 'c-1' }),
    bal_region({ itemId: 'i-2', variableName: 'm1', kind: 'matrix', itemType: 'matrix', rowId: 'r-2', columnId: 'c-2' })
  ];
}

describe('ground truth validation', () => {
  it('accepts a valid document', () => {
    const bal_doc = {
      questionnaireId: 'q-1',
      questionnaireVersion: 3,
      printProfile: 'compact',
      respondentId: 'R-1',
      pages: [
        {
          pageNumber: 1,
          qrPayload: 'S1|CODE|3|R-1|1',
          answers: [
            { itemId: 'i-1', rowId: null, expectedStatus: 'accept', expectedValue: ['o-b'] },
            { itemId: 'i-2', rowId: 'r-1', expectedStatus: 'blank', expectedValue: [] }
          ]
        }
      ]
    };
    expect(bal_ground_truth_issues(bal_doc)).toEqual([]);
    const bal_parsed = bal_parse_ground_truth(bal_doc);
    expect(bal_parsed.doc).not.toBeNull();
    expect(bal_parsed.doc?.pages[0].answers[0].expectedValue).toEqual(['o-b']);
  });

  it('rejects duplicate rows, unknown statuses, and accept without value', () => {
    const bal_doc = {
      questionnaireId: 'q-1',
      questionnaireVersion: 1,
      printProfile: 'dense',
      respondentId: 'R-1',
      pages: [
        {
          pageNumber: 1,
          qrPayload: 'x',
          answers: [
            { itemId: 'i-1', rowId: null, expectedStatus: 'accept', expectedValue: [] },
            { itemId: 'i-1', rowId: null, expectedStatus: 'nonsense', expectedValue: [] },
            { itemId: 'i-1', rowId: null, expectedStatus: 'blank', expectedValue: [] }
          ]
        },
        {
          pageNumber: 1,
          qrPayload: 'x',
          answers: []
        }
      ]
    };
    const bal_issues = bal_ground_truth_issues(bal_doc);
    const bal_messages = bal_issues.map((bal_i) => bal_i.message).join(' ');
    expect(bal_messages).toContain('accept requires');
    expect(bal_messages).toContain('unknown expected status');
    expect(bal_messages).toContain('duplicate itemId/rowId');
    expect(bal_messages).toContain('duplicate page number');
  });

  it('round trips through serialize and parse', () => {
    const bal_doc = {
      questionnaireId: 'q-1',
      questionnaireVersion: 2,
      printProfile: 'comfortable',
      respondentId: 'R-9',
      pages: [{ pageNumber: 2, qrPayload: 'S1|C|2|R-9|2', answers: [] }]
    };
    const bal_round = bal_parse_ground_truth(JSON.parse(bal_doc !== undefined ? JSON.stringify(bal_doc) : ''));
    expect(bal_round.issues).toEqual([]);
    expect(bal_round.doc?.pages[0].pageNumber).toBe(2);
  });
});

describe('page plan builder', () => {
  it('resolves marks and ground truth against stable ids', () => {
    const bal_regions = [...bal_choice_regions(), ...bal_matrix_regions()];
    const bal_marks: bal_MarkInstruction[] = [
      { variableName: 'q1', optionIndex: 1, style: 'fill' },
      { variableName: 'm1', row: 0, column: 1, style: 'tick' }
    ];
    const bal_answers: bal_AnswerPlan[] = [
      { variableName: 'q1', expected: 'accept', expectedOptionIndexes: [1] },
      { variableName: 'm1', row: 0, expected: 'accept', expectedOptionIndexes: [1] },
      { variableName: 'm1', row: 1, expected: 'blank' }
    ];
    const bal_result = bal_build_page_plan(1, 'S1|C|1|R|1', bal_regions, bal_marks, bal_answers);
    expect(bal_result.issues).toEqual([]);
    expect(bal_result.marks).toEqual([
      { regionIndex: 1, style: 'fill' },
      { regionIndex: 1 + 3, style: 'tick' }
    ]);
    expect(bal_result.groundTruth.answers[0]).toEqual({
      itemId: 'i-1',
      rowId: null,
      expectedStatus: 'accept',
      expectedValue: ['o-b']
    });
    expect(bal_result.groundTruth.answers[1]).toEqual({
      itemId: 'i-2',
      rowId: 'r-1',
      expectedStatus: 'accept',
      expectedValue: ['c-2']
    });
    expect(bal_result.groundTruth.answers[2].expectedStatus).toBe('blank');
  });

  it('reports unknown items instead of throwing', () => {
    const bal_result = bal_build_page_plan(1, 'p', bal_choice_regions(), [
      { variableName: 'ghost', style: 'fill' }
    ], [{ variableName: 'ghost', expected: 'blank' }]);
    expect(bal_result.marks).toEqual([]);
    expect(bal_result.issues.join(' ')).toContain('ghost');
  });

  it('groups matrix regions into rows and columns in print order', () => {
    const bal_groups = bal_group_regions(bal_matrix_regions());
    const bal_group = bal_groups.get('m1');
    expect(bal_group?.rowIds).toEqual(['r-1', 'r-2']);
    expect(bal_group?.columnIds).toEqual(['c-1', 'c-2']);
  });
});
