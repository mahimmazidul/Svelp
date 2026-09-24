<script lang="ts">
  import { route_store } from '../router/route_store';
  import { BAL_AREA_LINKS } from './area_links';
  import Sheet from '../../components/ui/Sheet.svelte';
  import Icon from '../../icons/Icon.svelte';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const bal_route = $derived($route_store);
  const bal_project_id = $derived(bal_route.name === 'project' ? bal_route.projectId : null);
</script>

<Sheet bind:open side="bottom" title="Project areas">
  <nav class="more-list" aria-label="Project areas">
    {#each BAL_AREA_LINKS as bal_link (bal_link.area)}
      <a
        class="more-row"
        class:active={bal_route.name === 'project' && bal_route.area === bal_link.area}
        href="#/project/{bal_project_id}/{bal_link.area}"
        onclick={() => (open = false)}
      >
        <Icon name={bal_link.icon} size={19} />
        <span class="more-label">{bal_link.label}</span>
        <Icon name="chevron-right" size={16} />
      </a>
    {/each}
  </nav>
</Sheet>

<style>
  .more-list {
    display: grid;
  }

  .more-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 48px;
    padding: 0 var(--space-2);
    border-radius: var(--radius-md);
    color: var(--color-ink-2);
    text-decoration: none;
  }

  .more-row:hover {
    background: var(--color-surface-2);
    color: var(--color-ink);
    text-decoration: none;
  }

  .more-row.active {
    color: var(--color-accent);
    background: var(--color-accent-soft);
  }

  .more-label {
    flex: 1;
    font-size: var(--text-md);
  }
</style>
