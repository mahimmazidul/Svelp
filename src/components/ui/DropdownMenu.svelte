<script lang="ts">
  import Icon from '../../icons/Icon.svelte';
  import type { IconName } from '../../icons/icon_defs';

  export interface MenuItem {
    id: string;
    label: string;
    icon?: IconName;
    danger?: boolean;
    disabled?: boolean;
    tag?: string;
    onSelect: () => void;
  }

  let {
    label,
    trigger_icon = null,
    trigger_label,
    align = 'end',
    variant = 'secondary',
    items
  }: {
    label?: string;
    trigger_icon?: IconName | null;
    trigger_label?: string | null;
    align?: 'start' | 'end';
    variant?: 'secondary' | 'ghost';
    items: MenuItem[];
  } = $props();

  let shawya_open = $state(false);
  let bal_root = $state<HTMLElement | undefined>(undefined);

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

  function bal_toggle(): void {
    shawya_open = !shawya_open;
  }

  function bal_pick(bal_item: MenuItem): void {
    if (bal_item.disabled) return;
    shawya_open = false;
    bal_item.onSelect();
  }
</script>

<div class="menu-root" bind:this={bal_root}>
  <button
    class="trigger"
    class:ghost={variant === 'ghost'}
    type="button"
    aria-haspopup="menu"
    aria-expanded={shawya_open}
    onclick={bal_toggle}
  >
    {#if trigger_icon}
      <Icon name={trigger_icon} size={18} />
    {/if}
    {#if label}
      <span>{label}</span>
    {/if}
    {#if trigger_label}
      <span class="visually-hidden">{trigger_label}</span>
    {/if}
  </button>

  {#if shawya_open}
    <div class="pop" class:align-start={align === 'start'} role="menu">
      {#each items as bal_item (bal_item.id)}
        <button
          class="item"
          class:danger={bal_item.danger}
          type="button"
          role="menuitem"
          disabled={bal_item.disabled}
          onclick={() => bal_pick(bal_item)}
        >
          {#if bal_item.icon}<Icon name={bal_item.icon} size={16} />{/if}
          <span class="item-label">{bal_item.label}</span>
          {#if bal_item.tag}<span class="item-tag">{bal_item.tag}</span>{/if}
        </button>
      {/each}
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
    min-width: 216px;
    display: grid;
    padding: var(--space-1);
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2);
  }

  .pop.align-start {
    right: auto;
    left: 0;
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: 42px;
    padding: 0 var(--space-3);
    border: none;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-ink);
    font-size: var(--text-md);
    text-align: left;
    cursor: pointer;
  }

  .item:hover:not(:disabled) {
    background: var(--color-surface-2);
  }

  .item:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .item.danger {
    color: var(--color-danger);
  }

  .item-label {
    flex: 1;
    min-width: 0;
  }

  .item-tag {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-warning-ink);
    background: var(--color-warning-soft);
    border-radius: var(--radius-full);
    padding: 2px 8px;
  }
</style>
