import type { RecognitionStatus, ResponseRecord } from '../../models/response_models';
import type { QuestionnaireRecord } from '../../models/types';
import { derive_numbering } from '../../models/numbering';

export function bal_confidence_category(bal_response: ResponseRecord): string {
  if (bal_response.status === 'accepted') return 'High confidence';
  if (bal_response.status === 'blank') return 'Blank';
  if (bal_response.status === 'unreadable') return 'Unreadable';
  if (bal_response.status === 'manual-only') return 'Transcription needed';
  if (bal_response.status === 'multiple-marks') return 'Ambiguous';
  return 'Needs review';
}

export function bal_status_tone(
  bal_status: RecognitionStatus
): 'neutral' | 'success' | 'warning' | 'accent' {
  if (bal_status === 'accepted') return 'success';
  if (bal_status === 'blank' || bal_status === 'manual-only') return 'neutral';
  if (bal_status === 'needs-review' || bal_status === 'ambiguous' || bal_status === 'multiple-marks')
    return 'warning';
  return 'accent';
}

export function bal_status_label(bal_status: RecognitionStatus): string {
  const bal_labels: Record<RecognitionStatus, string> = {
    accepted: 'Accepted',
    blank: 'Blank',
    'needs-review': 'Needs review',
    ambiguous: 'Ambiguous',
    'multiple-marks': 'Multiple marks',
    'manual-only': 'Manual only',
    unreadable: 'Unreadable'
  };
  return bal_labels[bal_status];
}

const BAL_TYPE_LABELS: Record<string, string> = {
  single_choice: 'single choice',
  multiple_choice: 'multiple choice',
  yes_no: 'yes / no',
  likert_scale: 'scale',
  matrix: 'matrix',
  short_text: 'short text',
  long_text: 'long text',
  number: 'number',
  date: 'date',
  time: 'time',
  ranking: 'ranking',
  consent: 'consent',
  participant_signature: 'signature',
  researcher_signature: 'signature',
  instruction: 'instruction',
  section: 'section'
};

export interface bal_ItemInfo {
  itemId: string;
  label: string;
  type_label: string;
  number: string;
  sectionTitle: string;
  options: { id: string; label: string }[];
  columns: { id: string; label: string }[];
  rows: { id: string; label: string }[];
}

export function bal_item_map(bal_questionnaire: QuestionnaireRecord): Map<string, bal_ItemInfo> {
  const bal_map = new Map<string, bal_ItemInfo>();
  const bal_numbering = derive_numbering(bal_questionnaire);
  for (const bal_section of bal_questionnaire.sections) {
    for (const bal_item of bal_section.items) {
      bal_map.set(bal_item.id, {
        itemId: bal_item.id,
        label: bal_item.label || bal_item.heading || bal_item.type,
        type_label: BAL_TYPE_LABELS[bal_item.type] ?? bal_item.type,
        number: bal_numbering.itemLabels[bal_item.id] ?? '',
        sectionTitle: bal_section.title,
        options: bal_item.options.map((bal_option) => ({ id: bal_option.id, label: bal_option.label })),
        columns: bal_item.columns.map((bal_column) => ({ id: bal_column.id, label: bal_column.label })),
        rows: bal_item.rows.map((bal_row) => ({ id: bal_row.id, label: bal_row.label }))
      });
    }
  }
  return bal_map;
}

export function bal_value_label(
  bal_response: ResponseRecord,
  bal_items: Map<string, bal_ItemInfo>
): string {
  if (bal_response.value.length === 0) return '—';
  const bal_item = bal_items.get(bal_response.itemId);
  if (!bal_item) return bal_response.value.join(', ');
  if (bal_response.rowId) {
    return bal_response.value
      .map((bal_column_id) => bal_item.columns.find((bal_c) => bal_c.id === bal_column_id)?.label ?? bal_column_id)
      .join(', ');
  }
  return bal_response.value
    .map((bal_option_id) => bal_item.options.find((bal_o) => bal_o.id === bal_option_id)?.label ?? bal_option_id)
    .join(', ');
}
