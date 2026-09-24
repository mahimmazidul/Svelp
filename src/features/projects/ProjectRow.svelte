<script lang="ts">
  import DropdownMenu from '../../components/ui/DropdownMenu.svelte';
  import StatusPill from '../../components/ui/StatusPill.svelte';
  import { shawya_format_datetime } from '../../utils/datetime';
  import type { ProjectRecord } from '../../models/types';

  let {
    project,
    version,
    onrename,
    onduplicate,
    onexport,
    ondelete
  }: {
    project: ProjectRecord;
    version: number;
    onrename: (bal_row: ProjectRecord) => void;
    onduplicate: (bal_row: ProjectRecord) => void;
    onexport: (bal_row: ProjectRecord) => void;
    ondelete: (bal_row: ProjectRecord) => void;
  } = $props();
</script>

<article class="row">
  <div class="row-main">
    <a class="row-title" href="#/project/{project.id}/build">{project.title}</a>
    {#if project.description}
      <p class="row-desc">{project.description}</p>
    {/if}
    <div class="row-meta">
      <StatusPill tone={project.status === 'active' ? 'success' : 'neutral'} label="Active" />
      <span class="meta-chip">Draft v{version}</span>
      <span class="meta-date">Updated {shawya_format_datetime(project.updatedAt)}</span>
    </div>
  </div>
  <DropdownMenu
    trigger_icon="more"
    trigger_label="Actions for {project.title}"
    items={[
      { id: 'open', label: 'Open', icon: 'eye', onSelect: () => window.open(`#/project/${project.id}/build`, '_self') },
      { id: 'rename', label: 'Rename', icon: 'pencil', onSelect: () => onrename(project) },
      { id: 'duplicate', label: 'Duplicate', icon: 'copy', onSelect: () => onduplicate(project) },
      { id: 'export', label: 'Export backup', icon: 'download', onSelect: () => onexport(project) },
      { id: 'delete', label: 'Delete', icon: 'trash', danger: true, onSelect: () => ondelete(project) }
    ]}
  />
</article>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .row:hover {
    border-color: var(--color-border-strong);
  }

  .row-main {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: var(--space-1);
  }

  .row-title {
    font-size: var(--text-lg);
    font-weight: 650;
    color: var(--color-ink);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-title:hover {
    color: var(--color-accent);
    text-decoration: none;
  }

  .row-desc {
    color: var(--color-ink-2);
    font-size: var(--text-sm);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .row-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    margin-top: var(--space-1);
  }

  .meta-chip {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-ink-2);
    background: var(--color-surface-2);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-full);
    padding: 2px 8px;
    white-space: nowrap;
  }

  .meta-date {
    font-size: var(--text-xs);
    color: var(--color-ink-3);
    white-space: nowrap;
  }
</style>
