<script lang="ts">
  import Icon from '../../icons/Icon.svelte';
  import type { IconName } from '../../icons/icon_defs';

  let {
    label,
    icon,
    size = 18,
    glyph = null,
    variant = 'ghost',
    disabled = false,
    onclick
  }: {
    label: string;
    icon: IconName;
    size?: number;
    glyph?: number | null;
    variant?: 'ghost' | 'secondary';
    disabled?: boolean;
    onclick?: (bal_event: MouseEvent) => void;
  } = $props();
</script>

<button
  class="ibtn"
  class:secondary={variant === 'secondary'}
  type="button"
  aria-label={label}
  title={label}
  {disabled}
  {onclick}
>
  <Icon name={icon} size={glyph ?? size} />
</button>

<style>
  .ibtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--control-height);
    height: var(--control-height);
    flex: none;
    border: var(--border-width) solid transparent;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-ink-2);
    cursor: pointer;
    transition:
      background var(--dur-fast) ease,
      color var(--dur-fast) ease;
  }

  .ibtn:hover:not(:disabled) {
    background: rgba(23, 26, 33, 0.06);
    color: var(--color-ink);
  }

  .ibtn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ibtn.secondary {
    background: var(--color-surface);
    border-color: var(--color-border-strong);
  }

  .ibtn.secondary:hover:not(:disabled) {
    background: var(--color-surface-2);
  }
</style>
