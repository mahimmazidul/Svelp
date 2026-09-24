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

  const bal_long = $derived(item.type === 'long_text');
  const bal_max_length = $derived(
    typeof item.validation?.maxLength === 'number' ? item.validation.maxLength : null
  );
</script>

<QuestionShell number={number} label={item.label} required={item.required} error={error}>
  {#if bal_long}
    <textarea
      class="pv-textarea"
      rows="4"
      placeholder={item.placeholder ?? ''}
      maxlength={bal_max_length ?? undefined}
      {value}
      oninput={(bal_event) => oninput((bal_event.currentTarget as HTMLTextAreaElement).value)}
    ></textarea>
  {:else}
    <input
      class="pv-input"
      type="text"
      placeholder={item.placeholder ?? ''}
      maxlength={bal_max_length ?? undefined}
      {value}
      oninput={(bal_event) => oninput((bal_event.currentTarget as HTMLInputElement).value)}
    />
  {/if}
  {#if bal_max_length}
    <p class="pv-counter">{value.length} / {bal_max_length}</p>
  {/if}
</QuestionShell>

<style>
  .pv-input {
    width: 100%;
    height: var(--control-height);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .pv-textarea {
    width: 100%;
    resize: vertical;
    padding: var(--space-2) var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
    line-height: var(--leading);
  }

  .pv-input:focus,
  .pv-textarea:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .pv-counter {
    font-size: var(--text-xs);
    color: var(--color-ink-3);
    text-align: right;
  }
</style>
