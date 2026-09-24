<script lang="ts">
  import Icon from '../../../icons/Icon.svelte';
  import type { QuestionnaireItem } from '../../../models/types';

  let { item }: { item: QuestionnaireItem } = $props();
</script>

{#if item.label.trim() !== ''}
  <aside class="pv-instruction">
    <Icon name="info" size={16} />
    <p>{item.label}</p>
  </aside>
{/if}

<style>
  .pv-instruction {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface-2);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-ink-2);
    font-size: var(--text-sm);
  }

  .pv-instruction :global(svg) {
    flex: none;
    color: var(--color-ink-3);
    margin-top: 3px;
  }
</style>
