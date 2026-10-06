import { bal_new_id } from '../../services/scan_service';
import { bal_is_reserved_word } from './shobdo_lexer';
import type {
  ChoiceOption,
  ConsentSection,
  ItemTypeName,
  MatrixColumn,
  MatrixRow,
  QuestionnaireItem,
  QuestionnaireRecord,
  QuestionnaireSection,
  ResponseScaleRecord
} from '../../models/types';
import type {
  bal_AstDocument,
  bal_AstItem,
  bal_AstOption,
  bal_AstSection,
  bal_ItemHead
} from './naksha_parser';
import { bal_consent_default_title } from './naksha_parser';

export function bal_slug_variable(bal_label: string): string {
  const bal_slug = bal_label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
    .replace(/_+$/g, '');
  return bal_slug.length > 0 ? bal_slug : 'item';
}

export function bal_unique_slug(bal_base: string, bal_taken: Set<string>): string {
  let bal_candidate = bal_base;
  let bal_n = 1;
  while (bal_taken.has(bal_candidate) || (bal_n === 1 && bal_is_reserved_word(bal_candidate))) {
    bal_n += 1;
    bal_candidate = `${bal_base}_${bal_n}`;
  }
  bal_taken.add(bal_candidate);
  return bal_candidate;
}

const BAL_HEAD_TO_TYPE: Record<bal_ItemHead, ItemTypeName> = {
  instruction: 'instruction',
  single: 'single_choice',
  multiple: 'multiple_choice',
  yesno: 'yes_no',
  shorttext: 'short_text',
  longtext: 'long_text',
  number: 'number',
  date: 'date',
  time: 'time',
  likert: 'likert_scale',
  matrix: 'matrix',
  consent: 'consent',
  participant_signature: 'participant_signature',
  researcher_signature: 'researcher_signature'
};

const BAL_UNREPRESENTABLE: ItemTypeName[] = ['ranking'];

export interface bal_ApplyChanges {
  sectionsAdded: number;
  sectionsRemoved: number;
  itemsAdded: number;
  itemsRemoved: number;
  itemsModified: number;
  variablesRenamed: { from: string; to: string }[];
  variablesRemovedWithData: string[];
}

export interface bal_ApplySkipped {
  label: string;
  type: ItemTypeName;
}

export type bal_ApplyPlan =
  | {
      ok: true;
      questionnaire: QuestionnaireRecord;
      scales: ResponseScaleRecord[];
      changes: bal_ApplyChanges;
      skipped: bal_ApplySkipped[];
    }
  | { ok: false; errors: string[] };

function bal_same_json(bal_a: unknown, bal_b: unknown): boolean {
  if (bal_a === bal_b) return true;
  if (Array.isArray(bal_a) && Array.isArray(bal_b)) {
    if (bal_a.length !== bal_b.length) return false;
    return bal_a.every((bal_v, bal_i) => bal_same_json(bal_v, bal_b[bal_i]));
  }
  if (typeof bal_a === 'object' && bal_a !== null && typeof bal_b === 'object' && bal_b !== null) {
    const bal_ka = Object.keys(bal_a as Record<string, unknown>).sort();
    const bal_kb = Object.keys(bal_b as Record<string, unknown>).sort();
    if (!bal_same_json(bal_ka, bal_kb)) return false;
    return bal_ka.every((bal_k) =>
      bal_same_json((bal_a as Record<string, unknown>)[bal_k], (bal_b as Record<string, unknown>)[bal_k])
    );
  }
  return false;
}

function bal_item_semantics(bal_item: QuestionnaireItem): unknown {
  return {
    type: bal_item.type,
    variableName: bal_item.variableName,
    label: bal_item.label,
    required: bal_item.required,
    options: bal_item.options.map((bal_o) => ({ label: bal_o.label, coding: bal_o.coding })),
    coding: bal_item.coding,
    validation: bal_item.validation,
    scaleId: bal_item.scaleId === null ? null : 'SCALE',
    placeholder: bal_item.placeholder,
    heading: bal_item.heading,
    emphasis: bal_item.emphasis,
    rows: bal_item.rows.map((bal_r) => bal_r.label),
    columns: bal_item.columns.map((bal_c) => ({ label: bal_c.label, coding: bal_c.coding })),
    selectionMode: bal_item.selectionMode,
    consent: bal_item.consent,
    signature: bal_item.signature,
    unitLabel: bal_item.unitLabel
  };
}

function bal_read_source_key(bal_metadata: Record<string, unknown> | null): string | null {
  const bal_key = bal_metadata?.sourceKey;
  return typeof bal_key === 'string' && bal_key.length > 0 ? bal_key : null;
}

function bal_ast_options_to_choice(
  bal_options: bal_AstOption[],
  bal_previous: ChoiceOption[]
): ChoiceOption[] {
  const bal_unused_previous = [...bal_previous];
  return bal_options.map((bal_option) => {
    const bal_by_code = bal_option.code
      ? bal_unused_previous.find((bal_p) => bal_p.coding === bal_option.code)
      : undefined;
    const bal_match =
      bal_by_code ?? bal_unused_previous.find((bal_p) => bal_p.label === bal_option.label) ?? undefined;
    if (bal_match) {
      const bal_index = bal_unused_previous.indexOf(bal_match);
      bal_unused_previous.splice(bal_index, 1);
      return { ...bal_match, label: bal_option.label, coding: bal_option.code };
    }
    return { id: bal_new_id(), label: bal_option.label, coding: bal_option.code };
  });
}

function bal_match_rows(bal_rows: { key: string | null; label: string }[], bal_previous: MatrixRow[]): MatrixRow[] {
  const bal_unused = [...bal_previous];
  return bal_rows.map((bal_row) => {
    const bal_match = bal_unused.find((bal_p) => bal_p.label === bal_row.label);
    if (bal_match) {
      bal_unused.splice(bal_unused.indexOf(bal_match), 1);
      return { ...bal_match, label: bal_row.label };
    }
    return { id: bal_new_id(), label: bal_row.label };
  });
}

function bal_match_columns(bal_columns: bal_AstOption[], bal_previous: MatrixColumn[]): MatrixColumn[] {
  const bal_unused = [...bal_previous];
  return bal_columns.map((bal_column) => {
    const bal_match =
      bal_unused.find((bal_p) => bal_column.code !== null && bal_p.coding === bal_column.code) ??
      bal_unused.find((bal_p) => bal_p.label === bal_column.label);
    if (bal_match) {
      bal_unused.splice(bal_unused.indexOf(bal_match), 1);
      return { ...bal_match, label: bal_column.label, coding: bal_column.code };
    }
    return { id: bal_new_id(), label: bal_column.label, coding: bal_column.code };
  });
}

function bal_compiled_item(
  bal_item: bal_AstItem,
  bal_previous: QuestionnaireItem | null,
  bal_scale_id_by_name: Map<string, ResponseScaleRecord>
): QuestionnaireItem {
  const bal_type = BAL_HEAD_TO_TYPE[bal_item.head];
  const bal_id = bal_previous?.id ?? bal_new_id();
  const bal_metadata = { ...(bal_previous?.metadata ?? {}) };
  const bal_base: QuestionnaireItem = {
    id: bal_id,
    type: bal_type,
    variableName: bal_item.key ?? (bal_previous?.variableName ?? null),
    label: bal_item.label,
    required: bal_item.required,
    options: [],
    coding: bal_previous?.coding ?? null,
    validation: bal_previous?.validation ?? null,
    scannerConfig: bal_previous?.scannerConfig ?? null,
    printConfig: bal_previous?.printConfig ?? null,
    metadata: bal_metadata as Record<string, unknown>,
    scaleId: bal_previous?.scaleId ?? null,
    placeholder: bal_previous?.placeholder ?? null,
    heading: bal_previous?.heading ?? null,
    emphasis: bal_previous?.emphasis ?? 'normal',
    rows: [],
    columns: [],
    selectionMode: bal_item.multiplePerRow ? 'multiple' : (bal_previous?.selectionMode ?? 'single'),
    consent: bal_previous?.consent ?? null,
    signature: bal_previous?.signature ?? null,
    unitLabel: null
  };
  if (bal_item.key !== null && bal_read_source_key(bal_metadata as Record<string, unknown>) === null) {
    bal_metadata.sourceKey = bal_item.key;
  }
  switch (bal_type) {
    case 'instruction':
      bal_base.emphasis = bal_item.callout ? 'callout' : 'normal';
      break;
    case 'single_choice':
    case 'multiple_choice':
      if (bal_item.useScale) {
        bal_base.scaleId = bal_scale_id_by_name.get(bal_item.useScale)?.id ?? null;
        bal_base.options = [];
      } else {
        bal_base.options = bal_ast_options_to_choice(bal_item.options, bal_previous?.options ?? []);
      }
      bal_base.validation = {
        minSelections: bal_item.min,
        maxSelections: bal_item.max
      };
      break;
    case 'yes_no': {
      const bal_yes: ChoiceOption = {
        id: bal_previous?.options.find((bal_o) => bal_o.label === 'Yes')?.id ?? bal_new_id(),
        label: 'Yes',
        coding: bal_item.yesCode ?? '1'
      };
      const bal_no: ChoiceOption = {
        id: bal_previous?.options.find((bal_o) => bal_o.label === 'No')?.id ?? bal_new_id(),
        label: 'No',
        coding: bal_item.noCode ?? '0'
      };
      bal_base.options = [bal_yes, bal_no];
      break;
    }
    case 'short_text':
    case 'long_text':
      bal_base.validation = { maxLength: bal_item.maxlen };
      break;
    case 'number':
      bal_base.validation = { min: bal_item.min, max: bal_item.max, step: bal_item.step, decimalAllowed: true };
      bal_base.unitLabel = bal_item.unit;
      break;
    case 'likert_scale':
      if (bal_item.useScale) {
        bal_base.scaleId = bal_scale_id_by_name.get(bal_item.useScale)?.id ?? null;
        bal_base.options = [];
      } else {
        bal_base.options = bal_item.likertPoints.map((bal_point) => {
          const bal_match = bal_previous?.options.find((bal_o) => bal_o.coding === bal_point.code);
          return { id: bal_match?.id ?? bal_new_id(), label: bal_point.label, coding: bal_point.code };
        });
      }
      break;
    case 'matrix':
      if (bal_item.matrixScale) {
        bal_base.scaleId = bal_scale_id_by_name.get(bal_item.matrixScale)?.id ?? null;
        bal_base.columns = [];
      } else {
        bal_base.columns = bal_match_columns(bal_item.matrixColumns, bal_previous?.columns ?? []);
        bal_base.scaleId = null;
      }
      bal_base.rows = bal_match_rows(bal_item.rows, bal_previous?.rows ?? []);
      bal_base.validation = { requireAllRows: bal_previous?.validation?.requireAllRows ?? true };
      break;
    case 'consent':
      bal_base.consent = {
        title: bal_item.label,
        introduction: bal_item.consentIntroduction ?? '',
        sections: bal_item.consentSections.map((bal_section) => {
          const bal_existing = bal_previous?.consent?.sections.find(
            (bal_s) => bal_s.kind === bal_section.kind && bal_s.title === (bal_section.title ?? bal_consent_default_title(bal_section.kind))
          );
          return {
            id: bal_existing?.id ?? bal_new_id(),
            kind: bal_section.kind as ConsentSection['kind'],
            title: bal_section.title ?? bal_consent_default_title(bal_section.kind),
            body: bal_section.body
          };
        }),
        acknowledgementLabel:
          bal_item.acknowledgement ?? bal_previous?.consent?.acknowledgementLabel ?? 'I agree to participate.'
      };
      break;
    case 'participant_signature':
    case 'researcher_signature':
      bal_base.signature = {
        signerRole: bal_item.role ?? (bal_type === 'participant_signature' ? 'Participant' : 'Researcher'),
        includePrintedName: bal_item.printedName ?? true,
        includeDate: bal_item.date ?? true
      };
      break;
    default:
      break;
  }
  return bal_base;
}

function bal_expand_bulk(bal_doc: bal_AstDocument): { section: bal_AstSection | null; item: bal_AstItem }[] {
  const bal_expanded: { section: bal_AstSection | null; item: bal_AstItem }[] = [];
  const bal_from_section = (bal_section: bal_AstSection | null, bal_item: bal_AstItem): void => {
    if (bal_item.bulkItems.length === 0) {
      bal_expanded.push({ section: bal_section, item: bal_item });
      return;
    }
    for (const bal_entry of bal_item.bulkItems) {
      bal_expanded.push({
        section: bal_section,
        item: { ...bal_item, key: bal_entry.variableName, label: bal_entry.label, bulkItems: [] }
      });
    }
  };
  for (const bal_item of bal_doc.looseItems) bal_from_section(null, bal_item);
  for (const bal_section of bal_doc.sections) {
    for (const bal_inner_item of bal_section.items) bal_from_section(bal_section, bal_inner_item);
  }
  return bal_expanded;
}


export function bal_plan_apply(
  bal_doc: bal_AstDocument,
  bal_previous: QuestionnaireRecord | null,
  bal_existing_scales: ResponseScaleRecord[],
  bal_variables_with_data: Set<string> = new Set()
): bal_ApplyPlan {
  const bal_errors: string[] = [];
  for (const bal_section of bal_previous?.sections ?? []) {
    for (const bal_item of bal_section.items) {
      if (BAL_UNREPRESENTABLE.includes(bal_item.type)) {
        bal_errors.push(
          `The questionnaire contains a ${bal_item.type} question ("${bal_item.label}") that source v1 cannot express. Applying this source would remove it.`
        );
      }
    }
  }
  if (bal_errors.length > 0) return { ok: false, errors: bal_errors };

  const bal_scales: ResponseScaleRecord[] = [...bal_existing_scales];
  const bal_scale_id_by_name = new Map<string, ResponseScaleRecord>();
  for (const bal_ast_scale of bal_doc.scales) {
    const bal_existing = bal_scales.find((bal_s) => bal_s.name === bal_ast_scale.name);
    const bal_options = bal_ast_options_to_choice(
      bal_ast_scale.options,
      bal_existing?.options ?? []
    );
    if (bal_existing) {
      const bal_updated: ResponseScaleRecord = {
        ...bal_existing,
        options: bal_options,
        updatedAt: Date.now()
      };
      bal_scales[bal_scales.indexOf(bal_existing)] = bal_updated;
      bal_scale_id_by_name.set(bal_ast_scale.name, bal_updated);
    } else {
      const bal_created: ResponseScaleRecord = {
        id: bal_new_id(),
        name: bal_ast_scale.name,
        options: bal_options,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      bal_scales.push(bal_created);
      bal_scale_id_by_name.set(bal_ast_scale.name, bal_created);
    }
  }
  for (const bal_existing of bal_scales) {
    if (!bal_scale_id_by_name.has(bal_existing.name)) bal_scale_id_by_name.set(bal_existing.name, bal_existing);
  }

  const bal_previous_items: { section: QuestionnaireSection; item: QuestionnaireItem }[] = [];
  for (const bal_section of bal_previous?.sections ?? []) {
    for (const bal_item of bal_section.items) bal_previous_items.push({ section: bal_section, item: bal_item });
  }
  const bal_matched_previous = new Set<string>();
  const bal_matched_section = new Set<string>();

  const bal_changes: bal_ApplyChanges = {
    sectionsAdded: 0,
    sectionsRemoved: 0,
    itemsAdded: 0,
    itemsRemoved: 0,
    itemsModified: 0,
    variablesRenamed: [],
    variablesRemovedWithData: []
  };

  const bal_all_sections: bal_AstSection[] = [...bal_doc.sections];
  if (bal_doc.looseItems.length > 0) {
    bal_all_sections.unshift({
      key: 'general',
      title: 'General',
      line: 0,
      newPage: false,
      description: null,
      items: bal_doc.looseItems
    });
  }

  const bal_new_sections: QuestionnaireSection[] = [];
  const bal_expanded = bal_expand_bulk(bal_doc);
  const bal_expanded_by_section = new Map<string, bal_AstItem[]>();
  for (const bal_entry of bal_expanded) {
    const bal_key = bal_entry.section ? (bal_entry.section.key ?? bal_entry.section.title) : 'general';
    const bal_list = bal_expanded_by_section.get(bal_key) ?? [];
    bal_list.push(bal_entry.item);
    bal_expanded_by_section.set(bal_key, bal_list);
  }

  const bal_resolve_section = (bal_ast_section: bal_AstSection): QuestionnaireSection | null => {
    let bal_match: QuestionnaireSection | undefined;
    if (bal_ast_section.key) {
      bal_match = (bal_previous?.sections ?? []).find(
        (bal_s) => bal_read_source_key(bal_s.metadata) === bal_ast_section.key
      );
    }
    if (!bal_match) {
      bal_match = (bal_previous?.sections ?? []).find(
        (bal_s) => !bal_matched_section.has(bal_s.id) && bal_s.title === bal_ast_section.title
      );
    }
    return bal_match ?? null;
  };

  const bal_taken_variables = new Set<string>();
  for (const [, bal_items] of bal_expanded_by_section) {
    for (const bal_item of bal_items) if (bal_item.key) bal_taken_variables.add(bal_item.key);
  }

  const bal_build_section = (
    bal_ast_section: bal_AstSection,
    bal_match: QuestionnaireSection | null
  ): QuestionnaireSection => {
    const bal_metadata: Record<string, unknown> = { ...(bal_match?.metadata ?? {}) };
    if (bal_ast_section.key) bal_metadata.sourceKey = bal_ast_section.key;
    else if (typeof bal_metadata.sourceKey !== 'string') bal_metadata.sourceKey = bal_unique_slug(bal_slug_variable(bal_ast_section.title), new Set());
    const bal_items: QuestionnaireItem[] = [];
    for (const bal_ast_item of bal_expanded_by_section.get(bal_ast_section.key ?? bal_ast_section.title) ?? []) {
      let bal_previous_item: QuestionnaireItem | null = null;
      if (bal_ast_item.key) {
        bal_previous_item =
          bal_previous_items.find(
            (bal_e) => bal_read_source_key(bal_e.item.metadata) === bal_ast_item.key && !bal_matched_previous.has(bal_e.item.id)
          )?.item ?? null;
      }
      if (!bal_previous_item && bal_ast_item.key) {
        bal_previous_item =
          bal_previous_items.find(
            (bal_e) => bal_e.item.variableName === bal_ast_item.key && !bal_matched_previous.has(bal_e.item.id)
          )?.item ?? null;
      }
      if (!bal_previous_item && bal_ast_item.key) {
        const bal_wanted_type = BAL_HEAD_TO_TYPE[bal_ast_item.head];
        const bal_candidates = bal_previous_items.filter(
          (bal_e) => !bal_matched_previous.has(bal_e.item.id) && bal_e.item.type === bal_wanted_type
        );
        if (bal_candidates.length === 1) {
          bal_previous_item = bal_candidates[0].item;
        }
      }
      if (bal_previous_item) {
        bal_matched_previous.add(bal_previous_item.id);
        if (bal_previous_item.variableName && bal_ast_item.key && bal_previous_item.variableName !== bal_ast_item.key) {
          bal_changes.variablesRenamed.push({ from: bal_previous_item.variableName, to: bal_ast_item.key });
        }
      }
      const bal_compiled = bal_compiled_item(bal_ast_item, bal_previous_item, bal_scale_id_by_name);
      if (!bal_ast_item.key && bal_compiled.variableName === null) {
        bal_compiled.variableName = bal_unique_slug(bal_slug_variable(bal_ast_item.label), bal_taken_variables);
        bal_taken_variables.add(bal_compiled.variableName);
        bal_compiled.metadata = { ...bal_compiled.metadata, sourceKey: bal_compiled.variableName };
      }
      if (bal_compiled.variableName !== null) bal_taken_variables.add(bal_compiled.variableName);
      if (bal_previous_item) {
        if (!bal_same_json(bal_item_semantics(bal_previous_item), bal_item_semantics(bal_compiled))) {
          bal_changes.itemsModified += 1;
        }
      } else {
        bal_changes.itemsAdded += 1;
      }
      bal_items.push(bal_compiled);
    }
    return {
      id: bal_match?.id ?? bal_new_id(),
      type: 'section',
      title: bal_ast_section.title,
      description: bal_ast_section.description ?? bal_match?.description ?? null,
      items: bal_items,
      printConfig: bal_ast_section.newPage ? { pageBreakBefore: true } : (bal_match?.printConfig ?? null),
      metadata: bal_metadata
    };
  };

  for (const bal_ast_section of bal_all_sections) {
    const bal_match = bal_resolve_section(bal_ast_section);
    if (bal_match) bal_matched_section.add(bal_match.id);
    else bal_changes.sectionsAdded += 1;
    bal_new_sections.push(bal_build_section(bal_ast_section, bal_match));
  }

  for (const bal_previous_section of bal_previous?.sections ?? []) {
    if (!bal_matched_section.has(bal_previous_section.id)) {
      bal_changes.sectionsRemoved += 1;
      bal_changes.itemsRemoved += bal_previous_section.items.length;
      for (const bal_item of bal_previous_section.items) {
        if (bal_item.variableName && bal_variables_with_data.has(bal_item.variableName)) {
          bal_changes.variablesRemovedWithData.push(bal_item.variableName);
        }
      }
    }
  }
  for (const bal_entry of bal_previous_items) {
    if (!bal_matched_previous.has(bal_entry.item.id)) {
      const bal_still_in_matched_section = bal_new_sections.find(
        (bal_s) => bal_s.id === bal_entry.section.id
      );
      if (!bal_still_in_matched_section || !bal_still_in_matched_section.items.some((bal_i) => bal_i.id === bal_entry.item.id)) {
        bal_changes.itemsRemoved += 1;
        if (bal_entry.item.variableName && bal_variables_with_data.has(bal_entry.item.variableName)) {
          bal_changes.variablesRemovedWithData.push(bal_entry.item.variableName);
        }
      }
    }
  }

  const bal_questionnaire: QuestionnaireRecord = {
    id: bal_previous?.id ?? bal_new_id(),
    projectId: bal_previous?.projectId ?? '',
    title: bal_doc.meta.title ?? bal_previous?.title ?? 'Untitled questionnaire',
    description: bal_doc.meta.description ?? bal_previous?.description ?? null,
    version: bal_previous?.version ?? 1,
    language: bal_doc.meta.language ?? bal_previous?.language ?? 'en',
    paperSize: bal_doc.meta.paper ?? bal_previous?.paperSize ?? 'a4',
    orientation: bal_doc.meta.orientation ?? bal_previous?.orientation ?? 'portrait',
    theme: bal_previous?.theme ?? null,
    status: bal_previous?.status ?? 'draft',
    metadata: bal_previous?.metadata ?? null,
    printSettings: bal_previous?.printSettings ?? null,
    sections: bal_new_sections,
    createdAt: bal_previous?.createdAt ?? Date.now(),
    updatedAt: Date.now()
  };

  return { ok: true, questionnaire: bal_questionnaire, scales: bal_scales, changes: bal_changes, skipped: [] };
}
