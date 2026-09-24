<script lang="ts">
  import { route_store } from '../router/route_store';
  import type { IconName } from '../../icons/icon_defs';
  import Icon from '../../icons/Icon.svelte';

  let { onmore }: { onmore: () => void } = $props();

  const BAL_TABS: { key: string; label: string; icon: IconName }[] = [
    { key: 'projects', label: 'Projects', icon: 'folder' },
    { key: 'build', label: 'Build', icon: 'layers' },
    { key: 'scan', label: 'Scan', icon: 'scan' },
    { key: 'data', label: 'Data', icon: 'table' }
  ];

  const bal_route = $derived($route_store);
  const bal_project_id = $derived(bal_route.name === 'project' ? bal_route.projectId : null);

  function bal_tab_area(bal_key: string): string {
    return bal_key === 'data' ? 'responses' : bal_key;
  }

  function bal_tab_href(bal_key: string): string {
    if (bal_key === 'projects') return '#/projects';
    return `#/project/${bal_project_id}/${bal_tab_area(bal_key)}`;
  }

  function bal_tab_active(bal_key: string): boolean {
    if (bal_route.name !== 'project') return bal_key === 'projects';
    if (bal_key === 'projects') return false;
    return bal_route.area === bal_tab_area(bal_key);
  }
</script>

<nav class="bottomnav" aria-label="Primary">
  {#each BAL_TABS as bal_tab (bal_tab.key)}
    {@const bal_enabled = bal_tab.key === 'projects' || bal_project_id !== null}
    {#if bal_enabled}
      <a
        class="tab"
        class:active={bal_tab_active(bal_tab.key)}
        href={bal_tab_href(bal_tab.key)}
        aria-current={bal_tab_active(bal_tab.key) ? 'page' : undefined}
      >
        <Icon name={bal_tab.icon} size={20} />
        <span class="tab-label">{bal_tab.label}</span>
      </a>
    {:else}
      <span class="tab tab-disabled" aria-disabled="true" title="Open a project first">
        <Icon name={bal_tab.icon} size={20} />
        <span class="tab-label">{bal_tab.label}</span>
      </span>
    {/if}
  {/each}
  {#if bal_project_id !== null}
    <button class="tab" type="button" onclick={onmore}>
      <Icon name="more" size={20} />
      <span class="tab-label">More</span>
    </button>
  {/if}
</nav>

<style>
  .bottomnav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-nav);
    display: flex;
    align-items: stretch;
    height: calc(var(--bottomnav-height) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--color-surface);
    border-top: var(--border-width) solid var(--color-border);
  }

  .tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-height: 44px;
    border: none;
    background: none;
    color: var(--color-ink-2);
    font-size: 11px;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    padding: 0;
  }

  .tab:hover {
    text-decoration: none;
    color: var(--color-ink);
  }

  .tab.active {
    color: var(--color-accent);
  }

  .tab-disabled {
    opacity: 0.38;
    cursor: default;
  }
</style>
