<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../../components/ui/Button.svelte';
  import EmptyState from '../../components/ui/EmptyState.svelte';
  import IconButton from '../../components/ui/IconButton.svelte';
  import StatusPill from '../../components/ui/StatusPill.svelte';
  import Switch from '../../components/ui/Switch.svelte';
  import ConfirmDialog from '../../components/ui/ConfirmDialog.svelte';
  import { dhon_questionnaire_by_project } from '../../db/questionnaires_repo';
  import { ken_pori_scan_batches, ken_pori_scan_pages, dhon_scan_batch, bal_save_scan_batch } from '../../db/scan_repo';
  import { ken_pori_layouts_by_questionnaire } from '../../db/print_repo';
  import type { PrintLayoutRecord } from '../../models/print_models';
  import type { QuestionnaireRecord } from '../../models/types';
  import type { ScanBatchRecord, ScanPageRecord } from '../../models/scan_models';
  import {
    bal_add_files_to_batch,
    bal_default_encode_normalized,
    bal_new_batch_for_project,
    bal_remove_originals,
    bal_resolve_duplicate_pair,
    bal_run_batch_queue,
    bal_set_page_thumbs,
    bal_stage_decode_source,
    bal_delete_scan_batch,
    bal_manual_identify_page,
    bal_apply_manual_corner_correction,
    bal_reprocess_page,
    type bal_QueueRunUpdate
  } from '../../services/scan_run';
  import { bal_worker_available, bal_create_worker_processor, type bal_WorkerHandle } from './scan_worker_client';
  import { bal_render_pdf_pages, bal_browser_pdf_page_renderer } from './scan_pdf';
  import {
    BAL_REVIEW_CATEGORIES,
    bal_category_pages,
    bal_format_bytes,
    bal_page_title,
    bal_review_pages,
    bal_status_label,
    bal_status_tone
  } from './scan_ui_helpers';
  import ScanViewerSheet from './ScanViewerSheet.svelte';
  import ScanIdentifySheet from './ScanIdentifySheet.svelte';
  import ScanCornerEditor from './ScanCornerEditor.svelte';
  import ScanDuplicateSheet from './ScanDuplicateSheet.svelte';

  let { projectId }: { projectId: string } = $props();

  let bal_status = $state<'loading' | 'ready' | 'missing'>('loading');
  let bal_questionnaire = $state<QuestionnaireRecord | null>(null);
  let bal_layouts = $state<PrintLayoutRecord[]>([]);
  let bal_batch = $state<ScanBatchRecord | null>(null);
  let bal_pages = $state<ScanPageRecord[]>([]);
  let bal_staging = $state<{ name: string; size: number; thumb: string | null }[]>([]);
  let bal_staging_files = $state<{ name: string; type: string; bytes: Blob }[]>([]);
  let bal_processing = $state(false);
  let bal_progress = $state<{ done: number; total: number; eta: string } | null>(null);
  let bal_note = $state<string | null>(null);
  let bal_file_input = $state<HTMLInputElement | undefined>(undefined);
  let bal_drag_over = $state(false);
  let bal_keep_originals = $state(true);
  let bal_storage = $state<{ source: number; normalized: number } | null>(null);
  let bal_confirm_remove_originals = $state(false);
  let bal_confirm_clear = $state(false);
  let bal_confirm_cancel = $state(false);
  let bal_cancel_requested = $state(false);
  let bal_viewer_page = $state<ScanPageRecord | null>(null);
  let bal_identify_page = $state<ScanPageRecord | null>(null);
  let bal_corner_page = $state<ScanPageRecord | null>(null);
  let bal_duplicate_pair = $state<{ a: ScanPageRecord; b: ScanPageRecord } | null>(null);
  let bal_worker: bal_WorkerHandle | null = null;

  onMount(() => {
    void (async () => {
      const bal_q = await dhon_questionnaire_by_project(projectId);
      bal_questionnaire = bal_q ?? null;
      bal_status = 'ready';
      if (!bal_q) return;
      bal_layouts = await ken_pori_layouts_by_questionnaire(bal_q.id);
      const bal_batches = await ken_pori_scan_batches(projectId);
      if (bal_batches.length > 0) {
        bal_batch = bal_batches[0];
        bal_pages = await ken_pori_scan_pages(bal_batches[0].id);
        bal_keep_originals = bal_batches[0].keepOriginals;
        await bal_refresh_storage();
      }
    })();
    return () => {
      bal_worker?.dispose();
      bal_worker = null;
    };
  });

  const bal_review = $derived(bal_review_pages(bal_pages));
  const bal_ready_pages = $derived(bal_pages.filter((bal_page) => bal_page.status === 'ready'));
  const bal_overview = $derived.by(() => {
    const bal_ready = bal_pages.filter((bal_page) => bal_page.status === 'ready');
    const bal_respondents = new Set(
      bal_ready.map((bal_page) => `${bal_page.questionnaireId}|${bal_page.questionnaireVersion}|${bal_page.respondentId}`)
    );
    return {
      respondents: bal_respondents.size,
      ready: bal_ready.length,
      review: bal_pages.filter((bal_page) => bal_page.status === 'needs-review').length,
      duplicates: bal_pages.filter((bal_page) => bal_page.status === 'duplicate').length,
      failed:
        bal_pages.filter((bal_page) => bal_page.status === 'failed').length +
        bal_pages.filter((bal_page) => bal_page.status === 'unsupported').length,
      queued: bal_pages.filter((bal_page) => bal_page.status === 'queued').length
    };
  });
  const bal_active_categories = $derived(
    BAL_REVIEW_CATEGORIES.filter((bal_category) => bal_category_pages(bal_review, bal_category.id).length > 0)
  );

  function bal_flash(bal_message: string): void {
    bal_note = bal_message;
    setTimeout(() => (bal_note = null), 2400);
  }

  async function bal_make_thumb(bal_blob: Blob, bal_max_px = 240): Promise<string | null> {
    try {
      const bal_bitmap = await createImageBitmap(bal_blob, { imageOrientation: 'from-image' });
      const bal_scale = Math.min(1, bal_max_px / Math.max(bal_bitmap.width, bal_bitmap.height));
      const bal_canvas = document.createElement('canvas');
      bal_canvas.width = Math.max(1, Math.round(bal_bitmap.width * bal_scale));
      bal_canvas.height = Math.max(1, Math.round(bal_bitmap.height * bal_scale));
      const bal_context = bal_canvas.getContext('2d') as CanvasRenderingContext2D;
      bal_context.drawImage(bal_bitmap, 0, 0, bal_canvas.width, bal_canvas.height);
      bal_bitmap.close();
      return bal_canvas.toDataURL('image/jpeg', 0.6);
    } catch {
      return null;
    }
  }

  function bal_accept_files(bal_list: FileList | File[]): void {
    const bal_incoming = [...bal_list];
    for (const bal_file of bal_incoming) {
      bal_staging_files = [...bal_staging_files, { name: bal_file.name, type: bal_file.type, bytes: bal_file }];
      bal_staging = [...bal_staging, { name: bal_file.name, size: bal_file.size, thumb: null }];
      if (bal_file.type.startsWith('image/')) {
        void bal_make_thumb(bal_file).then((bal_thumb) => {
          bal_staging = bal_staging.map((bal_item) =>
            bal_item.name === bal_file.name ? { ...bal_item, thumb: bal_thumb } : bal_item
          );
        });
      }
    }
  }

  function bal_on_drop(bal_event: DragEvent): void {
    bal_event.preventDefault();
    bal_drag_over = false;
    if (bal_event.dataTransfer?.files.length) bal_accept_files(bal_event.dataTransfer.files);
  }

  function bal_remove_staging(bal_name: string): void {
    bal_staging_files = bal_staging_files.filter((bal_file) => bal_file.name !== bal_name);
    bal_staging = bal_staging.filter((bal_item) => bal_item.name !== bal_name);
  }

  function bal_clear_staging(): void {
    bal_staging_files = [];
    bal_staging = [];
  }

  async function bal_begin_processing(): Promise<void> {
    if (bal_staging_files.length === 0) return;
    if (!bal_batch) {
      bal_batch = await bal_new_batch_for_project(
        projectId,
        bal_questionnaire?.id ?? null,
        bal_questionnaire?.version ?? null,
        bal_keep_originals
      );
    }
    bal_processing = true;
    bal_progress = null;
    bal_cancel_requested = false;
    const bal_images = bal_staging_files.filter((bal_file) => !bal_file.name.toLowerCase().endsWith('.pdf') && bal_file.type !== 'application/pdf');
    const bal_pdfs = bal_staging_files.filter((bal_file) => bal_file.name.toLowerCase().endsWith('.pdf') || bal_file.type === 'application/pdf');
    const bal_added = await bal_add_files_to_batch(bal_batch, bal_images);
    for (const bal_page of bal_added.added) {
      if (bal_page.status !== 'queued' || bal_page.sourceType !== 'image') continue;
      const bal_asset_id = bal_page.sourceAssetId;
      if (!bal_asset_id) continue;
      const { dhon_scan_asset } = await import('../../db/scan_repo');
      const bal_asset = await dhon_scan_asset(bal_asset_id);
      if (!bal_asset) continue;
      const bal_thumb = await bal_make_thumb(bal_asset.bytes);
      await bal_set_page_thumbs(bal_page.id, bal_thumb, null);
    }
    for (const bal_pdf of bal_pdfs) {
      await bal_ingest_pdf(bal_pdf.name, bal_pdf.bytes);
    }
    bal_staging_files = [];
    bal_staging = [];
    bal_pages = await ken_pori_scan_pages(bal_batch.id);
    if (!bal_worker && bal_worker_available()) bal_worker = bal_create_worker_processor();
    const bal_processor = bal_worker
      ? (bal_input: Parameters<bal_WorkerHandle['process']>[0]) => bal_worker!.process(bal_input)
      : (bal_input: Parameters<bal_WorkerHandle['process']>[0]) =>
          import('./scan_engine').then((bal_engine) => bal_engine.bal_process_image(bal_input));
    const bal_result = await bal_run_batch_queue(
      bal_batch.id,
      bal_layouts,
      bal_processor,
      (bal_blob) => bal_stage_decode_source(bal_blob),
      bal_default_encode_normalized,
      (bal_update: bal_QueueRunUpdate) => {
        bal_progress = { done: bal_update.processed, total: bal_update.total, eta: bal_update.etaLabel };
      },
      () => bal_cancel_requested
    );
    bal_pages = await ken_pori_scan_pages(bal_batch.id);
    await bal_refresh_storage();
    for (const bal_page of bal_pages) {
      if (bal_page.normalizedAssetId && !bal_page.thumbNormalized) {
        await bal_attach_normalized_thumb(bal_page.id, bal_page.normalizedAssetId);
      }
    }
    bal_pages = await ken_pori_scan_pages(bal_batch.id);
    bal_processing = false;
    bal_progress = null;
    if (bal_result.cancelled) bal_flash('Processing cancelled. Completed pages are kept.');
    else bal_flash(`Processed ${bal_result.processed} page${bal_result.processed === 1 ? '' : 's'}.`);
  }

  async function bal_attach_normalized_thumb(bal_page_id: string, bal_asset_id: string): Promise<void> {
    const { dhon_scan_asset } = await import('../../db/scan_repo');
    const bal_asset = await dhon_scan_asset(bal_asset_id);
    if (!bal_asset) return;
    const bal_thumb = await bal_make_thumb(bal_asset.bytes);
    await bal_set_page_thumbs(bal_page_id, null, bal_thumb);
  }

  async function bal_ingest_pdf(bal_name: string, bal_bytes: Blob): Promise<void> {
    try {
      const bal_rendered = await bal_render_pdf_pages(
        { name: bal_name, bytes: bal_bytes },
        bal_browser_pdf_page_renderer()
      );
      await bal_add_files_to_batch(
        bal_batch as ScanBatchRecord,
        bal_rendered.map((bal_page) => ({ name: bal_page.name, type: 'image/jpeg', bytes: bal_page.bytes }))
      );
    } catch {
      bal_flash(`Could not read ${bal_name} as a PDF.`);
    }
  }

  async function bal_refresh_storage(): Promise<void> {
    if (!bal_batch) {
      bal_storage = null;
      return;
    }
    let bal_source = 0;
    let bal_normalized = 0;
    for (const bal_page of bal_pages) {
      bal_source += bal_page.sourceBytes;
      bal_normalized += bal_page.normalizedBytes;
    }
    bal_storage = { source: bal_source, normalized: bal_normalized };
  }

  async function bal_toggle_keep_originals(bal_next: boolean): Promise<void> {
    if (!bal_batch) return;
    bal_keep_originals = bal_next;
    const bal_updated = { ...bal_batch, keepOriginals: bal_next, updatedAt: Date.now() };
    await bal_save_scan_batch(bal_updated);
    bal_batch = bal_updated;
    if (!bal_next) {
      bal_confirm_remove_originals = true;
    }
  }

  async function bal_do_remove_originals(): Promise<void> {
    if (!bal_batch) return;
    await bal_remove_originals(bal_batch.id);
    bal_pages = await ken_pori_scan_pages(bal_batch.id);
    await bal_refresh_storage();
    bal_flash('Original files removed from this device.');
  }

  function bal_cancel_processing(): void {
    if (!bal_processing) return;
    if (bal_progress && bal_progress.done === 0) {
      bal_cancel_requested = true;
      return;
    }
    bal_confirm_cancel = true;
  }

  function bal_request_duplicate_review(bal_page: ScanPageRecord): void {
    const bal_twin = bal_pages.find(
      (bal_other) =>
        bal_other.id !== bal_page.id &&
        bal_other.status === 'duplicate' &&
        bal_other.questionnaireId === bal_page.questionnaireId &&
        bal_other.pageNumber === bal_page.pageNumber &&
        bal_other.respondentId === bal_page.respondentId
    );
    if (bal_twin) bal_duplicate_pair = { a: bal_page, b: bal_twin };
    else bal_duplicate_pair = { a: bal_page, b: bal_page };
  }

  async function bal_after_duplicate(bal_resolution: string): Promise<void> {
    if (!bal_batch || !bal_duplicate_pair) return;
    if (bal_duplicate_pair.a.id !== bal_duplicate_pair.b.id) {
      await bal_resolve_duplicate_pair(
        bal_duplicate_pair.a.id,
        bal_duplicate_pair.b.id,
        bal_resolution as 'keep-a' | 'keep-b' | 'keep-both' | 'reject'
      );
    }
    bal_duplicate_pair = null;
    bal_pages = await ken_pori_scan_pages(bal_batch.id);
    await bal_refresh_storage();
  }

  async function bal_after_identify(bal_assignment: {
    questionnaireId: string;
    version: number;
    respondentId: string;
    pageNumber: number;
  }): Promise<void> {
    if (!bal_batch || !bal_identify_page) return;
    const bal_result = await bal_manual_identify_page(bal_identify_page.id, bal_assignment, bal_layouts, bal_pages);
    bal_identify_page = null;
    if (!bal_result.ok) {
      bal_flash(bal_result.error ?? 'Could not assign this page.');
      return;
    }
    if (bal_result.warning) bal_flash(bal_result.warning);
    bal_pages = await ken_pori_scan_pages(bal_batch.id);
    await bal_refresh_storage();
  }

  async function bal_after_corners(bal_points: { x: number; y: number }[]): Promise<void> {
    if (!bal_batch || !bal_corner_page) return;
    const bal_page = bal_corner_page;
    bal_corner_page = null;
    if (!bal_worker && bal_worker_available()) bal_worker = bal_create_worker_processor();
    const bal_processor = bal_worker
      ? (bal_input: Parameters<bal_WorkerHandle['process']>[0]) => bal_worker!.process(bal_input)
      : (bal_input: Parameters<bal_WorkerHandle['process']>[0]) =>
          import('./scan_engine').then((bal_engine) => bal_engine.bal_process_image(bal_input));
    await bal_apply_manual_corner_correction(
      bal_page.id,
      bal_points,
      bal_layouts,
      bal_processor,
      (bal_blob) => bal_stage_decode_source(bal_blob),
      bal_default_encode_normalized
    );
    bal_pages = await ken_pori_scan_pages(bal_batch.id);
    await bal_refresh_storage();
    bal_flash('Page corners updated.');
  }

  async function bal_reprocess(bal_page: ScanPageRecord): Promise<void> {
    if (!bal_batch) return;
    if (!bal_worker && bal_worker_available()) bal_worker = bal_create_worker_processor();
    const bal_processor = bal_worker
      ? (bal_input: Parameters<bal_WorkerHandle['process']>[0]) => bal_worker!.process(bal_input)
      : (bal_input: Parameters<bal_WorkerHandle['process']>[0]) =>
          import('./scan_engine').then((bal_engine) => bal_engine.bal_process_image(bal_input));
    if (!bal_page.sourceAssetId) {
      bal_flash('The original file was removed; this page cannot be reprocessed.');
      return;
    }
    const { dhon_scan_asset } = await import('../../db/scan_repo');
    const bal_asset = await dhon_scan_asset(bal_page.sourceAssetId);
    if (!bal_asset) {
      bal_flash('The original file was removed; this page cannot be reprocessed.');
      return;
    }
    bal_processing = true;
    await bal_reprocess_page(
      bal_page.id,
      bal_layouts,
      bal_processor,
      (bal_blob) => bal_stage_decode_source(bal_blob),
      bal_default_encode_normalized
    );
    bal_pages = await ken_pori_scan_pages(bal_batch.id);
    await bal_refresh_storage();
    bal_processing = false;
  }

  async function bal_open_batch(bal_batch_id: string): Promise<void> {
    const bal_loaded = await dhon_scan_batch(bal_batch_id);
    if (!bal_loaded) return;
    bal_batch = bal_loaded;
    bal_pages = await ken_pori_scan_pages(bal_batch_id);
    bal_keep_originals = bal_loaded.keepOriginals;
    await bal_refresh_storage();
  }

  async function bal_delete_current_batch(): Promise<void> {
    if (!bal_batch) return;
    await bal_delete_scan_batch(bal_batch.id);
    bal_batch = null;
    bal_pages = [];
    bal_storage = null;
    bal_flash('Batch deleted.');
    const bal_batches = await ken_pori_scan_batches(projectId);
    if (bal_batches.length > 0) await bal_open_batch(bal_batches[0].id);
  }

</script>

{#if bal_status === 'loading'}
  <div class="scan-loading"><p>Loading…</p></div>
{:else if bal_status === 'missing'}
  <EmptyState icon="scan" title="Scanning without a questionnaire" body="There is no questionnaire in this project yet. You can still add page photos and PDFs; codes will not auto-identify, so pages will land in review for manual assignment.">
    <Button variant="secondary" onclick={() => history.back()}>Go back</Button>
  </EmptyState>
{:else}
  <div class="scan-page">
    <header class="topbar">
      <div class="titles">
        <h2>Scan pages</h2>
        <p class="sub">
          {#if bal_processing && bal_progress}
            Importing {bal_progress.done} / {bal_progress.total} — {bal_progress.eta}
          {:else}
            All processing happens on this device. Nothing is uploaded.
          {/if}
        </p>
      </div>
      <div class="tools">
        {#if bal_processing}
          <Button size="sm" variant="secondary" onclick={bal_cancel_processing}>Cancel</Button>
        {:else}
          <input
            bind:this={bal_file_input}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            hidden
            onchange={(bal_event) => {
              const bal_files = (bal_event.currentTarget as HTMLInputElement).files;
              if (bal_files) bal_accept_files(bal_files);
              (bal_event.currentTarget as HTMLInputElement).value = '';
            }}
          />
          <Button size="sm" variant="primary" icon="upload" onclick={() => bal_file_input?.click()}>
            Add photos or PDFs
          </Button>
        {/if}
      </div>
    </header>

    {#if bal_note}
      <p class="note" role="status">{bal_note}</p>
    {/if}

    {#if bal_processing && bal_progress}
      <div class="progress-band">
        <div class="meter" role="progressbar" aria-valuemin={0} aria-valuemax={bal_progress.total} aria-valuenow={bal_progress.done}>
          <div class="fill" style="width: {Math.round((bal_progress.done / Math.max(1, bal_progress.total)) * 100)}%"></div>
        </div>
        <StatusPill tone="accent" label={bal_progress.eta} />
      </div>
    {/if}

    <section class="dropzone" class:over={bal_drag_over} aria-label="Add scanned pages">
      <div
        class="drop-inner"
        role="button"
        tabindex="0"
        onclick={() => !bal_processing && bal_file_input?.click()}
        onkeydown={(bal_event) => {
          if (bal_event.key === 'Enter' && !bal_processing) bal_file_input?.click();
        }}
        ondragover={(bal_event) => {
          bal_event.preventDefault();
          bal_drag_over = true;
        }}
        ondragleave={() => (bal_drag_over = false)}
        ondrop={bal_on_drop}
      >
        {#if bal_staging.length === 0}
          <p class="drop-title">Drop page photos or PDFs here</p>
          <p class="drop-sub">JPEG, PNG, WebP, or PDF. Files stay on this device.</p>
        {:else}
          <div class="staging-list">
            {#each bal_staging as bal_item (bal_item.name)}
              <div class="staging-item">
                {#if bal_item.thumb}
                  <img src={bal_item.thumb} alt="" />
                {:else}
                  <div class="thumb-blank">{bal_item.name.endsWith('.pdf') ? 'PDF' : 'IMG'}</div>
                {/if}
                <p class="staging-name" title={bal_item.name}>{bal_item.name}</p>
                <span class="staging-size">{bal_format_bytes(bal_item.size)}</span>
                <IconButton icon="x" label="Remove {bal_item.name}" size={16} onclick={() => bal_remove_staging(bal_item.name)} />
              </div>
            {/each}
          </div>
          <div class="staging-actions">
            <Button size="sm" variant="secondary" disabled={bal_processing} onclick={bal_clear_staging}>Clear list</Button>
            <Button size="sm" variant="primary" icon="scan" disabled={bal_processing} onclick={() => void bal_begin_processing()}>
              Begin processing ({bal_staging.length})
            </Button>
          </div>
        {/if}
      </div>
    </section>

    {#if bal_pages.length > 0}
      <section class="overview">
        <div class="stat"><span class="stat-num">{bal_overview.respondents}</span><span class="stat-label">Respondents</span></div>
        <div class="stat"><span class="stat-num">{bal_overview.ready}</span><span class="stat-label">Complete pages</span></div>
        <div class="stat"><span class="stat-num">{bal_overview.review}</span><span class="stat-label">Needs identification</span></div>
        <div class="stat"><span class="stat-num">{bal_overview.duplicates}</span><span class="stat-label">Duplicates</span></div>
        <div class="stat"><span class="stat-num">{bal_overview.failed}</span><span class="stat-label">Failed</span></div>
        {#if bal_overview.queued > 0}
          <div class="stat"><span class="stat-num">{bal_overview.queued}</span><span class="stat-label">Queued</span></div>
        {/if}
      </section>
    {/if}

    {#if bal_ready_pages.length > 0}
      <section class="ready-pages">
        <h3>Recovered pages</h3>
        <div class="thumbs">
          {#each bal_ready_pages as bal_page (bal_page.id)}
            <button class="thumb-card" type="button" onclick={() => (bal_viewer_page = bal_page)}>
              {#if bal_page.thumbNormalized ?? bal_page.thumbSource}
                <img src={bal_page.thumbNormalized ?? bal_page.thumbSource} alt="Page for {bal_page_title(bal_page)}" />
              {:else}
                <span class="thumb-blank small">No preview</span>
              {/if}
              <span class="thumb-label">{bal_page_title(bal_page)}</span>
            </button>
          {/each}
        </div>
      </section>
    {/if}

    {#if bal_active_categories.length > 0}
      <section class="review-queue">
        <h3>Review queue</h3>
        {#each bal_active_categories as bal_category (bal_category.id)}
          <div class="category">
            <div class="category-head">
              <h4>{bal_category.title}</h4>
              <p>{bal_category.description}</p>
            </div>
            <div class="cards">
              {#each bal_category_pages(bal_review, bal_category.id) as bal_page (bal_page.id)}
                <article class="page-card">
                  <button class="card-media" type="button" onclick={() => (bal_viewer_page = bal_page)}>
                    {#if bal_page.thumbNormalized ?? bal_page.thumbSource}
                      <img src={bal_page.thumbNormalized ?? bal_page.thumbSource} alt="Preview of {bal_page.sourceName}" />
                    {:else}
                      <div class="thumb-blank big">No preview</div>
                    {/if}
                  </button>
                  <div class="card-body">
                    <p class="card-title">{bal_page_title(bal_page)}</p>
                    <p class="card-source" title={bal_page.sourceName}>{bal_page.sourceName}</p>
                    <StatusPill tone={bal_status_tone(bal_page.status)} label={bal_status_label(bal_page.status)} />
                  </div>
                  <div class="card-actions">
                    {#if bal_page.issues.includes('duplicate')}
                      <Button size="sm" variant="secondary" onclick={() => bal_request_duplicate_review(bal_page)}>Compare</Button>
                    {/if}
                    {#if bal_page.issues.includes('unidentified') || bal_page.issues.includes('multiple-identifiers') || bal_page.issues.includes('possible-multiple-sheets')}
                      <Button size="sm" variant="primary" onclick={() => (bal_identify_page = bal_page)}>Identify</Button>
                    {/if}
                    {#if bal_page.issues.includes('alignment-failed') || bal_page.issues.includes('corner-correction-required')}
                      <Button size="sm" variant="primary" onclick={() => (bal_corner_page = bal_page)}>Fix corners</Button>
                    {/if}
                    {#if bal_page.sourceAssetId}
                      <Button size="sm" variant="secondary" disabled={bal_processing} onclick={() => void bal_reprocess(bal_page)}>Reprocess</Button>
                    {/if}
                  </div>
                </article>
              {/each}
            </div>
          </div>
        {/each}
      </section>
    {/if}

    <section class="storage">
      <h3>Storage</h3>
      {#if bal_storage}
        <p class="storage-line">
          Originals {bal_format_bytes(bal_storage.source)} · Normalized {bal_format_bytes(bal_storage.normalized)} ·
          Total {bal_format_bytes(bal_storage.source + bal_storage.normalized)}
        </p>
      {:else}
        <p class="storage-line">No pages stored yet.</p>
      {/if}
      <div class="storage-row">
        <Switch
          checked={bal_keep_originals}
          label="Keep original photos"
          onchange={(bal_next: boolean) => void bal_toggle_keep_originals(bal_next)}
        />
        <span class="storage-hint">Keeping originals preserves full traceability. Removing them cannot be undone.</span>
      </div>
      {#if bal_batch && bal_pages.length > 0}
        <div class="storage-actions">
          <Button size="sm" variant="danger" onclick={() => (bal_confirm_remove_originals = true)} disabled={!bal_batch.keepOriginals}>
            Remove originals now
          </Button>
          <Button size="sm" variant="danger" onclick={() => (bal_confirm_clear = true)}>Delete batch</Button>
        </div>
      {/if}
    </section>
  </div>

  <ScanViewerSheet open={bal_viewer_page !== null} page={bal_viewer_page} onclose={() => (bal_viewer_page = null)} />
  <ScanIdentifySheet
    open={bal_identify_page !== null}
    page={bal_identify_page}
    questionnaires={bal_questionnaire ? [bal_questionnaire] : []}
    layouts={bal_layouts}
    onsubmit={bal_after_identify}
    onclose={() => (bal_identify_page = null)}
  />
  <ScanCornerEditor
    open={bal_corner_page !== null}
    page={bal_corner_page}
    onsubmit={bal_after_corners}
    onclose={() => (bal_corner_page = null)}
  />
  <ScanDuplicateSheet
    open={bal_duplicate_pair !== null}
    pair={bal_duplicate_pair}
    onresolve={(bal_resolution) => void bal_after_duplicate(bal_resolution)}
    onclose={() => (bal_duplicate_pair = null)}
  />

  <ConfirmDialog
    bind:open={bal_confirm_remove_originals}
    title="Remove original files?"
    body="The untouched originals of these pages will be deleted from this device. Normalized pages stay usable, but you lose full traceability. This cannot be undone."
    confirm_label="Remove originals"
    danger
    onconfirm={() => void bal_do_remove_originals()}
  />
  <ConfirmDialog
    bind:open={bal_confirm_clear}
    title="Delete this batch?"
    body="All pages, originals, and normalized images in this batch will be removed from this device. This cannot be undone."
    confirm_label="Delete batch"
    danger
    onconfirm={() => void bal_delete_current_batch()}
  />
  <ConfirmDialog
    bind:open={bal_confirm_cancel}
    title="Stop processing?"
    body="Pages already processed are kept. The remaining pages stay queued and can be processed later."
    confirm_label="Stop processing"
    onconfirm={() => (bal_cancel_requested = true)}
  />
{/if}

<style>
  .scan-loading {
    padding: var(--space-8);
    color: var(--color-ink-2);
  }
  .scan-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-5);
    max-width: 1100px;
    margin: 0 auto;
  }
  .topbar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: center;
    justify-content: space-between;
  }
  .titles h2 {
    margin: 0;
    font-size: var(--text-xl);
  }
  .sub {
    margin: var(--space-1) 0 0;
    color: var(--color-ink-2);
    font-size: var(--text-sm);
  }
  .tools {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  .note {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
    color: var(--color-ink-2);
    font-size: var(--text-sm);
  }
  .progress-band {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .meter {
    flex: 1;
    height: 8px;
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--color-accent);
    transition: width 200ms ease;
  }
  .dropzone {
    border: var(--border-width) dashed var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }
  .dropzone.over {
    border-color: var(--color-accent);
    background: var(--color-surface-2);
  }
  .drop-inner {
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    cursor: pointer;
    min-height: 120px;
    justify-content: center;
  }
  .drop-title {
    margin: 0;
    font-weight: 600;
  }
  .drop-sub {
    margin: var(--space-1) 0 0;
    color: var(--color-ink-2);
    font-size: var(--text-sm);
  }
  .staging-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--space-3);
  }
  .staging-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    position: relative;
  }
  .staging-item img {
    width: 100%;
    height: 80px;
    object-fit: cover;
    border-radius: var(--radius-sm);
  }
  .staging-name {
    margin: 0;
    font-size: var(--text-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .staging-size {
    font-size: var(--text-xs);
    color: var(--color-ink-2);
  }
  .thumb-blank {
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--color-ink-2);
    font-weight: 600;
  }
  .thumb-blank.big {
    height: 100%;
    min-height: 120px;
  }
  .staging-actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
  }
  .overview {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--space-3);
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }
  .stat-num {
    font-size: var(--text-xl);
    font-weight: 700;
  }
  .stat-label {
    font-size: var(--text-xs);
    color: var(--color-ink-2);
  }
  .review-queue h3,
  .storage h3 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-lg);
  }
  .category {
    margin-bottom: var(--space-5);
  }
  .category-head h4 {
    margin: 0;
    font-size: var(--text-md);
  }
  .category-head p {
    margin: var(--space-1) 0 var(--space-2);
    color: var(--color-ink-2);
    font-size: var(--text-sm);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: var(--space-3);
  }
  .page-card {
    display: flex;
    flex-direction: column;
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    overflow: hidden;
  }
  .card-media {
    padding: 0;
    border: none;
    background: var(--color-surface-2);
    cursor: zoom-in;
    display: block;
  }
  .card-media img {
    width: 100%;
    height: 150px;
    object-fit: cover;
    display: block;
  }
  .card-body {
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    align-items: flex-start;
  }
  .card-title {
    margin: 0;
    font-weight: 600;
    font-size: var(--text-sm);
  }
  .card-source {
    margin: 0;
    color: var(--color-ink-2);
    font-size: var(--text-xs);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: 0 var(--space-3) var(--space-3);
  }
  .ready-pages h3 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-lg);
  }
  .thumbs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: var(--space-3);
  }
  .thumb-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    cursor: zoom-in;
  }
  .thumb-card img {
    width: 100%;
    height: 90px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    display: block;
  }
  .thumb-label {
    font-size: var(--text-xs);
    color: var(--color-ink-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .thumb-blank.small {
    height: 90px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--color-ink-2);
  }
  .storage {
    border-top: var(--border-width) solid var(--color-border);
    padding-top: var(--space-4);
  }
  .storage-line {
    margin: 0 0 var(--space-3);
    color: var(--color-ink-2);
    font-size: var(--text-sm);
  }
  .storage-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
  }
  .storage-hint {
    color: var(--color-ink-2);
    font-size: var(--text-xs);
  }
  .storage-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  @media (max-width: 767px) {
    .scan-page {
      padding: var(--space-3);
    }
    .cards {
      grid-template-columns: 1fr;
    }
    .page-card {
      flex-direction: column;
    }
    .card-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .card-actions :global(button) {
      width: 100%;
    }
  }
</style>
