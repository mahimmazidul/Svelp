<script lang="ts">
  import BulkCreator from './BulkCreator.svelte';
  import Icon from '../../icons/Icon.svelte';
  import { BAL_GROUP_LABELS, bal_grouped_catalog, type ItemDescriptor } from '../../models/item_catalog';
  import type { BuildableItemType } from './builder_ops';
  import { builder_state } from './builder_state';

  let {
    sectionId = null,
    label = 'Add',
    variant = 'secondary',
    show_bulk = false
  }: {
    sectionId?: string | null;
    label?: string;
    variant?: 'secondary' | 'ghost';
    show_bulk?: boolean;
  } = $props();

  let shawya_open = $state(false);
  let bal_root = $state<HTMLElement | undefined>(undefined);

  const bal_groups = bal_grouped_catalog();

  $effect(() => {
    if (!shawya_open) return;
    const bal_on_pointer = (bal_event: PointerEvent): void => {
      if (bal_root && !bal_root.contains(bal_event.target as Node)) shawya_open = false;
    };
    const bal_on_key = (bal_event: KeyboardEvent): void => {
      if (bal_event.key === 'Escape') shawya_open = false;
    };
    document.addEventListener('pointerdown', bal_on_pointer);
    document.addEventListener('keydown', bal_on_key);
    return () => {
      document.removeEventListener('pointerdown', bal_on_pointer);
      document.removeEventListener('keydown', bal_on_key);
    };
  });

  function bal_pick(bal_descriptor: ItemDescriptor): void {
    shawya_open = false;
    builder_state.add_item(bal_descriptor.type as BuildableItemType, sectionId);
  }

  function bal_open_bulk(): void {
    shawya_open = false;
    bal_bulk_open = true;
  }

  let bal_bulk_open = $state(false);
</script>

{#if show_bulk}
  <BulkCreator bind:open={bal_bulk_open} sectionId={sectionId} />
{/if}

<div class="menu-root" bind:this={bal_root}>
  <button
    class="trigger"
    class:ghost={variant === 'ghost'}
    type="button"
    aria-haspopup="menu"
    aria-expanded={shawya_open}
    onclick={() => (shawya_open = !shawya_open)}
  >
    <Icon name="plus" size={18} />
    {#if label}
      <span>{label}</span>
    {/if}
  </button>

  {#if shawya_open}
    <div class="pop" role="menu" aria-label="Add question">
      {#each bal_groups as bal_group (bal_group.group)}
        <div class="group-head">{BAL_GROUP_LABELS[bal_group.group]}</div>
        {#each bal_group.items as bal_item (bal_item.type)}
          <button
            class="menu-item"
            type="button"
            role="menuitem"
            onclick={() => bal_pick(bal_item)}
          >
            <Icon name={bal_item.icon} size={16} />
            <span class="menu-text">
              <span class="menu-label">{bal_item.label}</span>
              <span class="menu-desc">{bal_item.description}</span>
            </span>
          </button>
        {/each}
      {/each}
      {#if show_bulk}
        <div class="group-head">Bulk</div>
        <button class="menu-item" type="button" role="menuitem" onclick={bal_open_bulk}>
          <Icon name="list" size={16} />
          <span class="menu-text">
            <span class="menu-label">Paste multiple questions</span>
            <span class="menu-desc">Create many questions from pasted labels.</span>
          </span>
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .menu-root {
    position: relative;
    display: inline-flex;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    height: var(--control-height);
    min-width: var(--control-height);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
    font-size: var(--text-md);
    font-weight: 550;
    cursor: pointer;
  }

  .trigger.ghost {
    border-color: transparent;
    background: none;
    color: var(--color-ink-2);
  }

  .trigger:hover,
  .trigger[aria-expanded='true'] {
    background: var(--color-surface-2);
    color: var(--color-ink);
  }

  .pop {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: calc(var(--z-overlay) + 1);
    width: min(340px, 92vw);
    max-height: min(480px, 70dvh);
    overflow-y: auto;
    display: grid;
    padding: var(--space-1);
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2);
  }

  .group-head {
    font-size: var(--text-xs);
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-ink-3);
    padding: var(--space-2) var(--space-3) var(--space-1);
  }

  .menu-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: none;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-ink);
    text-align: left;
    cursor: pointer;
  }

  .menu-item:hover {
    background: var(--color-surface-2);
  }

  .menu-item :global(svg) {
    flex: none;
    color: var(--color-ink-2);
    margin-top: 2px;
  }

  .menu-text {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .menu-label {
    font-size: var(--text-md);
    font-weight: 550;
  }

  .menu-desc {
    font-size: var(--text-xs);
    color: var(--color-ink-3);
  }
</style>
