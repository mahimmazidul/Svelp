<script lang="ts">
  import ItemProperties from './ItemProperties.svelte';
  import { builder_state } from './builder_state';

  const bal_state = $derived($builder_state);
</script>

<aside class="inspector">
  <header class="head">
    <h2 class="head-title">Properties</h2>
  </header>
  <div class="body">
    {#if bal_state.selectedItemId || bal_state.selectedSectionId}
      <ItemProperties />
    {:else}
      <p class="hint">Select a question or section to edit its properties.</p>
    {/if}
  </div>
</aside>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .head {
    padding: var(--space-3) var(--space-4) var(--space-2);
    flex: none;
  }

  .head-title {
    font-size: var(--text-sm);
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-ink-3);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-2) var(--space-4) var(--space-5);
  }

  .hint {
    font-size: var(--text-sm);
    color: var(--color-ink-3);
  }
</style>
