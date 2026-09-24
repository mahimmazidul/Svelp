<script lang="ts">
  import type { ChoiceOption, QuestionnaireItem } from '../../../models/types';
  import QuestionShell from './QuestionShell.svelte';

  let {
    item,
    number,
    options,
    selected = [],
    error = null,
    ontoggle
  }: {
    item: QuestionnaireItem;
    number: string;
    options: ChoiceOption[];
    selected?: string[];
    error?: string | null;
    ontoggle: (bal_option_id: string) => void;
  } = $props();

  const bal_limits = $derived.by(() => {
    const bal_parts: string[] = [];
    const bal_min = item.validation?.minSelections;
    const bal_max = item.validation?.maxSelections;
    if (typeof bal_min === 'number') bal_parts.push(`at least ${bal_min}`);
    if (typeof bal_max === 'number') bal_parts.push(`at most ${bal_max}`);
    return bal_parts.length > 0 ? `Select ${bal_parts.join(' and ')}.` : 'Select any that apply.';
  });
</script>

<QuestionShell number={number} label={item.label} required={item.required} error={error}>
  <p class="pv-hint">{bal_limits}</p>
  <div class="pv-options">
    {#each options as bal_option (bal_option.id)}
      <label class="pv-option">
        <input
          type="checkbox"
          name={item.id}
          value={bal_option.id}
          checked={selected.includes(bal_option.id)}
          onchange={() => ontoggle(bal_option.id)}
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
</QuestionShell>

<style>
  .pv-hint {
    font-size: var(--text-xs);
    color: var(--color-ink-3);
    margin-top: calc(-1 * var(--space-2));
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
    transition:
      border-color var(--dur-fast) ease,
      background var(--dur-fast) ease;
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
