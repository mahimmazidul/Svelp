import type { QuestionnaireRecord, ResponseScaleRecord } from '../../models/types';
import type { ResponseRecord } from '../../models/response_models';

export type DatasetIssueSeverity = 'error' | 'warning' | 'info';

export type DatasetIssueType =
  | 'duplicate-respondent-page'
  | 'missing-required'
  | 'invalid-coded-value'
  | 'selection-rule-violation'
  | 'matrix-rule-violation'
  | 'numeric-range-violation'
  | 'missing-source-page'
  | 'unresolved-review'
  | 'version-mismatch'
  | 'schema-mismatch'
  | 'duplicate-response';

export type DatasetIssueResolution = 'open' | 'resolved';

export interface DatasetIssue {
  id: string;
  type: DatasetIssueType;
  severity: DatasetIssueSeverity;
  respondentId: string | null;
  itemId: string | null;
  variableName: string | null;
  currentValue: string[] | null;
  expectedRule: string | null;
  sourcePageId: string | null;
  resolution: DatasetIssueResolution;
}

export interface bal_DatasetValidationInput {
  questionnaire: QuestionnaireRecord;
  scales: ResponseScaleRecord[];
  responses: ResponseRecord[];
  readyPages: { id: string; respondentId: string | null; pageNumber: number | null; questionnaireVersion: number | null }[];
  expectedPages: number;
}

const BAL_REVIEW_STATUSES = new Set(['needs-review', 'ambiguous', 'multiple-marks', 'unreadable']);

function bal_options_for_item(bal_item: QuestionnaireRecord['sections'][number]['items'][number], bal_scales: ResponseScaleRecord[]) {
  if (bal_item.scaleId) {
    const bal_scale = bal_scales.find((bal_candidate) => bal_candidate.id === bal_item.scaleId);
    if (bal_scale) return bal_scale.options;
  }
  return bal_item.options;
}

function bal_issue_id(bal_parts: (string | null | undefined)[]): string {
  return bal_parts.map((bal_part) => bal_part ?? '-').join('::');
}

export function bal_validate_dataset(bal_input: bal_DatasetValidationInput): DatasetIssue[] {
  const bal_issues: DatasetIssue[] = [];
  const bal_item_by_id = new Map<string, QuestionnaireRecord['sections'][number]['items'][number]>();
  for (const bal_section of bal_input.questionnaire.sections) {
    for (const bal_item of bal_section.items) bal_item_by_id.set(bal_item.id, bal_item);
  }
  const bal_page_ids = new Set(bal_input.readyPages.map((bal_page) => bal_page.id));

  const bal_page_counts = new Map<string, number>();
  for (const bal_page of bal_input.readyPages) {
    if (!bal_page.respondentId || bal_page.pageNumber === null) continue;
    const bal_key = `${bal_page.respondentId}#${bal_page.pageNumber}`;
    bal_page_counts.set(bal_key, (bal_page_counts.get(bal_key) ?? 0) + 1);
  }
  for (const [bal_key, bal_count] of bal_page_counts) {
    if (bal_count > 1) {
      const [bal_respondent, bal_page_number] = bal_key.split('#');
      bal_issues.push({
        id: bal_issue_id(['duplicate-respondent-page', bal_key]),
        type: 'duplicate-respondent-page',
        severity: 'warning',
        respondentId: bal_respondent,
        itemId: null,
        variableName: null,
        currentValue: [`page ${bal_page_number} appears ${bal_count} times`],
        expectedRule: 'One ready page per respondent and page number',
        sourcePageId: null,
        resolution: 'open'
      });
    }
  }

  const bal_by_respondent = new Map<string, ResponseRecord[]>();
  for (const bal_response of bal_input.responses) {
    if (bal_response.status === 'manual-only') continue;
    const bal_existing = bal_by_respondent.get(bal_response.respondentId);
    if (bal_existing) bal_existing.push(bal_response);
    else bal_by_respondent.set(bal_response.respondentId, [bal_response]);
  }

  for (const [bal_respondent, bal_responses] of bal_by_respondent) {
    const bal_logical = new Map<string, ResponseRecord[]>();
    for (const bal_response of bal_responses) {
      const bal_key = `${bal_response.itemId}#${bal_response.rowId ?? ''}`;
      const bal_existing = bal_logical.get(bal_key);
      if (bal_existing) bal_existing.push(bal_response);
      else bal_logical.set(bal_key, [bal_response]);
      if (bal_response.questionnaireVersion !== bal_input.questionnaire.version) {
        bal_issues.push({
          id: bal_issue_id(['version-mismatch', bal_respondent, bal_response.id]),
          type: 'version-mismatch',
          severity: 'error',
          respondentId: bal_respondent,
          itemId: bal_response.itemId,
          variableName: bal_response.variableName,
          currentValue: [`version ${bal_response.questionnaireVersion}`],
          expectedRule: `Questionnaire version ${bal_input.questionnaire.version}`,
          sourcePageId: bal_response.sourcePageId,
          resolution: 'open'
        });
      }
      if (!bal_item_by_id.has(bal_response.itemId)) {
        bal_issues.push({
          id: bal_issue_id(['schema-mismatch', bal_respondent, bal_response.id]),
          type: 'schema-mismatch',
          severity: 'error',
          respondentId: bal_respondent,
          itemId: bal_response.itemId,
          variableName: bal_response.variableName,
          currentValue: bal_response.value,
          expectedRule: 'Response references a question in the current questionnaire',
          sourcePageId: bal_response.sourcePageId,
          resolution: 'open'
        });
        continue;
      }
      const bal_item = bal_item_by_id.get(bal_response.itemId);
      if (bal_response.sourcePageId && !bal_page_ids.has(bal_response.sourcePageId)) {
        bal_issues.push({
          id: bal_issue_id(['missing-source-page', bal_respondent, bal_response.id]),
          type: 'missing-source-page',
          severity: 'warning',
          respondentId: bal_respondent,
          itemId: bal_response.itemId,
          variableName: bal_response.variableName,
          currentValue: bal_response.value,
          expectedRule: 'The referenced source page exists and is ready',
          sourcePageId: bal_response.sourcePageId,
          resolution: 'open'
        });
      }
      if (BAL_REVIEW_STATUSES.has(bal_response.status)) {
        bal_issues.push({
          id: bal_issue_id(['unresolved-review', bal_respondent, bal_response.id]),
          type: 'unresolved-review',
          severity: 'warning',
          respondentId: bal_respondent,
          itemId: bal_response.itemId,
          variableName: bal_response.variableName,
          currentValue: bal_response.value,
          expectedRule: 'Resolved by review or marked blank',
          sourcePageId: bal_response.sourcePageId,
          resolution: 'open'
        });
      }
      if (!bal_item) continue;
      if (bal_response.status === 'accepted' || (bal_response.manuallyReviewed && bal_response.value.length > 0)) {
        if (bal_item.type === 'matrix' && bal_response.rowId) {
          if (!bal_item.rows.some((bal_row) => bal_row.id === bal_response.rowId)) {
            bal_issues.push({
              id: bal_issue_id(['matrix-rule-violation', bal_respondent, bal_response.id]),
              type: 'matrix-rule-violation',
              severity: 'error',
              respondentId: bal_respondent,
              itemId: bal_response.itemId,
              variableName: bal_response.variableName,
              currentValue: bal_response.value,
              expectedRule: 'Matrix row exists in the current questionnaire',
              sourcePageId: bal_response.sourcePageId,
              resolution: 'open'
            });
          }
          const bal_columns = bal_item.columns;
          for (const bal_value of bal_response.value) {
            if (!bal_columns.some((bal_column) => bal_column.id === bal_value)) {
              bal_issues.push({
                id: bal_issue_id(['invalid-coded-value', bal_respondent, bal_response.id, bal_value]),
                type: 'invalid-coded-value',
                severity: 'error',
                respondentId: bal_respondent,
                itemId: bal_response.itemId,
                variableName: bal_response.variableName,
                currentValue: [bal_value],
                expectedRule: 'Value must be a matrix column in the current questionnaire',
                sourcePageId: bal_response.sourcePageId,
                resolution: 'open'
              });
            }
          }
          if (bal_item.selectionMode === 'single' && bal_response.value.length > 1) {
            bal_issues.push({
              id: bal_issue_id(['matrix-rule-violation', bal_respondent, bal_response.id, 'single']),
              type: 'matrix-rule-violation',
              severity: 'error',
              respondentId: bal_respondent,
              itemId: bal_response.itemId,
              variableName: bal_response.variableName,
              currentValue: bal_response.value,
              expectedRule: 'This matrix row allows one selection',
              sourcePageId: bal_response.sourcePageId,
              resolution: 'open'
            });
          }
          const bal_max = bal_item.validation?.maxSelections ?? null;
          if (bal_item.selectionMode === 'multiple' && bal_max !== null && bal_response.value.length > bal_max) {
            bal_issues.push({
              id: bal_issue_id(['matrix-rule-violation', bal_respondent, bal_response.id, 'max']),
              type: 'matrix-rule-violation',
              severity: 'error',
              respondentId: bal_respondent,
              itemId: bal_response.itemId,
              variableName: bal_response.variableName,
              currentValue: bal_response.value,
              expectedRule: `At most ${bal_max} selections per row`,
              sourcePageId: bal_response.sourcePageId,
              resolution: 'open'
            });
          }
          continue;
        }
        const bal_allowed = new Set(bal_options_for_item(bal_item, bal_input.scales).map((bal_option) => bal_option.id));
        for (const bal_value of bal_response.value) {
          if (!bal_allowed.has(bal_value)) {
            bal_issues.push({
              id: bal_issue_id(['invalid-coded-value', bal_respondent, bal_response.id, bal_value]),
              type: 'invalid-coded-value',
              severity: 'error',
              respondentId: bal_respondent,
              itemId: bal_response.itemId,
              variableName: bal_response.variableName,
              currentValue: [bal_value],
              expectedRule: 'Value must be an option of this question in the current questionnaire',
              sourcePageId: bal_response.sourcePageId,
              resolution: 'open'
            });
          }
        }
        if (bal_item.type === 'multiple_choice') {
          const bal_min = bal_item.validation?.minSelections ?? null;
          const bal_max = bal_item.validation?.maxSelections ?? null;
          if (bal_max !== null && bal_response.value.length > bal_max) {
            bal_issues.push({
              id: bal_issue_id(['selection-rule-violation', bal_respondent, bal_response.id, 'max']),
              type: 'selection-rule-violation',
              severity: 'error',
              respondentId: bal_respondent,
              itemId: bal_response.itemId,
              variableName: bal_response.variableName,
              currentValue: bal_response.value.map((bal_v) => bal_v),
              expectedRule: `At most ${bal_max} selections`,
              sourcePageId: bal_response.sourcePageId,
              resolution: 'open'
            });
          }
          if (bal_min !== null && bal_response.value.length < bal_min) {
            bal_issues.push({
              id: bal_issue_id(['selection-rule-violation', bal_respondent, bal_response.id, 'min']),
              type: 'selection-rule-violation',
              severity: 'error',
              respondentId: bal_respondent,
              itemId: bal_response.itemId,
              variableName: bal_response.variableName,
              currentValue: bal_response.value,
              expectedRule: `At least ${bal_min} selections`,
              sourcePageId: bal_response.sourcePageId,
              resolution: 'open'
            });
          }
        }
      }
      if (bal_item.type === 'number' && bal_response.manuallyReviewed && bal_response.value.length > 0) {
        const bal_text = bal_response.value.join(' ');
        const bal_numeric = Number(bal_text);
        const bal_validation = bal_item.validation;
        if (Number.isNaN(bal_numeric)) {
          bal_issues.push({
            id: bal_issue_id(['numeric-range-violation', bal_respondent, bal_response.id, 'nan']),
            type: 'numeric-range-violation',
            severity: 'warning',
            respondentId: bal_respondent,
            itemId: bal_response.itemId,
            variableName: bal_response.variableName,
            currentValue: [bal_text],
            expectedRule: 'A number',
            sourcePageId: bal_response.sourcePageId,
            resolution: 'open'
          });
        } else if (bal_validation && (bal_validation.min !== null || bal_validation.max !== null)) {
          const bal_min = bal_validation.min ?? null;
          const bal_max = bal_validation.max ?? null;
          if ((bal_min !== null && bal_numeric < bal_min) || (bal_max !== null && bal_numeric > bal_max)) {
            bal_issues.push({
              id: bal_issue_id(['numeric-range-violation', bal_respondent, bal_response.id, 'range']),
              type: 'numeric-range-violation',
              severity: 'warning',
              respondentId: bal_respondent,
              itemId: bal_response.itemId,
              variableName: bal_response.variableName,
              currentValue: [bal_text],
              expectedRule: `Between ${bal_min ?? 'any'} and ${bal_max ?? 'any'}`,
              sourcePageId: bal_response.sourcePageId,
              resolution: 'open'
            });
          }
        }
      }
    }

    const bal_seen = new Set<string>();
    for (const bal_response of bal_responses) {
      const bal_key = `${bal_response.itemId}#${bal_response.rowId ?? ''}`;
      if (bal_seen.has(bal_key)) {
        bal_issues.push({
          id: bal_issue_id(['duplicate-response', bal_respondent, bal_response.id]),
          type: 'duplicate-response',
          severity: 'error',
          respondentId: bal_respondent,
          itemId: bal_response.itemId,
          variableName: bal_response.variableName,
          currentValue: bal_response.value,
          expectedRule: 'One response record per respondent, question, and matrix row',
          sourcePageId: bal_response.sourcePageId,
          resolution: 'open'
        });
      }
      bal_seen.add(bal_key);
    }

    for (const bal_section of bal_input.questionnaire.sections) {
      for (const bal_item of bal_section.items) {
        if (!bal_item.required) continue;
        const bal_answers = bal_logical.get(`${bal_item.id}#`) ?? [];
        const bal_answered = bal_answers.some(
          (bal_response) =>
            bal_response.status === 'accepted' || (bal_response.manuallyReviewed && bal_response.value.length > 0)
        );
        if (!bal_answered) {
          bal_issues.push({
            id: bal_issue_id(['missing-required', bal_respondent, bal_item.id]),
            type: 'missing-required',
            severity: 'error',
            respondentId: bal_respondent,
            itemId: bal_item.id,
            variableName: bal_item.variableName,
            currentValue: null,
            expectedRule: 'Required questions need a confirmed answer',
            sourcePageId: bal_answers[0]?.sourcePageId ?? null,
            resolution: 'open'
          });
        }
      }
    }
  }

  return bal_issues;
}

export function bal_count_issues_by_severity(bal_issues: DatasetIssue[]): Record<DatasetIssueSeverity, number> {
  const bal_counts: Record<DatasetIssueSeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const bal_issue of bal_issues) bal_counts[bal_issue.severity] += 1;
  return bal_counts;
}

export function bal_export_warning_counts(bal_issues: DatasetIssue[]): { unresolved: number; missingSource: number } {
  let bal_unresolved = 0;
  let bal_missing_source = 0;
  for (const bal_issue of bal_issues) {
    if (bal_issue.type === 'unresolved-review') bal_unresolved += 1;
    else if (bal_issue.type === 'missing-source-page' || bal_issue.type === 'duplicate-respondent-page') bal_missing_source += 1;
  }
  return { unresolved: bal_unresolved, missingSource: bal_missing_source };
}
