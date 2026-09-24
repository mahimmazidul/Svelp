import { get, writable } from 'svelte/store';
import {
  bal_save_questionnaire,
  dhon_questionnaire_by_project
} from '../../db/questionnaires_repo';
import { ken_pori_scales } from '../../db/scales_repo';
import { normalize_questionnaire } from '../../models/factories';
import type {
  ChoiceOption,
  ConsentSectionKind,
  ItemTypeName,
  MatrixSelectionMode,
  QuestionnaireRecord,
  ResponseScaleRecord
} from '../../models/types';
import { vorki_debounce } from '../../utils/debounce';
import {
  apel_find_item,
  bal_add_item,
  bal_banaitesi_bulk_questions,
  bal_paste_matrix_columns,
  bal_paste_matrix_rows,
  bal_plan_bulk_questions,
  bal_taken_variable_names,
  ghora_add_consent_section,
  ghora_add_matrix_column,
  ghora_add_matrix_row,
  ghora_add_section,
  ghora_move_consent_section,
  ghora_move_item,
  ghora_move_matrix_column,
  ghora_move_matrix_row,
  ghora_move_option,
  ghora_move_section,
  komola_add_option,
  komola_assign_scale,
  komola_detach_scale,
  lichu_consent_section,
  lichu_item,
  lichu_matrix_column,
  lichu_matrix_row,
  lichu_option,
  lichu_section,
  malta_item,
  malta_section,
  ram_chagol_consent,
  ram_chagol_consent_section,
  ram_chagol_matrix_column,
  ram_chagol_matrix_row,
  ram_chagol_section,
  ram_chagol_selection_mode,
  ram_chagol_signature,
  dhon_set_likert_points,
  dhon_update_item,
  dhon_update_option,
  type BuildableItemType,
  type ItemPatch
} from './builder_ops';

export type BuilderStatus = 'empty' | 'loading' | 'ready' | 'missing' | 'error';
export type BuilderSaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

export interface BuilderState {
  status: BuilderStatus;
  questionnaire: QuestionnaireRecord | null;
  scales: ResponseScaleRecord[];
  selectedSectionId: string | null;
  selectedItemId: string | null;
  saveStatus: BuilderSaveStatus;
  canUndo: boolean;
  canRedo: boolean;
}

const BAL_EMPTY: BuilderState = {
  status: 'empty',
  questionnaire: null,
  scales: [],
  selectedSectionId: null,
  selectedItemId: null,
  saveStatus: 'saved',
  canUndo: false,
  canRedo: false
};

interface HistoryEntry {
  questionnaire: QuestionnaireRecord;
  selectedSectionId: string | null;
  selectedItemId: string | null;
  tag: string | null;
  at: number;
}

const BAL_HISTORY_LIMIT = 100;
const BAL_COALESCE_WINDOW = 900;

let bal_undo_stack: HistoryEntry[] = [];
let bal_redo_stack: HistoryEntry[] = [];

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

function bal_mark_history(bal_previous: BuilderState, bal_tag: string | null): void {
  const bal_top = bal_undo_stack[bal_undo_stack.length - 1];
  if (
    bal_tag !== null &&
    bal_top &&
    bal_top.tag === bal_tag &&
    Date.now() - bal_top.at < BAL_COALESCE_WINDOW
  ) {
    bal_undo_stack[bal_undo_stack.length - 1] = { ...bal_top, at: Date.now() };
  } else {
    bal_undo_stack.push({
      questionnaire: bal_previous.questionnaire as QuestionnaireRecord,
      selectedSectionId: bal_previous.selectedSectionId,
      selectedItemId: bal_previous.selectedItemId,
      tag: bal_tag,
      at: Date.now()
    });
    if (bal_undo_stack.length > BAL_HISTORY_LIMIT) bal_undo_stack.shift();
  }
  bal_redo_stack = [];
}

function bal_mutate(
  bal_fn: (bal_q: QuestionnaireRecord) => QuestionnaireRecord,
  bal_tag: string | null = null
): void {
  heda_state.update((bal_s) => {
    if (bal_s.status !== 'ready' || !bal_s.questionnaire) return bal_s;
    bal_mark_history(bal_s, bal_tag);
    const bal_next = bal_fn(bal_s.questionnaire);
    return { ...bal_s, questionnaire: bal_next, saveStatus: 'dirty', canUndo: true, canRedo: false };
  });
  bal_schedule_save();
}

function bal_reset(bal_status: BuilderStatus): void {
  bal_undo_stack = [];
  bal_redo_stack = [];
  heda_state.set({ ...BAL_EMPTY, status: bal_status });
}

async function bal_refresh_scales(): Promise<void> {
  try {
    const bal_scales = await ken_pori_scales();
    heda_state.update((bal_s) => ({ ...bal_s, scales: bal_scales }));
  } catch {
    heda_state.update((bal_s) => ({ ...bal_s, scales: [] }));
  }
}

async function bal_load(bal_project_id: string): Promise<void> {
  if (bal_loaded_project_id === bal_project_id) return;
  bal_loaded_project_id = bal_project_id;
  bal_reset('loading');
  void bal_refresh_scales();
  try {
    const bal_q_raw = await dhon_questionnaire_by_project(bal_project_id);
    if (!bal_q_raw) {
      bal_reset('missing');
      return;
    }
    const bal_q = normalize_questionnaire(bal_q_raw);
    heda_state.set({
      status: 'ready',
      questionnaire: bal_q,
      scales: get(heda_state).scales,
      selectedSectionId: bal_q.sections[0]?.id ?? null,
      selectedItemId: null,
      saveStatus: 'saved',
      canUndo: false,
      canRedo: false
    });
  } catch {
    bal_reset('error');
  }
}

function bal_reload(bal_project_id: string): Promise<void> {
  bal_loaded_project_id = null;
  return bal_load(bal_project_id);
}

function bal_undo(): void {
  const bal_entry = bal_undo_stack.pop();
  if (!bal_entry) return;
  heda_state.update((bal_s) => {
    if (bal_s.status !== 'ready' || !bal_s.questionnaire) return bal_s;
    bal_redo_stack.push({
      questionnaire: bal_s.questionnaire,
      selectedSectionId: bal_s.selectedSectionId,
      selectedItemId: bal_s.selectedItemId,
      tag: null,
      at: 0
    });
    return {
      ...bal_s,
      questionnaire: bal_entry.questionnaire,
      selectedSectionId: bal_entry.selectedSectionId,
      selectedItemId: bal_entry.selectedItemId,
      saveStatus: 'dirty',
      canUndo: bal_undo_stack.length > 0,
      canRedo: true
    };
  });
  bal_schedule_save();
}

function bal_redo(): void {
  const bal_entry = bal_redo_stack.pop();
  if (!bal_entry) return;
  heda_state.update((bal_s) => {
    if (bal_s.status !== 'ready' || !bal_s.questionnaire) return bal_s;
    bal_undo_stack.push({
      questionnaire: bal_s.questionnaire,
      selectedSectionId: bal_s.selectedSectionId,
      selectedItemId: bal_s.selectedItemId,
      tag: null,
      at: 0
    });
    return {
      ...bal_s,
      questionnaire: bal_entry.questionnaire,
      selectedSectionId: bal_entry.selectedSectionId,
      selectedItemId: bal_entry.selectedItemId,
      saveStatus: 'dirty',
      canUndo: true,
      canRedo: bal_redo_stack.length > 0
    };
  });
  bal_schedule_save();
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
    bal_mark_history(bal_s, null);
    return {
      ...bal_s,
      questionnaire: bal_result.q,
      selectedSectionId: bal_result.sectionId,
      selectedItemId: null,
      saveStatus: 'dirty',
      canUndo: true,
      canRedo: false
    };
  });
  if (bal_new_id !== null) bal_schedule_save();
}

function bal_add_item_action(
  bal_type: BuildableItemType,
  bal_section_id?: string | null
): void {
  let bal_new_item_id: string | null = null;
  heda_state.update((bal_s) => {
    if (bal_s.status !== 'ready' || !bal_s.questionnaire) return bal_s;
    let bal_q = bal_s.questionnaire;
    let bal_target =
      bal_section_id ??
      bal_s.selectedSectionId ??
      bal_q.sections[bal_q.sections.length - 1]?.id ??
      null;
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
    bal_mark_history(bal_s, null);
    return {
      ...bal_s,
      questionnaire: bal_result.q,
      selectedSectionId: bal_target,
      selectedItemId: bal_result.itemId,
      saveStatus: 'dirty',
      canUndo: true,
      canRedo: false
    };
  });
  if (bal_new_item_id !== null) bal_schedule_save();
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
    bal_mark_history(bal_s, null);
    return {
      ...bal_s,
      questionnaire: bal_result.q,
      selectedSectionId: bal_found?.section.id ?? bal_s.selectedSectionId,
      selectedItemId: bal_result.itemId,
      saveStatus: 'dirty',
      canUndo: true,
      canRedo: false
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
    bal_mark_history(bal_s, null);
    return {
      ...bal_s,
      questionnaire: bal_result.q,
      selectedSectionId: bal_result.sectionId,
      selectedItemId: null,
      saveStatus: 'dirty',
      canUndo: true,
      canRedo: false
    };
  });
  if (bal_new_id !== null) bal_schedule_save();
}

function bal_bulk_create(
  bal_section_id: string,
  bal_type: Extract<ItemTypeName, 'single_choice' | 'multiple_choice'>,
  bal_labels: string[],
  bal_scale_id: string | null
): void {
  heda_state.update((bal_s) => {
    if (bal_s.status !== 'ready' || !bal_s.questionnaire) return bal_s;
    const bal_plan = bal_plan_bulk_questions(bal_s.questionnaire, bal_labels);
    const bal_result = bal_banaitesi_bulk_questions(
      bal_s.questionnaire,
      bal_section_id,
      bal_type,
      bal_plan,
      bal_scale_id
    );
    if (bal_result.itemIds.length === 0) return bal_s;
    bal_mark_history(bal_s, null);
    return {
      ...bal_s,
      questionnaire: bal_result.q,
      selectedSectionId: bal_section_id,
      selectedItemId: null,
      saveStatus: 'dirty',
      canUndo: true,
      canRedo: false
    };
  });
  bal_schedule_save();
}

function bal_assign_scale(bal_item_id: string, bal_scale_id: string): void {
  bal_mutate((bal_q) => komola_assign_scale(bal_q, bal_item_id, bal_scale_id), `scale:${bal_item_id}`);
}

function bal_detach_scale(bal_item_id: string, bal_options: ChoiceOption[]): void {
  bal_mutate((bal_q) => komola_detach_scale(bal_q, bal_item_id, bal_options), `scale:${bal_item_id}`);
}

export const builder_state = {
  subscribe: heda_state.subscribe,
  load: bal_load,
  reload: bal_reload,
  flush: bal_flush_save,
  refresh_scales: bal_refresh_scales,
  undo: bal_undo,
  redo: bal_redo,
  select_section: bal_select_section,
  select_item: bal_select_item,
  add_section: bal_add_section,
  add_item: bal_add_item_action,
  bulk_create: bal_bulk_create,
  update_item: (
    bal_item_id: string,
    bal_patch: ItemPatch,
    bal_tag?: string
  ): void => bal_mutate((bal_q) => dhon_update_item(bal_q, bal_item_id, bal_patch), bal_tag ?? null),
  delete_item: bal_delete_item,
  duplicate_item: bal_duplicate_item,
  move_item: (bal_item_id: string, bal_dir: -1 | 1): void =>
    bal_mutate((bal_q) => ghora_move_item(bal_q, bal_item_id, bal_dir)),
  update_section: (
    bal_section_id: string,
    bal_patch: Parameters<typeof ram_chagol_section>[2],
    bal_tag?: string
  ): void =>
    bal_mutate((bal_q) => ram_chagol_section(bal_q, bal_section_id, bal_patch), bal_tag ?? null),
  delete_section: bal_delete_section,
  duplicate_section: bal_duplicate_section,
  move_section: (bal_section_id: string, bal_dir: -1 | 1): void =>
    bal_mutate((bal_q) => ghora_move_section(bal_q, bal_section_id, bal_dir)),
  add_option: (bal_item_id: string): void =>
    bal_mutate((bal_q) => komola_add_option(bal_q, bal_item_id), `opt-add:${bal_item_id}`),
  update_option: (
    bal_item_id: string,
    bal_option_id: string,
    bal_patch: Partial<Pick<ChoiceOption, 'label' | 'coding'>>,
    bal_tag?: string
  ): void =>
    bal_mutate(
      (bal_q) => dhon_update_option(bal_q, bal_item_id, bal_option_id, bal_patch),
      bal_tag ?? null
    ),
  remove_option: (bal_item_id: string, bal_option_id: string): void =>
    bal_mutate((bal_q) => lichu_option(bal_q, bal_item_id, bal_option_id)),
  move_option: (bal_item_id: string, bal_option_id: string, bal_dir: -1 | 1): void =>
    bal_mutate((bal_q) => ghora_move_option(bal_q, bal_item_id, bal_option_id, bal_dir)),
  set_likert_points: (bal_item_id: string, bal_count: number): void =>
    bal_mutate((bal_q) => dhon_set_likert_points(bal_q, bal_item_id, bal_count)),
  assign_scale: bal_assign_scale,
  detach_scale: bal_detach_scale,
  add_matrix_row: (bal_item_id: string): void =>
    bal_mutate((bal_q) => ghora_add_matrix_row(bal_q, bal_item_id), `mrow-add:${bal_item_id}`),
  paste_matrix_rows: (bal_item_id: string, bal_labels: string[]): void =>
    bal_mutate((bal_q) => bal_paste_matrix_rows(bal_q, bal_item_id, bal_labels)),
  update_matrix_row: (
    bal_item_id: string,
    bal_row_id: string,
    bal_label: string,
    bal_tag?: string
  ): void =>
    bal_mutate(
      (bal_q) => ram_chagol_matrix_row(bal_q, bal_item_id, bal_row_id, bal_label),
      bal_tag ?? null
    ),
  remove_matrix_row: (bal_item_id: string, bal_row_id: string): void =>
    bal_mutate((bal_q) => lichu_matrix_row(bal_q, bal_item_id, bal_row_id)),
  move_matrix_row: (bal_item_id: string, bal_row_id: string, bal_dir: -1 | 1): void =>
    bal_mutate((bal_q) => ghora_move_matrix_row(bal_q, bal_item_id, bal_row_id, bal_dir)),
  add_matrix_column: (bal_item_id: string): void =>
    bal_mutate(
      (bal_q) => ghora_add_matrix_column(bal_q, bal_item_id),
      `mcol-add:${bal_item_id}`
    ),
  paste_matrix_columns: (bal_item_id: string, bal_labels: string[]): void =>
    bal_mutate((bal_q) => bal_paste_matrix_columns(bal_q, bal_item_id, bal_labels)),
  update_matrix_column: (
    bal_item_id: string,
    bal_column_id: string,
    bal_patch: Partial<Pick<ChoiceOption, 'label' | 'coding'>>,
    bal_tag?: string
  ): void =>
    bal_mutate(
      (bal_q) => ram_chagol_matrix_column(bal_q, bal_item_id, bal_column_id, bal_patch),
      bal_tag ?? null
    ),
  remove_matrix_column: (bal_item_id: string, bal_column_id: string): void =>
    bal_mutate((bal_q) => lichu_matrix_column(bal_q, bal_item_id, bal_column_id)),
  move_matrix_column: (bal_item_id: string, bal_column_id: string, bal_dir: -1 | 1): void =>
    bal_mutate((bal_q) => ghora_move_matrix_column(bal_q, bal_item_id, bal_column_id, bal_dir)),
  set_selection_mode: (bal_item_id: string, bal_mode: MatrixSelectionMode): void =>
    bal_mutate((bal_q) => ram_chagol_selection_mode(bal_q, bal_item_id, bal_mode)),
  update_consent: (
    bal_item_id: string,
    bal_patch: Parameters<typeof ram_chagol_consent>[2],
    bal_tag?: string
  ): void =>
    bal_mutate((bal_q) => ram_chagol_consent(bal_q, bal_item_id, bal_patch), bal_tag ?? null),
  add_consent_section: (bal_item_id: string, bal_kind: ConsentSectionKind): void =>
    bal_mutate((bal_q) => ghora_add_consent_section(bal_q, bal_item_id, bal_kind)),
  update_consent_section: (
    bal_item_id: string,
    bal_consent_section_id: string,
    bal_patch: Parameters<typeof ram_chagol_consent_section>[3],
    bal_tag?: string
  ): void =>
    bal_mutate(
      (bal_q) => ram_chagol_consent_section(bal_q, bal_item_id, bal_consent_section_id, bal_patch),
      bal_tag ?? null
    ),
  remove_consent_section: (bal_item_id: string, bal_consent_section_id: string): void =>
    bal_mutate((bal_q) => lichu_consent_section(bal_q, bal_item_id, bal_consent_section_id)),
  move_consent_section: (
    bal_item_id: string,
    bal_consent_section_id: string,
    bal_dir: -1 | 1
  ): void =>
    bal_mutate((bal_q) =>
      ghora_move_consent_section(bal_q, bal_item_id, bal_consent_section_id, bal_dir)
    ),
  update_signature: (
    bal_item_id: string,
    bal_patch: Parameters<typeof ram_chagol_signature>[2],
    bal_tag?: string
  ): void =>
    bal_mutate((bal_q) => ram_chagol_signature(bal_q, bal_item_id, bal_patch), bal_tag ?? null),
  taken_variable_names: (): string[] => {
    const bal_s = get(heda_state);
    if (!bal_s.questionnaire) return [];
    return bal_taken_variable_names(bal_s.questionnaire);
  }
};
