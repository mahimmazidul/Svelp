<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../../icons/Icon.svelte';
  import type { IconName } from '../../icons/icon_defs';

  let {
    icon,
    title,
    body = null,
    children
  }: {
    icon: IconName;
    title: string;
    body?: string | null;
    children?: Snippet;
  } = $props();
</script>

<div class="empty">
  <div class="empty-icon">
    <Icon name={icon} size={22} />
  </div>
  <h2 class="empty-title">{title}</h2>
  {#if body}<p class="empty-body">{body}</p>{/if}
  {#if children}
    <div class="empty-actions">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .empty {
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    text-align: center;
    padding: var(--space-8) var(--space-5);
    border: var(--border-width) dashed var(--color-border-strong);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }

  .empty-icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-lg);
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }

  .empty-title {
    font-size: var(--text-lg);
  }

  .empty-body {
    color: var(--color-ink-2);
    max-width: 44ch;
  }

  .empty-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-3);
    margin-top: var(--space-2);
  }
</style>
