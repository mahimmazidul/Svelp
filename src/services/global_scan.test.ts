import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { bal_clear } from '../db/client';
import { bal_save_questionnaire } from '../db/questionnaires_repo';
import { bal_save_project } from '../db/projects_repo';
import { bal_save_scale, ken_pori_scales } from '../db/scales_repo';
import {
  dhon_scan_batch,
  ken_pori_scan_batches,
  ken_pori_scan_pages,
  bal_save_scan_page,
  bal_save_scan_asset
} from '../db/scan_repo';
import { ken_pori_responses_by_project } from '../db/response_repo';
import { match_route } from '../app/router/routes';
import {
  BAL_GLOBAL_BATCH_ID,
  bal_new_global_batch,
  bal_route_ready_pages
} from './scan_run';
import { bal_add_files_to_batch, bal_new_batch_for_project, bal_run_batch_queue } from './scan_run';
import { bal_process_image } from '../features/scan/scan_engine';
import { bal_canonical_spec, bal_render_canonical_page } from '../features/scan/scan_fixtures';
import { bal_empty_summary } from './scan_service';
import type { bal_ScanProcessor } from './scan_service';
import type { ScanBatchRecord, ScanPageRecord } from '../models/scan_models';
import type { PrintLayoutRecord } from '../models/print_models';
import type { ResponseScaleRecord } from '../models/types';
import {
  BAL_BN_TITLE,
  BAL_BN_OPT_DAILY,
  bal_bangla_survey,
  bal_frequency_scale_bn
} from '../test/bangla_fixtures';
import { bal_build_print_document } from '../features/print/print_layout';
import { bal_to_csv, bal_build_export_rows, bal_export_columns, bal_export_headers } from '../features/export/export_dataset';
import { bal_run_reading } from './reading_run';
import { bal_reading_regions_for_page } from '../features/reading/reading_geometry';
  import { type bal_ReadingRegion } from '../features/reading/reading_fixtures';
import { bal_render_blank_instrument, bal_render_marked_scan } from '../features/reading/reading_fixtures';

const BAL_PPM = 5.9;

function bal_layout_for(
  bal_questionnaire_id: string,
  bal_project_id: string,
  bal_code: string,
  bal_version: number,
  bal_pages: number
): PrintLayoutRecord {
  const bal_geometry = bal_canonical_spec(`S1|${bal_code}|${bal_version}|000|1`);
  return {
    id: `layout-${bal_questionnaire_id}`,
    questionnaireId: bal_questionnaire_id,
    projectId: bal_project_id,
    questionnaireVersion: bal_version,
    fingerprint: `fp-${bal_questionnaire_id}`,
    paperSize: 'a4',
    orientation: 'portrait',
    settingsSnapshot: {} as PrintLayoutRecord['settingsSnapshot'],
    geometry: {
      questionnaireId: bal_questionnaire_id,
      questionnaireVersion: bal_version,
      fingerprint: `fp-${bal_questionnaire_id}`,
      paperSize: 'a4',
      orientation: 'portrait',
      scannerMode: true,
      pageCount: bal_pages,
      pages: Array.from({ length: bal_pages }, (_bal_page, bal_index) => ({
        pageNumber: bal_index + 1,
        width: 210,
        height: 297,
        margins: { top: 18, right: 16, bottom: 18, left: 16 },
        contentBounds: { x: 16, y: 30, width: 178, height: 239 },
        safeBounds: { x: 19, y: 33, width: 172, height: 233 },
        headerBounds: null,
        footerBounds: null,
        respondentIdBounds: null,
        identifier: {
          payload: `S1|${bal_code}|${bal_version}|000|${bal_index + 1}`,
          humanReadable: null,
          qrBounds: bal_geometry.qrRect,
          normalized: null,
          moduleCount: 21,
          quietZoneModules: 4,
          textBounds: null
        },
        alignmentMarkers: bal_geometry.markerRects.map((bal_r, bal_m) => ({
          corner: (['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const)[Math.min(bal_m, 3)],
          rect: bal_r,
          normalized: { x: bal_r.x / 210, y: bal_r.y / 297, width: bal_r.width / 210, height: bal_r.height / 297 }
        })),
        regions: [],
        contentBottomMm: 279,
        itemBounds: [],
        answerRegions: []
      })),
      regions: []
    },
    createdAt: 1,
    updatedAt: 1
  };
}

function bal_page_image(bal_code: string, bal_version: number, bal_respondent: string, bal_page: number) {
  return bal_render_canonical_page(
    bal_canonical_spec(`S1|${bal_code}|${bal_version}|${bal_respondent}|${bal_page}`),
    BAL_PPM
  );
}

function bal_processor() {
  return async (bal_input: {
    imageData: { data: Uint8ClampedArray; width: number; height: number };
    spec: { centersMm: { x: number; y: number }[]; widthMm: number; heightMm: number };
    outWidthPx: number;
    outHeightPx: number;
    pxPerMm: number;
  }) => bal_process_image(bal_input);
}

const bal_encode = async (bal_image: { width: number; height: number }) => ({
  bytes: new Blob([new Uint8Array(1024)], { type: 'image/jpeg' }),
  width: bal_image.width,
  height: bal_image.height
});

async function bal_seed_two_projects(): Promise<{ layouts: PrintLayoutRecord[]; bangla: ReturnType<typeof bal_bangla_survey> }> {
  await bal_save_project({
    id: 'p-bn',
    title: 'খাদ্য অপচয় গবেষণা',
    description: '',
    status: 'active',
    createdAt: 1,
    updatedAt: 1
  });
  await bal_save_project({
    id: 'p-en',
    title: 'KAP Study',
    description: '',
    status: 'active',
    createdAt: 1,
    updatedAt: 1
  });
  const bal_bn = bal_bangla_survey();
  await bal_save_questionnaire(bal_bn);
  await bal_save_scale(bal_frequency_scale_bn() as ResponseScaleRecord);
  const bal_layout_bn = bal_layout_for(bal_bn.id, 'p-bn', 'BN', 1, 2);
  const bal_layout_en = bal_layout_for('q-en', 'p-en', 'KAP', 1, 1);
  return { layouts: [bal_layout_bn, bal_layout_en], bangla: bal_bn };
}

async function bal_add_shuffled(bal_batch: ScanBatchRecord, bal_files: { name: string; image: ReturnType<typeof bal_page_image> }[]) {
  return bal_add_files_to_batch(
    bal_batch,
    bal_files.map((bal_file) => ({
      name: bal_file.name,
      type: 'image/jpeg',
      bytes: new Blob([new TextEncoder().encode(bal_file.name)], { type: 'image/jpeg' })
    }))
  );
}

function bal_decode_for(bal_files: { name: string; image: ReturnType<typeof bal_page_image> }[]) {
  let bal_index = 0;
  return async () => {
    const bal_next = bal_files[bal_index];
    bal_index += 1;
    if (!bal_next) throw new Error('decode failed');
    return { data: bal_next.image.data, width: bal_next.image.width, height: bal_next.image.height };
  };
}

beforeEach(async () => {
  for (const bal_store of [
    'projects',
    'questionnaires',
    'responseScales',
    'printLayouts',
    'scanBatches',
    'scanPages',
    'scanAssets',
    'scanAuditEvents',
    'blankReferences',
    'responses',
    'recognitionRuns',
    'responseAuditEvents'
  ]) {
    await bal_clear(bal_store);
  }
});

describe('global scan context', () => {
  it('matches the #/scan route without a project', () => {
    expect(match_route('/scan')).toEqual({ name: 'scan' });
    expect(match_route('/project/p1/scan')).toEqual({ name: 'project', projectId: 'p1', area: 'scan' });
    expect(match_route('/projects')).toEqual({ name: 'projects' });
  });

  it('creates a persistent global batch with a stable id', async () => {
    const bal_first = await bal_new_global_batch(true);
    expect(bal_first.id).toBe(BAL_GLOBAL_BATCH_ID);
    const bal_loaded = await dhon_scan_batch(BAL_GLOBAL_BATCH_ID);
    expect(bal_loaded?.projectId).toBe('__global__');
    expect(bal_loaded?.summary.totalPages).toBe(0);
  });

  it('routes a shuffled mixed-project batch to the matching projects', async () => {
    const { layouts: bal_layouts } = await bal_seed_two_projects();
    const bal_batch = await bal_new_global_batch(true);
    const bal_files = [
      { name: 'z.jpg', image: bal_page_image('BN', 1, '017', 2) },
      { name: 'a.jpg', image: bal_page_image('KAP', 1, '003', 1) },
      { name: 'm.jpg', image: bal_page_image('BN', 1, '017', 1) },
      { name: 'k.jpg', image: bal_page_image('KAP', 1, '042', 1) }
    ];
    await bal_add_shuffled(bal_batch, bal_files);
    const bal_result = await bal_run_batch_queue(
      bal_batch.id,
      bal_layouts,
      bal_processor() as bal_ScanProcessor,
      bal_decode_for(bal_files),
      bal_encode,
      () => {},
      () => false
    );
    expect(bal_result.failed).toBe(0);
    expect(bal_result.processed).toBe(4);
    const bal_outcome = await bal_route_ready_pages(
      await ken_pori_scan_pages(BAL_GLOBAL_BATCH_ID),
      bal_layouts,
      true
    );
    expect(bal_outcome.needTemplate).toBe(0);
    expect(bal_outcome.unidentified).toBe(0);
    const bal_moved = Object.fromEntries(bal_outcome.moved.map((bal_entry) => [bal_entry.projectId, bal_entry.count]));
    expect(bal_moved['p-bn']).toBe(2);
    expect(bal_moved['p-en']).toBe(2);
    const bal_global_pages = await ken_pori_scan_pages(BAL_GLOBAL_BATCH_ID);
    expect(bal_global_pages).toHaveLength(0);
    const bal_bn_batches = await ken_pori_scan_batches('p-bn');
    expect(bal_bn_batches).toHaveLength(1);
    const bal_bn_pages = await ken_pori_scan_pages(bal_bn_batches[0].id);
    expect(bal_bn_pages).toHaveLength(2);
    expect(bal_bn_pages.every((bal_p) => bal_p.projectId === 'p-bn' && bal_p.respondentId === '017')).toBe(true);
    expect([...bal_bn_pages].sort((bal_a, bal_b) => (bal_a.pageNumber ?? 0) - (bal_b.pageNumber ?? 0)).map((bal_p) => bal_p.pageNumber)).toEqual([1, 2]);
    const bal_en_pages = await ken_pori_scan_pages((await ken_pori_scan_batches('p-en'))[0].id);
    expect(bal_en_pages.map((bal_p) => bal_p.respondentId).sort()).toEqual(['003', '042']);
    const bal_global_batch = (await dhon_scan_batch(BAL_GLOBAL_BATCH_ID)) as ScanBatchRecord;
    expect(bal_global_batch.summary.totalPages).toBe(0);
  });

  it('keeps template-missing and unidentified pages in the global batch', async () => {
    const { layouts: bal_layouts } = await bal_seed_two_projects();
    const bal_batch = await bal_new_global_batch(true);
    const bal_files = [
      { name: 'known.jpg', image: bal_page_image('BN', 1, '017', 1) },
      { name: 'unknown.jpg', image: bal_page_image('ZZ', 1, '099', 1) },
      { name: 'plain.jpg', image: bal_render_canonical_page(bal_canonical_spec('S1|BN|1|020|2'), BAL_PPM).data ? { ...bal_page_image('BN', 1, '020', 2), data: bal_page_image('BN', 1, '020', 2).data.map((bal_v, bal_i) => (bal_i % 400 === 0 ? 255 : bal_v)) as Uint8ClampedArray } : null }
    ].filter((bal_file) => bal_file.image !== null) as { name: string; image: ReturnType<typeof bal_page_image> }[];
    await bal_add_shuffled(bal_batch, bal_files);
    await bal_run_batch_queue(
      bal_batch.id,
      bal_layouts,
      bal_processor() as bal_ScanProcessor,
      bal_decode_for(bal_files),
      bal_encode,
      () => {},
      () => false
    );
    const bal_outcome = await bal_route_ready_pages(
      await ken_pori_scan_pages(BAL_GLOBAL_BATCH_ID),
      bal_layouts,
      true
    );
    expect(bal_outcome.moved.map((bal_entry) => bal_entry.projectId)).toEqual(['p-bn']);
    const bal_kept = await ken_pori_scan_pages(BAL_GLOBAL_BATCH_ID);
    expect(bal_kept.length).toBeGreaterThanOrEqual(1);
    expect(bal_kept.some((bal_p) => bal_p.issues.includes('template-missing'))).toBe(true);
  });
});

describe('bangla global scan e2e', () => {
  it('reads a marked bangla page after global routing and exports bangla csv', async () => {
    const { layouts: bal_layouts, bangla: bal_bn } = await bal_seed_two_projects();
    const bal_scales = await ken_pori_scales();
    const bal_doc = bal_build_print_document({
      questionnaire: bal_bn,
      scales: bal_scales,
      respondentId: '017'
    });
    const bal_regions_all = bal_reading_regions_for_page(bal_doc, 1);
    expect(bal_regions_all.length).toBeGreaterThan(0);
    const bal_choice_regions: bal_ReadingRegion[] = [];
    for (const bal_region of bal_regions_all) {
      if (bal_region.kind === 'choice' && bal_region.selection === 'single') bal_choice_regions.push(bal_region);
    }
    expect(bal_choice_regions.length).toBeGreaterThan(2);
    const bal_blank = bal_render_blank_instrument(bal_regions_all, BAL_PPM);
    const bal_target = bal_choice_regions[1];
    const bal_marked = bal_render_marked_scan(
      bal_blank,
      bal_regions_all,
      [{ regionIndex: bal_regions_all.indexOf(bal_target), style: 'fill' }],
      BAL_PPM
    );

    const bal_batch = (await ken_pori_scan_batches('p-bn'))[0] ?? (await bal_new_batch_for_project('p-bn', bal_bn.id, 1, true));
    const bal_marker = new TextEncoder().encode('bn-e2e-page');
    await bal_save_scan_asset({
      id: 'asset-bn-e2e',
      batchId: bal_batch.id,
      pageId: 'page-bn-e2e',
      kind: 'normalized',
      mime: 'application/x-svelp-fixture',
      bytes: new Blob([bal_marker]),
      width: bal_marked.width,
      height: bal_marked.height,
      size: bal_marker.length,
      createdAt: 1
    });
    const bal_page: ScanPageRecord = {
      id: 'page-bn-e2e',
      batchId: bal_batch.id,
      projectId: 'p-bn',
      questionnaireId: bal_bn.id,
      questionnaireVersion: 1,
      respondentId: '017',
      pageNumber: 1,
      status: 'ready',
      sourceAssetId: null,
      normalizedAssetId: 'asset-bn-e2e',
      sourceName: 'bn-e2e.png',
      sourceType: 'image',
      sourceHash: 'hash-bn-e2e',
      sourceBytes: 10,
      normalizedBytes: bal_marked.data.length,
      thumbSource: null,
      thumbNormalized: null,
      identitySource: 'qr',
      payload: 'S1|BN|1|017|1',
      detectedPayloads: null,
      quality: null,
      alignment: null,
      transform: null,
      issues: [],
      errorMessage: null,
      processingMs: 5,
      createdAt: 1,
      updatedAt: 1
    };
    await bal_save_scan_page(bal_page);

    const bal_result = await bal_run_reading({
      scope: { projectId: 'p-bn', batchId: bal_batch.id, respondentId: null },
      decode: async (bal_blob) => {
        const bal_key = await bal_blob.text();
        return bal_key === 'blank-bn'
          ? { data: bal_blank.data, width: bal_blank.width, height: bal_blank.height }
          : { data: bal_marked.data, width: bal_marked.width, height: bal_marked.height };
      },
      blankRenderer: async () => new Blob([new TextEncoder().encode('blank-bn')]),
      onProgress: () => {}
    });
    console.log('TAG read errors ' + JSON.stringify(bal_result.errors));
    expect(bal_result.errors).toEqual([]);
    expect(bal_result.pagesProcessed).toBe(1);

    const bal_responses = await ken_pori_responses_by_project('p-bn');
    expect(bal_responses.length).toBeGreaterThan(0);
    const bal_columns = bal_export_columns(bal_bn, { optionColumns: false });
    const bal_rows = bal_build_export_rows(bal_columns, bal_bn, bal_scales, bal_responses, ['017']);
    const bal_csv = bal_to_csv(bal_rows, bal_export_headers(bal_columns, false), true);
    expect(bal_csv.charCodeAt(0)).toBe(0xfeff);
    expect(bal_csv).toContain('017');
    expect(bal_layouts).toHaveLength(2);
    expect(BAL_BN_TITLE.length).toBeGreaterThan(10);
    expect(BAL_BN_OPT_DAILY.length).toBeGreaterThan(3);
    expect(bal_empty_summary().totalPages).toBe(0);
  });
});
