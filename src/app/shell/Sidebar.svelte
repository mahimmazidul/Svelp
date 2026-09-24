<script lang="ts">
  import { route_store } from '../router/route_store';
  import { project_context } from '../project_context';
  import { BAL_AREA_LINKS } from './area_links';
  import BrandMark from './BrandMark.svelte';
  import Icon from '../../icons/Icon.svelte';

  const bal_route = $derived($route_store);
  const bal_ctx = $derived($project_context);
  const bal_project_id = $derived(bal_route.name === 'project' ? bal_route.projectId : null);
</script>

<aside class="sidebar">
  <a class="brand" href="#/projects" aria-label="Svelp home">
    <BrandMark size={30} wordmark tagline />
  </a>
  <nav class="nav" aria-label="Primary">
    <a
      class="nav-link"
      class:active={bal_route.name === 'projects'}
      href="#/projects"
      title="Projects"
    >
      <Icon name="folder" size={20} />
      <span class="nav-label">Projects</span>
    </a>
    {#if bal_project_id && bal_ctx.status === 'ready' && bal_ctx.project}
      <div class="project-block">
        <div class="project-block-label nav-label">{bal_ctx.project.title}</div>
        {#each BAL_AREA_LINKS as bal_link (bal_link.area)}
          <a
            class="nav-link"
            class:active={bal_route.name === 'project' && bal_route.area === bal_link.area}
            href="#/project/{bal_project_id}/{bal_link.area}"
            title={bal_link.label}
          >
            <Icon name={bal_link.icon} size={20} />
            <span class="nav-label">{bal_link.label}</span>
          </a>
        {/each}
      </div>
    {/if}
  </nav>
  <footer class="sidebar-foot">
    <span class="nav-label foot-line">Svelp {__SVELP_VERSION__}</span>
    <span class="nav-label foot-line foot-dim">Local data</span>
  </footer>
</aside>

<style>
  .sidebar {
    width: var(--sidebar-width);
    flex: none;
    position: sticky;
    top: 0;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border-right: var(--border-width) solid var(--color-border);
    padding: var(--space-5) var(--space-3);
    gap: var(--space-5);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    padding: var(--space-2) var(--space-2);
    border-radius: var(--radius-md);
    color: inherit;
  }

  .brand:hover {
    text-decoration: none;
    background: var(--color-surface-2);
  }

  .nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    height: 40px;
    padding: 0 var(--space-3);
    border-radius: var(--radius-md);
    color: var(--color-ink-2);
    font-size: var(--text-md);
    white-space: nowrap;
  }

  .nav-link:hover {
    background: var(--color-surface-2);
    color: var(--color-ink);
    text-decoration: none;
  }

  .nav-link.active {
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font-weight: 600;
  }

  .project-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: var(--border-width) solid var(--color-border);
  }

  .project-block-label {
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-ink-3);
    padding: 0 var(--space-3) var(--space-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar-foot {
    display: grid;
    gap: 2px;
    padding: var(--space-3);
  }

  .foot-line {
    font-size: var(--text-xs);
    color: var(--color-ink-3);
  }

  .foot-dim {
    color: var(--color-ink-3);
    opacity: 0.75;
  }

  @media (max-width: 767px) {
    .sidebar {
      display: none;
    }
  }

  @media (min-width: 768px) and (max-width: 1023px) {
    .sidebar {
      width: var(--rail-width);
      padding: var(--space-4) var(--space-2);
      align-items: center;
    }

    .nav-label,
    .brand :global(.brand-text) {
      display: none;
    }

    .nav,
    .project-block,
    .sidebar-foot {
      align-items: center;
      width: 100%;
    }

    .nav-link {
      justify-content: center;
      padding: 0;
      width: 44px;
    }

    .project-block-label {
      padding: 0 0 var(--space-2);
    }

    .sidebar-foot {
      display: none;
    }
  }
</style>
