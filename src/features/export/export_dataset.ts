import type { ChoiceOption, QuestionnaireItem, QuestionnaireRecord, ResponseScaleRecord } from '../../models/types';
import type { ResponseRecord } from '../../models/response_models';
import { derive_numbering } from '../../models/numbering';
import { bal_sanitize_filename } from '../mahim/mahim_filenames';

export interface bal_ExportColumn {
  key: string;
  itemId: string;
  rowId: string | null;
  variableName: string;
  header: string;
  questionLabel: string;
  questionNumber: string;
  itemType: string;
  required: boolean;
  matrixRowLabel: string | null;
}

export interface bal_CodebookRow {
  variableName: string;
  questionNumber: string;
  questionLabel: string;
  itemType: string;
  required: boolean;
  matrixRowLabel: string | null;
  optionLabel: string | null;
  optionCode: string | null;
}

export interface bal_CellExport {
  value: string;
  status: RecognitionStatusName;
  confidence: number | null;
  machineValue: string;
  manuallyReviewed: boolean;
}

type RecognitionStatusName = ResponseRecord['status'];

const BAL_EXPORTABLE_TYPES = new Set([
  'single_choice',
  'multiple_choice',
  'yes_no',
  'likert_scale',
  'matrix',
  'short_text',
  'long_text',
  'number',
  'date',
  'time',
  'consent'
]);

const BAL_MACHINE_READABLE_TYPES = new Set([
  'single_choice',
  'multiple_choice',
  'yes_no',
  'likert_scale',
  'matrix',
  'consent'
]);

export function bal_slug_variable_part(bal_label: string): string {
  const bal_slug = bal_label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
    .replace(/_+$/g, '');
  return bal_slug.length > 0 ? bal_slug : 'row';
}

function bal_options_for_item(
  bal_item: QuestionnaireItem,
  bal_scales: ResponseScaleRecord[]
): ChoiceOption[] {
  if (bal_item.scaleId) {
    const bal_scale = bal_scales.find((bal_candidate) => bal_candidate.id === bal_item.scaleId);
    if (bal_scale) return bal_scale.options;
  }
  return bal_item.options;
}

export function bal_export_columns(bal_questionnaire: QuestionnaireRecord): bal_ExportColumn[] {
  const bal_numbering = derive_numbering(bal_questionnaire);
  const bal_columns: bal_ExportColumn[] = [];
  for (const bal_section of bal_questionnaire.sections) {
    for (const bal_item of bal_section.items) {
      if (!BAL_EXPORTABLE_TYPES.has(bal_item.type)) continue;
      const bal_variable = bal_item.variableName ?? bal_item.id;
      const bal_label = bal_item.label || bal_item.heading || bal_item.type;
      if (bal_item.type === 'matrix') {
        const bal_used = new Map<string, string>();
        for (const bal_row of bal_item.rows) {
          const bal_base = `${bal_variable}_${bal_slug_variable_part(bal_row.label)}`;
          let bal_header = bal_base;
          let bal_suffix = 2;
          while ([...bal_used.values()].includes(bal_header)) {
            bal_header = `${bal_base}_${bal_suffix}`;
            bal_suffix += 1;
          }
          bal_used.set(bal_row.id, bal_header);
        }
        for (const bal_row of bal_item.rows) {
          bal_columns.push({
            key: `${bal_item.id}::${bal_row.id}`,
            itemId: bal_item.id,
            rowId: bal_row.id,
            variableName: bal_used.get(bal_row.id) ?? bal_variable,
            header: bal_used.get(bal_row.id) ?? bal_variable,
            questionLabel: bal_label,
            questionNumber: bal_numbering.itemLabels[bal_item.id] ?? '',
            itemType: bal_item.type,
            required: bal_item.required,
            matrixRowLabel: bal_row.label
          });
        }
        continue;
      }
      bal_columns.push({
        key: bal_item.id,
        itemId: bal_item.id,
        rowId: null,
        variableName: bal_variable,
        header: bal_variable,
        questionLabel: bal_label,
        questionNumber: bal_numbering.itemLabels[bal_item.id] ?? '',
        itemType: bal_item.type,
        required: bal_item.required,
        matrixRowLabel: null
      });
    }
  }
  return bal_columns;
}

export function bal_is_machine_readable(bal_item_type: string): boolean {
  return BAL_MACHINE_READABLE_TYPES.has(bal_item_type);
}

function bal_choice_codes(
  bal_value_ids: string[],
  bal_options: ChoiceOption[]
): string[] {
  return bal_value_ids.map((bal_id) => {
    const bal_option = bal_options.find((bal_candidate) => bal_candidate.id === bal_id);
    if (!bal_option) return bal_id;
    return bal_option.coding ?? bal_option.label;
  });
}

export function bal_cell_value(
  bal_response: ResponseRecord | undefined,
  bal_item: QuestionnaireItem,
  bal_scales: ResponseScaleRecord[],
  bal_matrix_columns: { id: string; label: string; coding: string | null }[] = []
): string {
  if (!bal_response) return '';
  const bal_confirmed =
    bal_response.status === 'accepted' || (bal_response.manuallyReviewed && bal_response.value.length > 0);
  if (!bal_confirmed) return '';
  if (bal_response.rowId) {
    const bal_codes = bal_choice_codes(bal_response.value, bal_matrix_columns);
    return bal_codes.join('; ');
  }
  if (BAL_MACHINE_READABLE_TYPES.has(bal_response.itemType)) {
    return bal_choice_codes(bal_response.value, bal_options_for_item(bal_item, bal_scales)).join('; ');
  }
  return bal_response.value.join(' ');
}

export function bal_cell_export(
  bal_response: ResponseRecord | undefined,
  bal_item: QuestionnaireItem,
  bal_scales: ResponseScaleRecord[],
  bal_matrix_columns: { id: string; label: string; coding: string | null }[] = []
): bal_CellExport {
  if (!bal_response) {
    return { value: '', status: 'blank', confidence: null, machineValue: '', manuallyReviewed: false };
  }
  return {
    value: bal_cell_value(bal_response, bal_item, bal_scales, bal_matrix_columns),
    status: bal_response.status,
    confidence: bal_response.confidence,
    machineValue: (bal_response.machineValue ?? []).join('; '),
    manuallyReviewed: bal_response.manuallyReviewed
  };
}

export function bal_build_export_rows(
  bal_columns: bal_ExportColumn[],
  bal_questionnaire: QuestionnaireRecord,
  bal_scales: ResponseScaleRecord[],
  bal_responses: ResponseRecord[],
  bal_respondents: string[],
  bal_include_diagnostics = false
): Record<string, string>[] {
  const bal_item_by_id = new Map<string, QuestionnaireItem>();
  for (const bal_section of bal_questionnaire.sections) {
    for (const bal_item of bal_section.items) bal_item_by_id.set(bal_item.id, bal_item);
  }
  const bal_by_respondent = new Map<string, ResponseRecord[]>();
  for (const bal_response of bal_responses) {
    const bal_existing = bal_by_respondent.get(bal_response.respondentId);
    if (bal_existing) bal_existing.push(bal_response);
    else bal_by_respondent.set(bal_response.respondentId, [bal_response]);
  }
  const bal_rows: Record<string, string>[] = [];
  for (const bal_respondent of bal_respondents) {
    const bal_row: Record<string, string> = { respondent_id: bal_respondent };
    const bal_cells = bal_by_respondent.get(bal_respondent) ?? [];
    for (const bal_column of bal_columns) {
      const bal_response = bal_cells.find(
        (bal_candidate) => bal_candidate.itemId === bal_column.itemId && bal_candidate.rowId === bal_column.rowId
      );
      const bal_item = bal_item_by_id.get(bal_column.itemId);
      if (!bal_item) {
        bal_row[bal_column.header] = '';
        if (bal_include_diagnostics) {
          bal_row[`${bal_column.header}__status`] = 'missing-source';
          bal_row[`${bal_column.header}__confidence`] = '';
          bal_row[`${bal_column.header}__machine`] = '';
          bal_row[`${bal_column.header}__corrected`] = '';
        }
        continue;
      }
      const bal_export = bal_cell_export(bal_response, bal_item, bal_scales, bal_item.columns);
      bal_row[bal_column.header] = bal_export.value;
      if (bal_include_diagnostics) {
        bal_row[`${bal_column.header}__status`] = bal_response ? bal_export.status : 'missing-source';
        bal_row[`${bal_column.header}__confidence`] =
          bal_export.confidence === null ? '' : String(Math.round(bal_export.confidence * 100));
        bal_row[`${bal_column.header}__machine`] = bal_export.machineValue;
        bal_row[`${bal_column.header}__corrected`] = bal_export.manuallyReviewed ? 'yes' : '';
      }
    }
    bal_rows.push(bal_row);
  }
  return bal_rows;
}

export function bal_export_headers(bal_columns: bal_ExportColumn[], bal_include_diagnostics = false): string[] {
  if (!bal_include_diagnostics) return ['respondent_id', ...bal_columns.map((bal_c) => bal_c.header)];
  const bal_headers = ['respondent_id'];
  for (const bal_column of bal_columns) {
    bal_headers.push(
      bal_column.header,
      `${bal_column.header}__status`,
      `${bal_column.header}__confidence`,
      `${bal_column.header}__machine`,
      `${bal_column.header}__corrected`
    );
  }
  return bal_headers;
}

export function bal_to_csv(bal_rows: Record<string, string>[], bal_headers: string[]): string {
  const bal_escape = (bal_value: string): string => {
    if (/[",\n\r]/.test(bal_value)) return `"${bal_value.replace(/"/g, '""')}"`;
    return bal_value;
  };
  const bal_lines = [bal_headers.map(bal_escape).join(',')];
  for (const bal_row of bal_rows) {
    bal_lines.push(bal_headers.map((bal_header) => bal_escape(bal_row[bal_header] ?? '')).join(','));
  }
  return `${bal_lines.join('\r\n')}\r\n`;
}

export function bal_build_json_dataset(
  bal_columns: bal_ExportColumn[],
  bal_questionnaire: QuestionnaireRecord,
  bal_scales: ResponseScaleRecord[],
  bal_responses: ResponseRecord[],
  bal_respondents: string[]
): string {
  const bal_rows = bal_build_export_rows(bal_columns, bal_questionnaire, bal_scales, bal_responses, bal_respondents);
  return JSON.stringify(
    {
      questionnaireId: bal_questionnaire.id,
      questionnaireVersion: bal_questionnaire.version,
      title: bal_questionnaire.title,
      exportedAt: new Date().toISOString(),
      respondents: bal_rows
    },
    null,
    2
  );
}

export function bal_build_codebook(
  bal_columns: bal_ExportColumn[],
  bal_questionnaire: QuestionnaireRecord,
  bal_scales: ResponseScaleRecord[]
): bal_CodebookRow[] {
  const bal_item_by_id = new Map<string, QuestionnaireItem>();
  for (const bal_section of bal_questionnaire.sections) {
    for (const bal_item of bal_section.items) bal_item_by_id.set(bal_item.id, bal_item);
  }
  const bal_rows: bal_CodebookRow[] = [];
  for (const bal_column of bal_columns) {
    const bal_item = bal_item_by_id.get(bal_column.itemId);
    if (!bal_item) continue;
    const bal_base: bal_CodebookRow = {
      variableName: bal_column.variableName,
      questionNumber: bal_column.questionNumber,
      questionLabel: bal_column.questionLabel,
      itemType: bal_item.type,
      required: bal_item.required,
      matrixRowLabel: bal_column.matrixRowLabel,
      optionLabel: null,
      optionCode: null
    };
    if (bal_column.rowId) {
      const bal_column_defs = bal_item.columns;
      if (bal_column_defs.length === 0) {
        bal_rows.push(bal_base);
        continue;
      }
      for (const bal_def of bal_column_defs) {
        bal_rows.push({ ...bal_base, optionLabel: bal_def.label, optionCode: bal_def.coding ?? bal_def.label });
      }
      continue;
    }
    if (BAL_MACHINE_READABLE_TYPES.has(bal_item.type) && bal_item.type !== 'matrix') {
      const bal_options = bal_options_for_item(bal_item, bal_scales);
      if (bal_options.length === 0) {
        bal_rows.push(bal_base);
        continue;
      }
      for (const bal_option of bal_options) {
        bal_rows.push({ ...bal_base, optionLabel: bal_option.label, optionCode: bal_option.coding ?? bal_option.label });
      }
      continue;
    }
    bal_rows.push(bal_base);
  }
  return bal_rows;
}

export function bal_codebook_to_csv(bal_rows: bal_CodebookRow[]): string {
  const bal_headers = [
    'variable_name',
    'question_number',
    'question_label',
    'item_type',
    'required',
    'matrix_row_label',
    'option_label',
    'option_code'
  ];
  const bal_escape = (bal_value: string | null | boolean): string => {
    const bal_text = bal_value === null ? '' : String(bal_value);
    if (/[",\n\r]/.test(bal_text)) return `"${bal_text.replace(/"/g, '""')}"`;
    return bal_text;
  };
  const bal_lines = [bal_headers.join(',')];
  for (const bal_row of bal_rows) {
    bal_lines.push(
      [
        bal_escape(bal_row.variableName),
        bal_escape(bal_row.questionNumber),
        bal_escape(bal_row.questionLabel),
        bal_escape(bal_row.itemType),
        bal_escape(bal_row.required),
        bal_escape(bal_row.matrixRowLabel),
        bal_escape(bal_row.optionLabel),
        bal_escape(bal_row.optionCode)
      ].join(',')
    );
  }
  return `${bal_lines.join('\r\n')}\r\n`;
}

export function bal_export_filenames(
  bal_project_title: string,
  bal_version: number
): { responsesCsv: string; responsesJson: string; codebookCsv: string } {
  return {
    responsesCsv: bal_sanitize_filename(`${bal_project_title}-v${bal_version}-responses`, '.csv'),
    responsesJson: bal_sanitize_filename(`${bal_project_title}-v${bal_version}-responses`, '.json'),
    codebookCsv: bal_sanitize_filename(`${bal_project_title}-v${bal_version}-codebook`, '.csv')
  };
}
