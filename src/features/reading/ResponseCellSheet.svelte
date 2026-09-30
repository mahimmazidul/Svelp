<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../../components/ui/Button.svelte';
  import StatusPill from '../../components/ui/StatusPill.svelte';
  import Sheet from '../../components/ui/Sheet.svelte';
  import { dhon_questionnaire } from '../../db/questionnaires_repo';
  import { ken_pori_scales } from '../../db/scales_repo';
  import {
    bal_save_response,
    bal_save_response_audit_event,
    dhon_blank_reference,
    ken_pori_response_audit,
    ken_pori_responses_by_respondent
  } from '../../db/response_repo';
  import { dhon_scan_asset, dhon_scan_page } from '../../db/scan_repo';
  import { bal_new_id } from '../../services/scan_service';
  import type { ResponseAuditEventRecord, ResponseRecord } from '../../models/response_models';
  import type { QuestionnaireRecord } from '../../models/types';
  import {
    bal_confidence_category,
    bal_item_map,
    bal_status_label,
    bal_status_tone,
    type bal_ItemInfo
  } from './reading_ui_helpers';
  import { bal_page_crop } from './reading_crops';
  import { bal_build_print_document } from '../print/print_layout';
  import { bal_reading_regions_for_page } from './reading_geometry';
  import { bal_read_page } from './reading_engine';
  import { BAL_DEFAULT_THRESHOLD_PROFILE } from '../../models/response_models';
  import { bal_default_image_decode } from './reading_crops';

  let {
    respondentId,
    itemId,
    rowId,
    onclose
  }: {
    respondentId: string;
    itemId: string;
    rowId: string | null;
    onclose: () => void;
  } = $props();

  let bal_response = $state<ResponseRecord | null>(null);
  let bal_info = $state<bal_ItemInfo | null>(null);
  let bal_crop = $state<string | null>(null);
  let bal_history = $state<ResponseAuditEventRecord[]>([]);
  let bal_diagnostic_rows = $state<
    { label: string; detected: boolean; evidence: number; center: number; added: number; stroke: number; glare: number }[]
  >([]);
  let bal_diagnostic_note = $state<string | null>(null);
  let bal_transcript = $state('');
  let bal_busy = $state(false);
  let bal_error = $state<string | null>(null);

  let bal_options = $derived(bal_info?.options ?? []);
  let bal_columns = $derived(bal_info?.columns ?? []);
  let bal_is_written = $derived(bal_response?.status === 'manual-only');

  async function bal_load(): Promise<void> {
    const bal_all = await ken_pori_responses_by_respondent(respondentId);
    bal_response =
      bal_all.find((bal_r) => bal_r.itemId === itemId && bal_r.rowId === rowId && bal_r.status !== 'manual-only') ??
      bal_all.find((bal_r) => bal_r.itemId === itemId && bal_r.rowId === rowId) ??
      null;
    if (!bal_response) return;
    const bal_q = await dhon_questionnaire(bal_response.questionnaireId);
    if (!bal_q) return;
    bal_info = bal_item_map(bal_q).get(itemId) ?? null;
    bal_history = (await ken_pori_response_audit(bal_response.id)).sort(
      (bal_a, bal_b) => bal_b.createdAt - bal_a.createdAt
    );
    bal_transcript = bal_response.value.join(' ');
    await bal_load_crop();
    void bal_load_diagnostics(bal_q);
  }

  async function bal_load_crop(): Promise<void> {
    if (!bal_response?.sourcePageId || !bal_response.sourceRegionRect) return;
    const bal_page = await dhon_scan_page(bal_response.sourcePageId);
    if (!bal_page?.normalizedAssetId) return;
    const bal_asset = await dhon_scan_asset(bal_page.normalizedAssetId);
    if (!bal_asset) return;
    bal_crop = await bal_page_crop(bal_page.normalizedAssetId, bal_response.sourceRegionRect);
  }

  async function bal_load_diagnostics(bal_q: QuestionnaireRecord): Promise<void> {
    if (!bal_response?.sourcePageId) return;
    const bal_page = await dhon_scan_page(bal_response.sourcePageId);
    if (!bal_page?.normalizedAssetId || bal_page.pageNumber === null) return;
    const bal_scales = await ken_pori_scales();
    const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: bal_scales, respondentId: respondentId });
    const bal_blank = await dhon_blank_reference(`${bal_doc.fingerprint}:${bal_page.pageNumber}`);
    if (!bal_blank) {
      bal_diagnostic_note = 'Diagnostics need the blank reference for this form version.';
      return;
    }
    try {
      const bal_asset = await dhon_scan_asset(bal_page.normalizedAssetId);
      if (!bal_asset) throw new Error('missing asset');
      const bal_image = await bal_default_image_decode(bal_asset.bytes);
      const bal_blank_image = await bal_default_image_decode(bal_blank.bytes);
      const bal_regions = bal_reading_regions_for_page(bal_doc, bal_page.pageNumber);
      const bal_item_regions = bal_regions.filter(
        (bal_r) => bal_r.itemId === itemId && (rowId === null || bal_r.rowId === rowId)
      );
      const bal_output = bal_read_page({
        image: bal_image,
        blank: bal_blank_image,
        regions: bal_item_regions,
        quality: {
          blurStatus: bal_page.quality?.blurStatus ?? 'good',
          exposureStatus: bal_page.quality?.exposureStatus ?? 'good',
          glareStatus: bal_page.quality?.glareStatus ?? 'good',
          resolutionStatus: bal_page.quality?.resolutionStatus ?? 'good',
          alignmentStatus: bal_page.quality?.alignmentStatus ?? 'good'
        },
        pxPerMm: bal_page.transform?.pixelsPerMm ?? 5.9,
        profile: BAL_DEFAULT_THRESHOLD_PROFILE,
        selectionRules: {}
      });
      const bal_marks = bal_output.marks;
      bal_diagnostic_rows = bal_item_regions.map((bal_region, bal_index) => {
        const bal_mark = bal_marks[bal_index];
        const bal_label = bal_region.optionId
          ? (bal_info?.options.find((bal_o) => bal_o.id === bal_region.optionId)?.label ?? bal_region.optionId)
          : (bal_info?.columns.find((bal_c) => bal_c.id === bal_region.columnId)?.label ?? bal_region.columnId ?? '');
        return {
          label: bal_label,
          detected: bal_mark?.markDetected ?? false,
          evidence: bal_mark?.normalizedInkScore ?? 0,
          center: bal_mark?.diagnostics.centerRatio ?? 0,
          added: bal_mark?.diagnostics.addedRatio ?? 0,
          stroke: bal_mark?.diagnostics.strokeDarkArea ?? 0,
          glare: bal_mark?.diagnostics.glareRatio ?? 0
        };
      });
    } catch {
      bal_diagnostic_note = 'Diagnostics could not re-read this page.';
    }
  }

  async function bal_apply(
    bal_value: string[],
    bal_status: ResponseRecord['status'],
    bal_action: ResponseAuditEventRecord['action']
  ): Promise<void> {
    if (!bal_response || bal_busy) return;
    bal_busy = true;
    bal_error = null;
    try {
      const bal_previous: ResponseRecord = $state.snapshot(bal_response);
      await bal_save_response_audit_event({
        id: bal_new_id(),
        projectId: bal_previous.projectId,
        responseId: bal_previous.id,
        respondentId,
        itemId,
        rowId,
        previousValue: bal_previous.value,
        previousStatus: bal_previous.status,
        finalValue: bal_value,
        finalStatus: bal_status,
        action: bal_action,
        createdAt: Date.now()
      });
      await bal_save_response({
        ...bal_previous,
        value: bal_value,
        codedValue: null,
        status: bal_status,
        confidence: bal_status === 'accepted' ? 1 : null,
        manuallyReviewed: true,
        recognitionRunId: bal_previous.recognitionRunId,
        updatedAt: Date.now()
      });
      bal_response = { ...bal_previous, value: bal_value, status: bal_status, manuallyReviewed: true };
      bal_history = (await ken_pori_response_audit(bal_response.id)).sort(
        (bal_a, bal_b) => bal_b.createdAt - bal_a.createdAt
      );
    } catch (bal_exception) {
      bal_error = bal_exception instanceof Error ? bal_exception.message : 'The correction could not be saved.';
    } finally {
      bal_busy = false;
    }
  }

  function bal_choose_option(bal_option_id: string): void {
    if (!bal_response) return;
    if (bal_response.itemType === 'multiple_choice') {
      const bal_current = bal_response.value.includes(bal_option_id)
        ? bal_response.value.filter((bal_id) => bal_id !== bal_option_id)
        : [...bal_response.value, bal_option_id];
      void bal_apply(bal_current.sort(), 'accepted', 'manual-correction');
    } else {
      void bal_apply([bal_option_id], 'accepted', 'manual-correction');
    }
  }

  function bal_choose_column(bal_column_id: string): void {
    if (!bal_response) return;
    if (bal_response.itemType === 'matrix' && bal_response.value.includes(bal_column_id)) {
      void bal_apply([], 'blank', 'marked-blank');
    } else {
      void bal_apply([bal_column_id], 'accepted', 'manual-correction');
    }
  }

  function bal_save_transcript(): void {
    const bal_parts = bal_transcript.split(/\s+/).filter((bal_part) => bal_part.length > 0);
    if (bal_parts.length === 0) {
      void bal_apply([], 'blank', 'marked-blank');
    } else {
      void bal_apply(bal_parts, 'accepted', 'manual-transcription');
    }
  }

  function bal_on_key(bal_event: KeyboardEvent): void {
    if (!bal_response || bal_busy) return;
    if (bal_event.key === 'b' || bal_event.key === 'B') {
      void bal_apply([], 'blank', 'marked-blank');
      return;
    }
    const bal_index = Number.parseInt(bal_event.key, 10);
    if (!Number.isNaN(bal_index) && bal_index >= 1) {
      if (bal_response.rowId && bal_index <= bal_columns.length) {
        bal_choose_column(bal_columns[bal_index - 1].id);
      } else if (!bal_response.rowId && bal_index <= bal_options.length) {
        bal_choose_option(bal_options[bal_index - 1].id);
      }
    }
  }

  onMount(() => {
    void bal_load();
  });
</script>

<svelte:window onkeydown={bal_on_key} />

<Sheet open title="Inspect answer" side="bottom" onclose={onclose}>
  <div class="wrap">
    {#if bal_response && bal_info}
      <div class="meta">
        <div>
          <strong>{bal_info.number} {bal_info.label}</strong>
          {#if rowId}
            <span class="muted"> · {bal_info.rows.find((bal_r) => bal_r.id === rowId)?.label ?? rowId}</span>
          {/if}
        </div>
        <StatusPill tone={bal_status_tone(bal_response.status)} label={bal_status_label(bal_response.status)} />
      </div>
      <p class="muted">
        {bal_confidence_category(bal_response)}
        {#if bal_response.confidence !== null}
          · clarity {Math.round(bal_response.confidence * 100)}%
        {/if}
        {#if bal_response.validationIssues.length > 0}
          · {bal_response.validationIssues.join(', ')}
        {/if}
      </p>

      <div class="crop-box">
        {#if bal_crop}
          <img src={bal_crop} alt="Answer region crop" />
        {:else}
          <p class="muted">No crop available for this answer.</p>
        {/if}
      </div>

      {#if bal_is_written}
        <label class="transcript">
          <span class="field-label">Transcribed value</span>
          <input bind:value={bal_transcript} placeholder="Type what is written on the form" />
        </label>
        <div class="actions">
          <Button variant="primary" disabled={bal_busy} onclick={bal_save_transcript}>Save transcription</Button>
          <Button disabled={bal_busy} onclick={() => bal_apply([], 'blank', 'marked-blank')}>Mark blank</Button>
        </div>
      {:else if rowId}
        <div class="choices">
          {#each bal_columns as bal_column, bal_index (bal_column.id)}
            <button
              class="choice"
              class:selected={bal_response.value.includes(bal_column.id)}
              disabled={bal_busy}
              onclick={() => bal_choose_column(bal_column.id)}
            >
              <span class="key">{bal_index + 1}</span>
              {bal_column.label}
            </button>
          {/each}
        </div>
      {:else}
        <div class="choices">
          {#each bal_options as bal_option, bal_index (bal_option.id)}
            <button
              class="choice"
              class:selected={bal_response.value.includes(bal_option.id)}
              disabled={bal_busy}
              onclick={() => bal_choose_option(bal_option.id)}
            >
              <span class="key">{bal_index + 1}</span>
              {bal_option.label}
            </button>
          {/each}
        </div>
        <div class="actions">
          <Button disabled={bal_busy} onclick={() => bal_apply([], 'blank', 'marked-blank')}>Mark blank (B)</Button>
        </div>
      {/if}

      {#if bal_diagnostic_rows.length > 0}
        <details class="diag">
          <summary>Diagnostics</summary>
          <table>
            <thead>
              <tr><th>Option</th><th>Mark</th><th>Evidence</th><th>Center</th><th>Added</th><th>Stroke</th><th>Glare</th></tr>
            </thead>
            <tbody>
              {#each bal_diagnostic_rows as bal_row (bal_row.label)}
                <tr>
                  <td>{bal_row.label}</td>
                  <td>{bal_row.detected ? 'yes' : 'no'}</td>
                  <td>{bal_row.evidence.toFixed(2)}</td>
                  <td>{bal_row.center.toFixed(3)}</td>
                  <td>{bal_row.added.toFixed(3)}</td>
                  <td>{bal_row.stroke}</td>
                  <td>{bal_row.glare.toFixed(2)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          {#if bal_diagnostic_note}
            <p class="muted">{bal_diagnostic_note}</p>
          {/if}
        </details>
      {:else if bal_diagnostic_note}
        <p class="muted">{bal_diagnostic_note}</p>
      {/if}

      {#if bal_history.length > 0}
        <details class="hist">
          <summary>History</summary>
          <ul>
            {#each bal_history as bal_event (bal_event.id)}
              <li>
                {new Date(bal_event.createdAt).toLocaleString()} · {bal_event.action} ·
                {bal_event.previousStatus ?? '—'} → {bal_event.finalStatus ?? '—'}
              </li>
            {/each}
          </ul>
        </details>
      {/if}

      {#if bal_error}
        <p class="error">{bal_error}</p>
      {/if}
    {:else}
      <p class="muted">Loading…</p>
    {/if}
  </div>
</Sheet>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 8px;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .crop-box {
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    background: var(--surface-raised);
    display: flex;
    justify-content: center;
  }
  .crop-box img {
    max-width: 100%;
    display: block;
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .choice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface-raised);
    color: var(--text);
    font-size: 14px;
    cursor: pointer;
    min-height: 44px;
  }
  .choice.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .transcript {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .transcript input {
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-raised);
    color: var(--text);
    font-size: 15px;
  }
  .field-label {
    font-size: 13px;
    color: var(--text-muted);
  }
  .diag table,
  .hist ul {
    width: 100%;
    font-size: 12px;
    border-collapse: collapse;
  }
  .diag th,
  .diag td {
    border-bottom: 1px solid var(--border);
    padding: 4px 6px;
    text-align: left;
  }
  .hist ul {
    margin: 6px 0 0;
    padding-left: 18px;
    color: var(--text-muted);
  }
  summary {
    cursor: pointer;
    font-size: 13px;
    color: var(--text-muted);
  }
  .error {
    color: var(--danger, #b3261e);
    font-size: 13px;
    margin: 0;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin: 0;
  }
</style>
