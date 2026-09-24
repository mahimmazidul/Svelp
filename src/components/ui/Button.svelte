<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../../icons/Icon.svelte';
  import type { IconName } from '../../icons/icon_defs';

  interface BalProps {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md';
    type?: 'button' | 'submit';
    icon?: IconName | null;
    href?: string | null;
    disabled?: boolean;
    onclick?: (bal_event: MouseEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
  }

  let {
    variant = 'secondary',
    size = 'md',
    type = 'button',
    icon = null,
    href = null,
    disabled = false,
    onclick,
    children,
    ...rest
  }: BalProps = $props();
</script>

{#if href}
  <a
    class="btn"
    class:primary={variant === 'primary'}
    class:secondary={variant === 'secondary'}
    class:ghost={variant === 'ghost'}
    class:danger={variant === 'danger'}
    class:sm={size === 'sm'}
    {href}
    {...rest}
  >
    {#if icon}<Icon name={icon} size={16} />{/if}
    {@render children?.()}
  </a>
{:else}
  <button
    class="btn"
    class:primary={variant === 'primary'}
    class:secondary={variant === 'secondary'}
    class:ghost={variant === 'ghost'}
    class:danger={variant === 'danger'}
    class:sm={size === 'sm'}
    {type}
    {disabled}
    {onclick}
    {...rest}
  >
    {#if icon}<Icon name={icon} size={16} />{/if}
    {@render children?.()}
  </button>
{/if}

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    height: var(--control-height);
    padding: 0 var(--space-4);
    border: var(--border-width) solid transparent;
    border-radius: var(--radius-md);
    background: none;
    font-size: var(--text-md);
    font-weight: 550;
    white-space: nowrap;
    color: inherit;
    text-decoration: none;
    cursor: pointer;
    transition:
      background var(--dur-fast) ease,
      border-color var(--dur-fast) ease,
      color var(--dur-fast) ease;
  }

  .btn:hover {
    text-decoration: none;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn.sm {
    height: calc(var(--control-height) - 8px);
    padding: 0 var(--space-3);
    font-size: var(--text-sm);
  }

  .primary {
    background: var(--color-accent);
    color: #ffffff;
  }

  .primary:hover:not(:disabled) {
    background: var(--color-accent-strong);
  }

  .secondary {
    background: var(--color-surface);
    border-color: var(--color-border-strong);
    color: var(--color-ink);
  }

  .secondary:hover:not(:disabled) {
    background: var(--color-surface-2);
  }

  .ghost {
    color: var(--color-ink-2);
  }

  .ghost:hover:not(:disabled) {
    background: rgba(23, 26, 33, 0.06);
    color: var(--color-ink);
  }

  .danger {
    background: var(--color-danger);
    color: #ffffff;
  }

  .danger:hover:not(:disabled) {
    background: #992014;
  }
</style>
