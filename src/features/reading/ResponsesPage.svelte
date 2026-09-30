<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../../components/ui/Button.svelte';
  import EmptyState from '../../components/ui/EmptyState.svelte';
  import StatusPill from '../../components/ui/StatusPill.svelte';
  import ConfirmDialog from '../../components/ui/ConfirmDialog.svelte';
  import { dhon_questionnaire_by_project } from '../../db/questionnaires_repo';
  import { ken_pori_scan_batches, ken_pori_scan_pages } from '../../db/scan_repo';
  import { ken_pori_scales } from '../../db/scales_repo';
  import { ken_pori_responses_by_project } from '../../db/response_repo';
  import type { QuestionnaireRecord } from '../../models/types';
  import type { ScanBatchRecord } from '../../models/scan_models';
  import type { ResponseRecord } from '../../models/response_models';
  import { bal_run_reading, type bal_ReadRunProgress, type bal_ReprocessMode } from '../../services/reading_run';
  import { bal_default_image_decode } from './reading_crops';
  import { bal_completeness_for_respondents, type bal_RespondentStatus } from './reading_completeness';
  import { bal_build_print_document } from '../print/print_layout';
  import { bal_format_eta } from '../scan/scan_eta';
  import {
    bal_item_map,
    bal_status_label,
    bal_status_tone,
    bal_value_label,
    type bal_ItemInfo
  } from './reading_ui_helpers';
  import ResponseCellSheet from './ResponseCellSheet.svelte';

  let { projectId }: { projectId: string } = $props();

  const BAL_REVIEW_STATUSES = new Set<string>([
    'needs-review',
    'ambiguous',
    'multiple-marks',
    'unreadable',
    'manual-only'
  ]);

  let bal_status = $state<'loading' | 'ready' | 'missing'>('loading');
  let bal_questionnaire = $state<QuestionnaireRecord | null>(null);
  let bal_batches = $state<ScanBatchRecord[]>([]);
  let bal_batch_id = $state<string>('all');
  let bal_responses = $state<ResponseRecord[]>([]);
  let bal_items = $state<Map<string, bal_ItemInfo>>(new Map());
  let bal_reading = $state(false);
  let bal_progress = $state<bal_ReadRunProgress | null>(null);
  let bal_mode = $state<bal_ReprocessMode>('preserve-manual');
  let bal_confirm_recompute = $state(false);
  let bal_note = $state<string | null>(null);
  let bal_cancel_requested = $state(false);
  let bal_cell = $state<{ respondentId: string; itemId: string; rowId: string | null } | null>(null);
  let bal_tab = $state<'review' | 'table'>('review');
  let bal_completeness = $state<Map<string, bal_RespondentStatus>>(new Map());

  let bal_respondents = $derived([...new Set(bal_responses.map((bal_r) => bal_r.respondentId))].sort());
  let bal_variables = $derived.by(() => {
    const bal_keys: { key: string; itemId: string; rowId: string | null; label: string }[] = [];
    for (const bal_r of bal_responses) {
      const bal_key = bal_r.rowId ? `${bal_r.itemId}::${bal_r.rowId}` : bal_r.itemId;
      if (bal_keys.some((bal_entry) => bal_entry.key === bal_key)) continue;
      const bal_info = bal_items.get(bal_r.itemId);
      const bal_row_label = bal_r.rowId
        ? (bal_info?.rows.find((bal_row) => bal_row.id === bal_r.rowId)?.label ?? bal_r.rowId)
        : null;
      bal_keys.push({
        key: bal_key,
        itemId: bal_r.itemId,
        rowId: bal_r.rowId,
        label: bal_info
          ? `${bal_info.number} ${bal_row_label ? `${bal_row_label} · ` : ''}${bal_info.label}`
          : (bal_r.variableName ?? bal_r.itemId)
      });
    }
    return bal_keys;
  });

  let bal_review_queue = $derived(
    bal_responses
      .filter((bal_r) => BAL_REVIEW_STATUSES.has(bal_r.status))
      .sort(
        (bal_a, bal_b) =>
          bal_a.respondentId.localeCompare(bal_b.respondentId) || bal_a.itemId.localeCompare(bal_b.itemId)
      )
  );

  let bal_counts = $derived.by(() => {
    const bal_result = { accepted: 0, review: 0, blank: 0, manual: 0, manualCorrected: 0 };
    for (const bal_r of bal_responses) {
      if (bal_r.status === 'accepted') bal_result.accepted += 1;
      else if (bal_r.status === 'blank') bal_result.blank += 1;
      else if (bal_r.status === 'manual-only') bal_result.manual += 1;
      else if (BAL_REVIEW_STATUSES.has(bal_r.status)) bal_result.review += 1;
      if (bal_r.manuallyReviewed) bal_result.manualCorrected += 1;
    }
    return bal_result;
  });

  function bal_completeness_label(bal_status: bal_RespondentStatus): string {
    if (bal_status.completeness === 'complete') return 'Complete';
    if (bal_status.completeness === 'missing-page') return `Missing page${bal_status.missingPages.length === 1 ? '' : 's'}`;
    if (bal_status.completeness === 'missing-required') return 'Required missing';
    return 'Needs review';
  }

  function bal_completeness_tone(bal_status: bal_RespondentStatus): 'neutral' | 'success' | 'warning' | 'accent' {
    if (bal_status.completeness === 'complete') return 'success';
    if (bal_status.completeness === 'missing-page') return 'accent';
    return 'warning';
  }

  async function bal_reload(): Promise<void> {
    if (!bal_questionnaire) return;
    bal_responses = await ken_pori_responses_by_project(projectId);
    bal_items = bal_item_map(bal_questionnaire);
    const bal_scales = await ken_pori_scales();
    const bal_doc = bal_build_print_document({ questionnaire: bal_questionnaire, scales: bal_scales, respondentId: '' });
    const bal_found: Record<string, number[]> = {};
    for (const bal_batch of bal_batches) {
      for (const bal_page of await ken_pori_scan_pages(bal_batch.id)) {
        if (bal_page.status !== 'ready' || !bal_page.respondentId || bal_page.pageNumber === null) continue;
        bal_found[bal_page.respondentId] = [...(bal_found[bal_page.respondentId] ?? []), bal_page.pageNumber];
      }
    }
    bal_completeness = bal_completeness_for_respondents(
      bal_respondents,
      bal_questionnaire,
      bal_doc.pages.length,
      bal_responses,
      bal_found
    );
  }

  function bal_progress_text(): string {
    const bal_p = bal_progress;
    if (!bal_p) return '';
    if (bal_p.phase === 'preparing') return 'Preparing blank references…';
    if (bal_p.pagesTotal === 0) return 'No identified pages to read yet.';
    if (bal_p.etaSeconds === null) return `Reading ${bal_p.pagesDone} of ${bal_p.pagesTotal} pages · Estimating…`;
    return `Reading ${bal_p.pagesDone} of ${bal_p.pagesTotal} pages · ${bal_format_eta(bal_p.etaSeconds)} left`;
  }

  async function bal_start_reading(): Promise<void> {
    if (!bal_questionnaire || bal_reading) return;
    if (bal_mode === 'recompute-all') {
      bal_confirm_recompute = true;
      return;
    }
    await bal_execute_reading();
  }

  async function bal_execute_reading(): Promise<void> {
    if (!bal_questionnaire || bal_reading) return;
    bal_reading = true;
    bal_note = null;
    bal_cancel_requested = false;
    bal_progress = null;
    try {
      const bal_result = await bal_run_reading({
        scope: { projectId, batchId: bal_batch_id === 'all' ? null : bal_batch_id, respondentId: null },
        mode: bal_mode,
        decode: bal_default_image_decode,
        onProgress: (bal_p) => (bal_progress = bal_p),
        isCancelled: () => bal_cancel_requested
      });
      bal_note = bal_summarize(bal_result);
      await bal_reload();
    } catch (bal_error) {
      bal_note = bal_error instanceof Error ? bal_error.message : 'Reading could not start.';
    } finally {
      bal_reading = false;
      bal_progress = null;
    }
  }

  function bal_summarize(bal_result: Awaited<ReturnType<typeof bal_run_reading>>): string {
    if (bal_result.cancelled) return 'Reading was stopped. Pages already read are kept.';
    const bal_parts = [
      `Read ${bal_result.pagesProcessed} page${bal_result.pagesProcessed === 1 ? '' : 's'}`,
      `${bal_result.accepted} accepted`,
      `${bal_result.needsReview} need review`,
      `${bal_result.blanks} blank`,
      `${bal_result.preservedManual} hand-corrected kept`
    ];
    if (bal_result.errors.length > 0) {
      bal_parts.push(`${bal_result.errors.length} page${bal_result.errors.length === 1 ? '' : 's'} failed`);
    }
    return `${bal_parts.join(', ')}.`;
  }

  onMount(() => {
    void (async () => {
      const bal_q = await dhon_questionnaire_by_project(projectId);
      bal_questionnaire = bal_q ?? null;
      bal_status = 'ready';
      if (!bal_q) return;
      bal_batches = await ken_pori_scan_batches(projectId);
      await bal_reload();
    })();
  });
</script>

<div class="page">
  <header class="head">
    <h1>Responses</h1>
    <p class="sub">Read scanned pages into structured answers, review what the reader was unsure about, and correct values.</p>
  </header>

  {#if bal_status === 'loading'}
    <p class="muted">Loading…</p>
  {:else if !bal_questionnaire}
    <EmptyState icon="file-text" title="No questionnaire yet" body="Create a questionnaire and print forms before reading responses." />
  {:else}
    <section class="card">
      <div class="control-row">
        <label class="field-label" for="batch-select">Batch</label>
        <select id="batch-select" bind:value={bal_batch_id} disabled={bal_reading}>
          <option value="all">All batches</option>
          {#each bal_batches as bal_batch (bal_batch.id)}
            <option value={bal_batch.id}>{bal_batch.id}</option>
          {/each}
        </select>
        <label class="field-label" for="mode-select">Reprocess</label>
        <select id="mode-select" bind:value={bal_mode} disabled={bal_reading}>
          <option value="preserve-manual">Keep manual corrections</option>
          <option value="unreviewed-only">Skip reviewed respondents</option>
          <option value="recompute-all">Recompute everything</option>
        </select>
        <Button variant="primary" onclick={bal_start_reading} disabled={bal_reading}>
          {bal_reading ? 'Reading…' : 'Read answers'}
        </Button>
        {#if bal_reading}
          <Button variant="danger" onclick={() => (bal_cancel_requested = true)}>Stop</Button>
        {/if}
      </div>
      {#if bal_mode === 'recompute-all'}
        <p class="warn-note">Recompute everything also replaces answers you corrected by hand.</p>
      {/if}
      {#if bal_progress}
        <div class="progress">
          <div class="progress-bar">
            <div
              class="progress-fill"
              style="width: {bal_progress.pagesTotal === 0
                ? 100
                : Math.round((bal_progress.pagesDone / bal_progress.pagesTotal) * 100)}%"
            ></div>
          </div>
          <span class="muted">{bal_progress_text()}</span>
        </div>
      {/if}
      {#if bal_note}
        <p class="note">{bal_note}</p>
      {/if}
    </section>

    <section class="card summary">
      <StatusPill tone="success" label={`${bal_counts.accepted} accepted`} />
      <StatusPill tone={bal_counts.review > 0 ? 'warning' : 'neutral'} label={`${bal_counts.review} need review`} />
      <StatusPill tone="neutral" label={`${bal_counts.blank} blank`} />
      <StatusPill tone="neutral" label={`${bal_counts.manual} to transcribe`} />
      <StatusPill tone="accent" label={`${bal_counts.manualCorrected} hand-corrected`} />
    </section>

    <nav class="tabs">
      <button class="tab" class:active={bal_tab === 'review'} onclick={() => (bal_tab = 'review')}>
        Review queue{bal_review_queue.length > 0 ? ` (${bal_review_queue.length})` : ''}
      </button>
      <button class="tab" class:active={bal_tab === 'table'} onclick={() => (bal_tab = 'table')}>Data table</button>
    </nav>

    {#if bal_tab === 'review'}
      {#if bal_review_queue.length === 0}
        <EmptyState
          icon="circle-check"
          title="Nothing to review"
          body="Run the reader on scanned pages. Answers the reader is unsure about will appear here."
        />
      {:else}
        <div class="queue">
          {#each bal_review_queue.slice(0, 40) as bal_response (bal_response.id)}
            <article class="card queue-card">
              <div class="queue-head">
                <div>
                  <strong>
                    {bal_items.get(bal_response.itemId)?.number ?? ''}
                    {bal_items.get(bal_response.itemId)?.label ?? bal_response.itemId}
                  </strong>
                  {#if bal_response.rowId}
                    <span class="muted">
                      · row {bal_items.get(bal_response.itemId)?.rows.find((bal_r) => bal_r.id === bal_response.rowId)?.label ?? bal_response.rowId}
                    </span>
                  {/if}
                </div>
                <StatusPill tone={bal_status_tone(bal_response.status)} label={bal_status_label(bal_response.status)} />
              </div>
              <p class="muted">Respondent {bal_response.respondentId}</p>
              <div class="queue-actions">
                <Button
                  size="sm"
                  onclick={() =>
                    (bal_cell = {
                      respondentId: bal_response.respondentId,
                      itemId: bal_response.itemId,
                      rowId: bal_response.rowId
                    })}
                >Open</Button>
              </div>
            </article>
          {/each}
          {#if bal_review_queue.length > 40}
            <p class="muted">Showing the first 40 of {bal_review_queue.length}.</p>
          {/if}
        </div>
      {/if}
    {:else if bal_respondents.length === 0}
      <EmptyState icon="table" title="No responses yet" body="Read a scanned batch to fill the table." />
    {:else}
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Respondent</th>
              <th scope="col">Status</th>
              {#each bal_variables as bal_variable (bal_variable.key)}
                <th scope="col">{bal_variable.label}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each bal_respondents as bal_respondent (bal_respondent)}
              <tr>
                <th scope="row">{bal_respondent}</th>
                <td>
                  {#if bal_completeness.get(bal_respondent)}
                    <StatusPill
                      tone={bal_completeness_tone(bal_completeness.get(bal_respondent)!)}
                      label={bal_completeness_label(bal_completeness.get(bal_respondent)!)}
                    />
                  {/if}
                </td>
                {#each bal_variables as bal_variable (bal_variable.key)}
                  {@const bal_cell_response = bal_responses.find(
                    (bal_r) =>
                      bal_r.respondentId === bal_respondent &&
                      bal_r.itemId === bal_variable.itemId &&
                      bal_r.rowId === bal_variable.rowId
                  )}
                  <td>
                    {#if bal_cell_response}
                      <button
                        class="cell"
                        class:cell-review={BAL_REVIEW_STATUSES.has(bal_cell_response.status)}
                        class:cell-blank={bal_cell_response.status === 'blank'}
                        class:cell-manual={bal_cell_response.manuallyReviewed}
                        onclick={() =>
                          (bal_cell = {
                            respondentId: bal_respondent,
                            itemId: bal_variable.itemId,
                            rowId: bal_variable.rowId
                          })}
                      >{bal_value_label(bal_cell_response, bal_items)}</button>
                    {:else}
                      <span class="muted">—</span>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>

{#if bal_cell}
  <ResponseCellSheet
    respondentId={bal_cell.respondentId}
    itemId={bal_cell.itemId}
    rowId={bal_cell.rowId}
    onclose={() => {
      bal_cell = null;
      void bal_reload();
    }}
  />
{/if}

<ConfirmDialog
  bind:open={bal_confirm_recompute}
  title="Recompute everything?"
  body="Answers you corrected by hand will be replaced by new machine results. The corrected values stay in the audit trail."
  confirm_label="Recompute all"
  danger
  onconfirm={bal_execute_reading}
/>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .head h1 {
    margin: 0 0 4px;
    font-size: 22px;
  }
  .sub {
    margin: 0;
    color: var(--text-muted);
    font-size: 14px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
  }
  .control-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .field-label {
    font-size: 13px;
    color: var(--text-muted);
  }
  select {
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-raised);
    color: var(--text);
    font-size: 14px;
  }
  .warn-note {
    margin: 10px 0 0;
    font-size: 13px;
    color: var(--warning-text, #a15c00);
  }
  .progress {
    margin-top: 10px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .progress-bar {
    flex: 1;
    height: 6px;
    background: var(--border);
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s ease;
  }
  .note {
    margin: 10px 0 0;
    font-size: 13px;
    color: var(--text-muted);
  }
  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--border);
  }
  .tab {
    padding: 8px 14px;
    border: none;
    background: none;
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  .tab.active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }
  .queue {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .queue-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .queue-actions {
    margin-top: 8px;
  }
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  table.data {
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
  }
  table.data th,
  table.data td {
    border-bottom: 1px solid var(--border);
    padding: 8px 10px;
    text-align: left;
    white-space: nowrap;
  }
  table.data thead th {
    position: sticky;
    top: 0;
    background: var(--surface);
  }
  .cell {
    border: none;
    background: none;
    padding: 2px 6px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text);
    font-size: 13px;
  }
  .cell-review {
    box-shadow: inset 0 -2px 0 0 var(--warning, #b45309);
  }
  .cell-blank {
    color: var(--text-muted);
  }
  .cell-manual {
    box-shadow: inset 0 -2px 0 0 var(--accent);
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  @media (max-width: 768px) {
    .page {
      padding: 12px;
    }
    .control-row select {
      flex: 1 1 100%;
    }
  }
</style>
