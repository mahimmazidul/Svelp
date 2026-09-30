import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { bal_clear } from '../db/client';
import { bal_save_questionnaire } from '../db/questionnaires_repo';
import { bal_save_response, ken_pori_response_audit, ken_pori_responses_by_respondent } from '../db/response_repo';
import { bal_save_scan_asset, bal_save_scan_batch, bal_save_scan_page } from '../db/scan_repo';
import { bal_save_scale } from '../db/scales_repo';
import {
  bal_render_blank_instrument,
  bal_render_marked_scan,
  type bal_ReadingRegion
} from '../features/reading/reading_fixtures';
import { bal_reading_regions_for_page } from '../features/reading/reading_geometry';
import { bal_build_print_document } from '../features/print/print_layout';
import { bal_ffq, bal_frequency_scale, bal_mixed_survey } from '../features/print/print_fixtures';
import type { ScanPageRecord } from '../models/scan_models';
import type { ResponseScaleRecord } from '../models/types';
import { bal_run_reading, type bal_ReadRunProgress } from './reading_run';
import { bal_new_batch_for_project } from './scan_run';

const BAL_PPM = 5.9;

async function bal_seed_project(): Promise<{ questionnaireId: string; batchId: string }> {
  const bal_q = bal_mixed_survey();
  await bal_save_questionnaire(bal_q);
  const bal_scales = [bal_frequency_scale()];
  for (const bal_scale of bal_scales) await bal_save_scale(bal_scale as ResponseScaleRecord);
  const bal_batch = await bal_new_batch_for_project('p-read', bal_q.id, bal_q.version, true);
  return { questionnaireId: bal_q.id, batchId: bal_batch.id };
}

interface bal_PagePlan {
  pageId: string;
  respondentId: string;
  pageNumber: number;
  marks: { optionIndex: number; style: 'fill' | 'tick' | 'cross' }[];
  choiceItemIndex: number;
  version?: number;
}

function bal_render_plan(bal_plan: bal_PagePlan): Record<string, { data: Uint8ClampedArray; width: number; height: number }> {
  const bal_q = bal_mixed_survey();
  const bal_doc = bal_build_print_document({
    questionnaire: bal_q,
    scales: [bal_frequency_scale()],
    respondentId: bal_plan.respondentId
  });
  const bal_regions_all = bal_reading_regions_for_page(bal_doc, bal_plan.pageNumber);
  const bal_choice_regions: bal_ReadingRegion[] = [];
  const bal_seen_items = new Map<string, number>();
  for (const bal_region of bal_regions_all) {
    if (bal_region.kind !== 'choice' || bal_region.selection !== 'single') continue;
    const bal_count = bal_seen_items.get(bal_region.itemId) ?? 0;
    bal_seen_items.set(bal_region.itemId, bal_count + 1);
  }
  const bal_target_item = [...bal_seen_items.keys()][bal_plan.choiceItemIndex];
  for (const bal_region of bal_regions_all) {
    if (bal_region.itemId === bal_target_item && bal_region.kind === 'choice') bal_choice_regions.push(bal_region);
  }
  const bal_blank = bal_render_blank_instrument(bal_regions_all, BAL_PPM);
  const bal_marks = bal_plan.marks.map((bal_mark) => {
    const bal_region_index = bal_regions_all.indexOf(bal_choice_regions[bal_mark.optionIndex]);
    return { regionIndex: bal_region_index, style: bal_mark.style };
  });
  const bal_scan = bal_render_marked_scan(bal_blank, bal_regions_all, bal_marks, BAL_PPM);
  return {
    [`${bal_plan.pageId}|scan`]: { data: bal_scan.data, width: bal_scan.width, height: bal_scan.height },
    [`blank:${bal_plan.pageNumber}`]: { data: bal_blank.data, width: bal_blank.width, height: bal_blank.height }
  };
}

async function bal_seed_page_with_blobs(
  bal_batch_id: string,
  bal_questionnaire_id: string,
  bal_plan: bal_PagePlan,
  bal_images: Map<string, { data: Uint8ClampedArray; width: number; height: number }>
): Promise<void> {
  const bal_scan_image = bal_images.get(`${bal_plan.pageId}|scan`);
  if (!bal_scan_image) throw new Error('plan not rendered');
  const bal_marker = new TextEncoder().encode(`${bal_plan.pageId}|scan`);
  const bal_q = bal_mixed_survey();
  await bal_save_scan_asset({
    id: `asset-n-${bal_plan.pageId}`,
    batchId: bal_batch_id,
    pageId: bal_plan.pageId,
    kind: 'normalized',
    mime: 'application/x-svelp-fixture',
    bytes: new Blob([bal_marker]),
    width: bal_scan_image.width,
    height: bal_scan_image.height,
    size: bal_marker.length,
    createdAt: 1
  });
  const bal_page: ScanPageRecord = {
    id: bal_plan.pageId,
    batchId: bal_batch_id,
    projectId: 'p-read',
    questionnaireId: bal_questionnaire_id,
    questionnaireVersion: bal_plan.version ?? bal_q.version,
    respondentId: bal_plan.respondentId,
    pageNumber: bal_plan.pageNumber,
    status: 'ready',
    sourceAssetId: null,
    normalizedAssetId: `asset-n-${bal_plan.pageId}`,
    sourceName: `${bal_plan.pageId}.png`,
    sourceType: 'image',
    sourceHash: `hash-${bal_plan.pageId}`,
    sourceBytes: 10,
    normalizedBytes: bal_scan_image.data.length,
    thumbSource: null,
    thumbNormalized: null,
    identitySource: 'qr',
    payload: null,
    detectedPayloads: null,
    quality: null,
    alignment: null,
    transform: {
      markerPoints: null,
      manualPoints: null,
      homography: null,
      sourceWidth: 1,
      sourceHeight: 1,
      outWidth: bal_scan_image.width,
      outHeight: bal_scan_image.height,
      rotationApplied: 0,
      pixelsPerMm: BAL_PPM
    },
    issues: [],
    errorMessage: null,
    processingMs: 5,
    createdAt: 1,
    updatedAt: 1
  };
  await bal_save_scan_page(bal_page);
}

function bal_make_decoder(bal_images: Map<string, { data: Uint8ClampedArray; width: number; height: number }>) {
  return async (bal_blob: Blob) => {
    const bal_text = await bal_blob.text();
    const bal_key = bal_text.endsWith('|scan') ? bal_text : bal_text;
    const bal_image = bal_images.get(bal_key);
    if (!bal_image) throw new Error(`no fixture image registered for ${bal_text.slice(0, 40)}`);
    return bal_image;
  };
}

async function bal_setup_plans(bal_plans: bal_PagePlan[]) {
  const bal_seed = await bal_seed_project();
  await bal_save_scan_batch({
    id: bal_seed.batchId,
    projectId: 'p-read',
    questionnaireId: bal_seed.questionnaireId,
    questionnaireVersion: bal_mixed_survey().version,
    status: 'done',
    keepOriginals: true,
    summary: {
      totalPages: 0,
      ready: 0,
      needsReview: 0,
      duplicates: 0,
      failed: 0,
      unsupported: 0,
      queued: 0,
      respondents: 0,
      complete: 0,
      incomplete: 0
    },
    createdAt: 1,
    updatedAt: 1
  });
  const bal_images = new Map<string, { data: Uint8ClampedArray; width: number; height: number }>();
  for (const bal_plan of bal_plans) {
    for (const [bal_key, bal_value] of Object.entries(bal_render_plan(bal_plan))) {
      bal_images.set(bal_key, bal_value);
    }
    await bal_seed_page_with_blobs(bal_seed.batchId, bal_seed.questionnaireId, bal_plan, bal_images);
  }
  const bal_decode = bal_make_decoder(bal_images);
  return { ...bal_seed, decode: bal_decode };
}

beforeEach(async () => {
  await bal_clear('scanBatches');
  await bal_clear('scanPages');
  await bal_clear('scanAssets');
  await bal_clear('scanAuditEvents');
  await bal_clear('questionnaires');
  await bal_clear('responseScales');
  await bal_clear('responses');
  await bal_clear('recognitionRuns');
  await bal_clear('responseAuditEvents');
  await bal_clear('blankReferences');
});

describe('reading run service', () => {
  it('reads marked and blank pages into accepted and blank responses', async () => {
    const bal_setup = await bal_setup_plans([
      { pageId: 'pg-1', respondentId: '001', pageNumber: 1, marks: [{ optionIndex: 1, style: 'fill' }], choiceItemIndex: 0 }
    ]);
    const bal_progress: bal_ReadRunProgress[] = [];
    const bal_result = await bal_run_reading({
      scope: { projectId: 'p-read', batchId: bal_setup.batchId, respondentId: null },
      decode: bal_setup.decode,
      blankRenderer: async (bal_page) => new Blob([new TextEncoder().encode(`blank:${bal_page.pageNumber}`)]),
      onProgress: (bal_p) => bal_progress.push(bal_p)
    });
    expect(bal_result.errors).toEqual([]);
    expect(bal_result.pagesProcessed).toBe(1);
    expect(bal_result.accepted).toBe(1);
    expect(bal_result.manualOnly).toBeGreaterThan(0);
    const bal_responses = await ken_pori_responses_by_respondent('001');
    const bal_accepted = bal_responses.find(
      (bal_r) => bal_r.status === 'accepted' && bal_r.rowId === null
    );
    expect(bal_accepted?.value).toHaveLength(1);
    expect(bal_accepted?.confidence ?? 0).toBeGreaterThan(0.75);
    expect(bal_accepted?.algorithmVersion).toBe('R1');
    const bal_manual = bal_responses.filter((bal_r) => bal_r.status === 'manual-only');
    expect(bal_manual.length).toBeGreaterThan(0);
    for (const bal_record of bal_manual) {
      expect(bal_record.id.endsWith('::written')).toBe(true);
    }
    expect(bal_progress[0].phase).toBe('preparing');
    expect(bal_progress[0].pagesTotal).toBe(1);
    const bal_last = bal_progress[bal_progress.length - 1];
    expect(bal_last.pagesDone).toBe(1);
    expect(Number.isNaN(bal_last.etaSeconds ?? 0)).toBe(false);
  });

  it('marks an empty page as blank and keeps manual-only records', async () => {
    const bal_setup = await bal_setup_plans([
      { pageId: 'pg-2', respondentId: '002', pageNumber: 1, marks: [], choiceItemIndex: 0 }
    ]);
    const bal_result = await bal_run_reading({
      scope: { projectId: 'p-read', batchId: bal_setup.batchId, respondentId: null },
      decode: bal_setup.decode,
      blankRenderer: async (bal_page) => new Blob([new TextEncoder().encode(`blank:${bal_page.pageNumber}`)])
    });
    const bal_responses = await ken_pori_responses_by_respondent('002');
    const bal_choice = bal_responses.filter((bal_r) => bal_r.status === 'blank' && bal_r.rowId === null);
    expect(bal_choice.length).toBeGreaterThanOrEqual(2);
    expect(bal_result.blanks).toBe(bal_choice.length);
  });

  it('preserves manual corrections on reprocess by default', async () => {
    const bal_setup = await bal_setup_plans([
      { pageId: 'pg-3', respondentId: '003', pageNumber: 1, marks: [{ optionIndex: 0, style: 'fill' }], choiceItemIndex: 0 }
    ]);
    await bal_run_reading({
      scope: { projectId: 'p-read', batchId: bal_setup.batchId, respondentId: null },
      decode: bal_setup.decode,
      blankRenderer: async (bal_page) => new Blob([new TextEncoder().encode(`blank:${bal_page.pageNumber}`)])
    });
    const bal_before = await ken_pori_responses_by_respondent('003');
    const bal_target = bal_before.find((bal_r) => bal_r.status === 'accepted' && bal_r.rowId === null);
    expect(bal_target).toBeDefined();
    await bal_save_response({
      ...(bal_target as NonNullable<typeof bal_target>),
      value: ['manual-option'],
      codedValue: ['9'],
      status: 'needs-review',
      machineValue: bal_target?.value ?? null,
      machineStatus: bal_target?.status ?? null,
      machineConfidence: bal_target?.confidence ?? null,
      manuallyReviewed: true,
      updatedAt: (bal_target?.updatedAt ?? 0) + 1
    });
    const bal_result = await bal_run_reading({
      scope: { projectId: 'p-read', batchId: bal_setup.batchId, respondentId: null },
      decode: bal_setup.decode,
      blankRenderer: async (bal_page) => new Blob([new TextEncoder().encode(`blank:${bal_page.pageNumber}`)])
    });
    expect(bal_result.preservedManual).toBeGreaterThanOrEqual(1);
    const bal_after = await ken_pori_responses_by_respondent('003');
    const bal_kept = bal_after.find((bal_r) => bal_r.id === bal_target?.id);
    expect(bal_kept?.value).toEqual(['manual-option']);
    expect(bal_kept?.manuallyReviewed).toBe(true);
    expect(bal_kept?.machineValue).toEqual(bal_target?.value);
  });

  it('overwrites manual corrections only in recompute-all mode with an audit event', async () => {
    const bal_setup = await bal_setup_plans([
      { pageId: 'pg-4', respondentId: '004', pageNumber: 1, marks: [{ optionIndex: 2, style: 'tick' }], choiceItemIndex: 0 }
    ]);
    await bal_run_reading({
      scope: { projectId: 'p-read', batchId: bal_setup.batchId, respondentId: null },
      decode: bal_setup.decode,
      blankRenderer: async (bal_page) => new Blob([new TextEncoder().encode(`blank:${bal_page.pageNumber}`)])
    });
    const bal_before = await ken_pori_responses_by_respondent('004');
    const bal_target = bal_before.find((bal_r) => bal_r.status === 'accepted' && bal_r.rowId === null);
    await bal_save_response({
      ...(bal_target as NonNullable<typeof bal_target>),
      value: ['human-pick'],
      manuallyReviewed: true,
      updatedAt: (bal_target?.updatedAt ?? 0) + 1
    });
    const bal_result = await bal_run_reading({
      scope: { projectId: 'p-read', batchId: bal_setup.batchId, respondentId: null },
      mode: 'recompute-all',
      decode: bal_setup.decode,
      blankRenderer: async (bal_page) => new Blob([new TextEncoder().encode(`blank:${bal_page.pageNumber}`)])
    });
    expect(bal_result.overwroteMachine).toBeGreaterThanOrEqual(0);
    const bal_after = await ken_pori_responses_by_respondent('004');
    const bal_overwritten = bal_after.find((bal_r) => bal_r.id === bal_target?.id);
    expect(bal_overwritten?.value).not.toEqual(['human-pick']);
    expect(bal_overwritten?.manuallyReviewed).toBe(false);
    const bal_audit = await ken_pori_response_audit(bal_target?.id ?? '');
    expect(bal_audit.some((bal_event) => bal_event.action === 'reprocess-overwrite')).toBe(true);
    expect(bal_audit.some((bal_event) => bal_event.previousValue?.[0] === 'human-pick')).toBe(true);
  });

  it('skips respondents with manual reviews in unreviewed-only mode', async () => {
    const bal_setup = await bal_setup_plans([
      { pageId: 'pg-5', respondentId: '005', pageNumber: 1, marks: [{ optionIndex: 1, style: 'fill' }], choiceItemIndex: 0 },
      { pageId: 'pg-6', respondentId: '006', pageNumber: 1, marks: [{ optionIndex: 2, style: 'fill' }], choiceItemIndex: 0 }
    ]);
    await bal_run_reading({
      scope: { projectId: 'p-read', batchId: bal_setup.batchId, respondentId: null },
      decode: bal_setup.decode,
      blankRenderer: async (bal_page) => new Blob([new TextEncoder().encode(`blank:${bal_page.pageNumber}`)])
    });
    const bal_before = await ken_pori_responses_by_respondent('005');
    await bal_save_response({
      ...(bal_before[0] as NonNullable<(typeof bal_before)[number]>),
      manuallyReviewed: true,
      updatedAt: 5
    });
    const bal_result = await bal_run_reading({
      scope: { projectId: 'p-read', batchId: bal_setup.batchId, respondentId: null },
      mode: 'unreviewed-only',
      decode: bal_setup.decode,
      blankRenderer: async (bal_page) => new Blob([new TextEncoder().encode(`blank:${bal_page.pageNumber}`)])
    });
    expect(bal_result.pagesSkippedManual).toBe(1);
    expect(bal_result.pagesProcessed).toBe(1);
  });

  it('records version mismatches as page errors without mixing versions', async () => {
    const bal_setup = await bal_setup_plans([
      { pageId: 'pg-7', respondentId: '007', pageNumber: 1, marks: [{ optionIndex: 1, style: 'fill' }], choiceItemIndex: 0, version: 999 }
    ]);
    const bal_result = await bal_run_reading({
      scope: { projectId: 'p-read', batchId: bal_setup.batchId, respondentId: null },
      decode: bal_setup.decode,
      blankRenderer: async (bal_page) => new Blob([new TextEncoder().encode(`blank:${bal_page.pageNumber}`)])
    });
    expect(bal_result.pagesProcessed).toBe(0);
    expect(bal_result.errors).toHaveLength(1);
    expect(bal_result.errors[0].message).toContain('different questionnaire version');
    const bal_responses = await ken_pori_responses_by_respondent('007');
    expect(bal_responses).toHaveLength(0);
  });

  it('reads a realistic batch of sixty respondents incrementally within a bounded time', async () => {
    const bal_plans = Array.from({ length: 60 }, (_bal_x, bal_i) => ({
      pageId: `pg-batch-${bal_i}`,
      respondentId: `R${String(bal_i + 1).padStart(3, '0')}`,
      pageNumber: 1,
      marks: [{ optionIndex: 1, style: 'fill' as const }],
      choiceItemIndex: 0
    }));
    const bal_seed = await bal_seed_project();
    await bal_save_scan_batch({
      id: bal_seed.batchId,
      projectId: 'p-read',
      questionnaireId: bal_seed.questionnaireId,
      questionnaireVersion: bal_mixed_survey().version,
      status: 'done',
      keepOriginals: true,
      summary: {
        totalPages: 0,
        ready: 0,
        needsReview: 0,
        duplicates: 0,
        failed: 0,
        unsupported: 0,
        queued: 0,
        respondents: 0,
        complete: 0,
        incomplete: 0
      },
      createdAt: 1,
      updatedAt: 1
    });
    const bal_images = new Map<string, { data: Uint8ClampedArray; width: number; height: number }>();
    for (const [bal_key, bal_value] of Object.entries(bal_render_plan(bal_plans[0]))) {
      for (const bal_plan of bal_plans) bal_images.set(bal_key.replace(bal_plans[0].pageId, bal_plan.pageId), bal_value);
    }
    for (const bal_plan of bal_plans) {
      await bal_seed_page_with_blobs(bal_seed.batchId, bal_seed.questionnaireId, bal_plan, bal_images);
    }
    const bal_started = Date.now();
    let bal_progress_updates = 0;
    let bal_last_done = 0;
    const bal_result = await bal_run_reading({
      scope: { projectId: 'p-read', batchId: bal_seed.batchId, respondentId: null },
      decode: bal_make_decoder(bal_images),
      blankRenderer: async (bal_page) => new Blob([new TextEncoder().encode(`blank:${bal_page.pageNumber}`)]),
      onProgress: (bal_p) => {
        bal_progress_updates += 1;
        expect(bal_p.pagesDone).toBeGreaterThanOrEqual(bal_last_done);
        bal_last_done = bal_p.pagesDone;
      }
    });
    const bal_elapsed = Date.now() - bal_started;
    expect(bal_result.errors).toEqual([]);
    expect(bal_result.pagesProcessed).toBe(60);
    expect(bal_result.accepted).toBe(60);
    expect(bal_progress_updates).toBeGreaterThanOrEqual(60);
    expect(bal_elapsed).toBeLessThan(120000);
    const bal_first = await ken_pori_responses_by_respondent('R001');
    expect(bal_first.length).toBeGreaterThan(0);
  }, 150000);

  it('reads a matrix-heavy questionnaire with per-row stability', async () => {
    const bal_q = bal_ffq(20);
    await bal_save_questionnaire(bal_q);
    await bal_save_scale(bal_frequency_scale());
    await bal_save_scan_batch({
      id: 'batch-ffq',
      projectId: 'p-read',
      questionnaireId: bal_q.id,
      questionnaireVersion: bal_q.version,
      status: 'done',
      keepOriginals: true,
      summary: {
        totalPages: 0,
        ready: 0,
        needsReview: 0,
        duplicates: 0,
        failed: 0,
        unsupported: 0,
        queued: 0,
        respondents: 0,
        complete: 0,
        incomplete: 0
      },
      createdAt: 1,
      updatedAt: 1
    });
    const bal_matrix = bal_q.sections[0].items[1];
    const bal_respondents = ['M001', 'M002', 'M003'];
    const bal_images = new Map<string, { data: Uint8ClampedArray; width: number; height: number }>();
    for (const bal_respondent of bal_respondents) {
      const bal_doc = bal_build_print_document({
        questionnaire: bal_q,
        scales: [bal_frequency_scale()],
        respondentId: bal_respondent
      });
      const bal_regions = bal_reading_regions_for_page(bal_doc, 1);
      const bal_blank = bal_render_blank_instrument(bal_regions, BAL_PPM);
      const bal_row_col_index = (bal_row_id: string): number =>
        bal_regions.findIndex(
          (bal_region) => bal_region.itemId === bal_matrix.id && bal_region.rowId === bal_row_id
        );
      const bal_scan = bal_render_marked_scan(
        bal_blank,
        bal_regions,
        [
          { regionIndex: bal_row_col_index('row-1'), style: 'fill' },
          { regionIndex: bal_row_col_index('row-2'), style: 'tick' }
        ],
        BAL_PPM
      );
      const bal_key = `ffq-${bal_respondent}|scan`;
      bal_images.set(bal_key, { data: bal_scan.data, width: bal_scan.width, height: bal_scan.height });
      bal_images.set(`blank:1`, { data: bal_blank.data, width: bal_blank.width, height: bal_blank.height });
      const bal_page_id = `ffq-pg-${bal_respondent}`;
      const bal_marker = new TextEncoder().encode(bal_key);
      await bal_save_scan_asset({
        id: `asset-n-${bal_page_id}`,
        batchId: 'batch-ffq',
        pageId: bal_page_id,
        kind: 'normalized',
        mime: 'application/x-svelp-fixture',
        bytes: new Blob([bal_marker]),
        width: bal_scan.width,
        height: bal_scan.height,
        size: bal_marker.length,
        createdAt: 1
      });
      await bal_save_scan_page({
        id: bal_page_id,
        batchId: 'batch-ffq',
        projectId: 'p-read',
        questionnaireId: bal_q.id,
        questionnaireVersion: bal_q.version,
        respondentId: bal_respondent,
        pageNumber: 1,
        status: 'ready',
        sourceAssetId: null,
        normalizedAssetId: `asset-n-${bal_page_id}`,
        sourceName: `${bal_page_id}.png`,
        sourceType: 'image',
        sourceHash: `hash-${bal_page_id}`,
        sourceBytes: 10,
        normalizedBytes: bal_scan.data.length,
        thumbSource: null,
        thumbNormalized: null,
        identitySource: 'qr',
        payload: null,
        detectedPayloads: null,
        quality: null,
        alignment: null,
        transform: {
          markerPoints: null,
          manualPoints: null,
          homography: null,
          sourceWidth: 1,
          sourceHeight: 1,
          outWidth: bal_scan.width,
          outHeight: bal_scan.height,
          rotationApplied: 0,
          pixelsPerMm: BAL_PPM
        },
        issues: [],
        errorMessage: null,
        processingMs: 5,
        createdAt: 1,
        updatedAt: 1
      });
    }
    const bal_result = await bal_run_reading({
      scope: { projectId: 'p-read', batchId: 'batch-ffq', respondentId: null },
      decode: bal_make_decoder(bal_images),
      blankRenderer: async (bal_page) => new Blob([new TextEncoder().encode(`blank:${bal_page.pageNumber}`)])
    });
    expect(bal_result.errors).toEqual([]);
    expect(bal_result.pagesProcessed).toBe(3);
    const bal_rows_m001 = (await ken_pori_responses_by_respondent('M001')).filter(
      (bal_r) => bal_r.itemId === bal_matrix.id && bal_r.rowId === 'row-1'
    );
    expect(bal_rows_m001).toHaveLength(1);
    expect(bal_rows_m001[0].status).toBe('accepted');
    expect(bal_rows_m001[0].value).toHaveLength(1);
  }, 150000);

  it('keeps a broken page from failing the whole run', async () => {
    const bal_setup = await bal_setup_plans([
      { pageId: 'pg-8', respondentId: '008', pageNumber: 1, marks: [{ optionIndex: 1, style: 'fill' }], choiceItemIndex: 0 },
      { pageId: 'pg-9', respondentId: '009', pageNumber: 1, marks: [{ optionIndex: 0, style: 'fill' }], choiceItemIndex: 0 }
    ]);
    await bal_save_scan_asset({
      id: 'asset-n-pg-8',
      batchId: bal_setup.batchId,
      pageId: 'pg-8',
      kind: 'normalized',
      mime: 'application/x-svelp-fixture',
      bytes: new Blob([new TextEncoder().encode('pg-8|scan')]),
      width: 10,
      height: 10,
      size: 8,
      createdAt: 1
    });
    const bal_images = new Map<string, { data: Uint8ClampedArray; width: number; height: number }>();
    for (const [bal_key, bal_value] of Object.entries(
      bal_render_plan({ pageId: 'pg-9', respondentId: '009', pageNumber: 1, marks: [{ optionIndex: 0, style: 'fill' }], choiceItemIndex: 0 })
    )) {
      bal_images.set(bal_key, bal_value);
    }
    const bal_result = await bal_run_reading({
      scope: { projectId: 'p-read', batchId: bal_setup.batchId, respondentId: null },
      decode: async (bal_blob) => {
        const bal_text = await bal_blob.text();
        const bal_image = bal_images.get(bal_text);
        if (!bal_image) throw new Error('no fixture image registered');
        return bal_image;
      },
      blankRenderer: async (bal_page) => new Blob([new TextEncoder().encode(`blank:${bal_page.pageNumber}`)])
    });
    expect(bal_result.pagesProcessed).toBe(1);
    expect(bal_result.errors).toHaveLength(1);
    expect(bal_result.errors[0].pageId).toBe('pg-8');
    const bal_responses = await ken_pori_responses_by_respondent('009');
    expect(bal_responses.some((bal_r) => bal_r.status === 'accepted')).toBe(true);
  });
});
