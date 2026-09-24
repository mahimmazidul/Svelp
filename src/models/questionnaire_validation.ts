import { item_descriptor } from './item_catalog';
import { BAL_VARIABLE_NAME_PATTERN } from './variable_names';
import type {
  ItemTypeName,
  QuestionnaireItem,
  QuestionnaireRecord,
  ResponseScaleRecord
} from './types';

export type ValidationSeverity = 'error' | 'warning';

export type ValidationCode =
  | 'duplicate-variable'
  | 'missing-variable'
  | 'invalid-variable'
  | 'empty-label'
  | 'empty-section-title'
  | 'too-few-options'
  | 'duplicate-code'
  | 'invalid-range'
  | 'invalid-selection-limits'
  | 'matrix-no-rows'
  | 'matrix-no-columns'
  | 'empty-consent-acknowledgement'
  | 'broken-scale-reference'
  | 'empty-scale'
  | 'empty-scale-name';

export interface ValidationIssue {
  code: ValidationCode;
  severity: ValidationSeverity;
  message: string;
  sectionId?: string;
  itemId?: string;
  scaleId?: string;
}

function bal_number(bal_value: unknown): number | null {
  return typeof bal_value === 'number' && Number.isFinite(bal_value) ? bal_value : null;
}

function bal_item_issues(
  bal_item: QuestionnaireItem,
  bal_section_id: string,
  bal_scales: ResponseScaleRecord[],
  bal_variable_seen: Map<string, string>,
  bal_issues: ValidationIssue[]
): void {
  const bal_descriptor = item_descriptor(bal_item.type as ItemTypeName);
  const bal_scale = bal_item.scaleId
    ? bal_scales.find((bal_s) => bal_s.id === bal_item.scaleId)
    : undefined;
  const bal_scale_missing = bal_item.scaleId !== null && !bal_scale;
  const bal_resolved = bal_item.scaleId
    ? (bal_scale?.options ?? [])
    : bal_item.options;
  if (bal_scale_missing) {
    bal_issues.push({
      code: 'broken-scale-reference',
      severity: 'error',
      message: `${bal_descriptor.label}: the assigned response scale no longer exists.`,
      sectionId: bal_section_id,
      itemId: bal_item.id
    });
  }
  if (bal_item.scaleId) {
    if (bal_scale && bal_scale.options.length < 2) {
      bal_issues.push({
        code: 'empty-scale',
        severity: 'error',
        message: `${bal_descriptor.label}: the assigned scale needs at least two options.`,
        sectionId: bal_section_id,
        itemId: bal_item.id,
        scaleId: bal_scale.id
      });
    }
  }
  if (bal_descriptor.usesVariableName) {
    const bal_name = bal_item.variableName ?? '';
    if (bal_name === '') {
      bal_issues.push({
        code: 'missing-variable',
        severity: 'error',
        message: `${bal_descriptor.label}: a variable name is required for data collection.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    } else if (!BAL_VARIABLE_NAME_PATTERN.test(bal_name)) {
      bal_issues.push({
        code: 'invalid-variable',
        severity: 'error',
        message: `“${bal_name}” is not a valid variable name. Use letters, digits, and underscores.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    } else if (bal_variable_seen.has(bal_name)) {
      bal_issues.push({
        code: 'duplicate-variable',
        severity: 'error',
        message: `The variable name “${bal_name}” is used by more than one question.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    } else {
      bal_variable_seen.set(bal_name, bal_item.id);
    }
  }
  if (bal_item.type !== 'instruction' && bal_item.label.trim() === '') {
    bal_issues.push({
      code: 'empty-label',
      severity: 'error',
      message: `${bal_descriptor.label}: the question text is empty.`,
      sectionId: bal_section_id,
      itemId: bal_item.id
    });
  }
  if (
    bal_item.type === 'instruction' &&
    bal_item.label.trim() === '' &&
    (bal_item.heading ?? '').trim() === ''
  ) {
    bal_issues.push({
      code: 'empty-label',
      severity: 'warning',
      message: 'An instructional text block has no heading or body text.',
      sectionId: bal_section_id,
      itemId: bal_item.id
    });
  }
  if (bal_descriptor.usesOptions && !bal_scale_missing) {
    if (bal_resolved.length < 2) {
      bal_issues.push({
        code: 'too-few-options',
        severity: 'error',
        message: `${bal_descriptor.label}: a choice question needs at least two options.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    }
    const bal_codes = new Map<string, number>();
    for (const bal_option of bal_resolved) {
      if (bal_option.coding === null) continue;
      const bal_key = bal_option.coding.trim();
      if (bal_key === '') continue;
      bal_codes.set(bal_key, (bal_codes.get(bal_key) ?? 0) + 1);
    }
    for (const [bal_code, bal_count] of bal_codes) {
      if (bal_count > 1) {
        bal_issues.push({
          code: 'duplicate-code',
          severity: 'error',
          message: `${bal_descriptor.label}: the code “${bal_code}” is assigned to more than one option.`,
          sectionId: bal_section_id,
          itemId: bal_item.id
        });
      }
    }
  }
  const bal_validation = bal_item.validation ?? {};
  if (bal_item.type === 'number') {
    const bal_min = bal_number(bal_validation.min);
    const bal_max = bal_number(bal_validation.max);
    if (bal_min !== null && bal_max !== null && bal_min > bal_max) {
      bal_issues.push({
        code: 'invalid-range',
        severity: 'error',
        message: `${bal_descriptor.label}: the minimum is greater than the maximum.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    }
    const bal_step = bal_number(bal_validation.step);
    if (bal_step !== null && bal_step <= 0) {
      bal_issues.push({
        code: 'invalid-range',
        severity: 'error',
        message: `${bal_descriptor.label}: the step must be a positive number.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    }
  }
  if (bal_item.type === 'multiple_choice') {
    const bal_min = bal_number(bal_validation.minSelections);
    const bal_max = bal_number(bal_validation.maxSelections);
    if (bal_min !== null && bal_min < 0) {
      bal_issues.push({
        code: 'invalid-selection-limits',
        severity: 'error',
        message: `${bal_descriptor.label}: the minimum number of selections cannot be negative.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    }
    if (bal_min !== null && bal_max !== null && bal_min > bal_max) {
      bal_issues.push({
        code: 'invalid-selection-limits',
        severity: 'error',
        message: `${bal_descriptor.label}: the minimum number of selections is greater than the maximum.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    }
    if (bal_max !== null && bal_max > bal_resolved.length) {
      bal_issues.push({
        code: 'invalid-selection-limits',
        severity: 'warning',
        message: `${bal_descriptor.label}: the maximum number of selections exceeds the number of options.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    }
  }
  if (bal_item.type === 'short_text' || bal_item.type === 'long_text') {
    const bal_max_length = bal_number(bal_validation.maxLength);
    if (bal_max_length !== null && bal_max_length <= 0) {
      bal_issues.push({
        code: 'invalid-range',
        severity: 'error',
        message: `${bal_descriptor.label}: the maximum length must be a positive number.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    }
  }
  if (bal_item.type === 'matrix') {
    if (bal_item.rows.length === 0) {
      bal_issues.push({
        code: 'matrix-no-rows',
        severity: 'error',
        message: `${bal_descriptor.label}: the matrix has no rows.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    }
    const bal_column_count = bal_item.scaleId
      ? (bal_scales.find((bal_s) => bal_s.id === bal_item.scaleId)?.options.length ?? 0)
      : bal_item.columns.length;
    if (bal_column_count < 2) {
      bal_issues.push({
        code: 'matrix-no-columns',
        severity: 'error',
        message: `${bal_descriptor.label}: the matrix needs at least two columns.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    }
    if (bal_item.rows.some((bal_row) => bal_row.label.trim() === '')) {
      bal_issues.push({
        code: 'empty-label',
        severity: 'error',
        message: `${bal_descriptor.label}: a matrix row has no label.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    }
    if (!bal_item.scaleId && bal_item.columns.some((bal_c) => bal_c.label.trim() === '')) {
      bal_issues.push({
        code: 'empty-label',
        severity: 'error',
        message: `${bal_descriptor.label}: a matrix column has no label.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    }
  }
  if (bal_item.type === 'consent' && bal_item.consent) {
    if (bal_item.consent.acknowledgementLabel.trim() === '') {
      bal_issues.push({
        code: 'empty-consent-acknowledgement',
        severity: 'error',
        message: `${bal_descriptor.label}: the consent acknowledgement text is empty.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    }
    if (bal_item.consent.title.trim() === '' && bal_item.consent.introduction.trim() === '') {
      bal_issues.push({
        code: 'empty-label',
        severity: 'warning',
        message: `${bal_descriptor.label}: the consent block has no title or introduction.`,
        sectionId: bal_section_id,
        itemId: bal_item.id
      });
    }
  }
}

export function validate_questionnaire(
  bal_q: QuestionnaireRecord,
  bal_scales: ResponseScaleRecord[]
): ValidationIssue[] {
  const bal_issues: ValidationIssue[] = [];
  const bal_variable_seen = new Map<string, string>();
  for (const bal_scale of bal_scales) {
    if (bal_scale.name.trim() === '') {
      bal_issues.push({
        code: 'empty-scale-name',
        severity: 'warning',
        message: 'A response scale has no name.',
        scaleId: bal_scale.id
      });
    }
  }
  for (const bal_section of bal_q.sections) {
    if (bal_section.title.trim() === '') {
      bal_issues.push({
        code: 'empty-section-title',
        severity: 'warning',
        message: 'A section has no title.',
        sectionId: bal_section.id
      });
    }
    for (const bal_item of bal_section.items) {
      bal_item_issues(bal_item, bal_section.id, bal_scales, bal_variable_seen, bal_issues);
    }
  }
  return bal_issues;
}
