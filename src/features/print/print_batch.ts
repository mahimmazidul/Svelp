import type { QuestionnaireRecord } from '../../models/types';

export type bal_BatchMode = 'sequential' | 'list';

export interface bal_BatchPlanInput {
  mode: bal_BatchMode;
  count: number;
  start: number;
  prefix: string;
  padding: number;
  customIds: string;
}

export interface bal_BatchPlan {
  respondentIds: string[];
  duplicates: string[];
  errors: string[];
  valid: boolean;
}

export const BAL_MAX_BATCH_SIZE = 500;
export const BAL_MAX_PADDING = 6;

export function bal_format_respondent_id(
  bal_number: number,
  bal_prefix: string,
  bal_padding: number
): string {
  const bal_digits = Math.max(1, Math.floor(bal_padding));
  let bal_text = String(Math.max(0, Math.floor(bal_number)));
  while (bal_text.length < bal_digits) bal_text = `0${bal_text}`;
  return `${bal_prefix}${bal_text}`;
}

export function bal_plan_respondent_ids(bal_input: bal_BatchPlanInput): bal_BatchPlan {
  const bal_errors: string[] = [];
  const bal_prefix = bal_input.prefix.replace(/\s+/g, '');
  let bal_ids: string[] = [];

  if (bal_input.mode === 'sequential') {
    const bal_count = Math.floor(bal_input.count);
    const bal_start = Math.floor(bal_input.start);
    if (!Number.isFinite(bal_count) || bal_count < 1) {
      bal_errors.push('Enter a copy count of at least 1.');
    }
    if (!Number.isFinite(bal_start) || bal_start < 0) {
      bal_errors.push('Enter a starting number of 0 or more.');
    }
    if (bal_count > BAL_MAX_BATCH_SIZE) {
      bal_errors.push(`Batch size is limited to ${BAL_MAX_BATCH_SIZE} copies.`);
    }
    if (bal_errors.length === 0) {
      const bal_last = bal_start + bal_count - 1;
      const bal_needed_padding = String(bal_last).length;
      const bal_padding = Math.min(
        BAL_MAX_PADDING,
        Math.max(Math.floor(bal_input.padding) || 1, bal_needed_padding)
      );
      for (let bal_i = 0; bal_i < bal_count; bal_i++) {
        bal_ids.push(bal_format_respondent_id(bal_start + bal_i, bal_prefix, bal_padding));
      }
    }
  } else {
    bal_ids = bal_input.customIds
      .split(/\r?\n/)
      .map((bal_line) => bal_line.trim())
      .filter((bal_line) => bal_line.length > 0);
    if (bal_ids.length === 0) {
      bal_errors.push('Paste at least one respondent ID.');
    }
    if (bal_ids.length > BAL_MAX_BATCH_SIZE) {
      bal_errors.push(`Batch size is limited to ${BAL_MAX_BATCH_SIZE} respondents.`);
      bal_ids = bal_ids.slice(0, BAL_MAX_BATCH_SIZE);
    }
  }

  const bal_counts = new Map<string, number>();
  for (const bal_id of bal_ids) {
    bal_counts.set(bal_id, (bal_counts.get(bal_id) ?? 0) + 1);
  }
  const bal_duplicates: string[] = [];
  for (const [bal_id, bal_count] of bal_counts) {
    if (bal_count > 1) bal_duplicates.push(bal_id);
  }
  if (bal_duplicates.length > 0) {
    bal_errors.push(
      `Duplicate respondent IDs are not allowed: ${bal_duplicates.slice(0, 5).join(', ')}${bal_duplicates.length > 5 ? '…' : ''}`
    );
  }

  return {
    respondentIds: bal_ids,
    duplicates: bal_duplicates,
    errors: bal_errors,
    valid: bal_errors.length === 0
  };
}

export function bal_questionnaire_fingerprint(bal_q: QuestionnaireRecord): string {
  const bal_payload = JSON.stringify({
    title: bal_q.title,
    version: bal_q.version,
    paperSize: bal_q.paperSize,
    orientation: bal_q.orientation,
    sections: bal_q.sections
  });
  let bal_hash = 5381;
  for (let bal_i = 0; bal_i < bal_payload.length; bal_i++) {
    bal_hash = ((bal_hash << 5) + bal_hash + bal_payload.charCodeAt(bal_i)) | 0;
  }
  return (bal_hash >>> 0).toString(16).padStart(8, '0');
}
