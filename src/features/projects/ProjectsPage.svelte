<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import ConfirmDialog from '../../components/ui/ConfirmDialog.svelte';
  import Dialog from '../../components/ui/Dialog.svelte';
  import EmptyState from '../../components/ui/EmptyState.svelte';
  import Icon from '../../icons/Icon.svelte';
  import {
    bal_banaitesi_project,
    lichu_project,
    malta_project,
    ram_chagol_project
  } from '../../services/project_service';
  import {
    biriyani_project,
    hati_bundle,
    hati_bundle_filename
  } from '../../services/backup_service';
  import {
    bal_scale_ids_of_questionnaire,
    bal_scales_for_bundle
  } from '../../services/scale_service';
  import {
    sagol_versions_by_project,
    dhon_questionnaire_by_project
  } from '../../db/questionnaires_repo';
  import { ken_pori_projects } from '../../db/projects_repo';
  import { malta_download_file } from '../../utils/download';
  import type { ProjectRecord } from '../../models/types';
  import ProjectFormDialog from './ProjectFormDialog.svelte';
  import ProjectRow from './ProjectRow.svelte';

  let bal_rows = $state<ProjectRecord[]>([]);
  let bal_versions = $state<Record<string, number>>({});
  let bal_loading = $state(true);
  let bal_error = $state<string | null>(null);
  let bal_query = $state('');

  let shawya_create_open = $state(false);
  let shawya_rename_target = $state<ProjectRecord | null>(null);
  let shawya_delete_target = $state<ProjectRecord | null>(null);
  let shawya_import_result = $state<
    { kind: 'imported' | 'imported-as-copy'; title: string } | { kind: 'error'; message: string } | null
  >(null);
  let bal_file_input = $state<HTMLInputElement | undefined>(undefined);

  async function bal_refresh(): Promise<void> {
    try {
      const bal_projects = await ken_pori_projects();
      const bal_version_map = await sagol_versions_by_project();
      bal_rows = bal_projects;
      bal_versions = bal_version_map;
      bal_error = null;
    } catch {
      bal_error = 'Projects could not be loaded from local storage.';
    } finally {
      bal_loading = false;
    }
  }

  $effect(() => {
    void bal_refresh();
  });

  const bal_filtered = $derived(
    bal_rows.filter((bal_row) =>
      bal_row.title.toLowerCase().includes(bal_query.trim().toLowerCase())
    )
  );

  async function bal_create(bal_values: { title: string; description: string }): Promise<void> {
    await bal_banaitesi_project(bal_values);
    shawya_create_open = false;
    await bal_refresh();
  }

  async function bal_rename_submit(bal_values: {
    title: string;
    description: string;
  }): Promise<void> {
    if (!shawya_rename_target) return;
    await ram_chagol_project(shawya_rename_target.id, bal_values);
    shawya_rename_target = null;
    await bal_refresh();
  }

  async function bal_duplicate(bal_row: ProjectRecord): Promise<void> {
    await malta_project(bal_row.id);
    await bal_refresh();
  }

  async function bal_delete(bal_row: ProjectRecord): Promise<void> {
    await lichu_project(bal_row.id);
    shawya_delete_target = null;
    await bal_refresh();
  }

  async function bal_export(bal_row: ProjectRecord): Promise<void> {
    const bal_q = await dhon_questionnaire_by_project(bal_row.id);
    if (!bal_q) {
      shawya_import_result = {
        kind: 'error',
        message: 'This project has no draft questionnaire to back up.'
      };
      return;
    }
    const bal_bundle = hati_bundle(
      bal_row,
      bal_q,
      await bal_scales_for_bundle(bal_scale_ids_of_questionnaire(bal_q))
    );
    malta_download_file(
      hati_bundle_filename(bal_row.title),
      JSON.stringify(bal_bundle, null, 2),
      'application/json'
    );
  }

  async function bal_import(bal_event: Event): Promise<void> {
    const bal_input = bal_event.currentTarget as HTMLInputElement;
    const bal_file = bal_input.files?.[0];
    bal_input.value = '';
    if (!bal_file) return;
    try {
      const bal_text = await bal_file.text();
      const bal_outcome = await biriyani_project(bal_text);
      shawya_import_result = { kind: bal_outcome.status, title: bal_outcome.project.title };
      await bal_refresh();
    } catch (bal_err) {
      shawya_import_result = {
        kind: 'error',
        message: bal_err instanceof Error ? bal_err.message : 'The project could not be imported.'
      };
    }
  }
</script>

<div class="page">
  <div class="page-header">
    <div class="page-header-text">
      <h1>Projects</h1>
      <p class="page-lede">
        Questionnaires are stored locally on this device and keep working without a connection.
      </p>
    </div>
    <div class="header-actions">
      <Button variant="secondary" icon="upload" onclick={() => bal_file_input?.click()}>
        Import
      </Button>
      <Button variant="primary" icon="plus" onclick={() => (shawya_create_open = true)}>
        New project
      </Button>
    </div>
  </div>

  {#if bal_loading}
    <p class="muted">Loading projects…</p>
  {:else if bal_error}
    <EmptyState icon="alert" title="Local storage unavailable" body={bal_error}>
      <Button variant="secondary" onclick={() => void bal_refresh()}>Try again</Button>
    </EmptyState>
  {:else if bal_rows.length === 0}
    <EmptyState
      icon="folder"
      title="No projects yet"
      body="Create a project to start building a questionnaire. Everything stays on this device."
    >
      <Button variant="primary" icon="plus" onclick={() => (shawya_create_open = true)}>
        New project
      </Button>
    </EmptyState>
  {:else}
    <div class="list-head">
      <div class="search">
        <Icon name="search" size={16} />
        <input
          type="search"
          placeholder="Search by title"
          bind:value={bal_query}
          aria-label="Search projects by title"
        />
      </div>
      <span class="count">
        {bal_rows.length}
        {bal_rows.length === 1 ? 'project' : 'projects'}
      </span>
    </div>
    <div class="rows">
      {#each bal_filtered as bal_row (bal_row.id)}
        <ProjectRow
          project={bal_row}
          version={bal_versions[bal_row.id] ?? 1}
          onrename={(bal_target) => (shawya_rename_target = bal_target)}
          onduplicate={bal_duplicate}
          onexport={bal_export}
          ondelete={(bal_target) => (shawya_delete_target = bal_target)}
        />
      {/each}
      {#if bal_filtered.length === 0}
        <p class="muted">No projects match this search.</p>
      {/if}
    </div>
  {/if}
</div>

<input
  bind:this={bal_file_input}
  class="visually-hidden"
  type="file"
  accept="application/json,.json"
  onchange={bal_import}
  tabindex="-1"
  aria-hidden="true"
/>

<ProjectFormDialog
  bind:open={shawya_create_open}
  mode="create"
  onsubmit={bal_create}
  oncancel={() => (shawya_create_open = false)}
/>

{#if shawya_rename_target}
  <ProjectFormDialog
    open={true}
    mode="rename"
    initial={shawya_rename_target}
    onsubmit={bal_rename_submit}
    oncancel={() => (shawya_rename_target = null)}
  />
{/if}

<ConfirmDialog
  open={shawya_delete_target !== null}
  title="Delete project"
  body="This permanently deletes “{shawya_delete_target?.title ?? ''}” and its draft questionnaire from this device. This cannot be undone."
  confirm_label="Delete project"
  danger
  onconfirm={() => shawya_delete_target && bal_delete(shawya_delete_target)}
  onclose={() => (shawya_delete_target = null)}
/>

{#if shawya_import_result}
  <Dialog
    open={true}
    title={shawya_import_result.kind === 'error' ? 'Import failed' : 'Project imported'}
    onclose={() => (shawya_import_result = null)}
  >
    {#if shawya_import_result.kind === 'error'}
      <p class="result-text">{shawya_import_result.message}</p>
    {:else}
      <p class="result-text">
        {shawya_import_result.title} was added to this device.
      </p>
      {#if shawya_import_result.kind === 'imported-as-copy'}
        <p class="result-note">
          A project with the same identifier already existed, so it was imported as a separate
          copy. The original was left untouched.
        </p>
      {/if}
    {/if}
    {#snippet footer()}
      <div class="result-actions">
        <Button variant="primary" onclick={() => (shawya_import_result = null)}>Done</Button>
      </div>
    {/snippet}
  </Dialog>
{/if}

<style>
  .header-actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .list-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
    max-width: 360px;
    height: var(--control-height);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink-3);
  }

  .search:focus-within {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .search input {
    flex: 1;
    min-width: 0;
    border: none;
    background: none;
    color: var(--color-ink);
  }

  .search input:focus {
    outline: none;
  }

  .count {
    font-size: var(--text-sm);
    color: var(--color-ink-3);
    white-space: nowrap;
  }

  .rows {
    display: grid;
    gap: var(--space-3);
  }

  .result-text {
    color: var(--color-ink-2);
  }

  .result-note {
    margin-top: var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-ink-3);
  }

  .result-actions {
    display: flex;
    justify-content: flex-end;
  }

  @media (max-width: 767px) {
    .list-head {
      flex-direction: column;
      align-items: stretch;
    }

    .search {
      max-width: none;
    }
  }
</style>
