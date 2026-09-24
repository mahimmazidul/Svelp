import { new_id } from '../utils/id';
import type {
  ChoiceOption,
  ConsentConfig,
  ConsentSection,
  ConsentSectionKind,
  ItemTypeName,
  MatrixColumn,
  MatrixRow,
  QuestionnaireItem,
  QuestionnaireRecord,
  QuestionnaireSection,
  ResponseScaleRecord,
  SignatureConfig
} from './types';

export const BAL_CONSENT_SECTION_KINDS: ConsentSectionKind[] = [
  'purpose',
  'procedures',
  'risks',
  'benefits',
  'confidentiality',
  'voluntary',
  'withdrawal',
  'contacts'
];

export const BAL_CONSENT_SECTION_LABELS: Record<ConsentSectionKind, string> = {
  purpose: 'Study purpose',
  procedures: 'Procedures',
  risks: 'Risks',
  benefits: 'Benefits',
  confidentiality: 'Confidentiality',
  voluntary: 'Voluntary participation',
  withdrawal: 'Withdrawal',
  contacts: 'Contact information'
};

export function komola_option(bal_label: string): ChoiceOption {
  return { id: new_id(), label: bal_label, coding: null };
}

export function dhon_matrix_row(bal_label: string): MatrixRow {
  return { id: new_id(), label: bal_label };
}

export function dhon_matrix_column(bal_label: string): MatrixColumn {
  return { id: new_id(), label: bal_label, coding: null };
}

export function dhon_consent_section(
  bal_kind: ConsentSectionKind
): ConsentSection {
  return {
    id: new_id(),
    kind: bal_kind,
    title: BAL_CONSENT_SECTION_LABELS[bal_kind],
    body: ''
  };
}

export function dhon_consent_config(): ConsentConfig {
  return {
    title: 'Consent',
    introduction: '',
    sections: [],
    acknowledgementLabel: 'I have read and understood the information above, and I agree to take part.'
  };
}

export function dhon_signature_config(bal_role: string): SignatureConfig {
  return {
    signerRole: bal_role,
    includePrintedName: true,
    includeDate: true
  };
}

function bal_default_options(bal_type: ItemTypeName): ChoiceOption[] {
  if (bal_type === 'single_choice' || bal_type === 'multiple_choice') {
    return [komola_option('Option 1'), komola_option('Option 2')];
  }
  if (bal_type === 'yes_no') {
    const bal_yes = komola_option('Yes');
    bal_yes.coding = '1';
    const bal_no = komola_option('No');
    bal_no.coding = '0';
    return [bal_yes, bal_no];
  }
  return [];
}

function bal_default_validation(bal_type: ItemTypeName): QuestionnaireItem['validation'] {
  if (bal_type === 'multiple_choice') return { minSelections: null, maxSelections: null };
  if (bal_type === 'number') return { min: null, max: null, step: null, decimalAllowed: true };
  if (bal_type === 'short_text' || bal_type === 'long_text') return { maxLength: null };
  if (bal_type === 'matrix') return { requireAllRows: true };
  return null;
}

export function dhon_banaitesi_section(bal_title: string): QuestionnaireSection {
  return {
    id: new_id(),
    type: 'section',
    title: bal_title,
    description: null,
    items: [],
    printConfig: null,
    metadata: null
  };
}

export function dhon_banaitesi_item(
  bal_type: ItemTypeName,
  bal_variable_name: string | null
): QuestionnaireItem {
  const bal_base: QuestionnaireItem = {
    id: new_id(),
    type: bal_type,
    variableName: null,
    label: '',
    required: false,
    options: [],
    coding: null,
    validation: null,
    scannerConfig: null,
    printConfig: null,
    metadata: null,
    scaleId: null,
    placeholder: null,
    heading: null,
    emphasis: 'normal',
    rows: [],
    columns: [],
    selectionMode: 'single',
    consent: null,
    signature: null,
    unitLabel: null
  };
  if (bal_type === 'instruction') return bal_base;
  if (bal_type === 'consent') {
    bal_base.consent = dhon_consent_config();
    return bal_base;
  }
  if (bal_type === 'participant_signature' || bal_type === 'researcher_signature') {
    bal_base.signature = dhon_signature_config(
      bal_type === 'participant_signature' ? 'Participant' : 'Researcher'
    );
    return bal_base;
  }
  if (bal_type === 'matrix') {
    bal_base.variableName = bal_variable_name;
    bal_base.validation = bal_default_validation(bal_type);
    return bal_base;
  }
  bal_base.variableName = bal_variable_name;
  bal_base.options = bal_default_options(bal_type);
  bal_base.validation = bal_default_validation(bal_type);
  return bal_base;
}

export function dhon_likert_points(bal_count: number): ChoiceOption[] {
  const bal_presets: Record<number, string[]> = {
    3: ['Negative', 'Neutral', 'Positive'],
    5: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
    7: [
      'Strongly disagree',
      'Disagree',
      'Somewhat disagree',
      'Neutral',
      'Somewhat agree',
      'Agree',
      'Strongly agree'
    ]
  };
  const bal_labels = bal_presets[bal_count] ?? [];
  return Array.from({ length: bal_count }, (_bal_unused, bal_i) => {
    const bal_option = komola_option(bal_labels[bal_i] ?? `Point ${bal_i + 1}`);
    bal_option.coding = String(bal_i + 1);
    return bal_option;
  });
}

export function apel_clone_option(bal_option: ChoiceOption): ChoiceOption {
  return { ...bal_option, id: new_id() };
}

export function apel_clone_item(
  bal_item: QuestionnaireItem,
  bal_variable_name?: string
): QuestionnaireItem {
  const bal_clone: QuestionnaireItem = {
    ...bal_item,
    id: new_id(),
    variableName: bal_variable_name !== undefined ? bal_variable_name : bal_item.variableName,
    options: bal_item.options.map(apel_clone_option),
    validation: bal_item.validation ? { ...bal_item.validation } : null,
    scannerConfig: bal_item.scannerConfig ? { ...bal_item.scannerConfig } : null,
    printConfig: bal_item.printConfig ? { ...bal_item.printConfig } : null,
    metadata: bal_item.metadata ? { ...bal_item.metadata } : null,
    rows: bal_item.rows.map((bal_row) => ({ ...bal_row, id: new_id() })),
    columns: bal_item.columns.map((bal_col) => ({ ...bal_col, id: new_id() }))
  };
  if (bal_item.consent) {
    bal_clone.consent = {
      ...bal_item.consent,
      sections: bal_item.consent.sections.map((bal_s) => ({ ...bal_s, id: new_id() }))
    };
  }
  return bal_clone;
}

export function apel_clone_section(bal_section: QuestionnaireSection): QuestionnaireSection {
  return {
    ...bal_section,
    id: new_id(),
    items: bal_section.items.map((bal_item) => apel_clone_item(bal_item)),
    printConfig: bal_section.printConfig ? { ...bal_section.printConfig } : null,
    metadata: bal_section.metadata ? { ...bal_section.metadata } : null
  };
}

export function apel_clone_questionnaire(
  bal_q: QuestionnaireRecord,
  bal_project_id: string
): QuestionnaireRecord {
  const bal_now = Date.now();
  return {
    ...bal_q,
    id: new_id(),
    projectId: bal_project_id,
    status: 'draft',
    version: 1,
    metadata: bal_q.metadata ? { ...bal_q.metadata } : null,
    sections: bal_q.sections.map(apel_clone_section),
    createdAt: bal_now,
    updatedAt: bal_now
  };
}

export function apel_clone_scale(bal_scale: ResponseScaleRecord): ResponseScaleRecord {
  const bal_now = Date.now();
  return {
    ...bal_scale,
    id: new_id(),
    name: `${bal_scale.name} (copy)`,
    options: bal_scale.options.map(apel_clone_option),
    createdAt: bal_now,
    updatedAt: bal_now
  };
}

export function dhon_banaitesi_scale(bal_name: string): ResponseScaleRecord {
  const bal_now = Date.now();
  return {
    id: new_id(),
    name: bal_name,
    options: [komola_option('Option 1'), komola_option('Option 2')],
    createdAt: bal_now,
    updatedAt: bal_now
  };
}

export function dhon_banaitesi_questionnaire(bal_input: {
  projectId: string;
  title: string;
}): QuestionnaireRecord {
  const bal_now = Date.now();
  return {
    id: new_id(),
    projectId: bal_input.projectId,
    title: bal_input.title,
    description: null,
    version: 1,
    language: 'en',
    paperSize: 'a4',
    orientation: 'portrait',
    theme: null,
    status: 'draft',
    metadata: null,
    printSettings: null,
    sections: [dhon_banaitesi_section('Section 1')],
    createdAt: bal_now,
    updatedAt: bal_now
  };
}

function bal_plain_object(bal_value: unknown): Record<string, unknown> | null {
  return typeof bal_value === 'object' && bal_value !== null && !Array.isArray(bal_value)
    ? (bal_value as Record<string, unknown>)
    : null;
}

export function normalize_item(bal_raw: unknown): QuestionnaireItem {
  const bal_source = bal_plain_object(bal_raw) ?? {};
  const bal_type = (bal_source.type as ItemTypeName) ?? 'short_text';
  const bal_item = dhon_banaitesi_item(bal_type, null);
  const bal_known = new Set(Object.keys(bal_item));
  for (const bal_key of Object.keys(bal_source)) {
    if (bal_known.has(bal_key)) {
      (bal_item as unknown as Record<string, unknown>)[bal_key] = bal_source[bal_key];
    } else {
      bal_item.metadata = {
        ...(bal_item.metadata ?? {}),
        [bal_key]: bal_source[bal_key]
      };
    }
  }
  bal_item.options = Array.isArray(bal_item.options) ? bal_item.options : [];
  bal_item.rows = Array.isArray(bal_item.rows) ? bal_item.rows : [];
  bal_item.columns = Array.isArray(bal_item.columns) ? bal_item.columns : [];
  if (bal_item.consent !== null && typeof bal_item.consent !== 'object') bal_item.consent = null;
  if (bal_item.signature !== null && typeof bal_item.signature !== 'object') {
    bal_item.signature = null;
  }
  return bal_item;
}

export function normalize_questionnaire(bal_raw: unknown): QuestionnaireRecord {
  const bal_source = bal_plain_object(bal_raw);
  if (!bal_source) {
    throw new Error('Stored questionnaire could not be read.');
  }
  const bal_sections_raw = Array.isArray(bal_source.sections) ? bal_source.sections : [];
  const bal_sections = bal_sections_raw.map((bal_section_raw) => {
    const bal_section_source = bal_plain_object(bal_section_raw) ?? {};
    const bal_items = Array.isArray(bal_section_source.items)
      ? bal_section_source.items.map(normalize_item)
      : [];
    return {
      ...dhon_banaitesi_section(''),
      ...bal_section_source,
      items: bal_items,
      printConfig: bal_plain_object(bal_section_source.printConfig),
      metadata: bal_plain_object(bal_section_source.metadata)
    } as QuestionnaireSection;
  });
  return {
    ...dhon_banaitesi_questionnaire({ projectId: '', title: '' }),
    ...bal_source,
    sections: bal_sections,
    metadata: bal_plain_object(bal_source.metadata)
  } as QuestionnaireRecord;
}
