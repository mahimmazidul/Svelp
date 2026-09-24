<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import Dialog from '../../components/ui/Dialog.svelte';
  import Field from '../../components/ui/Field.svelte';
  import IconButton from '../../components/ui/IconButton.svelte';
  import Switch from '../../components/ui/Switch.svelte';
  import type { QuestionnaireItem } from '../../models/types';
  import { bal_split_paste_lines } from './builder_ops';
  import { builder_state } from './builder_state';

  let { item }: { item: QuestionnaireItem } = $props();

  const bal_scales = $derived($builder_state.scales);

  const BAL_ROWS_EXAMPLE = 'Rice\nFish\nEgg\nMilk';
  const BAL_COLS_EXAMPLE = 'Never\nMonthly\nWeekly\nDaily';

  let shawya_paste_rows_open = $state(false);
  let bal_rows_text = $state('');
  let shawya_paste_cols_open = $state(false);
  let bal_cols_text = $state('');

  function bal_submit_rows(): void {
    const bal_lines = bal_split_paste_lines(bal_rows_text);
    shawya_paste_rows_open = false;
    bal_rows_text = '';
    if (bal_lines.length > 0) builder_state.paste_matrix_rows(item.id, bal_lines);
  }

  function bal_submit_cols(): void {
    const bal_lines = bal_split_paste_lines(bal_cols_text);
    shawya_paste_cols_open = false;
    bal_cols_text = '';
    if (bal_lines.length > 0) builder_state.paste_matrix_columns(item.id, bal_lines);
  }

  function bal_assign(bal_event: Event): void {
    const bal_value = (bal_event.currentTarget as HTMLSelectElement).value;
    if (bal_value === '') {
      if (item.scaleId) {
        builder_state.detach_scale(item.id, []);
      }
      return;
    }
    builder_state.assign_scale(item.id, bal_value);
  }
</script>

<div class="matrix">
  <Field label="Columns" hint="Columns are the answer choices for every row.">
    <div class="scale-row">
      <select
        class="scale-select"
        value={item.scaleId ?? ''}
        onchange={bal_assign}
        aria-label="Response scale for matrix columns"
      >
        <option value="">Custom columns</option>
        {#each bal_scales as bal_scale (bal_scale.id)}
          <option value={bal_scale.id}>{bal_scale.name}</option>
        {/each}
      </select>
      {#if item.scaleId}
        <Button
          variant="secondary"
          size="sm"
          onclick={() => {
            const bal_scale = bal_scales.find((bal_s) => bal_s.id === item.scaleId);
            builder_state.detach_scale(item.id, bal_scale ? bal_scale.options : []);
          }}
        >
          Detach to custom columns
        </Button>
      {/if}
    </div>
  </Field>

  {#if item.scaleId}
    <p class="linked-note">
      Columns follow the assigned scale and update when the scale changes.
    </p>
    <div class="col-chips">
      {#each (bal_scales.find((bal_s) => bal_s.id === item.scaleId)?.options ?? []) as bal_option, bal_ci (bal_option.id)}
        <span class="chip">
          {bal_option.label}
          {#if bal_option.coding}<code>{bal_option.coding}</code>{/if}
          <span class="chip-num">{bal_ci + 1}</span>
        </span>
      {/each}
    </div>
  {:else}
    <div class="col-list">
      {#each item.columns as bal_col, bal_ci (bal_col.id)}
        <div class="col-row">
          <span class="col-num">{bal_ci + 1}</span>
          <label class="visually-hidden" for="col-{bal_col.id}">Column {bal_ci + 1} label</label>
          <input
            id="col-{bal_col.id}"
            class="col-input"
            value={bal_col.label}
            placeholder="Column {bal_ci + 1}"
            oninput={(bal_event) =>
              builder_state.update_matrix_column(
                item.id,
                bal_col.id,
                { label: (bal_event.currentTarget as HTMLInputElement).value },
                `mcol:${bal_col.id}`
              )}
          />
          <label class="visually-hidden" for="colcode-{bal_col.id}">
            Column {bal_ci + 1} code
          </label>
          <input
            id="colcode-{bal_col.id}"
            class="col-code"
            value={bal_col.coding ?? ''}
            placeholder="Code"
            oninput={(bal_event) =>
              builder_state.update_matrix_column(
                item.id,
                bal_col.id,
                { coding: (bal_event.currentTarget as HTMLInputElement).value || null },
                `mcolcode:${bal_col.id}`
              )}
          />
          <div class="row-tools">
            <IconButton
              label="Move column {bal_ci + 1} left"
              icon="chevron-up"
              glyph={14}
              disabled={bal_ci === 0}
              onclick={() => builder_state.move_matrix_column(item.id, bal_col.id, -1)}
            />
            <IconButton
              label="Move column {bal_ci + 1} right"
              icon="chevron-down"
              glyph={14}
              disabled={bal_ci === item.columns.length - 1}
              onclick={() => builder_state.move_matrix_column(item.id, bal_col.id, 1)}
            />
            <IconButton
              label="Remove column {bal_ci + 1}"
              icon="trash"
              glyph={14}
              disabled={item.columns.length <= 1}
              onclick={() => builder_state.remove_matrix_column(item.id, bal_col.id)}
            />
          </div>
        </div>
      {/each}
      <div class="list-actions">
        <Button variant="ghost" size="sm" icon="plus" onclick={() => builder_state.add_matrix_column(item.id)}>
          Add column
        </Button>
        <Button variant="ghost" size="sm" icon="upload" onclick={() => (shawya_paste_cols_open = true)}>
          Paste columns
        </Button>
      </div>
    </div>
  {/if}

  <Field label="Rows" hint="Each row becomes one answered sub-question.">
    <div class="row-list">
      {#each item.rows as bal_row, bal_ri (bal_row.id)}
        <div class="col-row">
          <span class="col-num">{bal_ri + 1}</span>
          <label class="visually-hidden" for="row-{bal_row.id}">Row {bal_ri + 1} label</label>
          <input
            id="row-{bal_row.id}"
            class="col-input"
            value={bal_row.label}
            placeholder="Row {bal_ri + 1}"
            oninput={(bal_event) =>
              builder_state.update_matrix_row(
                item.id,
                bal_row.id,
                (bal_event.currentTarget as HTMLInputElement).value,
                `mrow:${bal_row.id}`
              )}
          />
          <div class="row-tools">
            <IconButton
              label="Move row {bal_ri + 1} up"
              icon="chevron-up"
              glyph={14}
              disabled={bal_ri === 0}
              onclick={() => builder_state.move_matrix_row(item.id, bal_row.id, -1)}
            />
            <IconButton
              label="Move row {bal_ri + 1} down"
              icon="chevron-down"
              glyph={14}
              disabled={bal_ri === item.rows.length - 1}
              onclick={() => builder_state.move_matrix_row(item.id, bal_row.id, 1)}
            />
            <IconButton
              label="Remove row {bal_ri + 1}"
              icon="trash"
              glyph={14}
              onclick={() => builder_state.remove_matrix_row(item.id, bal_row.id)}
            />
          </div>
        </div>
      {/each}
      <div class="list-actions">
        <Button variant="ghost" size="sm" icon="plus" onclick={() => builder_state.add_matrix_row(item.id)}>
          Add row
        </Button>
        <Button variant="ghost" size="sm" icon="upload" onclick={() => (shawya_paste_rows_open = true)}>
          Paste rows
        </Button>
      </div>
    </div>
  </Field>

  <Field label="Selection rule">
    <div class="mode-row">
      <label class="mode-option">
        <input
          type="radio"
          name="mode-{item.id}"
          value="single"
          checked={item.selectionMode === 'single'}
          onchange={() => builder_state.set_selection_mode(item.id, 'single')}
        />
        <span>One answer per row</span>
      </label>
      <label class="mode-option">
        <input
          type="radio"
          name="mode-{item.id}"
          value="multiple"
          checked={item.selectionMode === 'multiple'}
          onchange={() => builder_state.set_selection_mode(item.id, 'multiple')}
        />
        <span>Multiple answers per row</span>
      </label>
    </div>
  </Field>

  <Switch
    label="Require an answer in every row"
    checked={item.validation?.requireAllRows ?? false}
    onchange={(bal_checked) =>
      builder_state.update_item(item.id, { validation: { requireAllRows: bal_checked } })}
  />
</div>

<Dialog bind:open={shawya_paste_rows_open} title="Paste matrix rows" onclose={() => (shawya_paste_rows_open = false)}>
  <div class="paste-body">
    <p class="paste-hint">One row label per line. For example a full food list.</p>
    <textarea
      class="paste-area"
      rows="8"
      bind:value={bal_rows_text}
      placeholder={BAL_ROWS_EXAMPLE}
      aria-label="Row labels, one per line"
    ></textarea>
  </div>
  {#snippet footer()}
    <div class="paste-actions">
      <Button variant="secondary" onclick={() => (shawya_paste_rows_open = false)}>Cancel</Button>
      <Button variant="primary" onclick={bal_submit_rows}>Add rows</Button>
    </div>
  {/snippet}
</Dialog>

<Dialog bind:open={shawya_paste_cols_open} title="Paste matrix columns" onclose={() => (shawya_paste_cols_open = false)}>
  <div class="paste-body">
    <p class="paste-hint">One column label per line. This replaces any scale link with custom columns.</p>
    <textarea
      class="paste-area"
      rows="8"
      bind:value={bal_cols_text}
      placeholder={BAL_COLS_EXAMPLE}
      aria-label="Column labels, one per line"
    ></textarea>
  </div>
  {#snippet footer()}
    <div class="paste-actions">
      <Button variant="secondary" onclick={() => (shawya_paste_cols_open = false)}>Cancel</Button>
      <Button variant="primary" onclick={bal_submit_cols}>Add columns</Button>
    </div>
  {/snippet}
</Dialog>

<style>
  .matrix {
    display: grid;
    gap: var(--space-4);
  }

  .scale-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .scale-select {
    flex: 1;
    min-width: 0;
    height: var(--control-height);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .scale-select:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .linked-note {
    font-size: var(--text-xs);
    color: var(--color-ink-3);
    margin-top: calc(-1 * var(--space-2));
  }

  .col-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: calc(-1 * var(--space-2));
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    border: var(--border-width) solid var(--color-border);
    background: var(--color-surface-2);
    border-radius: var(--radius-full);
    padding: 3px 10px;
  }

  .chip code {
    font-family: var(--font-mono);
    color: var(--color-accent);
  }

  .chip-num {
    color: var(--color-ink-3);
  }

  .col-list,
  .row-list {
    display: grid;
    gap: var(--space-2);
  }

  .col-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .col-num {
    width: 22px;
    flex: none;
    text-align: center;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-ink-3);
  }

  .col-input {
    flex: 1;
    min-width: 0;
    height: 36px;
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .col-input:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .col-code {
    width: 72px;
    flex: none;
    height: 36px;
    padding: 0 var(--space-2);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .col-code:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .row-tools {
    display: flex;
    flex: none;
  }

  .row-tools :global(.ibtn) {
    width: 32px;
    height: 36px;
  }

  .list-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .mode-row {
    display: grid;
    gap: var(--space-2);
  }

  .mode-option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 36px;
    cursor: pointer;
  }

  .mode-option input {
    accent-color: var(--color-accent);
    width: 16px;
    height: 16px;
  }

  .paste-body {
    display: grid;
    gap: var(--space-3);
  }

  .paste-hint {
    font-size: var(--text-sm);
    color: var(--color-ink-2);
  }

  .paste-area {
    width: 100%;
    resize: vertical;
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    line-height: var(--leading);
    color: var(--color-ink);
    background: var(--color-surface);
  }

  .paste-area:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .paste-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }
</style>
