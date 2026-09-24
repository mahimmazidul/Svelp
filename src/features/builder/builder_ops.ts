import {
  apel_clone_item,
  apel_clone_option,
  apel_clone_section,
  dhon_banaitesi_item,
  dhon_banaitesi_section,
  dhon_consent_section,
  dhon_likert_points,
  dhon_matrix_column,
  dhon_matrix_row,
  komola_option
} from '../../models/factories';
import { item_descriptor } from '../../models/item_catalog';
import {
  next_variable_name,
  suggest_variable_name,
  unique_variable_name
} from '../../models/variable_names';
import type {
  ChoiceOption,
  ConsentConfig,
  ConsentSectionKind,
  ItemTypeName,
  MatrixSelectionMode,
  QuestionnaireItem,
  QuestionnaireRecord,
  QuestionnaireSection,
  SignatureConfig
} from '../../models/types';

export type BuildableItemType = ItemTypeName;

export interface SectionRef {
  section: QuestionnaireSection;
  index: number;
}

export interface ItemRef {
  section: QuestionnaireSection;
  sectionIndex: number;
  itemIndex: number;
  item: QuestionnaireItem;
}

export type ItemPatch = Partial<Omit<QuestionnaireItem, 'id' | 'type'>>;

export function vorki_find_section(
  bal_q: QuestionnaireRecord,
  bal_section_id: string
): SectionRef | null {
  const bal_index = bal_q.sections.findIndex((bal_s) => bal_s.id === bal_section_id);
  if (bal_index === -1) return null;
  return { section: bal_q.sections[bal_index], index: bal_index };
}

export function apel_find_item(
  bal_q: QuestionnaireRecord,
  bal_item_id: string
): ItemRef | null {
  for (let bal_si = 0; bal_si < bal_q.sections.length; bal_si++) {
    const bal_section = bal_q.sections[bal_si];
    const bal_ii = bal_section.items.findIndex((bal_i) => bal_i.id === bal_item_id);
    if (bal_ii !== -1) {
      return {
        section: bal_section,
        sectionIndex: bal_si,
        itemIndex: bal_ii,
        item: bal_section.items[bal_ii]
      };
    }
  }
  return null;
}

export function bal_taken_variable_names(bal_q: QuestionnaireRecord): string[] {
  const bal_names: string[] = [];
  for (const bal_section of bal_q.sections) {
    for (const bal_item of bal_section.items) {
      if (bal_item.variableName) bal_names.push(bal_item.variableName);
    }
  }
  return bal_names;
}

export function bal_map_item(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_fn: (bal_item: QuestionnaireItem) => QuestionnaireItem
): QuestionnaireRecord {
  return {
    ...bal_q,
    sections: bal_q.sections.map((bal_s) => ({
      ...bal_s,
      items: bal_s.items.map((bal_i) => (bal_i.id === bal_item_id ? bal_fn(bal_i) : bal_i))
    }))
  };
}

export function ghora_add_section(
  bal_q: QuestionnaireRecord,
  bal_title: string
): { q: QuestionnaireRecord; sectionId: string } {
  const bal_section = dhon_banaitesi_section(bal_title);
  return {
    q: { ...bal_q, sections: [...bal_q.sections, bal_section] },
    sectionId: bal_section.id
  };
}

export function ram_chagol_section(
  bal_q: QuestionnaireRecord,
  bal_section_id: string,
  bal_patch: Partial<Pick<QuestionnaireSection, 'title' | 'description' | 'printConfig'>>
): QuestionnaireRecord {
  return {
    ...bal_q,
    sections: bal_q.sections.map((bal_s) =>
      bal_s.id === bal_section_id ? { ...bal_s, ...bal_patch } : bal_s
    )
  };
}

export function ghora_move_section(
  bal_q: QuestionnaireRecord,
  bal_section_id: string,
  bal_dir: -1 | 1
): QuestionnaireRecord {
  const bal_found = vorki_find_section(bal_q, bal_section_id);
  if (!bal_found) return bal_q;
  const bal_target = bal_found.index + bal_dir;
  if (bal_target < 0 || bal_target >= bal_q.sections.length) return bal_q;
  const bal_sections = [...bal_q.sections];
  const bal_moved = bal_sections.splice(bal_found.index, 1)[0];
  bal_sections.splice(bal_target, 0, bal_moved);
  return { ...bal_q, sections: bal_sections };
}

export function malta_section(
  bal_q: QuestionnaireRecord,
  bal_section_id: string
): { q: QuestionnaireRecord; sectionId: string } {
  const bal_found = vorki_find_section(bal_q, bal_section_id);
  if (!bal_found) return { q: bal_q, sectionId: bal_section_id };
  const bal_clone = apel_clone_section(bal_found.section);
  const bal_sections = [...bal_q.sections];
  bal_sections.splice(bal_found.index + 1, 0, bal_clone);
  return { q: { ...bal_q, sections: bal_sections }, sectionId: bal_clone.id };
}

export function lichu_section(
  bal_q: QuestionnaireRecord,
  bal_section_id: string
): QuestionnaireRecord {
  return { ...bal_q, sections: bal_q.sections.filter((bal_s) => bal_s.id !== bal_section_id) };
}

export function bal_add_item(
  bal_q: QuestionnaireRecord,
  bal_section_id: string,
  bal_type: BuildableItemType,
  bal_after_item_id?: string | null
): { q: QuestionnaireRecord; itemId: string | null } {
  const bal_found = vorki_find_section(bal_q, bal_section_id);
  if (!bal_found) return { q: bal_q, itemId: null };
  const bal_descriptor = item_descriptor(bal_type);
  let bal_variable_name: string | null = null;
  if (bal_descriptor.usesVariableName) {
    bal_variable_name = next_variable_name(bal_taken_variable_names(bal_q));
  }
  const bal_item = dhon_banaitesi_item(bal_type, bal_variable_name);
  const bal_items = [...bal_found.section.items];
  const bal_at = bal_after_item_id
    ? bal_items.findIndex((bal_i) => bal_i.id === bal_after_item_id)
    : -1;
  if (bal_at === -1) {
    bal_items.push(bal_item);
  } else {
    bal_items.splice(bal_at + 1, 0, bal_item);
  }
  return {
    q: {
      ...bal_q,
      sections: bal_q.sections.map((bal_s) =>
        bal_s.id === bal_section_id ? { ...bal_s, items: bal_items } : bal_s
      )
    },
    itemId: bal_item.id
  };
}

export function dhon_update_item(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_patch: ItemPatch
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => ({ ...bal_i, ...bal_patch }));
}

export function lichu_item(
  bal_q: QuestionnaireRecord,
  bal_item_id: string
): QuestionnaireRecord {
  return {
    ...bal_q,
    sections: bal_q.sections.map((bal_s) => ({
      ...bal_s,
      items: bal_s.items.filter((bal_i) => bal_i.id !== bal_item_id)
    }))
  };
}

export function malta_item(
  bal_q: QuestionnaireRecord,
  bal_item_id: string
): { q: QuestionnaireRecord; itemId: string | null } {
  const bal_found = apel_find_item(bal_q, bal_item_id);
  if (!bal_found) return { q: bal_q, itemId: null };
  const bal_taken = bal_taken_variable_names(bal_q);
  let bal_new_name: string | null;
  if (bal_found.item.variableName !== null) {
    bal_new_name = unique_variable_name(bal_taken, bal_found.item.variableName);
  } else {
    const bal_suggestion = suggest_variable_name(bal_found.item.label);
    bal_new_name =
      bal_suggestion !== '' ? unique_variable_name(bal_taken, bal_suggestion) : null;
  }
  const bal_clone = apel_clone_item(bal_found.item, bal_new_name ?? undefined);
  const bal_items = [...bal_found.section.items];
  bal_items.splice(bal_found.itemIndex + 1, 0, bal_clone);
  return {
    q: {
      ...bal_q,
      sections: bal_q.sections.map((bal_s) =>
        bal_s.id === bal_found.section.id ? { ...bal_s, items: bal_items } : bal_s
      )
    },
    itemId: bal_clone.id
  };
}

export function ghora_move_item(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_dir: -1 | 1
): QuestionnaireRecord {
  const bal_found = apel_find_item(bal_q, bal_item_id);
  if (!bal_found) return bal_q;
  const bal_target_index = bal_found.itemIndex + bal_dir;
  if (bal_target_index >= 0 && bal_target_index < bal_found.section.items.length) {
    return {
      ...bal_q,
      sections: bal_q.sections.map((bal_s) => {
        if (bal_s.id !== bal_found.section.id) return bal_s;
        const bal_items = [...bal_s.items];
        const bal_moved = bal_items.splice(bal_found.itemIndex, 1)[0];
        bal_items.splice(bal_target_index, 0, bal_moved);
        return { ...bal_s, items: bal_items };
      })
    };
  }
  const bal_neighbor_index = bal_found.sectionIndex + bal_dir;
  if (bal_neighbor_index < 0 || bal_neighbor_index >= bal_q.sections.length) return bal_q;
  const bal_sections = bal_q.sections.map((bal_s) =>
    bal_s.id === bal_found.section.id
      ? { ...bal_s, items: bal_s.items.filter((bal_i) => bal_i.id !== bal_item_id) }
      : bal_s
  );
  const bal_moved_item = bal_found.item;
  return {
    ...bal_q,
    sections: bal_sections.map((bal_s, bal_i) => {
      if (bal_i !== bal_neighbor_index) return bal_s;
      const bal_items = [...bal_s.items];
      if (bal_dir === -1) {
        bal_items.push(bal_moved_item);
      } else {
        bal_items.unshift(bal_moved_item);
      }
      return { ...bal_s, items: bal_items };
    })
  };
}

export function komola_add_option(
  bal_q: QuestionnaireRecord,
  bal_item_id: string
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => ({
    ...bal_i,
    options: [...bal_i.options, komola_option(`Option ${bal_i.options.length + 1}`)]
  }));
}

export function dhon_update_option(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_option_id: string,
  bal_patch: Partial<Pick<ChoiceOption, 'label' | 'coding'>>
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => ({
    ...bal_i,
    options: bal_i.options.map((bal_o) =>
      bal_o.id === bal_option_id ? { ...bal_o, ...bal_patch } : bal_o
    )
  }));
}

export function lichu_option(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_option_id: string
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) =>
    bal_i.options.length > 1
      ? { ...bal_i, options: bal_i.options.filter((bal_o) => bal_o.id !== bal_option_id) }
      : bal_i
  );
}

export function ghora_move_option(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_option_id: string,
  bal_dir: -1 | 1
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => {
    const bal_oi = bal_i.options.findIndex((bal_o) => bal_o.id === bal_option_id);
    const bal_target = bal_oi + bal_dir;
    if (bal_oi === -1 || bal_target < 0 || bal_target >= bal_i.options.length) return bal_i;
    const bal_options = [...bal_i.options];
    const bal_moved = bal_options.splice(bal_oi, 1)[0];
    bal_options.splice(bal_target, 0, bal_moved);
    return { ...bal_i, options: bal_options };
  });
}

export function dhon_set_likert_points(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_count: number
): QuestionnaireRecord {
  const bal_clamped = Math.max(2, Math.min(10, Math.round(bal_count)));
  return bal_map_item(bal_q, bal_item_id, (bal_i) => ({
    ...bal_i,
    options: dhon_likert_points(bal_clamped)
  }));
}

export function komola_assign_scale(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_scale_id: string
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => ({
    ...bal_i,
    scaleId: bal_scale_id,
    options: []
  }));
}

export function komola_detach_scale(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_scale_options: ChoiceOption[]
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => ({
    ...bal_i,
    scaleId: null,
    options: bal_scale_options.map(apel_clone_option)
  }));
}

export function ghora_add_matrix_row(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_label?: string
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => ({
    ...bal_i,
    rows: [...bal_i.rows, dhon_matrix_row(bal_label ?? '')]
  }));
}

export function bal_paste_matrix_rows(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_labels: string[]
): QuestionnaireRecord {
  if (bal_labels.length === 0) return bal_q;
  return bal_map_item(bal_q, bal_item_id, (bal_i) => ({
    ...bal_i,
    rows: [...bal_i.rows, ...bal_labels.map(dhon_matrix_row)]
  }));
}

export function ram_chagol_matrix_row(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_row_id: string,
  bal_label: string
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => ({
    ...bal_i,
    rows: bal_i.rows.map((bal_r) => (bal_r.id === bal_row_id ? { ...bal_r, label: bal_label } : bal_r))
  }));
}

export function lichu_matrix_row(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_row_id: string
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => ({
    ...bal_i,
    rows: bal_i.rows.filter((bal_r) => bal_r.id !== bal_row_id)
  }));
}

export function ghora_move_matrix_row(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_row_id: string,
  bal_dir: -1 | 1
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => {
    const bal_ri = bal_i.rows.findIndex((bal_r) => bal_r.id === bal_row_id);
    const bal_target = bal_ri + bal_dir;
    if (bal_ri === -1 || bal_target < 0 || bal_target >= bal_i.rows.length) return bal_i;
    const bal_rows = [...bal_i.rows];
    const bal_moved = bal_rows.splice(bal_ri, 1)[0];
    bal_rows.splice(bal_target, 0, bal_moved);
    return { ...bal_i, rows: bal_rows };
  });
}

export function ghora_add_matrix_column(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_label?: string
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => ({
    ...bal_i,
    columns: [...bal_i.columns, dhon_matrix_column(bal_label ?? '')]
  }));
}

export function bal_paste_matrix_columns(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_labels: string[]
): QuestionnaireRecord {
  if (bal_labels.length === 0) return bal_q;
  return bal_map_item(bal_q, bal_item_id, (bal_i) => ({
    ...bal_i,
    scaleId: null,
    columns: [...bal_i.columns, ...bal_labels.map(dhon_matrix_column)]
  }));
}

export function ram_chagol_matrix_column(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_column_id: string,
  bal_patch: Partial<Pick<ChoiceOption, 'label' | 'coding'>>
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => ({
    ...bal_i,
    columns: bal_i.columns.map((bal_c) =>
      bal_c.id === bal_column_id ? { ...bal_c, ...bal_patch } : bal_c
    )
  }));
}

export function lichu_matrix_column(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_column_id: string
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) =>
    bal_i.columns.length > 1
      ? { ...bal_i, columns: bal_i.columns.filter((bal_c) => bal_c.id !== bal_column_id) }
      : bal_i
  );
}

export function ghora_move_matrix_column(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_column_id: string,
  bal_dir: -1 | 1
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => {
    const bal_ci = bal_i.columns.findIndex((bal_c) => bal_c.id === bal_column_id);
    const bal_target = bal_ci + bal_dir;
    if (bal_ci === -1 || bal_target < 0 || bal_target >= bal_i.columns.length) return bal_i;
    const bal_columns = [...bal_i.columns];
    const bal_moved = bal_columns.splice(bal_ci, 1)[0];
    bal_columns.splice(bal_target, 0, bal_moved);
    return { ...bal_i, columns: bal_columns };
  });
}

export function ram_chagol_selection_mode(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_mode: MatrixSelectionMode
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => ({
    ...bal_i,
    selectionMode: bal_mode
  }));
}

export function ram_chagol_consent(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_patch: Partial<Omit<ConsentConfig, 'sections'>>
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => ({
    ...bal_i,
    consent: bal_i.consent ? { ...bal_i.consent, ...bal_patch } : bal_i.consent
  }));
}

export function ghora_add_consent_section(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_kind: ConsentSectionKind
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) =>
    bal_i.consent
      ? { ...bal_i, consent: { ...bal_i.consent, sections: [...bal_i.consent.sections, dhon_consent_section(bal_kind)] } }
      : bal_i
  );
}

export function ram_chagol_consent_section(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_section_id: string,
  bal_patch: Partial<Pick<{ id: string; kind: ConsentSectionKind; title: string; body: string }, 'title' | 'body'>>
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) =>
    bal_i.consent
      ? {
          ...bal_i,
          consent: {
            ...bal_i.consent,
            sections: bal_i.consent.sections.map((bal_s) =>
              bal_s.id === bal_section_id ? { ...bal_s, ...bal_patch } : bal_s
            )
          }
        }
      : bal_i
  );
}

export function lichu_consent_section(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_consent_section_id: string
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) =>
    bal_i.consent
      ? {
          ...bal_i,
          consent: {
            ...bal_i.consent,
            sections: bal_i.consent.sections.filter(
              (bal_s) => bal_s.id !== bal_consent_section_id
            )
          }
        }
      : bal_i
  );
}

export function ghora_move_consent_section(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_consent_section_id: string,
  bal_dir: -1 | 1
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) => {
    if (!bal_i.consent) return bal_i;
    const bal_si = bal_i.consent.sections.findIndex(
      (bal_s) => bal_s.id === bal_consent_section_id
    );
    const bal_target = bal_si + bal_dir;
    if (bal_si === -1 || bal_target < 0 || bal_target >= bal_i.consent.sections.length) {
      return bal_i;
    }
    const bal_sections = [...bal_i.consent.sections];
    const bal_moved = bal_sections.splice(bal_si, 1)[0];
    bal_sections.splice(bal_target, 0, bal_moved);
    return { ...bal_i, consent: { ...bal_i.consent, sections: bal_sections } };
  });
}

export function ram_chagol_signature(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_patch: Partial<SignatureConfig>
): QuestionnaireRecord {
  return bal_map_item(bal_q, bal_item_id, (bal_i) =>
    bal_i.signature ? { ...bal_i, signature: { ...bal_i.signature, ...bal_patch } } : bal_i
  );
}

export interface BulkQuestionPlanEntry {
  label: string;
  variableName: string;
}

export function bal_plan_bulk_questions(
  bal_q: QuestionnaireRecord,
  bal_labels: string[]
): BulkQuestionPlanEntry[] {
  const bal_taken = bal_taken_variable_names(bal_q);
  const bal_plan: BulkQuestionPlanEntry[] = [];
  for (const bal_label of bal_labels) {
    const bal_suggestion = suggest_variable_name(bal_label);
    const bal_base = bal_suggestion !== '' ? bal_suggestion : '';
    const bal_name =
      bal_base !== '' ? unique_variable_name(bal_taken, bal_base) : next_variable_name(bal_taken);
    bal_taken.push(bal_name);
    bal_plan.push({ label: bal_label, variableName: bal_name });
  }
  return bal_plan;
}

export function bal_banaitesi_bulk_questions(
  bal_q: QuestionnaireRecord,
  bal_section_id: string,
  bal_type: Extract<ItemTypeName, 'single_choice' | 'multiple_choice'>,
  bal_entries: BulkQuestionPlanEntry[],
  bal_scale_id: string | null
): { q: QuestionnaireRecord; itemIds: string[] } {
  const bal_found = vorki_find_section(bal_q, bal_section_id);
  if (!bal_found) return { q: bal_q, itemIds: [] };
  const bal_new_items: QuestionnaireItem[] = bal_entries.map((bal_entry) => {
    const bal_item = dhon_banaitesi_item(bal_type, bal_entry.variableName);
    bal_item.label = bal_entry.label;
    if (bal_scale_id) {
      bal_item.scaleId = bal_scale_id;
      bal_item.options = [];
    }
    return bal_item;
  });
  return {
    q: {
      ...bal_q,
      sections: bal_q.sections.map((bal_s) =>
        bal_s.id === bal_section_id
          ? { ...bal_s, items: [...bal_s.items, ...bal_new_items] }
          : bal_s
      )
    },
    itemIds: bal_new_items.map((bal_i) => bal_i.id)
  };
}

export function suggest_label_variable(bal_item: QuestionnaireItem): string {
  if (bal_item.label.trim() !== '') return bal_item.label;
  if (bal_item.type === 'instruction') {
    return (bal_item.heading ?? '').trim() !== '' ? (bal_item.heading as string) : 'Instruction';
  }
  return `Untitled ${item_descriptor(bal_item.type).label.toLowerCase()}`;
}

export function bal_split_paste_lines(bal_text: string): string[] {
  return bal_text
    .split(/\r\n|\r|\n/)
    .map((bal_line) => bal_line.trim())
    .filter((bal_line) => bal_line !== '');
}
