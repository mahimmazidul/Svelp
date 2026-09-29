import {
  BAL_DEFAULT_THRESHOLD_PROFILE,
  BAL_READER_ALGORITHM_VERSION,
  BAL_THRESHOLD_PROFILE_NAME,
  type BlankReferenceRecord,
  type RecognitionRunRecord,
  type RecognitionStatus,
  type RecognitionThresholdProfile,
  type ResponseRecord
} from '../models/response_models';
import type { ScanPageRecord } from '../models/scan_models';
import type { QuestionnaireRecord, ResponseScaleRecord } from '../models/types';
import {
  bal_save_blank_reference,
  bal_save_recognition_run,
  bal_save_response,
  bal_save_response_audit_event,
  dhon_blank_reference,
  ken_pori_blank_references,
  ken_pori_responses_by_respondent
} from '../db/response_repo';
import { dhon_scan_asset, ken_pori_scan_batches, ken_pori_scan_pages } from '../db/scan_repo';
import { dhon_questionnaire } from '../db/questionnaires_repo';
import { ken_pori_scales } from '../db/scales_repo';
import { bal_read_page, type bal_ReadPageOutput } from '../features/reading/reading_engine';
import {
  bal_reading_regions_for_page,
  bal_selection_rules_from_questionnaire
} from '../features/reading/reading_geometry';
import { bal_default_blank_renderer, bal_ensure_blank_references, type bal_BlankRenderer } from '../features/reading/reading_blank';
import { bal_build_print_document, type bal_PrintDocument } from '../features/print/print_layout';
import type { bal_ReadingRegion } from '../features/reading/reading_fixtures';
import { bal_create_eta_estimator, bal_eta_seconds } from '../features/scan/scan_eta';
import { bal_new_id } from './scan_service';

export type bal_ReprocessMode = 'unreviewed-only' | 'preserve-manual' | 'recompute-all';

export interface bal_ReadRunScope {
  projectId: string;
  batchId: string | null;
  respondentId: string | null;
}

export interface bal_ReadRunProgress {
  phase: 'preparing' | 'reading';
  pagesDone: number;
  pagesTotal: number;
  etaSeconds: number | null;
}

export interface bal_ReadPageError {
  pageId: string;
  message: string;
}

export interface bal_ReadRunResult {
  runId: string;
  cancelled: boolean;
  pagesProcessed: number;
  pagesSkippedManual: number;
  regionsProcessed: number;
  accepted: number;
  blanks: number;
  needsReview: number;
  unreadable: number;
  manualOnly: number;
  preservedManual: number;
  overwroteMachine: number;
  errors: bal_ReadPageError[];
}

export interface bal_ReadRunOptions {
  scope: bal_ReadRunScope;
  mode?: bal_ReprocessMode;
  profile?: RecognitionThresholdProfile;
  blankRenderer?: bal_BlankRenderer;
  decode: (bal_blob: Blob) => Promise<{ data: Uint8ClampedArray; width: number; height: number }>;
  onProgress?: (bal_progress: bal_ReadRunProgress) => void;
  isCancelled?: () => boolean;
}

interface bal_QuestionnaireContext {
  questionnaire: QuestionnaireRecord;
  scales: ResponseScaleRecord[];
  doc: bal_PrintDocument;
  blanks: Map<number, BlankReferenceRecord>;
}

function bal_response_key(
  bal_respondent_id: string,
  bal_item_id: string,
  bal_row_id: string | null,
  bal_written: boolean
): string {
  const bal_parts = [bal_respondent_id, bal_item_id];
  if (bal_row_id) bal_parts.push(bal_row_id);
  if (bal_written) bal_parts.push('written');
  return bal_parts.join('::');
}

function bal_normalized_region(
  bal_region: bal_ReadingRegion,
  bal_page_width_mm: number,
  bal_page_height_mm: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: bal_region.rectMm.x / bal_page_width_mm,
    y: bal_region.rectMm.y / bal_page_height_mm,
    width: bal_region.rectMm.width / bal_page_width_mm,
    height: bal_region.rectMm.height / bal_page_height_mm
  };
}

async function bal_scope_pages(bal_scope: bal_ReadRunScope): Promise<ScanPageRecord[]> {
  const bal_batches = bal_scope.batchId
    ? [{ id: bal_scope.batchId }]
    : await ken_pori_scan_batches(bal_scope.projectId);
  const bal_pages: ScanPageRecord[] = [];
  for (const bal_batch of bal_batches) {
    const bal_batch_pages = await ken_pori_scan_pages(bal_batch.id);
    for (const bal_page of bal_batch_pages) bal_pages.push(bal_page);
  }
  const bal_seen = new Set<string>();
  return bal_pages
    .filter((bal_page) => {
      if (bal_seen.has(bal_page.id)) return false;
      bal_seen.add(bal_page.id);
      return (
        bal_page.status === 'ready' &&
        bal_page.respondentId !== null &&
        bal_page.pageNumber !== null &&
        bal_page.questionnaireId !== null &&
        bal_page.normalizedAssetId !== null &&
        (bal_scope.respondentId === null || bal_page.respondentId === bal_scope.respondentId)
      );
    })
    .sort(
      (bal_a, bal_b) =>
        (bal_a.respondentId ?? '').localeCompare(bal_b.respondentId ?? '') ||
        (bal_a.pageNumber ?? 0) - (bal_b.pageNumber ?? 0)
    );
}

async function bal_context_for_questionnaire(
  bal_questionnaire_id: string,
  bal_version: number,
  bal_respondent_sample: string,
  bal_render: bal_BlankRenderer
): Promise<bal_QuestionnaireContext> {
  const bal_questionnaire = await dhon_questionnaire(bal_questionnaire_id);
  if (!bal_questionnaire) throw new Error('The questionnaire for this page is missing from local storage.');
  if (bal_questionnaire.version !== bal_version) {
    throw new Error('This page was printed with a different questionnaire version, so it was not read.');
  }
  const bal_scales = await ken_pori_scales();
  const bal_doc = bal_build_print_document({
    questionnaire: bal_questionnaire,
    scales: bal_scales,
    respondentId: bal_respondent_sample
  });
  const bal_cached = await ken_pori_blank_references(bal_doc.fingerprint);
  const bal_records = await bal_ensure_blank_references(
    bal_questionnaire,
    bal_scales,
    bal_respondent_sample,
    bal_cached,
    bal_render
  );
  const bal_blanks = new Map<number, BlankReferenceRecord>();
  for (const bal_record of bal_records) {
    const bal_existing = await dhon_blank_reference(bal_record.id);
    if (!bal_existing) await bal_save_blank_reference(bal_record);
    bal_blanks.set(bal_record.pageNumber, bal_existing ?? bal_record);
  }
  return { questionnaire: bal_questionnaire, scales: bal_scales, doc: bal_doc, blanks: bal_blanks };
}

function bal_machine_response(
  bal_page: ScanPageRecord,
  bal_ctx: bal_QuestionnaireContext,
  bal_item_id: string,
  bal_variable_name: string | null,
  bal_item_type: string,
  bal_row_id: string | null,
  bal_status: RecognitionStatus,
  bal_value: string[],
  bal_coded: string[] | null,
  bal_confidence: number | null,
  bal_issues: string[],
  bal_run_id: string,
  bal_first_region: bal_ReadingRegion | null,
  bal_page_dims: { width: number; height: number },
  bal_existing: ResponseRecord | null | undefined
): ResponseRecord {
  const bal_now = Date.now();
  return {
    id: bal_response_key(bal_page.respondentId ?? '', bal_item_id, bal_row_id, bal_status === 'manual-only'),
    projectId: bal_page.projectId,
    batchId: bal_page.batchId,
    questionnaireId: bal_page.questionnaireId ?? '',
    questionnaireVersion: bal_page.questionnaireVersion ?? bal_ctx.questionnaire.version,
    respondentId: bal_page.respondentId ?? '',
    itemId: bal_item_id,
    variableName: bal_variable_name ?? bal_first_region?.variableName ?? null,
    itemType: bal_item_type,
    rowId: bal_row_id,
    columnId: null,
    value: bal_value,
    codedValue: bal_coded,
    status: bal_status,
    confidence: bal_confidence,
    machineValue: bal_status === 'manual-only' ? null : bal_value,
    machineStatus: bal_status === 'manual-only' ? null : bal_status,
    machineConfidence: bal_status === 'manual-only' ? null : bal_confidence,
    manuallyReviewed: false,
    validationIssues: bal_issues,
    sourcePageId: bal_page.id,
    sourceRegionRect: bal_first_region
      ? bal_normalized_region(bal_first_region, bal_page_dims.width, bal_page_dims.height)
      : null,
    algorithmVersion: BAL_READER_ALGORITHM_VERSION,
    thresholdProfileName: BAL_THRESHOLD_PROFILE_NAME,
    recognitionRunId: bal_run_id,
    createdAt: bal_existing?.createdAt ?? bal_now,
    updatedAt: bal_now
  };
}

function bal_estimator_record(bal_estimator: ReturnType<typeof bal_create_eta_estimator>, bal_ms: number): void {
  bal_estimator.samples.push({ stage: 'read', ms: bal_ms, at: Date.now() });
  const bal_window = bal_estimator.samples
    .filter((bal_s) => bal_s.stage === 'read')
    .slice(-bal_estimator.windowSize);
  if (bal_window.length === 0) return;
  const bal_latest = bal_window[bal_window.length - 1].ms;
  const bal_previous = bal_estimator.stageAverages.get('read') ?? 0;
  bal_estimator.stageAverages.set('read', bal_previous === 0 ? bal_latest : bal_previous * 0.6 + bal_latest * 0.4);
  bal_estimator.globalAverage = bal_previous === 0 ? bal_latest : bal_previous * 0.6 + bal_latest * 0.4;
  bal_estimator.globalSamples += 1;
}

export async function bal_run_reading(bal_options: bal_ReadRunOptions): Promise<bal_ReadRunResult> {
  const bal_profile = bal_options.profile ?? BAL_DEFAULT_THRESHOLD_PROFILE;
  const bal_mode = bal_options.mode ?? 'preserve-manual';
  const bal_render = bal_options.blankRenderer ?? bal_default_blank_renderer();
  const bal_run_id = bal_new_id();
  const bal_started = Date.now();
  const bal_estimator = bal_create_eta_estimator();
  const bal_result: bal_ReadRunResult = {
    runId: bal_run_id,
    cancelled: false,
    pagesProcessed: 0,
    pagesSkippedManual: 0,
    regionsProcessed: 0,
    accepted: 0,
    blanks: 0,
    needsReview: 0,
    unreadable: 0,
    manualOnly: 0,
    preservedManual: 0,
    overwroteMachine: 0,
    errors: []
  };

  const bal_pages = await bal_scope_pages(bal_options.scope);
  const bal_total = bal_pages.length;
  let bal_done = 0;
  bal_options.onProgress?.({ phase: 'preparing', pagesDone: 0, pagesTotal: bal_total, etaSeconds: null });

  const bal_contexts = new Map<string, bal_QuestionnaireContext>();
  const bal_skipped_respondents = new Set<string>();
  if (bal_mode === 'unreviewed-only') {
    const bal_respondents = [...new Set(bal_pages.map((bal_page) => bal_page.respondentId ?? ''))];
    for (const bal_respondent of bal_respondents) {
      const bal_existing = await ken_pori_responses_by_respondent(bal_respondent);
      if (bal_existing.some((bal_response) => bal_response.manuallyReviewed)) {
        bal_skipped_respondents.add(bal_respondent);
      }
    }
  }

  for (const bal_page of bal_pages) {
    if (bal_options.isCancelled?.()) {
      bal_result.cancelled = true;
      break;
    }
    if (bal_skipped_respondents.has(bal_page.respondentId ?? '')) {
      bal_result.pagesSkippedManual += 1;
      bal_done += 1;
      continue;
    }
    const bal_page_started = Date.now();
    try {
      const bal_ctx_key = `${bal_page.questionnaireId}:${bal_page.questionnaireVersion}`;
      let bal_ctx = bal_contexts.get(bal_ctx_key);
      if (!bal_ctx) {
        bal_ctx = await bal_context_for_questionnaire(
          bal_page.questionnaireId ?? '',
          bal_page.questionnaireVersion ?? 0,
          bal_page.respondentId ?? '',
          bal_render
        );
        bal_contexts.set(bal_ctx_key, bal_ctx);
      }
      const bal_page_number = bal_page.pageNumber ?? 0;
      const bal_blank_record = bal_ctx.blanks.get(bal_page_number);
      if (!bal_blank_record) throw new Error('No blank reference exists for this page.');
      const bal_doc_page = bal_ctx.doc.pages.find((bal_p) => bal_p.pageNumber === bal_page_number);
      if (!bal_doc_page) throw new Error('This page number is not part of the printed layout.');
      const bal_normalized_asset = await dhon_scan_asset(bal_page.normalizedAssetId ?? '');
      if (!bal_normalized_asset) throw new Error('The normalized page image is missing from local storage.');
      const bal_image = await bal_options.decode(bal_normalized_asset.bytes);
      const bal_blank_image = await bal_options.decode(bal_blank_record.bytes);
      const bal_regions = bal_reading_regions_for_page(bal_ctx.doc, bal_page_number);
      const bal_px_per_mm =
        bal_page.transform?.pixelsPerMm ?? bal_image.width / (bal_doc_page.regions.width || 210);
      const bal_output: bal_ReadPageOutput = bal_read_page({
        image: bal_image,
        blank: bal_blank_image,
        regions: bal_regions,
        quality: {
          blurStatus: bal_page.quality?.blurStatus ?? 'good',
          exposureStatus: bal_page.quality?.exposureStatus ?? 'good',
          glareStatus: bal_page.quality?.glareStatus ?? 'good',
          resolutionStatus: bal_page.quality?.resolutionStatus ?? 'good',
          alignmentStatus: bal_page.quality?.alignmentStatus ?? 'good'
        },
        pxPerMm: bal_px_per_mm,
        profile: bal_profile,
        selectionRules: bal_selection_rules_from_questionnaire(bal_ctx.questionnaire)
      });
      bal_result.regionsProcessed += bal_regions.length;
      const bal_existing_responses = await ken_pori_responses_by_respondent(bal_page.respondentId ?? '');
      const bal_existing_by_id = new Map(bal_existing_responses.map((bal_r) => [bal_r.id, bal_r]));

      const bal_groups = new Map<string, bal_ReadingRegion[]>();
      for (const bal_region of bal_regions) {
        const bal_key =
          bal_region.kind === 'matrix'
            ? `${bal_region.itemId}::${bal_region.rowId ?? ''}`
            : bal_region.itemId;
        const bal_existing_group = bal_groups.get(bal_key);
        if (bal_existing_group) bal_existing_group.push(bal_region);
        else bal_groups.set(bal_key, [bal_region]);
      }
      const bal_page_dims = { width: bal_doc_page.regions.width, height: bal_doc_page.regions.height };

      for (const bal_reading of bal_output.items) {
        const bal_group_key =
          bal_reading.kind === 'matrix'
            ? `${bal_reading.itemId}::${bal_reading.rowId ?? ''}`
            : bal_reading.itemId;
        const bal_group_regions = bal_groups.get(bal_group_key) ?? [];
        const bal_existing = bal_existing_by_id.get(
          bal_response_key(bal_page.respondentId ?? '', bal_reading.itemId, bal_reading.rowId, false)
        );
        if (bal_existing?.manuallyReviewed && bal_mode !== 'recompute-all') {
          bal_result.preservedManual += 1;
          continue;
        }
        if (bal_existing?.manuallyReviewed && bal_mode === 'recompute-all') {
          await bal_save_response_audit_event({
            id: bal_new_id(),
            projectId: bal_page.projectId,
            responseId: bal_existing.id,
            respondentId: bal_page.respondentId ?? '',
            itemId: bal_reading.itemId,
            rowId: bal_reading.rowId,
            previousValue: bal_existing.value,
            previousStatus: bal_existing.status,
            finalValue: bal_reading.value.map((bal_v) => bal_v.optionId ?? bal_v.columnId ?? ''),
            finalStatus: bal_reading.status,
            action: 'reprocess-overwrite',
            createdAt: Date.now()
          });
        }
        const bal_value = bal_reading.value.map((bal_v) => bal_v.optionId ?? bal_v.columnId ?? '');
        const bal_issues: string[] = [];
        if (bal_reading.reason.includes('at most')) bal_issues.push('over-max-selections');
        if (bal_reading.reason.includes('At least')) bal_issues.push('under-min-selections');
        const bal_record = bal_machine_response(
          bal_page,
          bal_ctx,
          bal_reading.itemId,
          bal_reading.variableName,
          bal_reading.itemType,
          bal_reading.rowId,
          bal_reading.status,
          bal_value,
          bal_reading.codedValue ? [...bal_reading.codedValue] : null,
          bal_reading.status === 'unreadable' ? null : bal_reading.confidence,
          bal_issues,
          bal_run_id,
          bal_group_regions[0] ?? null,
          bal_page_dims,
          bal_existing
        );
        if (bal_reading.status === 'accepted') bal_result.accepted += 1;
        else if (bal_reading.status === 'blank') bal_result.blanks += 1;
        else if (bal_reading.status === 'unreadable') bal_result.unreadable += 1;
        else bal_result.needsReview += 1;
        if (bal_existing && !bal_existing.manuallyReviewed) bal_result.overwroteMachine += 1;
        await bal_save_response(bal_record);
      }

      for (const bal_written_region of bal_output.manualOnlyRegions) {
        if (bal_written_region.kind === 'respondent') continue;
        const bal_group_regions = bal_groups.get(bal_written_region.itemId) ?? [];
        const bal_existing = bal_existing_by_id.get(
          bal_response_key(bal_page.respondentId ?? '', bal_written_region.itemId, null, true)
        );
        if (bal_existing?.manuallyReviewed && bal_mode !== 'recompute-all') {
          bal_result.preservedManual += 1;
          continue;
        }
        const bal_record = bal_machine_response(
          bal_page,
          bal_ctx,
          bal_written_region.itemId,
          bal_written_region.variableName,
          bal_written_region.itemType,
          null,
          'manual-only',
          [],
          null,
          null,
          [],
          bal_run_id,
          bal_group_regions[0] ?? bal_written_region,
          bal_page_dims,
          bal_existing
        );
        bal_result.manualOnly += 1;
        await bal_save_response(bal_record);
      }
      bal_result.pagesProcessed += 1;
    } catch (bal_error) {
      bal_result.errors.push({
        pageId: bal_page.id,
        message: bal_error instanceof Error ? bal_error.message : 'This page could not be read.'
      });
    }
    bal_done += 1;
    bal_estimator_record(bal_estimator, Date.now() - bal_page_started);
    const bal_remaining = bal_total - bal_done;
    bal_options.onProgress?.({
      phase: 'reading',
      pagesDone: bal_done,
      pagesTotal: bal_total,
      etaSeconds:
        bal_remaining > 0 ? bal_eta_seconds(bal_estimator, [{ stage: 'read', count: bal_remaining }]) : 0
    });
  }

  const bal_single_context = [...bal_contexts.values()][0];
  const bal_run: RecognitionRunRecord = {
    id: bal_run_id,
    projectId: bal_options.scope.projectId,
    batchId: bal_options.scope.batchId,
    questionnaireId: bal_contexts.size === 1 ? bal_single_context.questionnaire.id : null,
    questionnaireVersion: bal_contexts.size === 1 ? bal_single_context.questionnaire.version : null,
    scope: bal_options.scope.respondentId ? 'respondent' : bal_options.scope.batchId ? 'batch' : 'project',
    algorithmVersion: BAL_READER_ALGORITHM_VERSION,
    thresholdProfile: bal_profile,
    acceptanceThreshold: bal_profile.acceptanceConfidence,
    pagesProcessed: bal_result.pagesProcessed,
    regionsProcessed: bal_result.regionsProcessed,
    accepted: bal_result.accepted,
    blanks: bal_result.blanks,
    needsReview: bal_result.needsReview,
    unreadable: bal_result.unreadable,
    preservedManual: bal_result.preservedManual,
    overwroteMachine: bal_result.overwroteMachine,
    startedAt: bal_started,
    finishedAt: Date.now(),
    createdAt: bal_started
  };
  await bal_save_recognition_run(bal_run);
  return bal_result;
}
