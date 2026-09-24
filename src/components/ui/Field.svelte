<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    label,
    hint = null,
    error = null,
    children
  }: {
    label: string;
    hint?: string | null;
    error?: string | null;
    children?: Snippet;
  } = $props();
</script>

<div class="field">
  <span class="field-label">{label}</span>
  {@render children?.()}
  {#if error}
    <p class="field-error" role="alert">{error}</p>
  {:else if hint}
    <p class="field-hint">{hint}</p>
  {/if}
</div>

<style>
  .field {
    display: grid;
    gap: var(--space-2);
  }

  .field-label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-ink-2);
  }

  .field-hint {
    font-size: var(--text-xs);
    color: var(--color-ink-3);
  }

  .field-error {
    font-size: var(--text-xs);
    color: var(--color-danger);
  }
</style>
