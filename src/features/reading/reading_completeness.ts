import type { ResponseRecord } from '../../models/response_models';
import type { QuestionnaireRecord, QuestionnaireItem } from '../../models/types';

export type bal_CompletenessLevel =
  | 'complete'
  | 'needs-review'
  | 'missing-required'
  | 'missing-page'
  | 'transcription-pending'
  | 'unreadable-source'
  | 'version-conflict';

export interface bal_RespondentStatus {
  respondentId: string;
  completeness: bal_CompletenessLevel;
  missingPages: number[];
  missingRequiredItemIds: string[];
  needsReviewCount: number;
  unreadableCount: number;
  manualPendingCount: number;
  versionConflicts: number;
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
  let bal_unreadable = 0;
  let bal_manual_pending = 0;
  let bal_version_conflicts = 0;
  for (const bal_response of bal_responses) {
    if (
      bal_response.status === 'needs-review' ||
      bal_response.status === 'ambiguous' ||
      bal_response.status === 'multiple-marks'
    ) {
      bal_needs_review += 1;
    }
    if (bal_response.status === 'unreadable') bal_unreadable += 1;
    if (bal_response.status === 'manual-only') bal_manual_pending += 1;
    if (bal_response.questionnaireVersion !== bal_questionnaire.version) bal_version_conflicts += 1;
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
  if (bal_version_conflicts > 0) bal_completeness = 'version-conflict';
  else if (bal_missing_pages.length > 0) bal_completeness = 'missing-page';
  else if (bal_unreadable > 0) bal_completeness = 'unreadable-source';
  else if (bal_needs_review > 0) bal_completeness = 'needs-review';
  else if (bal_manual_pending > 0) bal_completeness = 'transcription-pending';
  else if (bal_missing_required.length > 0) bal_completeness = 'missing-required';
  return {
    respondentId: bal_respondent_id,
    completeness: bal_completeness,
    missingPages: bal_missing_pages,
    missingRequiredItemIds: bal_missing_required,
    needsReviewCount: bal_needs_review,
    unreadableCount: bal_unreadable,
    manualPendingCount: bal_manual_pending,
    versionConflicts: bal_version_conflicts
  };
}

export interface bal_QuestionnaireSummary {
  totalRespondents: number;
  complete: number;
  needsReview: number;
  missingRequired: number;
  missingPages: number;
  unresolvedAmbiguous: number;
  transcriptionPending: number;
  unreadableSource: number;
  versionConflicts: number;
}

export function bal_questionnaire_summary(bal_statuses: bal_RespondentStatus[]): bal_QuestionnaireSummary {
  const bal_summary: bal_QuestionnaireSummary = {
    totalRespondents: bal_statuses.length,
    complete: 0,
    needsReview: 0,
    missingRequired: 0,
    missingPages: 0,
    unresolvedAmbiguous: 0,
    transcriptionPending: 0,
    unreadableSource: 0,
    versionConflicts: 0
  };
  for (const bal_status of bal_statuses) {
    if (bal_status.completeness === 'complete') bal_summary.complete += 1;
    if (bal_status.completeness === 'missing-required') bal_summary.missingRequired += 1;
    if (bal_status.completeness === 'missing-page') bal_summary.missingPages += 1;
    if (bal_status.completeness === 'transcription-pending') bal_summary.transcriptionPending += 1;
    if (bal_status.completeness === 'unreadable-source') bal_summary.unreadableSource += 1;
    if (bal_status.completeness === 'version-conflict') bal_summary.versionConflicts += 1;
    if (bal_status.completeness === 'needs-review') bal_summary.needsReview += 1;
    bal_summary.unresolvedAmbiguous += bal_status.needsReviewCount;
  }
  return bal_summary;
}

export function bal_completeness_for_respondents(
  bal_respondent_ids: string[],
  bal_questionnaire: QuestionnaireRecord,
  bal_expected_pages: number,
  bal_responses: ResponseRecord[],
  bal_found_pages: Record<string, number[]>
): Map<string, bal_RespondentStatus> {
  const bal_map = new Map<string, bal_RespondentStatus>();
  for (const bal_respondent of bal_respondent_ids) {
    bal_map.set(
      bal_respondent,
      bal_respondent_status(
        bal_respondent,
        bal_questionnaire,
        bal_expected_pages,
        bal_responses.filter((bal_response) => bal_response.respondentId === bal_respondent),
        new Set(bal_found_pages[bal_respondent] ?? [])
      )
    );
  }
  return bal_map;
}
