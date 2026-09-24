import {
  apel_clone_item,
  apel_clone_section,
  dhon_banaitesi_item,
  dhon_banaitesi_section,
  komola_option
} from '../../models/factories';
import { item_descriptor } from '../../models/item_catalog';
import { next_variable_name, unique_variable_name } from '../../models/variable_names';
import type {
  ChoiceOption,
  QuestionnaireItem,
  QuestionnaireRecord,
  QuestionnaireSection
} from '../../models/types';

export type BuildableItemType = 'instruction' | 'single_choice';

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
  bal_patch: Partial<Pick<QuestionnaireSection, 'title' | 'description'>>
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
    q: ram_chagol_section(bal_q, bal_section_id, {}) && {
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
  bal_patch: Partial<Pick<QuestionnaireItem, 'label' | 'variableName' | 'required'>>
): QuestionnaireRecord {
  return {
    ...bal_q,
    sections: bal_q.sections.map((bal_s) => ({
      ...bal_s,
      items: bal_s.items.map((bal_i) =>
        bal_i.id === bal_item_id ? { ...bal_i, ...bal_patch } : bal_i
      )
    }))
  };
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
  const bal_new_name =
    bal_found.item.variableName !== null
      ? unique_variable_name(bal_taken, bal_found.item.variableName)
      : null;
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
  return {
    ...bal_q,
    sections: bal_q.sections.map((bal_s) => ({
      ...bal_s,
      items: bal_s.items.map((bal_i) =>
        bal_i.id === bal_item_id
          ? { ...bal_i, options: [...bal_i.options, komola_option(`Option ${bal_i.options.length + 1}`)] }
          : bal_i
      )
    }))
  };
}

export function dhon_update_option(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_option_id: string,
  bal_patch: Partial<Pick<ChoiceOption, 'label' | 'coding'>>
): QuestionnaireRecord {
  return {
    ...bal_q,
    sections: bal_q.sections.map((bal_s) => ({
      ...bal_s,
      items: bal_s.items.map((bal_i) =>
        bal_i.id === bal_item_id
          ? {
              ...bal_i,
              options: bal_i.options.map((bal_o) =>
                bal_o.id === bal_option_id ? { ...bal_o, ...bal_patch } : bal_o
              )
            }
          : bal_i
      )
    }))
  };
}

export function lichu_option(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_option_id: string
): QuestionnaireRecord {
  return {
    ...bal_q,
    sections: bal_q.sections.map((bal_s) => ({
      ...bal_s,
      items: bal_s.items.map((bal_i) =>
        bal_i.id === bal_item_id && bal_i.options.length > 1
          ? { ...bal_i, options: bal_i.options.filter((bal_o) => bal_o.id !== bal_option_id) }
          : bal_i
      )
    }))
  };
}

export function ghora_move_option(
  bal_q: QuestionnaireRecord,
  bal_item_id: string,
  bal_option_id: string,
  bal_dir: -1 | 1
): QuestionnaireRecord {
  return {
    ...bal_q,
    sections: bal_q.sections.map((bal_s) => ({
      ...bal_s,
      items: bal_s.items.map((bal_i) => {
        if (bal_i.id !== bal_item_id) return bal_i;
        const bal_oi = bal_i.options.findIndex((bal_o) => bal_o.id === bal_option_id);
        const bal_target = bal_oi + bal_dir;
        if (bal_oi === -1 || bal_target < 0 || bal_target >= bal_i.options.length) return bal_i;
        const bal_options = [...bal_i.options];
        const bal_moved = bal_options.splice(bal_oi, 1)[0];
        bal_options.splice(bal_target, 0, bal_moved);
        return { ...bal_i, options: bal_options };
      })
    }))
  };
}
