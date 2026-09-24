import { dhon_matrix_columns, dhon_resolve_options } from '../../models/scale_options';
import type {
  MatrixColumnView
} from '../../models/scale_options';
import type {
  QuestionnaireItem,
  QuestionnaireRecord,
  ResponseScaleRecord
} from '../../models/types';

export interface MatrixAnswer {
  cells: Record<string, string[]>;
}

export interface SignatureAnswer {
  data: string | null;
  printedName: string;
  date: string;
}

export type AnswerValue =
  | string
  | string[]
  | boolean
  | MatrixAnswer
  | SignatureAnswer
  | null;

export type AnswerMap = Record<string, AnswerValue>;

export function bal_empty_answer(bal_item: QuestionnaireItem): AnswerValue {
  switch (bal_item.type) {
    case 'multiple_choice':
      return [];
    case 'matrix':
      return { cells: {} };
    case 'consent':
      return false;
    case 'participant_signature':
    case 'researcher_signature':
      return { data: null, printedName: '', date: '' };
    case 'short_text':
    case 'long_text':
    case 'number':
    case 'date':
      return '';
    default:
      return '';
  }
}

export function bal_empty_answers(bal_q: QuestionnaireRecord): AnswerMap {
  const bal_map: AnswerMap = {};
  for (const bal_section of bal_q.sections) {
    for (const bal_item of bal_section.items) {
      bal_map[bal_item.id] = bal_empty_answer(bal_item);
    }
  }
  return bal_map;
}

export function bal_validate_answers(
  bal_q: QuestionnaireRecord,
  _bal_scales: ResponseScaleRecord[],
  bal_answers: AnswerMap
): Record<string, string> {
  const bal_errors: Record<string, string> = {};
  for (const bal_section of bal_q.sections) {
    for (const bal_item of bal_section.items) {
      const bal_answer = bal_answers[bal_item.id] ?? null;
      const bal_validation = bal_item.validation ?? {};
      if (
        bal_item.type === 'single_choice' ||
        bal_item.type === 'yes_no' ||
        bal_item.type === 'likert_scale'
      ) {
        const bal_value = typeof bal_answer === 'string' ? bal_answer : '';
        if (bal_item.required && bal_value === '') {
          bal_errors[bal_item.id] = 'An answer is required.';
        }
      } else if (bal_item.type === 'multiple_choice') {
        const bal_selected = Array.isArray(bal_answer) ? bal_answer : [];
        const bal_min = typeof bal_validation.minSelections === 'number' ? bal_validation.minSelections : null;
        const bal_max = typeof bal_validation.maxSelections === 'number' ? bal_validation.maxSelections : null;
        if (bal_item.required && bal_selected.length === 0) {
          bal_errors[bal_item.id] = 'Select at least one option.';
        } else if (bal_min !== null && bal_selected.length < bal_min) {
          bal_errors[bal_item.id] = `Select at least ${bal_min} option(s).`;
        } else if (bal_max !== null && bal_selected.length > bal_max) {
          bal_errors[bal_item.id] = `Select at most ${bal_max} option(s).`;
        }
      } else if (bal_item.type === 'short_text' || bal_item.type === 'long_text') {
        const bal_value = typeof bal_answer === 'string' ? bal_answer : '';
        const bal_max_length =
          typeof bal_validation.maxLength === 'number' ? bal_validation.maxLength : null;
        if (bal_item.required && bal_value.trim() === '') {
          bal_errors[bal_item.id] = 'An answer is required.';
        } else if (bal_max_length !== null && bal_value.length > bal_max_length) {
          bal_errors[bal_item.id] = `Keep the answer within ${bal_max_length} characters.`;
        }
      } else if (bal_item.type === 'number') {
        const bal_text = typeof bal_answer === 'string' ? bal_answer.trim() : '';
        if (bal_text === '') {
          if (bal_item.required) bal_errors[bal_item.id] = 'A number is required.';
          continue;
        }
        const bal_value = Number(bal_text);
        if (!Number.isFinite(bal_value)) {
          bal_errors[bal_item.id] = 'Enter a valid number.';
          continue;
        }
        const bal_min = typeof bal_validation.min === 'number' ? bal_validation.min : null;
        const bal_max = typeof bal_validation.max === 'number' ? bal_validation.max : null;
        const bal_decimals_allowed = bal_validation.decimalAllowed ?? true;
        if (!bal_decimals_allowed && !Number.isInteger(bal_value)) {
          bal_errors[bal_item.id] = 'Whole numbers only.';
        } else if (bal_min !== null && bal_value < bal_min) {
          bal_errors[bal_item.id] = `The value cannot be below ${bal_min}.`;
        } else if (bal_max !== null && bal_value > bal_max) {
          bal_errors[bal_item.id] = `The value cannot be above ${bal_max}.`;
        }
      } else if (bal_item.type === 'date') {
        const bal_value = typeof bal_answer === 'string' ? bal_answer : '';
        if (bal_item.required && bal_value === '') {
          bal_errors[bal_item.id] = 'A date is required.';
        }
      } else if (bal_item.type === 'matrix') {
        const bal_require_all = bal_validation.requireAllRows ?? false;
        if (!bal_item.required && !bal_require_all) continue;
        const bal_answered_rows = new Set<string>();
        const bal_matrix = bal_answer as MatrixAnswer | null;
        if (bal_matrix && typeof bal_matrix === 'object' && bal_matrix.cells) {
          for (const [bal_row_id, bal_selections] of Object.entries(bal_matrix.cells)) {
            if (Array.isArray(bal_selections) && bal_selections.length > 0) {
              bal_answered_rows.add(bal_row_id);
            }
          }
        }
        if (bal_require_all && bal_item.rows.some((bal_r) => !bal_answered_rows.has(bal_r.id))) {
          bal_errors[bal_item.id] = 'Answer every row.';
        } else if (bal_item.required && bal_item.rows.length > 0 && bal_answered_rows.size === 0) {
          bal_errors[bal_item.id] = 'An answer is required.';
        }
      } else if (bal_item.type === 'consent') {
        if (bal_item.required && bal_answer !== true) {
          bal_errors[bal_item.id] = 'Acknowledgement is required.';
        }
      }
    }
  }
  return bal_errors;
}

export function bal_matrix_options(
  bal_item: QuestionnaireItem,
  bal_scales: ResponseScaleRecord[]
): MatrixColumnView[] {
  return dhon_matrix_columns(bal_item, bal_scales);
}

export function bal_item_options(
  bal_item: QuestionnaireItem,
  bal_scales: ResponseScaleRecord[]
) {
  return dhon_resolve_options(bal_item, bal_scales);
}
