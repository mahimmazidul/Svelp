import { describe, expect, it } from 'vitest';
import type { QuestionnaireRecord } from '../../models/types';
import type { ResponseRecord } from '../../models/response_models';
import { bal_completeness_for_respondents, bal_respondent_status } from './reading_completeness';
import { dhon_banaitesi_item, dhon_banaitesi_questionnaire } from '../../models/factories';

function bal_questionnaire(): QuestionnaireRecord {
  const bal_required = dhon_banaitesi_item('single_choice', 'water_source');
  bal_required.required = true;
  bal_required.options = [
    { id: 'o1', label: 'Piped', coding: '1' },
    { id: 'o2', label: 'Well', coding: '2' }
  ];
  const bal_optional = dhon_banaitesi_item('short_text', 'notes');
  bal_optional.required = false;
  const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p1', title: 'Completeness study' });
  bal_q.sections = [
    {
      id: 's1',
      type: 'section',
      title: 'Section',
      description: null,
      printConfig: null,
      metadata: null,
      items: [bal_required, bal_optional]
    }
  ];
  return bal_q;
}

function bal_response(bal_over: Partial<ResponseRecord>): ResponseRecord {
  return {
    id: 'r1::i1',
    projectId: 'p1',
    batchId: null,
    questionnaireId: 'q1',
    questionnaireVersion: 1,
    respondentId: 'R1',
    itemId: 'i1',
    variableName: 'water_source',
    itemType: 'single_choice',
    rowId: null,
    columnId: null,
    value: [],
    codedValue: null,
    status: 'blank',
    confidence: null,
    machineValue: null,
    machineStatus: null,
    machineConfidence: null,
    manuallyReviewed: false,
    validationIssues: [],
    sourcePageId: null,
    sourceRegionRect: null,
    algorithmVersion: 'R1',
    thresholdProfileName: 'default-v1',
    recognitionRunId: null,
    createdAt: 0,
    updatedAt: 0,
    ...bal_over
  };
}

describe('respondent completeness', () => {
  it('marks a respondent complete when all required items have answers', () => {
    const bal_q = bal_questionnaire();
    const bal_required = bal_q.sections[0].items[0];
    const bal_status = bal_respondent_status('R1', bal_q, 2, [bal_response({ itemId: bal_required.id, status: 'accepted', value: ['o1'] })], new Set([1, 2]));
    expect(bal_status.completeness).toBe('complete');
    expect(bal_status.missingPages).toEqual([]);
  });

  it('treats a manually corrected answer as answering the requirement', () => {
    const bal_q = bal_questionnaire();
    const bal_required = bal_q.sections[0].items[0];
    const bal_status = bal_respondent_status(
      'R1',
      bal_q,
      2,
      [bal_response({ itemId: bal_required.id, status: 'blank', manuallyReviewed: true, value: ['o2'] })],
      new Set([1, 2])
    );
    expect(bal_status.completeness).toBe('complete');
  });

  it('reports missing required items when a required question has no confirmed answer', () => {
    const bal_q = bal_questionnaire();
    const bal_required = bal_q.sections[0].items[0];
    const bal_blank_only = bal_respondent_status('R1', bal_q, 2, [bal_response({ itemId: bal_required.id, status: 'blank' })], new Set([1, 2]));
    expect(bal_blank_only.completeness).toBe('missing-required');
    expect(bal_blank_only.missingRequiredItemIds).toEqual([bal_required.id]);
    const bal_no_record = bal_respondent_status('R2', bal_q, 2, [], new Set([1, 2]));
    expect(bal_no_record.completeness).toBe('missing-required');
    expect(bal_no_record.missingRequiredItemIds).toEqual([bal_required.id]);
  });

  it('reports missing pages before missing required items', () => {
    const bal_q = bal_questionnaire();
    const bal_required = bal_q.sections[0].items[0];
    const bal_status = bal_respondent_status('R1', bal_q, 3, [bal_response({ itemId: bal_required.id, status: 'blank' })], new Set([1]));
    expect(bal_status.completeness).toBe('missing-page');
    expect(bal_status.missingPages).toEqual([2, 3]);
  });

  it('counts review and pending transcription items', () => {
    const bal_q = bal_questionnaire();
    const bal_required = bal_q.sections[0].items[0];
    const bal_status = bal_respondent_status(
      'R1',
      bal_q,
      1,
      [
        bal_response({ itemId: bal_required.id, status: 'ambiguous' }),
        bal_response({ itemId: 'i9', itemType: 'short_text', status: 'manual-only' })
      ],
      new Set([1])
    );
    expect(bal_status.completeness).toBe('needs-review');
    expect(bal_status.needsReviewCount).toBe(1);
    expect(bal_status.manualPendingCount).toBe(1);
  });

  it('builds a status map for several respondents', () => {
    const bal_q = bal_questionnaire();
    const bal_required = bal_q.sections[0].items[0];
    const bal_map = bal_completeness_for_respondents(
      ['R1', 'R2'],
      bal_q,
      1,
      [
        bal_response({ respondentId: 'R1', itemId: bal_required.id, status: 'accepted', value: ['o1'] }),
        bal_response({ respondentId: 'R2', itemId: bal_required.id, status: 'blank' })
      ],
      { R1: [1], R2: [1] }
    );
    expect(bal_map.get('R1')?.completeness).toBe('complete');
    expect(bal_map.get('R2')?.completeness).toBe('missing-required');
  });
});
