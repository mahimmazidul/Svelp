<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import type { Snippet } from 'svelte';
  import Icon from '../../icons/Icon.svelte';
  import { bal_focus_first, bal_trap_tab } from '../../utils/focus';

  let {
    open = $bindable(false),
    title,
    onclose,
    children,
    footer
  }: {
    open?: boolean;
    title: string;
    onclose?: () => void;
    children?: Snippet;
    footer?: Snippet;
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
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabindex="-1"
      bind:this={bal_panel}
      in:fly={{ y: 14, duration: 160 }}
      out:fade={{ duration: 110 }}
    >
      <header class="head">
        <h2 class="head-title">{title}</h2>
        <button class="close" type="button" onclick={bal_close} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </header>
      <div class="body">
        {@render children?.()}
      </div>
      {#if footer}
        <footer class="foot">
          {@render footer()}
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    background: var(--color-overlay);
    display: grid;
    place-items: center;
    padding: var(--space-4);
  }

  .dialog {
    width: 100%;
    max-width: 480px;
    max-height: 86dvh;
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2);
    outline: none;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5) var(--space-3);
    flex: none;
  }

  .head-title {
    font-size: var(--text-lg);
    font-weight: 650;
    min-width: 0;
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
    padding: 0 var(--space-5) var(--space-3);
  }

  .foot {
    padding: var(--space-3) var(--space-5) var(--space-5);
    flex: none;
  }
</style>
