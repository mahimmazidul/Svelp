<script lang="ts">
  import Dialog from '../../components/ui/Dialog.svelte';
  import Button from '../../components/ui/Button.svelte';
  import { malta_download_blob } from '../../utils/download';
  import type { ProjectRecord } from '../../models/types';
  import { dhon_questionnaire_by_project } from '../../db/questionnaires_repo';
  import { ken_pori_layouts_by_questionnaire, ken_pori_batches_by_project } from '../../db/print_repo';
  import { bal_scales_for_bundle } from '../../services/scale_service';
  import { bal_build_transfer_package } from './mahim_transfer';
  import { bal_build_backup_package, type BalBackupOptions } from './mahim_backup';
  import { bal_backup_filename, bal_transfer_filename } from './mahim_filenames';
  import { bal_mahim_open } from './mahim_container';
  import {
    ken_pori_scan_batches,
    ken_pori_scan_pages_by_project,
    ken_pori_scan_assets,
    ken_pori_scan_audit_by_project,
    ken_pori_response_runs_by_project,
    ken_pori_response_audit_by_project,
    ken_pori_dataset_snapshots,
    ken_pori_responses_for_project,
    ken_pori_blank_references_for_fingerprints
  } from './mahim_read_helpers';
  import { bal_get_all } from '../../db/client';
  import type { SettingRow } from '../../db/settings_repo';

  let {
    open = $bindable(false),
    mode,
    project,
    onexported
  }: {
    open?: boolean;
    mode: 'transfer' | 'backup';
    project: ProjectRecord;
    onexported?: () => void;
  } = $props();

  let bal_stage = $state<'idle' | 'options' | 'preparing' | 'encoding' | 'writing' | 'verifying' | 'done' | 'error'>('idle');
  let bal_error = $state<string | null>(null);
  let bal_summary = $state<string[]>([]);
  let bal_filename = $state('');
  let bal_blob = $state<Blob | null>(null);
  let bal_version = $state(1);
  let bal_advanced_open = $state(false);
  let bal_backup_options = $state<BalBackupOptions>({
    includeResponses: true,
    includeOriginalScans: false,
    includeNormalizedPages: false,
    includeThumbnails: true
  });
  let bal_estimate = $state<string | null>(null);

  function bal_format_bytes(bal_bytes: number): string {
    if (bal_bytes < 1024) return `${bal_bytes} B`;
    if (bal_bytes < 1024 * 1024) return `${(bal_bytes / 1024).toFixed(1)} KB`;
    if (bal_bytes < 1024 * 1024 * 1024) return `${(bal_bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bal_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  async function bal_estimate_backup(): Promise<void> {
    if (mode !== 'backup') return;
    try {
      const bal_batches = await ken_pori_scan_batches(project.id);
      const bal_assets = await ken_pori_scan_assets(bal_batches.map((bal_b) => bal_b.id));
      let bal_total = 0;
      for (const bal_asset of bal_assets) {
        if (bal_asset.kind === 'source' && !bal_backup_options.includeOriginalScans) continue;
        if (bal_asset.kind === 'normalized' && !bal_backup_options.includeNormalizedPages) continue;
        bal_total += bal_asset.size;
      }
      bal_estimate = bal_assets.length === 0
        ? 'No scan images stored for this project.'
        : `Approximate file size with the selected scan images: ${bal_format_bytes(bal_total)} or less, plus questionnaire data.`;
    } catch {
      bal_estimate = null;
    }
  }

  $effect(() => {
    if (!open) {
      bal_stage = 'idle';
      bal_error = null;
      bal_summary = [];
      bal_blob = null;
      return;
    }
    if (bal_stage !== 'idle') return;
    if (mode === 'backup') {
      void bal_estimate_backup();
      bal_stage = 'options';
      return;
    }
    void bal_run();
  });

  function bal_start_backup(): void {
    bal_stage = 'preparing';
    void bal_run();
  }

  async function bal_run(): Promise<void> {
    try {
      const bal_q = await dhon_questionnaire_by_project(project.id);
      if (!bal_q) {
        bal_error = 'This project has no questionnaire to export yet.';
        bal_stage = 'error';
        return;
      }
      bal_version = bal_q.version;
      const bal_scales = await bal_scales_for_bundle(
        bal_q.sections.flatMap((bal_section) =>
          bal_section.items.map((bal_item) => bal_item.scaleId).filter((bal_id): bal_id is string => bal_id !== null)
        )
      );
      const bal_layouts = await ken_pori_layouts_by_questionnaire(bal_q.id);
      const bal_batches = await ken_pori_batches_by_project(project.id);
      if (mode === 'transfer') {
        bal_stage = 'encoding';
        const bal_result = await bal_build_transfer_package({
          project,
          questionnaire: bal_q,
          scales: bal_scales,
          layouts: bal_layouts,
          batches: bal_batches
        });
        if ('issues' in bal_result) {
          bal_error = bal_result.issues[0]?.message ?? 'The package could not be built.';
          bal_stage = 'error';
          return;
        }
        bal_stage = 'writing';
        bal_filename = bal_transfer_filename(project.title, bal_q.version);
        bal_stage = 'verifying';
        const bal_reader = await bal_mahim_open(new Blob([bal_result.build.bytes]));
        const bal_report = await bal_reader.verify();
        if (!bal_report.valid) {
          bal_error = 'The written package failed its integrity verification and was not saved.';
          bal_stage = 'error';
          return;
        }
        bal_blob = new Blob([bal_result.build.bytes], { type: 'application/x-mahim' });
        bal_summary = [
          `Questionnaire: ${bal_q.title} (version ${bal_q.version})`,
          `Items: ${bal_result.build.summary.itemCount}`,
          `Referenced scales: ${bal_result.build.summary.scaleCount}`,
          bal_result.build.summary.includesPrint
            ? `Print layout and scanner geometry included (${bal_result.build.summary.pageCount} page${bal_result.build.summary.pageCount === 1 ? '' : 's'})`
            : 'No print layout yet: scanner geometry is not part of this file. Print this version first to include it.',
          `Print batch records: ${bal_result.build.summary.batchCount}`,
          'Scans, responses and recognition results are excluded.'
        ];
        bal_stage = 'done';
        return;
      }
      const bal_scan_batches = await ken_pori_scan_batches(project.id);
      const bal_scan_pages = await ken_pori_scan_pages_by_project(project.id);
      const bal_scan_assets = await ken_pori_scan_assets(bal_scan_batches.map((bal_b) => bal_b.id));
      const bal_scan_audit = await ken_pori_scan_audit_by_project(project.id);
      const bal_responses = bal_backup_options.includeResponses
        ? await ken_pori_responses_for_project(project.id)
        : [];
      const bal_runs = bal_backup_options.includeResponses
        ? await ken_pori_response_runs_by_project(project.id)
        : [];
      const bal_response_audit = bal_backup_options.includeResponses
        ? await ken_pori_response_audit_by_project(project.id)
        : [];
      const bal_blanks = await ken_pori_blank_references_for_fingerprints(
        bal_layouts.map((bal_layout) => bal_layout.fingerprint)
      );
      const bal_snapshots = bal_backup_options.includeResponses
        ? await ken_pori_dataset_snapshots(project.id)
        : [];
      const bal_settings = await bal_get_all<SettingRow<unknown>>('settings');
      bal_stage = 'encoding';
      const bal_backup = await bal_build_backup_package({
        project,
        questionnaires: [bal_q],
        scales: bal_scales,
        layouts: bal_layouts,
        batches: bal_batches,
        scanBatches: bal_scan_batches,
        scanPages: bal_scan_pages,
        scanAuditEvents: bal_scan_audit,
        responses: bal_responses,
        recognitionRuns: bal_runs,
        responseAuditEvents: bal_response_audit,
        blankReferences: bal_blanks,
        datasetSnapshots: bal_snapshots,
        assets: bal_scan_assets,
        settings: bal_settings,
        options: bal_backup_options
      });
      if ('issues' in bal_backup) {
        bal_error = bal_backup.issues[0]?.message ?? 'The backup could not be built.';
        bal_stage = 'error';
        return;
      }
      bal_stage = 'writing';
      bal_filename = bal_backup_filename(project.title);
      bal_stage = 'verifying';
      const bal_reader = await bal_mahim_open(new Blob([bal_backup.build.bytes]));
      const bal_report = await bal_reader.verify();
      if (!bal_report.valid) {
        bal_error = 'The written backup failed its integrity verification and was not saved.';
        bal_stage = 'error';
        return;
      }
      bal_blob = new Blob([bal_backup.build.bytes], { type: 'application/x-mahim' });
      bal_summary = [
        `Project: ${project.title}`,
        `Questionnaire: ${bal_q.title} (version ${bal_q.version})`,
        `Items: ${bal_backup.build.summary.itemCount}`,
        `Print layouts: ${bal_backup.build.summary.layoutCount}, print batches: ${bal_backup.build.summary.batchCount}`,
        `Scan batches: ${bal_backup.build.summary.scanBatchCount}, pages: ${bal_backup.build.summary.scanPageCount}`,
        `Scan images included: ${bal_backup.build.summary.assetCount} (${bal_format_bytes(bal_backup.build.summary.assetBytes)})`,
        bal_backup_options.includeResponses
          ? `Responses included: ${bal_backup.build.summary.responseCount}`
          : 'Responses are excluded from this backup.'
      ];
      bal_stage = 'done';
    } catch (bal_err) {
      bal_error = bal_err instanceof Error ? bal_err.message : 'The export could not be completed.';
      bal_stage = 'error';
    }
  }

  function bal_download(): void {
    if (!bal_blob) return;
    malta_download_blob(bal_filename, bal_blob);
    onexported?.();
    open = false;
  }
</script>

<Dialog bind:open title={mode === 'transfer' ? 'Export for another device' : 'Export project backup'} onclose={() => (open = false)}>
  {#if bal_stage === 'options'}
    <div class="export-options-body">
      <p class="export-estimate">{bal_estimate ?? 'Choose what to include in the backup.'}</p>
      <fieldset class="export-options">
        <legend>Include scan images</legend>
        <label class="export-option">
          <input type="checkbox" bind:checked={bal_backup_options.includeOriginalScans} />
          Original scans
        </label>
        <label class="export-option">
          <input type="checkbox" bind:checked={bal_backup_options.includeNormalizedPages} />
          Normalized pages
        </label>
        <label class="export-option">
          <input type="checkbox" bind:checked={bal_backup_options.includeThumbnails} />
          Thumbnails
        </label>
        <label class="export-option">
          <input type="checkbox" bind:checked={bal_backup_options.includeResponses} />
          Responses and recognition history
        </label>
      </fieldset>
    </div>
  {:else if bal_stage === 'error'}
    <p class="export-error">{bal_error}</p>
  {:else if bal_stage === 'done' && bal_blob}
    <div class="export-summary">
      <p class="export-file">
        <strong>{bal_filename}</strong>
        <span class="export-size">{bal_format_bytes(bal_blob.size)}</span>
      </p>
      <ul class="export-list">
        {#each bal_summary as bal_line, bal_i (bal_i)}
          <li>{bal_line}</li>
        {/each}
      </ul>
      <details class="export-advanced" bind:open={bal_advanced_open}>
        <summary>Package details</summary>
        <dl class="export-details">
          <dt>Container</dt>
          <dd>MAHIM</dd>
          <dt>Application</dt>
          <dd>Svelp</dd>
          <dt>Svelp data version</dt>
          <dd>1</dd>
          <dt>Questionnaire version</dt>
          <dd>{bal_version}</dd>
        </dl>
      </details>
    </div>
  {:else}
    <p class="export-stage" role="status">
      {bal_stage === 'preparing' && 'Preparing…'}
      {bal_stage === 'encoding' && 'Encoding…'}
      {bal_stage === 'writing' && 'Writing…'}
      {bal_stage === 'verifying' && 'Verifying…'}
    </p>
  {/if}
  {#snippet footer()}
    {#if bal_stage === 'options'}
      <div class="export-actions">
        <Button variant="secondary" onclick={() => (open = false)}>Cancel</Button>
        <Button variant="primary" onclick={bal_start_backup}>Create backup</Button>
      </div>
    {:else if bal_stage === 'error'}
      <div class="export-actions">
        <Button variant="secondary" onclick={() => (open = false)}>Close</Button>
      </div>
    {:else if bal_stage === 'done' && bal_blob}
      <div class="export-actions">
        <Button variant="secondary" onclick={() => (open = false)}>Close</Button>
        <Button variant="primary" icon="download" onclick={bal_download}>Download file</Button>
      </div>
    {/if}
  {/snippet}
</Dialog>

<style>
  .export-error {
    color: var(--color-danger);
  }

  .export-summary {
    display: grid;
    gap: var(--space-3);
  }

  .export-file {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .export-size {
    font-size: var(--text-sm);
    color: var(--color-ink-3);
  }

  .export-list {
    margin: 0;
    padding-left: var(--space-5);
    display: grid;
    gap: var(--space-2);
    color: var(--color-ink-2);
    font-size: var(--text-sm);
  }

  .export-advanced {
    font-size: var(--text-sm);
  }

  .export-advanced summary {
    cursor: pointer;
    color: var(--color-ink-3);
  }

  .export-details {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-1) var(--space-4);
    margin-top: var(--space-2);
    color: var(--color-ink-2);
  }

  .export-details dt {
    color: var(--color-ink-3);
  }

  .export-details dd {
    margin: 0;
  }

  .export-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .export-stage {
    color: var(--color-ink-2);
  }

  .export-estimate {
    font-size: var(--text-sm);
    color: var(--color-ink-3);
  }

  .export-options {
    margin-top: var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    display: grid;
    gap: var(--space-2);
  }

  .export-options legend {
    font-size: var(--text-sm);
    color: var(--color-ink-3);
    padding: 0 var(--space-2);
  }

  .export-option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
  }
</style>
