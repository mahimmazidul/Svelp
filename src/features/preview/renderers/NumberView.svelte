<script lang="ts">
  import QuestionShell from './QuestionShell.svelte';
  import type { QuestionnaireItem } from '../../../models/types';

  let {
    item,
    number,
    value = '',
    error = null,
    oninput
  }: {
    item: QuestionnaireItem;
    number: string;
    value?: string;
    error?: string | null;
    oninput: (bal_value: string) => void;
  } = $props();

  const bal_step = $derived(
    typeof item.validation?.step === 'number' && item.validation.step > 0
      ? item.validation.step
      : item.validation?.decimalAllowed === false
        ? '1'
        : 'any'
  );
</script>

<QuestionShell number={number} label={item.label} required={item.required} error={error}>
  <div class="pv-number">
    <input
      class="pv-input"
      type="number"
      inputmode={item.validation?.decimalAllowed === false ? 'numeric' : 'decimal'}
      placeholder={item.placeholder ?? ''}
      min={typeof item.validation?.min === 'number' ? item.validation.min : undefined}
      max={typeof item.validation?.max === 'number' ? item.validation.max : undefined}
      step={bal_step}
      {value}
      oninput={(bal_event) => oninput((bal_event.currentTarget as HTMLInputElement).value)}
    />
    {#if item.unitLabel}
      <span class="pv-unit">{item.unitLabel}</span>
    {/if}
  </div>
</QuestionShell>

<style>
  .pv-number {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .pv-input {
    width: 180px;
    max-width: 60vw;
    height: var(--control-height);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .pv-input:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .pv-unit {
    font-size: var(--text-sm);
    color: var(--color-ink-3);
    white-space: nowrap;
  }
</style>
