<script lang="ts">
  import { route_store } from './app/router/route_store';
  import { project_context } from './app/project_context';
  import AppShell from './app/shell/AppShell.svelte';
  import ProjectsPage from './features/projects/ProjectsPage.svelte';
  import BuilderPage from './features/builder/BuilderPage.svelte';
  import PreviewPage from './features/preview/PreviewPage.svelte';
  import PrintPage from './features/print/PrintPage.svelte';
  import PlaceholderPage from './features/placeholders/PlaceholderPage.svelte';
  import NotFoundPage from './features/placeholders/NotFoundPage.svelte';

  const bal_route = $derived($route_store);

  $effect(() => {
    if (bal_route.name === 'project') {
      void project_context.load(bal_route.projectId);
    }
  });
</script>

<AppShell>
  {#if bal_route.name === 'projects'}
    <ProjectsPage />
  {:else if bal_route.name === 'project'}
    {#if bal_route.area === 'build'}
      <BuilderPage projectId={bal_route.projectId} />
    {:else if bal_route.area === 'preview'}
      <PreviewPage projectId={bal_route.projectId} />
    {:else if bal_route.area === 'print'}
      <PrintPage projectId={bal_route.projectId} />
    {:else}
      <PlaceholderPage area={bal_route.area} />
    {/if}
  {:else}
    <NotFoundPage />
  {/if}
</AppShell>
