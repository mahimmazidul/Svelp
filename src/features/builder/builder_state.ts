import { get, writable } from 'svelte/store';
import {
  bal_save_questionnaire,
  dhon_questionnaire_by_project
} from '../../db/questionnaires_repo';
import type { ChoiceOption, QuestionnaireRecord } from '../../models/types';
import { vorki_debounce } from '../../utils/debounce';
import {
  apel_find_item,
  bal_add_item,
  bal_taken_variable_names,
  ghora_add_section,
  ghora_move_item,
  ghora_move_option,
  ghora_move_section,
  komola_add_option,
  lichu_item,
  lichu_option,
  lichu_section,
  malta_item,
  malta_section,
  ram_chagol_section,
  dhon_update_item,
  dhon_update_option,
  type BuildableItemType
} from './builder_ops';

export type BuilderStatus = 'empty' | 'loading' | 'ready' | 'missing' | 'error';
export type BuilderSaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

export interface BuilderState {
  status: BuilderStatus;
  questionnaire: QuestionnaireRecord | null;
  selectedSectionId: string | null;
  selectedItemId: string | null;
  saveStatus: BuilderSaveStatus;
}

const BAL_EMPTY: BuilderState = {
  status: 'empty',
  questionnaire: null,
  selectedSectionId: null,
  selectedItemId: null,
  saveStatus: 'saved'
};

const heda_state = writable<BuilderState>(BAL_EMPTY);

let bal_loaded_project_id: string | null = null;

async function bal_flush_save(): Promise<void> {
  const bal_snapshot = get(heda_state);
  if (bal_snapshot.status !== 'ready' || !bal_snapshot.questionnaire) return;
  if (bal_snapshot.saveStatus === 'saved' || bal_snapshot.saveStatus === 'saving') return;
  heda_state.update((bal_s) => ({ ...bal_s, saveStatus: 'saving' }));
  try {
    const bal_next = { ...bal_snapshot.questionnaire, updatedAt: Date.now() };
    await bal_save_questionnaire(bal_next);
    heda_state.update((bal_s) =>
      bal_s.questionnaire && bal_s.questionnaire.id === bal_next.id
        ? { ...bal_s, questionnaire: bal_next, saveStatus: 'saved' }
        : bal_s
    );
  } catch {
    heda_state.update((bal_s) => ({ ...bal_s, saveStatus: 'error' }));
  }
}

const bal_schedule_save = vorki_debounce(() => {
  void bal_flush_save();
}, 600);

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    void bal_flush_save();
  });
}

function bal_mutate(
  bal_fn: (bal_q: QuestionnaireRecord) => QuestionnaireRecord
): void {
  heda_state.update((bal_s) => {
    if (bal_s.status !== 'ready' || !bal_s.questionnaire) return bal_s;
    const bal_next = bal_fn(bal_s.questionnaire);
    return { ...bal_s, questionnaire: bal_next, saveStatus: 'dirty' };
  });
  bal_schedule_save();
}

function bal_reset(bal_status: BuilderStatus): void {
  heda_state.set({ ...BAL_EMPTY, status: bal_status });
}

async function bal_load(bal_project_id: string): Promise<void> {
  if (bal_loaded_project_id === bal_project_id) return;
  bal_loaded_project_id = bal_project_id;
  bal_reset('loading');
  try {
    const bal_q = await dhon_questionnaire_by_project(bal_project_id);
    if (!bal_q) {
      bal_reset('missing');
      return;
    }
    heda_state.set({
      status: 'ready',
      questionnaire: bal_q,
      selectedSectionId: bal_q.sections[0]?.id ?? null,
      selectedItemId: null,
      saveStatus: 'saved'
    });
  } catch {
    bal_reset('error');
  }
}

function bal_reload(bal_project_id: string): Promise<void> {
  bal_loaded_project_id = null;
  return bal_load(bal_project_id);
}

function bal_select_section(bal_section_id: string): void {
  heda_state.update((bal_s) => ({
    ...bal_s,
    selectedSectionId: bal_section_id,
    selectedItemId: null
  }));
}

function bal_select_item(bal_item_id: string): void {
  heda_state.update((bal_s) => {
    if (!bal_s.questionnaire) return bal_s;
    const bal_found = apel_find_item(bal_s.questionnaire, bal_item_id);
    if (!bal_found) return bal_s;
    return { ...bal_s, selectedSectionId: bal_found.section.id, selectedItemId: bal_item_id };
  });
}

function bal_add_section(): void {
  let bal_new_id: string | null = null;
  heda_state.update((bal_s) => {
    if (bal_s.status !== 'ready' || !bal_s.questionnaire) return bal_s;
    const bal_result = ghora_add_section(
      bal_s.questionnaire,
      `Section ${bal_s.questionnaire.sections.length + 1}`
    );
    bal_new_id = bal_result.sectionId;
    return {
      ...bal_s,
      questionnaire: bal_result.q,
      selectedSectionId: bal_result.sectionId,
      selectedItemId: null,
      saveStatus: 'dirty'
    };
  });
  if (bal_new_id !== null) bal_schedule_save();
}

function bal_add_item_action(
  bal_type: BuildableItemType,
  bal_section_id?: string | null
): void {
  let bal_new_item_id: string | null = null;
  let bal_target_section: string | null = null;
  heda_state.update((bal_s) => {
    if (bal_s.status !== 'ready' || !bal_s.questionnaire) return bal_s;
    let bal_q = bal_s.questionnaire;
    let bal_target =
      bal_section_id ?? bal_s.selectedSectionId ?? bal_q.sections[bal_q.sections.length - 1]?.id ?? null;
    if (!bal_target) {
      const bal_result = ghora_add_section(bal_q, 'Section 1');
      bal_q = bal_result.q;
      bal_target = bal_result.sectionId;
    }
    const bal_after =
      bal_s.selectedItemId &&
      apel_find_item(bal_q, bal_s.selectedItemId)?.section.id === bal_target
        ? bal_s.selectedItemId
        : null;
    const bal_result = bal_add_item(bal_q, bal_target, bal_type, bal_after);
    if (!bal_result.itemId) return bal_s;
    bal_new_item_id = bal_result.itemId;
    bal_target_section = bal_target;
    return {
      ...bal_s,
      questionnaire: bal_result.q,
      selectedSectionId: bal_target,
      selectedItemId: bal_result.itemId,
      saveStatus: 'dirty'
    };
  });
  if (bal_new_item_id !== null && bal_target_section !== null) bal_schedule_save();
}

function bal_delete_item(bal_item_id: string): void {
  bal_mutate((bal_q) => lichu_item(bal_q, bal_item_id));
  heda_state.update((bal_s) => ({ ...bal_s, selectedItemId: null }));
}

function bal_duplicate_item(bal_item_id: string): void {
  let bal_new_id: string | null = null;
  heda_state.update((bal_s) => {
    if (bal_s.status !== 'ready' || !bal_s.questionnaire) return bal_s;
    const bal_result = malta_item(bal_s.questionnaire, bal_item_id);
    if (!bal_result.itemId) return bal_s;
    bal_new_id = bal_result.itemId;
    const bal_found = apel_find_item(bal_result.q, bal_result.itemId);
    return {
      ...bal_s,
      questionnaire: bal_result.q,
      selectedSectionId: bal_found?.section.id ?? bal_s.selectedSectionId,
      selectedItemId: bal_result.itemId,
      saveStatus: 'dirty'
    };
  });
  if (bal_new_id !== null) bal_schedule_save();
}

function bal_delete_section(bal_section_id: string): void {
  bal_mutate((bal_q) => lichu_section(bal_q, bal_section_id));
  heda_state.update((bal_s) => {
    if (!bal_s.questionnaire) return { ...bal_s, selectedSectionId: null, selectedItemId: null };
    const bal_first = bal_s.questionnaire.sections[0]?.id ?? null;
    return { ...bal_s, selectedSectionId: bal_first, selectedItemId: null };
  });
}

function bal_duplicate_section(bal_section_id: string): void {
  let bal_new_id: string | null = null;
  heda_state.update((bal_s) => {
    if (bal_s.status !== 'ready' || !bal_s.questionnaire) return bal_s;
    const bal_result = malta_section(bal_s.questionnaire, bal_section_id);
    bal_new_id = bal_result.sectionId;
    return {
      ...bal_s,
      questionnaire: bal_result.q,
      selectedSectionId: bal_result.sectionId,
      selectedItemId: null,
      saveStatus: 'dirty'
    };
  });
  if (bal_new_id !== null) bal_schedule_save();
}

export const builder_state = {
  subscribe: heda_state.subscribe,
  load: bal_load,
  reload: bal_reload,
  flush: bal_flush_save,
  select_section: bal_select_section,
  select_item: bal_select_item,
  add_section: bal_add_section,
  add_item: bal_add_item_action,
  update_item: (bal_item_id: string, bal_patch: Parameters<typeof dhon_update_item>[2]): void =>
    bal_mutate((bal_q) => dhon_update_item(bal_q, bal_item_id, bal_patch)),
  delete_item: bal_delete_item,
  duplicate_item: bal_duplicate_item,
  move_item: (bal_item_id: string, bal_dir: -1 | 1): void =>
    bal_mutate((bal_q) => ghora_move_item(bal_q, bal_item_id, bal_dir)),
  update_section: (
    bal_section_id: string,
    bal_patch: Parameters<typeof ram_chagol_section>[2]
  ): void => bal_mutate((bal_q) => ram_chagol_section(bal_q, bal_section_id, bal_patch)),
  delete_section: bal_delete_section,
  duplicate_section: bal_duplicate_section,
  move_section: (bal_section_id: string, bal_dir: -1 | 1): void =>
    bal_mutate((bal_q) => ghora_move_section(bal_q, bal_section_id, bal_dir)),
  add_option: (bal_item_id: string): void =>
    bal_mutate((bal_q) => komola_add_option(bal_q, bal_item_id)),
  update_option: (
    bal_item_id: string,
    bal_option_id: string,
    bal_patch: Partial<Pick<ChoiceOption, 'label' | 'coding'>>
  ): void => bal_mutate((bal_q) => dhon_update_option(bal_q, bal_item_id, bal_option_id, bal_patch)),
  remove_option: (bal_item_id: string, bal_option_id: string): void =>
    bal_mutate((bal_q) => lichu_option(bal_q, bal_item_id, bal_option_id)),
  move_option: (bal_item_id: string, bal_option_id: string, bal_dir: -1 | 1): void =>
    bal_mutate((bal_q) => ghora_move_option(bal_q, bal_item_id, bal_option_id, bal_dir)),
  taken_variable_names: (): string[] => {
    const bal_s = get(heda_state);
    if (!bal_s.questionnaire) return [];
    return bal_taken_variable_names(bal_s.questionnaire);
  }
};
