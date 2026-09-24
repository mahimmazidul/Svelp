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
</script>

<QuestionShell number={number} label={item.label} required={item.required} error={error}>
  <input
    class="pv-date"
    type="date"
    {value}
    oninput={(bal_event) => oninput((bal_event.currentTarget as HTMLInputElement).value)}
  />
</QuestionShell>

<style>
  .pv-date {
    width: 200px;
    max-width: 70vw;
    height: var(--control-height);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .pv-date:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }
</style>
