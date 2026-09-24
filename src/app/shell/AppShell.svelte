<script lang="ts">
  import type { Snippet } from 'svelte';
  import { route_store } from '../router/route_store';
  import { project_context } from '../project_context';
  import { ghora_layout } from '../../utils/breakpoints';
  import Sidebar from './Sidebar.svelte';
  import MobileNav from './MobileNav.svelte';
  import MoreSheet from './MoreSheet.svelte';
  import BrandMark from './BrandMark.svelte';
  import Icon from '../../icons/Icon.svelte';

  let { children }: { children?: Snippet } = $props();

  let shawya_more_open = $state(false);

  const bal_route = $derived($route_store);
  const bal_in_project = $derived(bal_route.name === 'project');
  const bal_mobile = $derived($ghora_layout === 'mobile');
</script>

<div class="shell">
  <Sidebar />
  <div class="main">
    {#if bal_mobile}
      <header class="topbar">
        {#if bal_in_project}
          <a class="topbar-btn" href="#/projects" aria-label="Back to Projects">
            <Icon name="arrow-left" size={20} />
          </a>
        {:else}
          <a class="topbar-btn" href="#/projects" aria-label="Svelp home">
            <BrandMark size={22} />
          </a>
        {/if}
        <div class="topbar-title">
          {#if bal_in_project}
            {$project_context.project?.title ?? 'Project'}
          {:else}
            Projects
          {/if}
        </div>
        {#if bal_in_project}
          <button
            class="topbar-btn"
            type="button"
            onclick={() => (shawya_more_open = true)}
            aria-label="More areas"
          >
            <Icon name="more" size={20} />
          </button>
        {:else}
          <span class="topbar-spacer" aria-hidden="true"></span>
        {/if}
      </header>
    {/if}
    <main class="content">
      {@render children?.()}
    </main>
  </div>
  {#if bal_mobile}
    <MobileNav onmore={() => (shawya_more_open = true)} />
  {/if}
</div>

{#if bal_mobile && bal_in_project}
  <MoreSheet bind:open={shawya_more_open} />
{/if}

<style>
  .shell {
    display: flex;
    min-height: 100dvh;
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: var(--z-topbar);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: 56px;
    padding: 0 var(--space-2);
    background: var(--color-surface);
    border-bottom: var(--border-width) solid var(--color-border);
  }

  .topbar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-ink-2);
    cursor: pointer;
    flex: none;
    text-decoration: none;
  }

  .topbar-btn:hover {
    background: var(--color-surface-2);
    color: var(--color-ink);
    text-decoration: none;
  }

  .topbar-title {
    flex: 1;
    min-width: 0;
    text-align: center;
    font-weight: 650;
    font-size: var(--text-md);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 var(--space-1);
  }

  .topbar-spacer {
    width: 44px;
    flex: none;
  }

  .content {
    flex: 1;
    min-width: 0;
  }
</style>
