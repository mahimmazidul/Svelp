<script lang="ts">
  import Dialog from '../../components/ui/Dialog.svelte';
  import Button from '../../components/ui/Button.svelte';
  import ConfirmDialog from '../../components/ui/ConfirmDialog.svelte';
  import {
    bal_inspect_mahim_package,
    type BalInspectedPackage
  } from './mahim_import';
  import { bal_plan_collisions, bal_build_copy_remapping, bal_apply_copy_remapping, type BalCollisionPlan } from './mahim_collision';
  import { bal_commit_import, type BalImportReport } from './mahim_commit';

  let {
    open = $bindable(false),
    file,
    onimported
  }: {
    open?: boolean;
    file: File | null;
    onimported?: () => void;
  } = $props();

  let bal_stage = $state<
    'idle' | 'reading' | 'verifying' | 'preview' | 'checking' | 'importing' | 'finalizing' | 'done' | 'error'
  >('idle');
  let bal_error_title = $state('');
  let bal_error_detail = $state('');
  let bal_issue_lines = $state<string[]>([]);
  let bal_inspected = $state<BalInspectedPackage | null>(null);
  let bal_plan = $state<BalCollisionPlan | null>(null);
  let bal_report = $state<BalImportReport | null>(null);
  let bal_replace_confirm = $state(false);

  function bal_format_bytes(bal_bytes: number): string {
    if (bal_bytes < 1024) return `${bal_bytes} B`;
    if (bal_bytes < 1024 * 1024) return `${(bal_bytes / 1024).toFixed(1)} KB`;
    if (bal_bytes < 1024 * 1024 * 1024) return `${(bal_bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bal_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  $effect(() => {
    if (!open || !file) {
      if (!open) {
        bal_stage = 'idle';
        bal_error_title = '';
        bal_error_detail = '';
        bal_issue_lines = [];
        bal_inspected = null;
        bal_plan = null;
        bal_report = null;
      }
      return;
    }
    if (bal_stage !== 'idle') return;
    void bal_inspect();
  });

  async function bal_inspect(): Promise<void> {
    if (!file) return;
    bal_stage = 'reading';
    try {
      const bal_outcome = await bal_inspect_mahim_package(file);
      if (!bal_outcome.ok && 'failure' in bal_outcome) {
        bal_error_title = bal_outcome.failure.title;
        bal_error_detail = bal_outcome.failure.detail;
        bal_stage = 'error';
        return;
      }
      if (!bal_outcome.ok && 'issues' in bal_outcome) {
        bal_error_title = 'This Svelp data file uses an unsupported or invalid structure.';
        bal_issue_lines = bal_outcome.issues.map((bal_issue) => bal_issue.message);
        bal_stage = 'error';
        return;
      }
      bal_inspected = bal_outcome.inspected;
      bal_stage = 'verifying';
      bal_stage = 'preview';
      bal_plan = await bal_plan_collisions(bal_outcome.inspected);
    } catch (bal_err) {
      bal_error_title = 'The file could not be read.';
      bal_error_detail = bal_err instanceof Error ? bal_err.message : String(bal_err);
      bal_stage = 'error';
    }
  }

  async function bal_run_import(bal_resolution: 'merge' | 'replace'): Promise<void> {
    if (!bal_inspected) return;
    bal_stage = 'checking';
    try {
      const bal_target = $state.snapshot(bal_inspected);
      bal_stage = 'importing';
      const bal_result = await bal_commit_import(bal_target, bal_resolution);
      bal_stage = 'finalizing';
      bal_report = bal_result;
      bal_stage = 'done';
      onimported?.();
    } catch (bal_err) {
      bal_error_title = 'The import could not be completed.';
      bal_error_detail = bal_err instanceof Error ? bal_err.message : String(bal_err);
      bal_stage = 'error';
    }
  }

  async function bal_import_as_copy(): Promise<void> {
    if (!bal_inspected) return;
    bal_stage = 'checking';
    try {
      const bal_source = $state.snapshot(bal_inspected);
      const bal_remap = await bal_build_copy_remapping(bal_source);
      const bal_copy = bal_apply_copy_remapping(bal_source, bal_remap);
      bal_stage = 'importing';
      const bal_result = await bal_commit_import(bal_copy, 'merge');
      bal_stage = 'finalizing';
      bal_report = { ...bal_result, projectTitle: bal_copy.project.title };
      bal_stage = 'done';
      onimported?.();
    } catch (bal_err) {
      bal_error_title = 'The import could not be completed.';
      bal_error_detail = bal_err instanceof Error ? bal_err.message : String(bal_err);
      bal_stage = 'error';
    }
  }
</script>

<Dialog bind:open title="Import data package" onclose={() => (open = false)}>
  {#if bal_stage === 'error'}
    <div class="import-error">
      <p class="import-error-title">{bal_error_title}</p>
      {#if bal_error_detail}
        <p class="import-error-detail">{bal_error_detail}</p>
      {/if}
      {#if bal_issue_lines.length > 0}
        <ul class="import-issues">
          {#each bal_issue_lines.slice(0, 6) as bal_line, bal_i (bal_i)}
            <li>{bal_line}</li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else if bal_stage === 'done' && bal_report}
    <div class="import-done">
      <p class="import-done-title">{bal_report.projectTitle} was imported.</p>
      <ul class="import-facts">
        <li>Package type: {bal_report.mode === 'questionnaire-transfer' ? 'Questionnaire transfer' : 'Project backup'}</li>
        <li>
          Written: {bal_report.written.questionnaires} questionnaire{bal_report.written.questionnaires === 1 ? '' : 's'},
          {bal_report.written.scales} scale{bal_report.written.scales === 1 ? '' : 's'},
          {bal_report.written.printLayouts} print layout{bal_report.written.printLayouts === 1 ? '' : 's'}
        </li>
        {#if bal_report.mode === 'project-backup'}
          <li>
            Scan data: {bal_report.written.scanPages} page{bal_report.written.scanPages === 1 ? '' : 's'},
            {bal_report.written.scanAssets} image{bal_report.written.scanAssets === 1 ? '' : 's'}
          </li>
        {/if}
        {#if bal_report.resolution === 'replace'}
          <li>Existing local data for this project identity was replaced.</li>
        {/if}
        {#if bal_report.written.projects === 0}
          <li>The project already existed and was left untouched.</li>
        {/if}
      </ul>
      <p class="import-note">
        Printed sheets from another device keep working here: the print layout and scanner
        geometry travel inside the file.
      </p>
    </div>
  {:else if bal_stage === 'preview' && bal_inspected && bal_plan}
    <div class="import-preview">
      <p class="import-kind">
        {bal_inspected.manifest.mode === 'questionnaire-transfer'
          ? 'Questionnaire transfer package'
          : 'Project backup package'}
        <span class="import-size">{bal_format_bytes(file?.size ?? 0)}</span>
      </p>
      <dl class="import-facts">
        <dt>Project</dt>
        <dd>{bal_inspected.project.title}</dd>
        {#each bal_inspected.questionnaires as bal_q, bal_i (bal_i)}
          <dt>Questionnaire</dt>
          <dd>{bal_q.title} — version {bal_q.version}</dd>
        {/each}
        <dt>Contents</dt>
        <dd>
          {bal_inspected.questionnaires.reduce(
            (bal_total, bal_q) =>
              bal_total +
              bal_q.sections.reduce((bal_sub, bal_section) => bal_sub + bal_section.items.length, 0),
            0
          )} items,
          {bal_inspected.scales.length} scale{bal_inspected.scales.length === 1 ? '' : 's'},
          {bal_inspected.print.layouts.length} print layout{bal_inspected.print.layouts.length === 1 ? '' : 's'}
        </dd>
        {#if bal_inspected.manifest.mode === 'project-backup'}
          <dt>Scan data</dt>
          <dd>
            {bal_inspected.manifest.contents.scanPages} pages,
            {bal_inspected.manifest.contents.assets} image{bal_inspected.manifest.contents.assets === 1 ? '' : 's'}
            ({bal_format_bytes(bal_inspected.totalAssetBytes)})
          </dd>
        {/if}
        <dt>Integrity</dt>
        <dd>Verified: checksums and file digest are valid.</dd>
      </dl>
      {#if bal_plan.project.action !== 'add' || bal_plan.questionnaires.some((bal_q) => bal_q.action !== 'add')}
        <div class="import-collisions">
          <p class="import-collision-title">
            {bal_plan.project.action === 'dedupe' &&
            bal_plan.questionnaires.every((bal_q) => bal_q.action === 'dedupe')
              ? 'Already on this device'
              : 'Existing data on this device'}
          </p>
          <ul class="import-collision-list">
            <li>{bal_plan.project.detail}</li>
            {#each bal_plan.questionnaires as bal_q, bal_i (bal_i)}
              <li>{bal_q.detail}</li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {:else}
    <p class="import-stage" role="status">
      {bal_stage === 'reading' && 'Reading file…'}
      {bal_stage === 'verifying' && 'Verifying integrity…'}
      {bal_stage === 'checking' && 'Checking existing data…'}
      {bal_stage === 'importing' && 'Importing…'}
      {bal_stage === 'finalizing' && 'Finalizing…'}
    </p>
  {/if}
  {#snippet footer()}
    {#if bal_stage === 'preview' && bal_inspected && bal_plan}
      <div class="import-actions">
        <Button variant="secondary" onclick={() => (open = false)}>Cancel</Button>
        {#if bal_plan.project.action === 'conflict'}
          <Button variant="secondary" onclick={() => void bal_import_as_copy()}>Import as copy</Button>
          <Button variant="danger" onclick={() => (bal_replace_confirm = true)}>Replace existing</Button>
        {:else}
          <Button variant="primary" onclick={() => void bal_run_import('merge')}>Import</Button>
        {/if}
      </div>
    {:else if bal_stage === 'done' || bal_stage === 'error'}
      <div class="import-actions">
        <Button variant="primary" onclick={() => (open = false)}>Done</Button>
      </div>
    {:else}
      <div class="import-actions">
        <Button variant="secondary" disabled onclick={() => (open = false)}>Cancel</Button>
      </div>
    {/if}
  {/snippet}
</Dialog>

<ConfirmDialog
  open={bal_replace_confirm}
  title="Replace existing project"
  body="This deletes the local project “{bal_inspected?.project.title ?? ''}” with its scans and responses, and replaces it with the imported data. This cannot be undone."
  confirm_label="Replace project"
  cancel_label="Cancel"
  danger
  onconfirm={() => {
    bal_replace_confirm = false;
    void bal_run_import('replace');
  }}
  onclose={() => (bal_replace_confirm = false)}
/>

<style>
  .import-error-title {
    font-weight: 600;
  }

  .import-error-detail {
    margin-top: var(--space-2);
    color: var(--color-ink-2);
    font-size: var(--text-sm);
  }

  .import-issues {
    margin: var(--space-3) 0 0;
    padding-left: var(--space-5);
    color: var(--color-ink-3);
    font-size: var(--text-sm);
    display: grid;
    gap: var(--space-1);
  }

  .import-done-title,
  .import-kind {
    font-weight: 600;
  }

  .import-size {
    margin-left: var(--space-2);
    font-weight: 400;
    font-size: var(--text-sm);
    color: var(--color-ink-3);
  }

  .import-facts {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-1) var(--space-4);
    margin-top: var(--space-3);
    font-size: var(--text-sm);
  }

  .import-facts dt {
    color: var(--color-ink-3);
  }

  .import-facts dd {
    margin: 0;
    color: var(--color-ink-2);
  }

  .import-collisions {
    margin-top: var(--space-4);
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
  }

  .import-collision-title {
    font-weight: 600;
    font-size: var(--text-sm);
  }

  .import-collision-list {
    margin: var(--space-2) 0 0;
    padding-left: var(--space-5);
    color: var(--color-ink-2);
    font-size: var(--text-sm);
    display: grid;
    gap: var(--space-1);
  }

  .import-note {
    margin-top: var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-ink-3);
  }

  .import-stage {
    color: var(--color-ink-2);
  }

  .import-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
</style>
