import type { ResponseRecord } from '../../models/response_models';
import type { QuestionnaireRecord, QuestionnaireItem } from '../../models/types';

export type bal_CompletenessLevel = 'complete' | 'needs-review' | 'missing-required' | 'missing-page';

export interface bal_RespondentStatus {
  respondentId: string;
  completeness: bal_CompletenessLevel;
  missingPages: number[];
  missingRequiredItemIds: string[];
  needsReviewCount: number;
  manualPendingCount: number;
}

const BAL_ANSWERED_STATUSES = new Set(['accepted']);

function bal_required_items(bal_questionnaire: QuestionnaireRecord): QuestionnaireItem[] {
  const bal_items: QuestionnaireItem[] = [];
  for (const bal_section of bal_questionnaire.sections) {
    for (const bal_item of bal_section.items) {
      if (bal_item.type === 'instruction') continue;
      if (bal_item.required) bal_items.push(bal_item);
    }
  }
  return bal_items;
}

export function bal_respondent_status(
  bal_respondent_id: string,
  bal_questionnaire: QuestionnaireRecord,
  bal_expected_pages: number,
  bal_responses: ResponseRecord[],
  bal_found_pages: Set<number>
): bal_RespondentStatus {
  const bal_missing_pages: number[] = [];
  for (let bal_page = 1; bal_page <= bal_expected_pages; bal_page++) {
    if (!bal_found_pages.has(bal_page)) bal_missing_pages.push(bal_page);
  }
  const bal_by_item = new Map<string, ResponseRecord[]>();
  for (const bal_response of bal_responses) {
    const bal_existing = bal_by_item.get(bal_response.itemId);
    if (bal_existing) bal_existing.push(bal_response);
    else bal_by_item.set(bal_response.itemId, [bal_response]);
  }
  const bal_missing_required: string[] = [];
  let bal_needs_review = 0;
  let bal_manual_pending = 0;
  for (const bal_response of bal_responses) {
    if (
      bal_response.status === 'needs-review' ||
      bal_response.status === 'ambiguous' ||
      bal_response.status === 'multiple-marks' ||
      bal_response.status === 'unreadable'
    ) {
      bal_needs_review += 1;
    }
    if (bal_response.status === 'manual-only') bal_manual_pending += 1;
  }
  for (const bal_item of bal_required_items(bal_questionnaire)) {
    const bal_answers = bal_by_item.get(bal_item.id) ?? [];
    const bal_answered = bal_answers.some(
      (bal_response) =>
        BAL_ANSWERED_STATUSES.has(bal_response.status) ||
        (bal_response.manuallyReviewed && bal_response.value.length > 0)
    );
    if (!bal_answered && bal_missing_pages.length === 0) bal_missing_required.push(bal_item.id);
  }
  let bal_completeness: bal_CompletenessLevel = 'complete';
  if (bal_missing_pages.length > 0) bal_completeness = 'missing-page';
  else if (bal_needs_review > 0 || bal_manual_pending > 0) bal_completeness = 'needs-review';
  else if (bal_missing_required.length > 0) bal_completeness = 'missing-required';
  return {
    respondentId: bal_respondent_id,
    completeness: bal_completeness,
    missingPages: bal_missing_pages,
    missingRequiredItemIds: bal_missing_required,
    needsReviewCount: bal_needs_review,
    manualPendingCount: bal_manual_pending
  };
}
