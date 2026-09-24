<script lang="ts">
  import type { QuestionnaireItem, ResponseScaleRecord } from '../../../models/types';
  import { bal_matrix_options } from '../preview_answers';
  import type { MatrixAnswer } from '../preview_answers';
  import QuestionShell from './QuestionShell.svelte';

  let {
    item,
    number,
    scales,
    answer,
    error = null,
    onchange
  }: {
    item: QuestionnaireItem;
    number: string;
    scales: ResponseScaleRecord[];
    answer?: MatrixAnswer | null;
    error?: string | null;
    onchange: (bal_answer: MatrixAnswer) => void;
  } = $props();

  const bal_columns = $derived(bal_matrix_options(item, scales));
  const bal_multiple = $derived(item.selectionMode === 'multiple');
  const bal_cells = $derived(answer?.cells ?? {});

  function bal_toggle(bal_row_id: string, bal_column_id: string): void {
    const bal_current = bal_cells[bal_row_id] ?? [];
    let bal_next: string[];
    if (bal_multiple) {
      bal_next = bal_current.includes(bal_column_id)
        ? bal_current.filter((bal_id) => bal_id !== bal_column_id)
        : [...bal_current, bal_column_id];
    } else {
      bal_next = [bal_column_id];
    }
    onchange({ cells: { ...bal_cells, [bal_row_id]: bal_next } });
  }
</script>

<QuestionShell number={number} label={item.label} required={item.required} error={error}>
  <div class="pv-matrix" role="table" aria-label={item.label}>
    <div class="pv-matrix-head" role="row">
      <span class="pv-matrix-corner" aria-hidden="true"></span>
      {#each bal_columns as bal_col, bal_ci (bal_col.id)}
        <span class="pv-matrix-col" role="columnheader">
          <span class="pv-col-num">{bal_ci + 1}</span>
          {bal_col.label.trim() !== '' ? bal_col.label : `Column ${bal_ci + 1}`}
          {#if bal_col.coding}
            <span class="pv-col-code">{bal_col.coding}</span>
          {/if}
        </span>
      {/each}
    </div>
    {#each item.rows as bal_row, bal_ri (bal_row.id)}
      <div class="pv-matrix-row" role="row">
        <span class="pv-matrix-rowhead" role="rowheader">
          <span class="pv-row-num">{bal_ri + 1}</span>
          {bal_row.label.trim() !== '' ? bal_row.label : `Row ${bal_ri + 1}`}
        </span>
        {#each bal_columns as bal_col (bal_col.id)}
          <span class="pv-matrix-cell" role="cell">
            <label class="pv-cell-label">
              <input
                type={bal_multiple ? 'checkbox' : 'radio'}
                name={`${item.id}-${bal_row.id}`}
                checked={(bal_cells[bal_row.id] ?? []).includes(bal_col.id)}
                onchange={() => bal_toggle(bal_row.id, bal_col.id)}
                aria-label={`${bal_row.label} — ${bal_col.label}`}
              />
              <span class="pv-cell-text">
                {bal_col.label.trim() !== '' ? bal_col.label : `Column ${bal_columns.indexOf(bal_col) + 1}`}
              </span>
            </label>
          </span>
        {/each}
      </div>
    {/each}
  </div>
  {#if item.rows.length === 0 || bal_columns.length === 0}
    <p class="pv-matrix-empty">This matrix has no rows or columns yet.</p>
  {/if}
</QuestionShell>

<style>
  .pv-matrix {
    display: grid;
    gap: 0;
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    overflow-x: auto;
  }

  .pv-matrix-head {
    display: grid;
    grid-template-columns: minmax(140px, 1.6fr) repeat(auto-fit, minmax(1px, 1fr));
    background: var(--color-surface-2);
    border-bottom: var(--border-width) solid var(--color-border);
  }

  .pv-matrix-corner {
    min-width: 0;
  }

  .pv-matrix-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 2px;
    padding: var(--space-2) var(--space-1);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-ink-2);
    text-align: center;
    min-width: 64px;
  }

  .pv-col-num {
    font-family: var(--font-mono);
    font-weight: 500;
    color: var(--color-ink-3);
  }

  .pv-col-code {
    font-family: var(--font-mono);
    font-weight: 400;
    color: var(--color-ink-3);
  }

  .pv-matrix-row {
    display: grid;
    grid-template-columns: minmax(140px, 1.6fr) repeat(auto-fit, minmax(1px, 1fr));
    border-bottom: var(--border-width) solid var(--color-border);
  }

  .pv-matrix-row:last-child {
    border-bottom: none;
  }

  .pv-matrix-rowhead {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    font-weight: 550;
    min-width: 0;
  }

  .pv-row-num {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-ink-3);
    flex: none;
  }

  .pv-matrix-cell {
    display: grid;
    place-items: center;
    padding: var(--space-1);
    border-left: var(--border-width) solid var(--color-border);
    min-width: 64px;
  }

  .pv-cell-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    cursor: pointer;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .pv-cell-label:hover {
    background: var(--color-surface-2);
  }

  .pv-cell-label input {
    accent-color: var(--color-accent);
    width: 17px;
    height: 17px;
  }

  .pv-cell-text {
    display: none;
    font-size: var(--text-xs);
    color: var(--color-ink-2);
  }

  .pv-matrix-empty {
    font-size: var(--text-sm);
    color: var(--color-ink-3);
  }

  @media (max-width: 767px) {
    .pv-matrix {
      border: none;
      overflow-x: visible;
    }

    .pv-matrix-head {
      display: none;
    }

    .pv-matrix-row {
      display: block;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      margin-bottom: var(--space-3);
      background: var(--color-surface);
    }

    .pv-matrix-rowhead {
      padding: var(--space-3) var(--space-3) var(--space-1);
      border-bottom: var(--border-width) solid var(--color-border);
    }

    .pv-matrix-cell {
      display: flex;
      justify-content: flex-start;
      border-left: none;
      border-bottom: var(--border-width) solid var(--color-border);
      min-width: 0;
      padding: 0 var(--space-2);
    }

    .pv-matrix-cell:last-child {
      border-bottom: none;
    }

    .pv-cell-label {
      flex-direction: row;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      min-height: 44px;
      text-align: left;
    }

    .pv-cell-text {
      display: inline;
    }
  }
</style>
