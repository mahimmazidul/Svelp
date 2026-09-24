<script lang="ts">
  import type { QuestionnaireItem } from '../../../models/types';

  let {
    item,
    number,
    selected = null,
    onanswer
  }: {
    item: QuestionnaireItem;
    number: string;
    selected?: string | null;
    onanswer: (bal_option_id: string) => void;
  } = $props();
</script>

<fieldset class="pv-q">
  <legend class="pv-q-legend">
    <span class="pv-q-num">{number}</span>
    <span class="pv-q-label">{item.label.trim() !== '' ? item.label : 'Untitled question'}</span>
    {#if item.required}
      <span class="pv-req">Required</span>
    {/if}
  </legend>
  <div class="pv-options">
    {#each item.options as bal_option (bal_option.id)}
      <label class="pv-option">
        <input
          type="radio"
          name={item.id}
          value={bal_option.id}
          checked={selected === bal_option.id}
          onchange={() => onanswer(bal_option.id)}
        />
        <span class="pv-option-label">
          {bal_option.label.trim() !== '' ? bal_option.label : 'Untitled option'}
        </span>
        {#if bal_option.coding}
          <span class="pv-option-code">{bal_option.coding}</span>
        {/if}
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .pv-q {
    border: none;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }

  .pv-q-legend {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    padding: 0;
    font-weight: 600;
  }

  .pv-q-num {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-ink-3);
    flex: none;
  }

  .pv-q-label {
    min-width: 0;
  }

  .pv-req {
    flex: none;
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-warning-ink);
    background: var(--color-warning-soft);
    border-radius: var(--radius-full);
    padding: 2px 8px;
  }

  .pv-options {
    display: grid;
    gap: var(--space-2);
  }

  .pv-option {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: border-color var(--dur-fast) ease, background var(--dur-fast) ease;
  }

  .pv-option:hover {
    background: var(--color-surface-2);
  }

  .pv-option:has(input:checked) {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }

  .pv-option input {
    accent-color: var(--color-accent);
    width: 18px;
    height: 18px;
    flex: none;
  }

  .pv-option-label {
    flex: 1;
    min-width: 0;
  }

  .pv-option-code {
    flex: none;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-ink-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 1px 6px;
  }
</style>
