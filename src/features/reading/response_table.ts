import type { ResponseRecord } from '../../models/response_models';
import type { bal_ItemInfo } from './reading_ui_helpers';

export const BAL_TABLE_ROW_WINDOW = 100;

export type bal_TableFilter =
  | 'all'
  | 'review'
  | 'missing-required'
  | 'manual-only'
  | 'corrected'
  | 'blank'
  | 'missing-page'
  | 'unreadable'
  | 'complete'
  | 'incomplete';

export interface bal_TableVariable {
  key: string;
  itemId: string;
  rowId: string | null;
  variableName: string;
  label: string;
  sectionTitle: string;
}

export interface bal_SortState {
  key: string | null;
  dir: 'asc' | 'desc';
}

export function bal_table_variables(
  bal_responses: ResponseRecord[],
  bal_items: Map<string, bal_ItemInfo>
): bal_TableVariable[] {
  const bal_keys: bal_TableVariable[] = [];
  const bal_seen = new Set<string>();
  for (const bal_response of bal_responses) {
    const bal_key = bal_response.rowId ? `${bal_response.itemId}::${bal_response.rowId}` : bal_response.itemId;
    if (bal_seen.has(bal_key)) continue;
    bal_seen.add(bal_key);
    const bal_info = bal_items.get(bal_response.itemId);
    const bal_row_label = bal_response.rowId
      ? (bal_info?.rows.find((bal_row) => bal_row.id === bal_response.rowId)?.label ?? bal_response.rowId)
      : null;
    bal_keys.push({
      key: bal_key,
      itemId: bal_response.itemId,
      rowId: bal_response.rowId,
      variableName: bal_response.variableName ?? bal_response.itemId,
      label: bal_info
        ? `${bal_info.number} ${bal_row_label ? `${bal_row_label} · ` : ''}${bal_info.label}`
        : (bal_response.variableName ?? bal_response.itemId),
      sectionTitle: bal_info?.sectionTitle ?? ''
    });
  }
  return bal_keys;
}

export function bal_respondent_matches_filter(
  bal_cells: ResponseRecord[],
  bal_filter: bal_TableFilter,
  bal_completeness: string | undefined,
  bal_review_statuses: Set<string>
): boolean {
  if (bal_filter === 'review') return bal_cells.some((bal_cell) => bal_review_statuses.has(bal_cell.status));
  if (bal_filter === 'missing-required') return bal_completeness === 'missing-required';
  if (bal_filter === 'manual-only')
    return bal_cells.some((bal_cell) => bal_cell.status === 'manual-only' && !bal_cell.manuallyReviewed);
  if (bal_filter === 'corrected') return bal_cells.some((bal_cell) => bal_cell.manuallyReviewed);
  if (bal_filter === 'blank') return bal_cells.some((bal_cell) => bal_cell.status === 'blank');
  if (bal_filter === 'missing-page') return bal_completeness === 'missing-page';
  if (bal_filter === 'unreadable') return bal_cells.some((bal_cell) => bal_cell.status === 'unreadable');
  if (bal_filter === 'complete') return bal_completeness === 'complete';
  if (bal_filter === 'incomplete') return bal_completeness !== 'complete';
  return true;
}

export function bal_search_respondents(bal_respondents: string[], bal_query: string): string[] | null {
  const bal_trimmed = bal_query.trim().toLowerCase();
  if (bal_trimmed.length === 0) return null;
  const bal_matched = bal_respondents.filter((bal_respondent) => bal_respondent.toLowerCase().includes(bal_trimmed));
  return bal_matched.length > 0 ? bal_matched : null;
}

export function bal_search_variables(
  bal_variables: bal_TableVariable[],
  bal_query: string
): bal_TableVariable[] | null {
  const bal_trimmed = bal_query.trim().toLowerCase();
  if (bal_trimmed.length === 0) return null;
  const bal_matched = bal_variables.filter(
    (bal_variable) =>
      bal_variable.label.toLowerCase().includes(bal_trimmed) ||
      bal_variable.variableName.toLowerCase().includes(bal_trimmed) ||
      bal_variable.sectionTitle.toLowerCase().includes(bal_trimmed)
  );
  return bal_matched.length > 0 ? bal_matched : null;
}

export function bal_search_matches_nothing(
  bal_respondents: string[],
  bal_variables: bal_TableVariable[],
  bal_query: string
): boolean {
  if (bal_query.trim().length === 0) return false;
  return bal_search_respondents(bal_respondents, bal_query) === null && bal_search_variables(bal_variables, bal_query) === null;
}

export function bal_sort_respondents(
  bal_respondents: string[],
  bal_sort: bal_SortState,
  bal_cell_text: (bal_respondent: string, bal_key: string) => string
): string[] {
  if (bal_sort.key === null) return bal_respondents;
  const bal_factor = bal_sort.dir === 'asc' ? 1 : -1;
  return [...bal_respondents].sort((bal_a, bal_b) => {
    const bal_text_a = bal_cell_text(bal_a, bal_sort.key ?? '');
    const bal_text_b = bal_cell_text(bal_b, bal_sort.key ?? '');
    const bal_empty_a = bal_text_a.length === 0;
    const bal_empty_b = bal_text_b.length === 0;
    if (bal_empty_a && bal_empty_b) return bal_a.localeCompare(bal_b);
    if (bal_empty_a) return 1;
    if (bal_empty_b) return -1;
    return bal_factor * bal_text_a.localeCompare(bal_text_b, undefined, { numeric: true });
  });
}

export function bal_next_row_limit(bal_row_limit: number): number {
  return bal_row_limit + BAL_TABLE_ROW_WINDOW;
}
