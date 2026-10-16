<script lang="ts">
  import { route_store } from './app/router/route_store';
  import { project_context } from './app/project_context';
  import AppShell from './app/shell/AppShell.svelte';
  import ProjectsPage from './features/projects/ProjectsPage.svelte';
  import BuilderPage from './features/builder/BuilderPage.svelte';
  import PreviewPage from './features/preview/PreviewPage.svelte';
  import PrintPage from './features/print/PrintPage.svelte';
  import ScanPage from './features/scan/ScanPage.svelte';
  import ResponsesPage from './features/reading/ResponsesPage.svelte';
  import ExportPage from './features/export/ExportPage.svelte';
  import SettingsPage from './features/settings/SettingsPage.svelte';
  import NotFoundPage from './features/placeholders/NotFoundPage.svelte';
  import { BAL_DEFAULT_META, bal_apply_route_meta, bal_is_raw_app_entry, bal_meta_for_route } from './app/route_meta';

  const bal_route = $derived($route_store);

  $effect(() => {
    if (typeof document === 'undefined') return;
    const bal_area = bal_route.name === 'project' ? bal_route.area : null;
    if (bal_route.name === 'projects' && bal_is_raw_app_entry()) {
      bal_apply_route_meta(BAL_DEFAULT_META, bal_route.name);
      return;
    }
    bal_apply_route_meta(bal_meta_for_route(bal_route.name, bal_area), bal_route.name);
  });

  $effect(() => {
    if (bal_route.name === 'project') {
      void project_context.load(bal_route.projectId);
    }
  });
</script>

<AppShell>
  {#if bal_route.name === 'projects'}
    <ProjectsPage />
  {:else if bal_route.name === 'scan'}
    <ScanPage projectId={null} />
  {:else if bal_route.name === 'project'}
    {#if bal_route.area === 'build'}
      <BuilderPage projectId={bal_route.projectId} />
    {:else if bal_route.area === 'preview'}
      <PreviewPage projectId={bal_route.projectId} />
    {:else if bal_route.area === 'print'}
      <PrintPage projectId={bal_route.projectId} />
    {:else if bal_route.area === 'scan'}
      <ScanPage projectId={bal_route.projectId} />
    {:else if bal_route.area === 'responses'}
      <ResponsesPage projectId={bal_route.projectId} />
    {:else if bal_route.area === 'export'}
      <ExportPage projectId={bal_route.projectId} />
    {:else if bal_route.area === 'settings'}
      <SettingsPage />
    {/if}
  {:else}
    <NotFoundPage />
  {/if}
</AppShell>
