<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import type { Snippet } from 'svelte';
  import Icon from '../../icons/Icon.svelte';
  import { bal_focus_first, bal_trap_tab } from '../../utils/focus';

  let {
    open = $bindable(false),
    title,
    side = 'bottom',
    onclose,
    children
  }: {
    open?: boolean;
    title: string;
    side?: 'bottom' | 'start';
    onclose?: () => void;
    children?: Snippet;
  } = $props();

  let bal_panel = $state<HTMLElement | undefined>(undefined);
  let bal_overlay = $state<HTMLElement | undefined>(undefined);

  function bal_close(): void {
    open = false;
    onclose?.();
  }

  $effect(() => {
    if (!open) return;
    if (bal_panel) bal_focus_first(bal_panel);
    const bal_previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      bal_previous?.focus();
    };
  });

  $effect(() => {
    if (!open || !bal_overlay) return;
    const bal_el = bal_overlay;
    const bal_handler = (bal_event: MouseEvent): void => {
      if (bal_event.target === bal_el) bal_close();
    };
    bal_el.addEventListener('click', bal_handler);
    return () => bal_el.removeEventListener('click', bal_handler);
  });

  function bal_keydown(bal_event: KeyboardEvent): void {
    if (!open) return;
    if (bal_event.key === 'Escape') {
      bal_event.stopPropagation();
      bal_close();
    } else {
      bal_trap_tab(bal_event, bal_panel);
    }
  }
</script>

<svelte:window onkeydown={bal_keydown} />

{#if open}
  <div
    class="overlay"
    role="presentation"
    bind:this={bal_overlay}
    transition:fade={{ duration: 130 }}
  >
    <div
      class="panel"
      class:bottom={side === 'bottom'}
      class:start={side === 'start'}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabindex="-1"
      bind:this={bal_panel}
      in:fly={side === 'start' ? { x: -48, duration: 170 } : { y: 48, duration: 180 }}
      out:fade={{ duration: 110 }}
    >
      <div class="grab" aria-hidden="true"></div>
      <header class="head">
        <h2 class="head-title">{title}</h2>
        <button class="close" type="button" onclick={bal_close} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </header>
      <div class="body">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}


<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    background: var(--color-overlay);
    display: flex;
    justify-content: center;
  }

  .panel {
    background: var(--color-surface);
    display: flex;
    flex-direction: column;
    outline: none;
  }

  .panel.bottom {
    align-self: flex-end;
    width: 100%;
    max-width: 640px;
    max-height: 82dvh;
    border-radius: 16px 16px 0 0;
    box-shadow: var(--shadow-2);
  }

  .panel.start {
    height: 100dvh;
    width: min(320px, 86vw);
    border-radius: 0;
    box-shadow: var(--shadow-2);
    margin-right: auto;
  }

  .grab {
    display: none;
    width: 40px;
    height: 4px;
    border-radius: var(--radius-full);
    background: var(--color-border-strong);
    margin: var(--space-2) auto 0;
    flex: none;
  }

  .panel.bottom .grab {
    display: block;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-width) solid var(--color-border);
    flex: none;
  }

  .panel.bottom .head {
    padding-top: var(--space-2);
  }

  .head-title {
    font-size: var(--text-lg);
    font-weight: 650;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-ink-2);
    cursor: pointer;
    flex: none;
  }

  .close:hover {
    background: var(--color-surface-2);
    color: var(--color-ink);
  }

  .body {
    overflow-y: auto;
    padding: var(--space-3) var(--space-4) var(--space-5);
    padding-bottom: max(var(--space-5), env(safe-area-inset-bottom));
  }
</style>
