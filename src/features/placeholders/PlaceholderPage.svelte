<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import StatusPill from '../../components/ui/StatusPill.svelte';
  import Icon from '../../icons/Icon.svelte';
  import { shawya_area_content } from './area_content';

  let {
    area
  }: {
    area: 'print' | 'scan' | 'responses' | 'export' | 'settings';
  } = $props();

  const bal_content = $derived(shawya_area_content[area]);
</script>

<div class="page">
  <div class="ph-card">
    <div class="ph-icon">
      <Icon name={bal_content.icon} size={26} />
    </div>
    <div class="ph-head">
      <h1>{bal_content.title}</h1>
      <StatusPill tone="warning" label="Not available in this version" />
    </div>
    <p class="ph-lead">{bal_content.lead}</p>
    <ul class="ph-list">
      {#each bal_content.bullets as bal_line (bal_line)}
        <li>
          <Icon name="check" size={15} />
          <span>{bal_line}</span>
        </li>
      {/each}
    </ul>
    {#if bal_content.note}
      <p class="ph-note">
        {bal_content.note.text}
        <a href={bal_content.note.href}>{bal_content.note.label}</a>
      </p>
    {/if}
    <div class="ph-actions">
      <Button variant="primary" icon="layers" href="#/projects">Back to Projects</Button>
    </div>
  </div>
</div>

<style>
  .ph-card {
    max-width: 640px;
    margin: 0 auto;
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: clamp(var(--space-5), 4vw, var(--space-7));
    display: grid;
    gap: var(--space-4);
    justify-items: start;
  }

  .ph-icon {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: var(--radius-lg);
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }

  .ph-head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .ph-lead {
    color: var(--color-ink-2);
  }

  .ph-list {
    list-style: none;
    padding: 0;
    display: grid;
    gap: var(--space-2);
    width: 100%;
  }

  .ph-list li {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    color: var(--color-ink-2);
    font-size: var(--text-sm);
  }

  .ph-list li :global(svg) {
    flex: none;
    color: var(--color-ink-3);
    margin-top: 4px;
  }

  .ph-note {
    font-size: var(--text-sm);
    color: var(--color-ink-2);
    background: var(--color-surface-2);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
  }

  .ph-actions {
    margin-top: var(--space-2);
  }
</style>
