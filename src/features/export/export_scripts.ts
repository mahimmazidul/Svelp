import type { bal_CodebookRow, bal_ExportColumn } from './export_dataset';
import type { ResponseAuditEventRecord, ResponseRecord } from '../../models/response_models';
import { bal_to_csv } from './export_dataset';

const BAL_SPSS_STRING_WIDTH = 255;

function bal_codebook_rows_for_column(
  bal_column: bal_ExportColumn,
  bal_rows: bal_CodebookRow[]
): bal_CodebookRow[] {
  return bal_rows.filter(
    (bal_row) =>
      bal_row.variableName === bal_column.variableName &&
      (bal_row.matrixRowLabel ?? null) === (bal_column.matrixRowLabel ?? null) &&
      (bal_column.binaryOptionId ? bal_row.optionLabel === bal_column.binaryOptionLabel : true)
  );
}

function bal_spss_quote(bal_value: string): string {
  return `'${bal_value.replace(/'/g, "''")}'`;
}

function bal_spss_type(bal_column: bal_ExportColumn): string {
  if (bal_column.binaryOptionId) return 'F1.0';
  if (bal_column.itemType === 'number') return 'F8.2';
  return `A${BAL_SPSS_STRING_WIDTH}`;
}

export function bal_spss_syntax(
  bal_columns: bal_ExportColumn[],
  bal_codebook: bal_CodebookRow[],
  bal_csv_filename: string
): string {
  const bal_lines: string[] = [];
  bal_lines.push('GET DATA');
  bal_lines.push('  /TYPE=TXT');
  bal_lines.push(`  /FILE=${bal_spss_quote(bal_csv_filename)}`);
  bal_lines.push("  /ENCODING='UTF8'");
  bal_lines.push('  /DELIMITERS=","');
  bal_lines.push("  /QUALIFIER='\"'");
  bal_lines.push('  /FIRSTCASE=2');
  bal_lines.push('  /VARIABLES=');
  for (const bal_column of bal_columns) {
    bal_lines.push(`    ${bal_column.header} ${bal_spss_type(bal_column)}`);
  }
  bal_lines.push('.');
  bal_lines.push('');
  bal_lines.push('VARIABLE LABELS');
  const bal_question_labels = new Map<string, string>();
  for (const bal_row of bal_codebook) {
    if (!bal_question_labels.has(bal_row.variableName)) {
      bal_question_labels.set(bal_row.variableName, bal_row.questionLabel || bal_row.variableName);
    }
  }
  const bal_label_lines = bal_columns.map(
    (bal_column) =>
      `    ${bal_column.header} ${bal_spss_quote(bal_question_labels.get(bal_column.header) || bal_column.questionLabel || bal_column.header)}`
  );
  bal_lines.push(bal_label_lines.join('\n'));
  bal_lines.push('.');
  bal_lines.push('');
  const bal_label_groups: string[] = [];
  for (const bal_column of bal_columns) {
    const bal_rows = bal_codebook_rows_for_column(bal_column, bal_codebook).filter((bal_row) => bal_row.optionLabel !== null);
    if (bal_rows.length === 0) continue;
    const bal_numeric_column = bal_spss_type(bal_column).startsWith('F');
    const bal_parts = bal_rows.map((bal_row) => {
      const bal_code = bal_row.optionCode ?? '';
      return `${bal_numeric_column ? bal_code : bal_spss_quote(bal_code)} ${bal_spss_quote(bal_row.optionLabel ?? '')}`;
    });
    bal_label_groups.push(`    /${bal_column.header} ${bal_parts.join(' ')}`);
  }
  if (bal_label_groups.length > 0) {
    bal_lines.push('VALUE LABELS');
    bal_lines.push(bal_label_groups.join('\n'));
    bal_lines.push('.');
    bal_lines.push('');
  }
  const bal_numeric = bal_columns.filter((bal_column) => bal_spss_type(bal_column).startsWith('F'));
  if (bal_numeric.length > 0) {
    bal_lines.push('MISSING VALUES');
    bal_lines.push(`    ${bal_numeric.map((bal_column) => bal_column.header).join(' ')} ('')`);
    bal_lines.push('.');
  }
  bal_lines.push('');
  bal_lines.push('EXECUTE.');
  return `${bal_lines.join('\n')}\n`;
}

export function bal_r_helper(
  bal_csv_filename: string,
  bal_columns: bal_ExportColumn[],
  bal_codebook: bal_CodebookRow[]
): string {
  const bal_lines: string[] = [];
  bal_lines.push(`responses <- read.csv(${JSON.stringify(bal_csv_filename)}, colClasses = "character", fileEncoding = "UTF-8")`);
  bal_lines.push('');
  for (const bal_column of bal_columns) {
    const bal_rows = bal_codebook_rows_for_column(bal_column, bal_codebook).filter(
      (bal_row) => bal_row.optionLabel !== null && bal_row.optionCode !== null && bal_row.optionCode !== ''
    );
    if (bal_rows.length === 0) continue;
    const bal_pairs = bal_rows.map(
      (bal_row) => `${JSON.stringify(bal_row.optionCode ?? '')} = ${JSON.stringify(bal_row.optionLabel ?? '')}`
    );
    bal_lines.push(`${bal_column.header}_labels <- c(${bal_pairs.join(', ')})`);
    bal_lines.push(`responses$${bal_column.header} <- factor(responses$${bal_column.header}, levels = names(${bal_column.header}_labels), labels = ${bal_column.header}_labels)`);
  }
  bal_lines.push('');
  return bal_lines.join('\n');
}

export interface bal_AuditRow {
  timestamp: string;
  respondentId: string;
  variableName: string | null;
  itemId: string;
  rowId: string | null;
  action: string;
  previousValue: string;
  previousStatus: string | null;
  finalValue: string;
  finalStatus: string | null;
  algorithmVersion: string | null;
  responseId: string;
}

export function bal_audit_rows(
  bal_events: ResponseAuditEventRecord[],
  bal_responses_by_id: Map<string, ResponseRecord>,
  bal_value_text: (bal_event: ResponseAuditEventRecord, bal_key: 'previousValue' | 'finalValue') => string
): bal_AuditRow[] {
  return [...bal_events]
    .sort((bal_a, bal_b) => bal_a.createdAt - bal_b.createdAt)
    .map((bal_event) => {
      const bal_response = bal_responses_by_id.get(bal_event.responseId);
      return {
        timestamp: new Date(bal_event.createdAt).toISOString(),
        respondentId: bal_event.respondentId,
        variableName: bal_response?.variableName ?? null,
        itemId: bal_event.itemId,
        rowId: bal_event.rowId,
        action: bal_event.action,
        previousValue: bal_value_text(bal_event, 'previousValue'),
        previousStatus: bal_event.previousStatus,
        finalValue: bal_value_text(bal_event, 'finalValue'),
        finalStatus: bal_event.finalStatus,
        algorithmVersion: bal_response?.algorithmVersion ?? null,
        responseId: bal_event.responseId
      };
    });
}

export function bal_audit_to_csv(bal_rows: bal_AuditRow[], bal_bom = false): string {
  const bal_headers = [
    'timestamp',
    'respondent_id',
    'variable_name',
    'item_id',
    'matrix_row_id',
    'action',
    'previous_value',
    'previous_status',
    'final_value',
    'final_status',
    'algorithm_version',
    'response_id'
  ];
  const bal_serialized = bal_rows.map((bal_row) => ({
    timestamp: bal_row.timestamp,
    respondent_id: bal_row.respondentId,
    variable_name: bal_row.variableName ?? '',
    item_id: bal_row.itemId,
    matrix_row_id: bal_row.rowId ?? '',
    action: bal_row.action,
    previous_value: bal_row.previousValue,
    previous_status: bal_row.previousStatus ?? '',
    final_value: bal_row.finalValue,
    final_status: bal_row.finalStatus ?? '',
    algorithm_version: bal_row.algorithmVersion ?? '',
    response_id: bal_row.responseId
  }));
  return bal_to_csv(bal_serialized, bal_headers, bal_bom);
}

export interface bal_ResearchSummaryInput {
  questionnaireTitle: string;
  questionnaireVersion: number;
  respondentCount: number;
  algorithmVersion: string;
  profileName: string;
  autoAccepted: number;
  reviewedCorrected: number;
  blanks: number;
  unresolved: number;
  missingPageRespondents: number;
  transcriptionPending: number;
  versionConflicts: number;
  svelpVersion: string;
}

export function bal_diagnostics_to_csv(
  bal_responses: ResponseRecord[],
  bal_respondent_order: string[] | null = null,
  bal_bom = false
): string {
  const bal_order = new Map((bal_respondent_order ?? []).map((bal_respondent, bal_index) => [bal_respondent, bal_index]));
  const bal_rank = (bal_response: ResponseRecord): number =>
    bal_order.get(bal_response.respondentId) ?? Number.MAX_SAFE_INTEGER;
  const bal_variable = (bal_response: ResponseRecord): string => bal_response.variableName ?? '';
  const bal_sorted = [...bal_responses].sort((bal_a, bal_b) => {
    const bal_rank_a = bal_rank(bal_a);
    const bal_rank_b = bal_rank(bal_b);
    if (bal_rank_a !== bal_rank_b) return bal_rank_a - bal_rank_b;
    return bal_variable(bal_a).localeCompare(bal_variable(bal_b));
  });
  const bal_serialized = bal_sorted.map((bal_response) => ({
    respondent_id: bal_response.respondentId,
    variable_name: bal_response.variableName ?? '',
    final_value: (bal_response.value ?? []).join('; '),
    machine_detected_value: (bal_response.machineValue ?? []).join('; '),
    recognition_status: bal_response.status,
    evidence_score: bal_response.confidence === null ? '' : String(bal_response.confidence),
    manually_reviewed: bal_response.manuallyReviewed ? 'true' : 'false',
    algorithm_version: bal_response.algorithmVersion,
    source_page_id: bal_response.sourcePageId ?? ''
  }));
  return bal_to_csv(
    bal_serialized,
    [
      'respondent_id',
      'variable_name',
      'final_value',
      'machine_detected_value',
      'recognition_status',
      'evidence_score',
      'manually_reviewed',
      'algorithm_version',
      'source_page_id'
    ],
    bal_bom
  );
}

export function bal_research_summary(bal_input: bal_ResearchSummaryInput): string {
  return JSON.stringify(
    {
      product: 'Svelp',
      svelpVersion: bal_input.svelpVersion,
      questionnaireTitle: bal_input.questionnaireTitle,
      questionnaireVersion: bal_input.questionnaireVersion,
      respondentCount: bal_input.respondentCount,
      recognitionAlgorithmVersion: bal_input.algorithmVersion,
      recognitionProfile: bal_input.profileName,
      counts: {
        autoAccepted: bal_input.autoAccepted,
        reviewedCorrected: bal_input.reviewedCorrected,
        blank: bal_input.blanks,
        unresolved: bal_input.unresolved,
        missingPageRespondents: bal_input.missingPageRespondents,
        transcriptionPending: bal_input.transcriptionPending,
        versionConflicts: bal_input.versionConflicts
      },
      note: 'Confidence values are deterministic evidence scores, not probabilities.',
      exportedAt: new Date().toISOString()
    },
    null,
    2
  );
}
