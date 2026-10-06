import { bal_is_reserved_word } from './shobdo_lexer';
import type {
  ChoiceOption,
  ItemTypeName,
  QuestionnaireItem,
  QuestionnaireRecord,
  ResponseScaleRecord
} from '../../models/types';
import { bal_consent_default_title } from './naksha_parser';

export interface bal_SerializedSource {
  text: string;
  skipped: { label: string; type: ItemTypeName }[];
}

export function bal_slug_key(bal_label: string): string {
  const bal_slug = bal_label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
    .replace(/_+$/g, '');
  return bal_slug.length > 0 ? bal_slug : 'item';
}

export function bal_unique_key(bal_base: string, bal_taken: Set<string>): string {
  if (!bal_taken.has(bal_base) && !bal_is_reserved_word(bal_base)) {
    bal_taken.add(bal_base);
    return bal_base;
  }
  let bal_n = 2;
  while (bal_taken.has(`${bal_base}_${bal_n}`)) bal_n += 1;
  const bal_key = `${bal_base}_${bal_n}`;
  bal_taken.add(bal_key);
  return bal_key;
}

function bal_quote(bal_text: string): string {
  return `"${bal_text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function bal_emit_string(bal_lines: string[], bal_text: string): void {
  if (bal_text.includes('\n')) {
    bal_lines.push('"""');
    for (const bal_line of bal_text.split('\n')) bal_lines.push(bal_line);
    bal_lines.push('"""');
    return;
  }
  bal_lines.push(bal_quote(bal_text));
}

function bal_item_key(bal_item: QuestionnaireItem): string {
  const bal_name = bal_item.variableName ?? '';
  if (/^[a-z_][a-z0-9_]*$/.test(bal_name) && !bal_is_reserved_word(bal_name)) {
    return bal_name;
  }
  return bal_unique_key(bal_slug_key(bal_item.label), new Set());
}

function bal_option_key(bal_label: string, bal_coding: string | null, bal_taken: Set<string>): string {
  if (bal_coding !== null && /^[a-z_][a-z0-9_]*$/.test(bal_coding) && !bal_is_reserved_word(bal_coding)) {
    return bal_unique_key(bal_coding, bal_taken);
  }
  return bal_unique_key(bal_slug_key(bal_label), bal_taken);
}

function bal_code_suffix(bal_coding: string | null): string {
  return bal_coding === null ? '' : ` code ${bal_coding === '' ? '""' : bal_coding}`;
}

function bal_scale_name(bal_scale_id: string | null, bal_scales: ResponseScaleRecord[]): string | null {
  if (bal_scale_id === null) return null;
  return bal_scales.find((bal_s) => bal_s.id === bal_scale_id)?.name ?? null;
}

function bal_serialize_item(
  bal_lines: string[],
  bal_item: QuestionnaireItem,
  bal_scales: ResponseScaleRecord[],
  bal_skipped: { label: string; type: ItemTypeName }[]
): void {
  const bal_heads: Record<string, string> = {
    instruction: 'instruction',
    single_choice: 'single',
    multiple_choice: 'multiple',
    yes_no: 'yesno',
    short_text: 'shorttext',
    long_text: 'longtext',
    number: 'number',
    date: 'date',
    time: 'time',
    likert_scale: 'likert',
    matrix: 'matrix',
    consent: 'consent',
    participant_signature: 'participant_signature',
    researcher_signature: 'researcher_signature'
  };
  const bal_head = bal_heads[bal_item.type];
  if (!bal_head) {
    bal_skipped.push({ label: bal_item.label, type: bal_item.type });
    return;
  }
  if (bal_item.type === 'instruction') {
    bal_lines.push('');
    bal_lines.push(`instruction ${bal_quote(bal_item.label)}`);
    if (bal_item.emphasis === 'callout') bal_lines.push('  callout');
    return;
  }
  bal_lines.push('');
  bal_lines.push(`${bal_head} ${bal_item_key(bal_item)} ${bal_quote(bal_item.label)}`);
  if (bal_item.required) bal_lines.push('  required');
  switch (bal_item.type) {
    case 'single_choice':
    case 'multiple_choice': {
      const bal_assigned = bal_scale_name(bal_item.scaleId, bal_scales);
      if (bal_assigned) {
        bal_lines.push(`  use ${bal_assigned}`);
      } else {
        const bal_taken_keys = new Set<string>();
        for (const bal_option of bal_item.options) {
          bal_lines.push(
            `  option ${bal_option_key(bal_option.label, bal_option.coding, bal_taken_keys)} ${bal_quote(bal_option.label)}${bal_code_suffix(bal_option.coding)}`
          );
        }
      }
      if (bal_item.type === 'multiple_choice' && bal_item.validation) {
        if (bal_item.validation.minSelections !== null && bal_item.validation.minSelections !== undefined) {
          bal_lines.push(`  min ${bal_item.validation.minSelections}`);
        }
        if (bal_item.validation.maxSelections !== null && bal_item.validation.maxSelections !== undefined) {
          bal_lines.push(`  max ${bal_item.validation.maxSelections}`);
        }
      }
      break;
    }
    case 'yes_no': {
      const bal_yes = bal_item.options.find((bal_o) => bal_o.label === 'Yes');
      const bal_no = bal_item.options.find((bal_o) => bal_o.label === 'No');
      if (bal_yes && bal_yes.coding !== '1') bal_lines.push(`  yes ${bal_yes.coding ?? '1'}`);
      if (bal_no && bal_no.coding !== '0') bal_lines.push(`  no ${bal_no.coding ?? '0'}`);
      break;
    }
    case 'short_text':
    case 'long_text':
      if (bal_item.validation?.maxLength) bal_lines.push(`  maxlen ${bal_item.validation.maxLength}`);
      break;
    case 'number':
      if (bal_item.validation?.min !== null && bal_item.validation?.min !== undefined) {
        bal_lines.push(`  min ${bal_item.validation.min}`);
      }
      if (bal_item.validation?.max !== null && bal_item.validation?.max !== undefined) {
        bal_lines.push(`  max ${bal_item.validation.max}`);
      }
      if (bal_item.validation?.step !== null && bal_item.validation?.step !== undefined) {
        bal_lines.push(`  step ${bal_item.validation.step}`);
      }
      if (bal_item.unitLabel) bal_lines.push(`  unit ${bal_quote(bal_item.unitLabel)}`);
      break;
    case 'likert_scale': {
      const bal_assigned = bal_scale_name(bal_item.scaleId, bal_scales);
      if (bal_assigned) {
        bal_lines.push(`  use ${bal_assigned}`);
      } else {
        for (const bal_option of bal_item.options) {
          bal_lines.push(`  ${bal_option.coding ?? ''} ${bal_quote(bal_option.label)}`);
        }
      }
      break;
    }
    case 'matrix': {
      const bal_assigned = bal_scale_name(bal_item.scaleId, bal_scales);
      if (bal_assigned) {
        bal_lines.push(`  scale ${bal_assigned}`);
      } else {
        const bal_taken_column_keys = new Set<string>();
        for (const bal_column of bal_item.columns) {
          bal_lines.push(
            `  column ${bal_option_key(bal_column.label, bal_column.coding, bal_taken_column_keys)} ${bal_quote(bal_column.label)}${bal_code_suffix(bal_column.coding)}`
          );
        }
      }
      if (bal_item.selectionMode === 'multiple') bal_lines.push('  multiple_per_row');
      bal_lines.push('  rows {');
      const bal_taken_row_keys = new Set<string>();
      for (const bal_row of bal_item.rows) {
        bal_lines.push(
          `    ${bal_unique_key(bal_slug_key(bal_row.label), bal_taken_row_keys)} ${bal_quote(bal_row.label)}`
        );
      }
      bal_lines.push('  }');
      break;
    }
    case 'consent': {
      const bal_consent = bal_item.consent;
      if (bal_consent) {
        if (bal_consent.introduction.length > 0) {
          bal_lines.push('  introduction');
          bal_emit_string(bal_lines, bal_consent.introduction);
        }
        for (const bal_section of bal_consent.sections) {
          const bal_explicit_title = bal_section.title !== bal_consent_default_title(bal_section.kind);
          bal_lines.push(`  ${bal_section.kind}`);
          if (bal_explicit_title) bal_lines.push(`  ${bal_quote(bal_section.title)}`);
          bal_emit_string(bal_lines, bal_section.body);
        }
        if (bal_consent.acknowledgementLabel) {
          bal_lines.push(`  acknowledgement ${bal_quote(bal_consent.acknowledgementLabel)}`);
        }
      }
      break;
    }
    case 'participant_signature':
    case 'researcher_signature': {
      const bal_signature = bal_item.signature;
      if (bal_signature) {
        if (!bal_signature.includePrintedName) bal_lines.push('  no_printed_name');
        if (!bal_signature.includeDate) bal_lines.push('  no_date');
        const bal_default_role = bal_item.type === 'participant_signature' ? 'Participant' : 'Researcher';
        if (bal_signature.signerRole !== bal_default_role) bal_lines.push(`  role ${bal_quote(bal_signature.signerRole)}`);
      }
      break;
    }
    default:
      break;
  }
}

export function bal_source_serialize(
  bal_questionnaire: QuestionnaireRecord,
  bal_scales: ResponseScaleRecord[]
): bal_SerializedSource {
  const bal_lines: string[] = [];
  const bal_skipped: { label: string; type: ItemTypeName }[] = [];
  bal_lines.push('svelp 1');
  bal_lines.push('');
  bal_lines.push(`title ${bal_quote(bal_questionnaire.title)}`);
  if (bal_questionnaire.description) bal_lines.push(`description ${bal_quote(bal_questionnaire.description)}`);
  if (bal_questionnaire.language && bal_questionnaire.language !== 'en') {
    bal_lines.push(`language ${bal_quote(bal_questionnaire.language)}`);
  }
  if (bal_questionnaire.paperSize !== 'a4') bal_lines.push(`paper ${bal_questionnaire.paperSize}`);
  if (bal_questionnaire.orientation !== 'portrait') bal_lines.push(`orientation ${bal_questionnaire.orientation}`);

  for (const bal_scale of bal_scales) {
    bal_lines.push('');
    bal_lines.push(`scale ${bal_scale.name}`);
    const bal_taken_keys = new Set<string>();
    for (const bal_option of bal_scale.options) {
      bal_lines.push(
        `option ${bal_option_key(bal_option.label, bal_option.coding, bal_taken_keys)} ${bal_quote(bal_option.label)}${bal_code_suffix(bal_option.coding)}`
      );
    }
  }

  let bal_first_section = true;
  for (const bal_section of bal_questionnaire.sections) {
    bal_lines.push('');
    if (!bal_first_section) bal_lines.push('');
    bal_first_section = false;
    const bal_section_key =
      (typeof bal_section.metadata?.sourceKey === 'string' &&
        /^[a-z_][a-z0-9_]*$/.test(bal_section.metadata.sourceKey) &&
        !bal_is_reserved_word(bal_section.metadata.sourceKey) &&
        bal_section.metadata.sourceKey) ||
      bal_unique_key(bal_slug_key(bal_section.title), new Set());
    bal_lines.push(`section ${bal_section_key} ${bal_quote(bal_section.title)}`);
    if (bal_section.printConfig?.pageBreakBefore) bal_lines.push('new_page');
    if (bal_section.description) bal_lines.push(`description ${bal_quote(bal_section.description)}`);
    for (const bal_item of bal_section.items) {
      bal_serialize_item(bal_lines, bal_item, bal_scales, bal_skipped);
    }
  }

  const bal_cleaned: string[] = [];
  for (const bal_line of bal_lines) {
    if (bal_line === '' && (bal_cleaned.length === 0 || bal_cleaned[bal_cleaned.length - 1] === '')) continue;
    bal_cleaned.push(bal_line);
  }
  return { text: `${bal_cleaned.join('\n').replace(/\n+$/, '')}\n`, skipped: bal_skipped };
}

function bal_item_signature_for_compare(bal_item: QuestionnaireItem): unknown {
  return {
    type: bal_item.type,
    label: bal_item.label,
    required: bal_item.required,
    options: bal_item.options.map((bal_o) => ({ label: bal_o.label, coding: bal_o.coding })),
    validation: bal_item.validation ?? null,
    scaleId: bal_item.scaleId,
    rows: bal_item.rows.map((bal_r) => bal_r.label),
    columns: bal_item.columns.map((bal_c) => ({ label: bal_c.label, coding: bal_c.coding })),
    selectionMode: bal_item.selectionMode,
    consent: bal_item.consent,
    signature: bal_item.signature,
    unitLabel: bal_item.unitLabel,
    emphasis: bal_item.emphasis
  };
}

export function bal_questionnaire_source_diff(
  bal_a: QuestionnaireRecord,
  bal_b: QuestionnaireRecord
): boolean {
  if (bal_a.title !== bal_b.title) return false;
  if (bal_a.description !== bal_b.description) return false;
  if (bal_a.language !== bal_b.language) return false;
  if (bal_a.paperSize !== bal_b.paperSize) return false;
  if (bal_a.orientation !== bal_b.orientation) return false;
  if (bal_a.sections.length !== bal_b.sections.length) return false;
  for (let bal_i = 0; bal_i < bal_a.sections.length; bal_i += 1) {
    const bal_sa = bal_a.sections[bal_i];
    const bal_sb = bal_b.sections[bal_i];
    if (bal_sa.title !== bal_sb.title) return false;
    if (bal_sa.description !== bal_sb.description) return false;
    if ((bal_sa.printConfig?.pageBreakBefore ?? false) !== (bal_sb.printConfig?.pageBreakBefore ?? false)) return false;
    if (bal_sa.items.length !== bal_sb.items.length) return false;
    for (let bal_j = 0; bal_j < bal_sa.items.length; bal_j += 1) {
      const bal_same =
        JSON.stringify(bal_item_signature_for_compare(bal_sa.items[bal_j])) ===
        JSON.stringify(bal_item_signature_for_compare(bal_sb.items[bal_j]));
      if (!bal_same) return false;
    }
  }
  return true;
}

export function bal_options_equal(bal_a: ChoiceOption[], bal_b: ChoiceOption[]): boolean {
  if (bal_a.length !== bal_b.length) return false;
  return bal_a.every((bal_o, bal_i) => bal_o.label === bal_b[bal_i].label && bal_o.coding === bal_b[bal_i].coding);
}
