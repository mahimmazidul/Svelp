<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import Button from '../../components/ui/Button.svelte';
  import EmptyState from '../../components/ui/EmptyState.svelte';
  import StatusPill from '../../components/ui/StatusPill.svelte';
  import ConfirmDialog from '../../components/ui/ConfirmDialog.svelte';
  import { dhon_questionnaire_for_responses } from '../../db/questionnaires_repo';
  import { ken_pori_scan_batches, ken_pori_scan_pages } from '../../db/scan_repo';
  import { ken_pori_scales } from '../../db/scales_repo';
  import {
    bal_save_response,
    bal_save_response_audit_event,
    ken_pori_responses_by_project
  } from '../../db/response_repo';
  import type { QuestionnaireRecord } from '../../models/types';
  import type { ScanBatchRecord } from '../../models/scan_models';
  import type { ResponseRecord } from '../../models/response_models';
  import { bal_run_reading, type bal_ReadRunProgress, type bal_ReprocessMode } from '../../services/reading_run';
  import {
    bal_validate_dataset,
    bal_count_issues_by_severity,
    type DatasetIssue,
    type DatasetIssueSeverity
  } from '../export/dataset_validation';
  import {
    BAL_RECOGNITION_CONTROL_BOUNDS,
    bal_load_recognition_profile,
    bal_profile_name_for_controls,
    bal_profile_to_controls,
    bal_save_recognition_profile,
    type bal_RecognitionControls
  } from '../../services/recognition_settings';
  import { bal_default_image_decode } from './reading_crops';
  import { bal_completeness_for_respondents, type bal_RespondentStatus } from './reading_completeness';
  import {
    BAL_TABLE_ROW_WINDOW,
    bal_next_row_limit,
    bal_respondent_matches_filter,
    bal_search_matches_nothing,
    bal_search_respondents,
    bal_search_variables,
    bal_sort_respondents,
    bal_table_variables,
    type bal_SortState
  } from './response_table';
  import { bal_build_print_document } from '../print/print_layout';
  import { bal_new_id } from '../../services/scan_service';
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
  let bal_tab = $state<'review' | 'checks' | 'table'>('review');
  let bal_completeness = $state<Map<string, bal_RespondentStatus>>(new Map());
  let bal_issues = $state<DatasetIssue[]>([]);
  let bal_issue_counts = $state<Record<DatasetIssueSeverity, number>>({ error: 0, warning: 0, info: 0 });
  let bal_selected = new SvelteSet<string>();
  let bal_confirm_bulk_blank = $state(false);
  let bal_filter = $state<
    'all' | 'review' | 'missing-required' | 'manual-only' | 'corrected' | 'blank' | 'missing-page' | 'unreadable' | 'complete' | 'incomplete'
  >('all');
  let bal_search = $state('');
  let bal_sort = $state<bal_SortState>({ key: null, dir: 'asc' });
  let bal_row_limit = $state(BAL_TABLE_ROW_WINDOW);
  let bal_hidden_columns = new SvelteSet<string>();
  let bal_controls = $state<bal_RecognitionControls>({
    markSensitivity: BAL_RECOGNITION_CONTROL_BOUNDS.markSensitivity.default,
    ambiguityTolerance: BAL_RECOGNITION_CONTROL_BOUNDS.ambiguityTolerance.default,
    autoAcceptConfidence: BAL_RECOGNITION_CONTROL_BOUNDS.autoAcceptConfidence.default
  });

  let bal_respondents = $derived([...new Set(bal_responses.map((bal_r) => bal_r.respondentId))].sort());
  let bal_variables = $derived(bal_table_variables(bal_responses, bal_items));

  let bal_review_queue = $derived(
    bal_responses
      .filter((bal_r) => BAL_REVIEW_STATUSES.has(bal_r.status))
      .sort(
        (bal_a, bal_b) =>
          bal_a.respondentId.localeCompare(bal_b.respondentId) || bal_a.itemId.localeCompare(bal_b.itemId)
      )
  );

  let bal_filtered_respondents = $derived.by(() => {
    const bal_rows = bal_respondents.filter((bal_respondent) =>
      bal_respondent_matches_filter(
        bal_responses.filter((bal_r) => bal_r.respondentId === bal_respondent),
        bal_filter,
        bal_completeness.get(bal_respondent)?.completeness,
        BAL_REVIEW_STATUSES
      )
    );
    const bal_by_id = bal_search_respondents(bal_rows, bal_search);
    return bal_by_id ?? bal_rows;
  });

  let bal_filtered_variables = $derived.by(() => {
    const bal_matched = bal_search_variables(bal_variables, bal_search);
    return (bal_matched ?? bal_variables).filter((bal_variable) => !bal_hidden_columns.has(bal_variable.key));
  });

  let bal_sorted_respondents = $derived(
    bal_sort_respondents(bal_filtered_respondents, bal_sort, (bal_respondent, bal_key) => {
      const bal_response = bal_responses.find(
        (bal_r) =>
          bal_r.respondentId === bal_respondent &&
          (bal_r.rowId ? `${bal_r.itemId}::${bal_r.rowId}` : bal_r.itemId) === bal_key
      );
      return bal_response ? bal_value_label(bal_response, bal_items) : '';
    })
  );

  let bal_visible_respondents = $derived(bal_sorted_respondents.slice(0, bal_row_limit));
  let bal_nothing_matches = $derived(bal_search_matches_nothing(bal_respondents, bal_variables, bal_search));
  let bal_shown_column_count = $derived(bal_filtered_variables.length);
  let bal_all_columns_visible = $derived(bal_filtered_variables.length === bal_variables.length && bal_hidden_columns.size === 0);

  function bal_toggle_sort(bal_key: string): void {
    if (bal_sort.key === bal_key) {
      bal_sort = { key: bal_key, dir: bal_sort.dir === 'asc' ? 'desc' : 'asc' };
    } else {
      bal_sort = { key: bal_key, dir: 'asc' };
    }
  }

  function bal_toggle_column(bal_key: string): void {
    if (bal_hidden_columns.has(bal_key)) bal_hidden_columns.delete(bal_key);
    else bal_hidden_columns.add(bal_key);
  }

  function bal_show_all_columns(): void {
    bal_hidden_columns.clear();
  }

  function bal_show_no_columns(): void {
    for (const bal_variable of bal_variables) bal_hidden_columns.add(bal_variable.key);
  }

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
    if (bal_status.completeness === 'transcription-pending') return 'Transcription pending';
    if (bal_status.completeness === 'unreadable-source') return 'Unreadable source';
    if (bal_status.completeness === 'version-conflict') return 'Version conflict';
    return 'Needs review';
  }

  function bal_completeness_tone(bal_status: bal_RespondentStatus): 'neutral' | 'success' | 'warning' | 'accent' {
    if (bal_status.completeness === 'complete') return 'success';
    if (bal_status.completeness === 'missing-page' || bal_status.completeness === 'transcription-pending') return 'accent';
    return 'warning';
  }

  function bal_issue_label(bal_issue: DatasetIssue): string {
    const bal_labels: Record<DatasetIssue['type'], string> = {
      'duplicate-respondent-page': 'Duplicate page',
      'missing-required': 'Required response missing',
      'invalid-coded-value': 'Value not in questionnaire options',
      'selection-rule-violation': 'Selection rule broken',
      'matrix-rule-violation': 'Matrix rule broken',
      'numeric-range-violation': 'Number outside range',
      'missing-source-page': 'Source page missing',
      'unresolved-review': 'Unresolved review',
      'version-mismatch': 'Questionnaire version mismatch',
      'schema-mismatch': 'Response without a question',
      'duplicate-response': 'Duplicate response record'
    };
    return bal_labels[bal_issue.type];
  }

  function bal_severity_tone(bal_severity: DatasetIssueSeverity): 'neutral' | 'success' | 'warning' | 'accent' {
    if (bal_severity === 'error') return 'warning';
    if (bal_severity === 'info') return 'neutral';
    return 'accent';
  }

  async function bal_reload(): Promise<void> {
    if (!bal_questionnaire) return;
    bal_responses = await ken_pori_responses_by_project(projectId);
    bal_items = bal_item_map(bal_questionnaire);
    await bal_reload_completeness();
  }

  async function bal_reload_completeness(): Promise<void> {
    if (!bal_questionnaire) return;
    const bal_scales = await ken_pori_scales();
    const bal_doc = bal_build_print_document({ questionnaire: bal_questionnaire, scales: bal_scales, respondentId: '' });
    const bal_found: Record<string, number[]> = {};
    const bal_ready_pages: { id: string; respondentId: string | null; pageNumber: number | null; questionnaireVersion: number | null }[] = [];
    for (const bal_batch of bal_batches) {
      for (const bal_page of await ken_pori_scan_pages(bal_batch.id)) {
        if (bal_page.status !== 'ready' || !bal_page.respondentId || bal_page.pageNumber === null) continue;
        bal_found[bal_page.respondentId] = [...(bal_found[bal_page.respondentId] ?? []), bal_page.pageNumber];
        bal_ready_pages.push({
          id: bal_page.id,
          respondentId: bal_page.respondentId,
          pageNumber: bal_page.pageNumber,
          questionnaireVersion: bal_page.questionnaireVersion
        });
      }
    }
    bal_completeness = bal_completeness_for_respondents(
      bal_respondents,
      bal_questionnaire,
      bal_doc.pages.length,
      bal_responses,
      bal_found
    );
    bal_issues = bal_validate_dataset({
      questionnaire: bal_questionnaire,
      scales: bal_scales,
      responses: bal_responses,
      readyPages: bal_ready_pages,
      expectedPages: bal_doc.pages.length
    });
    bal_issue_counts = bal_count_issues_by_severity(bal_issues);
  }

  async function bal_mark_blank(bal_target: ResponseRecord): Promise<void> {
    await bal_save_response_audit_event({
      id: bal_new_id(),
      projectId: bal_target.projectId,
      responseId: bal_target.id,
      respondentId: bal_target.respondentId,
      itemId: bal_target.itemId,
      rowId: bal_target.rowId,
      previousValue: bal_target.value,
      previousStatus: bal_target.status,
      finalValue: [],
      finalStatus: 'blank',
      action: 'marked-blank',
      createdAt: Date.now()
    });
    await bal_save_response({
      ...bal_target,
      value: [],
      codedValue: null,
      status: 'blank',
      confidence: null,
      manuallyReviewed: true,
      updatedAt: Date.now()
    });
  }

  async function bal_mark_selected_blank(): Promise<void> {
    const bal_targets = bal_responses.filter((bal_r) => bal_selected.has(bal_r.id));
    for (const bal_target of bal_targets) {
      await bal_mark_blank(bal_target);
    }
    bal_selected.clear();
    bal_confirm_bulk_blank = false;
    await bal_reload();
  }

  function bal_toggle_selected(bal_id: string): void {
    if (bal_selected.has(bal_id)) bal_selected.delete(bal_id);
    else bal_selected.add(bal_id);
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
      const bal_profile_record = await bal_load_recognition_profile();
      const bal_name = bal_profile_name_for_controls(bal_profile_to_controls(bal_profile_record.thresholdProfile));
      const bal_result = await bal_run_reading({
        scope: { projectId, batchId: bal_batch_id === 'all' ? null : bal_batch_id, respondentId: null },
        mode: bal_mode,
        profile: bal_profile_record.thresholdProfile,
        profileName: bal_name,
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

  async function bal_apply_control_change(): Promise<void> {
    await bal_save_recognition_profile(bal_controls);
    bal_note = `Recognition settings saved. The next run uses profile ${bal_profile_name_for_controls(bal_controls)}; finished runs keep the profile they used.`;
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
      const bal_rows = await ken_pori_responses_by_project(projectId);
      const bal_q = await dhon_questionnaire_for_responses(projectId, bal_rows);
      bal_questionnaire = bal_q ?? null;
      bal_status = 'ready';
      if (!bal_q) return;
      bal_batches = await ken_pori_scan_batches(projectId);
      const bal_saved = await bal_load_recognition_profile();
      bal_controls = bal_profile_to_controls(bal_saved.thresholdProfile);
      bal_responses = bal_rows;
      bal_items = bal_item_map(bal_q);
      await bal_reload_completeness();
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
      <details class="advanced">
        <summary>Recognition settings</summary>
        <div class="settings-grid">
          <label class="setting">
            <span>Mark sensitivity <strong>{bal_controls.markSensitivity.toFixed(2)}×</strong></span>
            <input
              type="range"
              min={BAL_RECOGNITION_CONTROL_BOUNDS.markSensitivity.min}
              max={BAL_RECOGNITION_CONTROL_BOUNDS.markSensitivity.max}
              step={BAL_RECOGNITION_CONTROL_BOUNDS.markSensitivity.step}
              bind:value={bal_controls.markSensitivity}
              onchange={bal_apply_control_change}
              disabled={bal_reading}
            />
          </label>
          <label class="setting">
            <span>Ambiguity tolerance <strong>{bal_controls.ambiguityTolerance.toFixed(2)}</strong></span>
            <input
              type="range"
              min={BAL_RECOGNITION_CONTROL_BOUNDS.ambiguityTolerance.min}
              max={BAL_RECOGNITION_CONTROL_BOUNDS.ambiguityTolerance.max}
              step={BAL_RECOGNITION_CONTROL_BOUNDS.ambiguityTolerance.step}
              bind:value={bal_controls.ambiguityTolerance}
              onchange={bal_apply_control_change}
              disabled={bal_reading}
            />
          </label>
          <label class="setting">
            <span>Auto-accept threshold <strong>{Math.round(bal_controls.autoAcceptConfidence * 100)}%</strong></span>
            <input
              type="range"
              min={BAL_RECOGNITION_CONTROL_BOUNDS.autoAcceptConfidence.min}
              max={BAL_RECOGNITION_CONTROL_BOUNDS.autoAcceptConfidence.max}
              step={BAL_RECOGNITION_CONTROL_BOUNDS.autoAcceptConfidence.step}
              bind:value={bal_controls.autoAcceptConfidence}
              onchange={bal_apply_control_change}
              disabled={bal_reading}
            />
          </label>
        </div>
        <p class="muted">
          Higher sensitivity finds fainter marks but sends more answers to review. Changes apply to the next run;
          finished runs keep the profile they used.
        </p>
      </details>
    </section>

    <section class="card summary">
      <StatusPill tone="success" label={`${bal_counts.accepted} accepted`} />
      <StatusPill tone={bal_counts.review > 0 ? 'warning' : 'neutral'} label={`${bal_counts.review} need review`} />
      <StatusPill tone="neutral" label={`${bal_counts.blank} blank`} />
      <StatusPill tone="neutral" label={`${bal_counts.manual} to transcribe`} />
      <StatusPill tone="accent" label={`${bal_counts.manualCorrected} hand-corrected`} />
      <StatusPill
        tone="neutral"
        label={`${[...bal_completeness.values()].filter((bal_s) => bal_s.completeness === 'complete').length} of ${bal_completeness.size} respondents complete`}
      />
      {#if bal_issue_counts.error > 0}
        <StatusPill tone="warning" label={`${bal_issue_counts.error} data check${bal_issue_counts.error === 1 ? '' : 's'} failed`} />
      {/if}
    </section>

    <nav class="tabs">
      <button class="tab" class:active={bal_tab === 'review'} onclick={() => (bal_tab = 'review')}>
        Review queue{bal_review_queue.length > 0 ? ` (${bal_review_queue.length})` : ''}
      </button>
      <button class="tab" class:active={bal_tab === 'checks'} onclick={() => (bal_tab = 'checks')}>
        Data checks{bal_issues.length > 0 ? ` (${bal_issues.length})` : ''}
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
                  <label class="queue-select">
                    <input
                      type="checkbox"
                      checked={bal_selected.has(bal_response.id)}
                      onchange={() => bal_toggle_selected(bal_response.id)}
                    />
                    <span class="visually-hidden">Select for bulk action</span>
                  </label>
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
                <Button size="sm" disabled={bal_reading} onclick={() => void bal_mark_blank(bal_response).then(() => bal_reload())}>
                  Mark blank
                </Button>
              </div>
            </article>
          {/each}
          {#if bal_review_queue.length > 40}
            <p class="muted">Showing the first 40 of {bal_review_queue.length}.</p>
          {:else if bal_selected.size > 0}
            <div class="bulk-bar">
              <span class="muted">{bal_selected.size} selected</span>
              <Button size="sm" variant="danger" onclick={() => (bal_confirm_bulk_blank = true)}>
                Mark selected as reviewed blank
              </Button>
            </div>
          {/if}
        </div>
      {/if}
    {:else if bal_tab === 'checks'}
      {#if bal_issues.length === 0}
        <EmptyState
          icon="circle-check"
          title="No data issues found"
          body="Required answers, option values, selection rules, versions, and source references all check out."
        />
      {:else}
        <div class="checks-head">
          <StatusPill tone={bal_issue_counts.error > 0 ? 'warning' : 'neutral'} label={`${bal_issue_counts.error} errors`} />
          <StatusPill tone="accent" label={`${bal_issue_counts.warning} warnings`} />
          <StatusPill tone="neutral" label={`${bal_issue_counts.info} info`} />
        </div>
        <div class="checks">
          {#each bal_issues.slice(0, 120) as bal_issue (bal_issue.id)}
            <article class="card check-card">
              <div class="queue-head">
                <div>
                  <strong>{bal_issue_label(bal_issue)}</strong>
                  <span class="muted">
                    {#if bal_issue.respondentId} · {bal_issue.respondentId}{/if}
                    {#if bal_issue.variableName} · {bal_issue.variableName}{/if}
                    {#if bal_issue.currentValue && bal_issue.currentValue.length > 0} · now: {bal_issue.currentValue.join(', ')}{/if}
                  </span>
                </div>
                <StatusPill tone={bal_severity_tone(bal_issue.severity)} label={bal_issue.severity} />
              </div>
              {#if bal_issue.expectedRule}
                <p class="muted">Expected: {bal_issue.expectedRule}</p>
              {/if}
              {#if bal_issue.respondentId && bal_issue.itemId}
                <div class="queue-actions">
                  <Button
                    size="sm"
                    onclick={() =>
                      (bal_cell = {
                        respondentId: bal_issue.respondentId ?? '',
                        itemId: bal_issue.itemId ?? '',
                        rowId: null
                      })}
                  >Open</Button>
                </div>
              {/if}
            </article>
          {/each}
          {#if bal_issues.length > 120}
            <p class="muted">Showing the first 120 of {bal_issues.length} issues.</p>
          {/if}
        </div>
      {/if}
    {:else if bal_respondents.length === 0}
      <EmptyState icon="table" title="No responses yet" body="Read a scanned batch to fill the table." />
    {:else}
      <div class="table-tools">
        <label class="field-label" for="table-filter">Show</label>
        <select id="table-filter" bind:value={bal_filter}>
          <option value="all">All respondents</option>
          <option value="review">Needs review</option>
          <option value="missing-required">Missing required</option>
          <option value="missing-page">Missing page</option>
          <option value="unreadable">Unreadable</option>
          <option value="manual-only">Manual only</option>
          <option value="corrected">Corrected</option>
          <option value="blank">Blank</option>
          <option value="complete">Complete respondents</option>
          <option value="incomplete">Incomplete respondents</option>
        </select>
        <input
          class="table-search"
          type="search"
          placeholder="Search respondent, variable, question, or section"
          bind:value={bal_search}
        />
        <details class="cols">
          <summary>Columns ({bal_shown_column_count}/{bal_variables.length})</summary>
          <div class="cols-pop">
            <div class="cols-actions">
              <button type="button" onclick={bal_show_all_columns} disabled={bal_all_columns_visible}>All</button>
              <button type="button" onclick={bal_show_no_columns} disabled={!bal_all_columns_visible}>None</button>
            </div>
            {#each bal_variables as bal_variable (bal_variable.key)}
              <label class="col-toggle">
                <input
                  type="checkbox"
                  checked={!bal_hidden_columns.has(bal_variable.key)}
                  onchange={() => bal_toggle_column(bal_variable.key)}
                />
                <span>{bal_variable.label}</span>
              </label>
            {/each}
          </div>
        </details>
      </div>
      <p class="muted table-count">
        Showing {bal_visible_respondents.length} of {bal_sorted_respondents.length} respondent{bal_sorted_respondents.length === 1 ? '' : 's'}
        · {bal_shown_column_count} of {bal_variables.length} variable{bal_variables.length === 1 ? '' : 's'}
      </p>
      {#if bal_nothing_matches}
        <p class="muted">Nothing matches this search.</p>
      {:else}
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th scope="col" class="sticky-id">Respondent</th>
              <th scope="col" class="sticky-status">Status</th>
              {#each bal_filtered_variables as bal_variable (bal_variable.key)}
                <th scope="col" aria-sort={bal_sort.key === bal_variable.key ? (bal_sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button class="sort-btn" onclick={() => bal_toggle_sort(bal_variable.key)}>
                    {bal_variable.label}
                    <span class="sort-arrow">{bal_sort.key === bal_variable.key ? (bal_sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
                  </button>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each bal_visible_respondents as bal_respondent (bal_respondent)}
              <tr>
                <th scope="row" class="sticky-id">{bal_respondent}</th>
                <td class="sticky-status">
                  {#if bal_completeness.get(bal_respondent)}
                    <StatusPill
                      tone={bal_completeness_tone(bal_completeness.get(bal_respondent)!)}
                      label={bal_completeness_label(bal_completeness.get(bal_respondent)!)}
                    />
                  {/if}
                </td>
                {#each bal_filtered_variables as bal_variable (bal_variable.key)}
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
      {#if bal_sorted_respondents.length > bal_visible_respondents.length}
        <div class="window-bar">
          <Button size="sm" onclick={() => (bal_row_limit = bal_next_row_limit(bal_row_limit))}>
            Show {Math.min(BAL_TABLE_ROW_WINDOW, bal_sorted_respondents.length - bal_visible_respondents.length)} more
          </Button>
          <span class="muted">{bal_sorted_respondents.length - bal_visible_respondents.length} respondents hidden</span>
        </div>
      {/if}
      {/if}
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
  bind:open={bal_confirm_bulk_blank}
  title="Mark selected as reviewed blank?"
  body="The selected responses will be recorded as intentional blanks in your name, and each change is added to the audit trail."
  confirm_label="Mark blank"
  danger
  onconfirm={bal_mark_selected_blank}
/>

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
  .advanced {
    margin-top: 12px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }
  .advanced summary {
    cursor: pointer;
    font-size: 13px;
    color: var(--text-muted);
  }
  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    margin-top: 10px;
  }
  .setting {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
  }
  .setting span {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .table-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .table-search {
    flex: 1 1 220px;
    min-width: 180px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-raised);
    color: var(--text);
    font-size: 14px;
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
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .queue-select {
    display: inline-flex;
    align-items: center;
    margin-right: 8px;
  }
  .queue-select input {
    width: 16px;
    height: 16px;
  }
  .bulk-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
  }
  .checks-head {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }
  .checks {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .check-card .muted {
    margin: 6px 0 0;
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
    z-index: 2;
  }
  table.data thead th.sticky-id,
  table.data thead th.sticky-status {
    z-index: 3;
  }
  table.data .sticky-id {
    position: sticky;
    left: 0;
    background: var(--surface);
    z-index: 1;
    min-width: 110px;
    border-right: 1px solid var(--border);
  }
  table.data thead th.sticky-id {
    z-index: 4;
  }
  table.data .sticky-status {
    position: sticky;
    left: 110px;
    background: var(--surface);
    z-index: 1;
    border-right: 1px solid var(--border);
  }
  table.data tbody tr:hover .sticky-id,
  table.data tbody tr:hover .sticky-status {
    background: var(--surface-raised, var(--surface));
  }
  .sort-btn {
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .sort-arrow {
    min-width: 10px;
    color: var(--text-muted);
  }
  .table-count {
    margin: 0;
  }
  .window-bar {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .cols {
    position: relative;
  }
  .cols summary {
    cursor: pointer;
    font-size: 13px;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    background: var(--surface-raised);
    white-space: nowrap;
    user-select: none;
  }
  .cols-pop {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    z-index: 20;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px;
    max-height: 300px;
    max-width: 280px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
  .cols-actions {
    display: flex;
    gap: 6px;
  }
  .cols-actions button {
    border: 1px solid var(--border);
    background: var(--surface-raised);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
    color: var(--text);
  }
  .cols-actions button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .col-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    white-space: nowrap;
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
    .table-tools select {
      flex: 1 1 100%;
    }
  }
</style>
