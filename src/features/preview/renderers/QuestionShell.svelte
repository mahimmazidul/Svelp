<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    number,
    label,
    required = false,
    error = null,
    children
  }: {
    number: string;
    label: string;
    required?: boolean;
    error?: string | null;
    children?: Snippet;
  } = $props();
</script>

<fieldset class="pv-q">
  <legend class="pv-q-legend">
    <span class="pv-q-num">{number}</span>
    <span class="pv-q-label">{label.trim() !== '' ? label : 'Untitled question'}</span>
    {#if required}
      <span class="pv-req">Required</span>
    {/if}
  </legend>
  {@render children?.()}
  {#if error}
    <p class="pv-error" role="alert">{error}</p>
  {/if}
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

  .pv-error {
    font-size: var(--text-sm);
    color: var(--color-danger);
  }
</style>
