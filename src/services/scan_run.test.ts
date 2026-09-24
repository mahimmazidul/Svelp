import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { bal_clear } from '../db/client';
import { dhon_scan_batch, ken_pori_scan_pages } from '../db/scan_repo';
import { bal_canonical_spec, bal_render_canonical_page } from '../features/scan/scan_fixtures';
import { bal_process_image } from '../features/scan/scan_engine';
import { bal_empty_summary, bal_group_pages, bal_compute_summary, bal_resolve_identity, bal_validate_manual_assignment } from './scan_service';
import { bal_add_files_to_batch, bal_apply_manual_corner_correction, bal_new_batch_for_project, bal_reprocess_page, bal_run_batch_queue } from './scan_run';
import type { bal_ScanProcessor } from './scan_service';
import type { ScanBatchRecord, ScanPageRecord } from '../models/scan_models';
import type { PrintLayoutRecord } from '../models/print_models';


const BAL_PPM = 5.9;

function bal_layout_for(bal_questionnaire_id: string, bal_version: number): PrintLayoutRecord {
  const bal_geometry = bal_canonical_spec(`S1|TEST|${bal_version}|000|1`);
  return {
    id: `layout-${bal_questionnaire_id}-${bal_version}`,
    questionnaireId: bal_questionnaire_id,
    projectId: 'p-1',
    questionnaireVersion: bal_version,
    fingerprint: `fp-${bal_questionnaire_id}-${bal_version}`,
    paperSize: 'a4',
    orientation: 'portrait',
    settingsSnapshot: {} as PrintLayoutRecord['settingsSnapshot'],
    geometry: {
      questionnaireId: bal_questionnaire_id,
      questionnaireVersion: bal_version,
      fingerprint: `fp-${bal_questionnaire_id}-${bal_version}`,
      paperSize: 'a4',
      orientation: 'portrait',
      scannerMode: true,
      pageCount: 3,
      pages: [
        {
          pageNumber: 1,
          width: 210,
          height: 297,
          margins: { top: 18, right: 16, bottom: 18, left: 16 },
          contentBounds: { x: 16, y: 30, width: 178, height: 239 },
          safeBounds: { x: 19, y: 33, width: 172, height: 233 },
          headerBounds: null,
          footerBounds: null,
          respondentIdBounds: null,
          identifier: {
            payload: `S1|TEST|${bal_version}|000|1`,
            humanReadable: null,
            qrBounds: bal_geometry.qrRect,
            normalized: null,
            moduleCount: 21,
            quietZoneModules: 4,
            textBounds: null
          },
          alignmentMarkers: bal_geometry.markerRects.map((bal_r) => ({
            id: 'm',
            role: 'corner',
            rect: bal_r,
            normalized: { x: bal_r.x / 210, y: bal_r.y / 297, width: bal_r.width / 210, height: bal_r.height / 297 }
          })),
          itemBounds: [],
          answerRegions: []
        },
        {
          pageNumber: 2,
          width: 210,
          height: 297,
          margins: { top: 18, right: 16, bottom: 18, left: 16 },
          contentBounds: { x: 16, y: 30, width: 178, height: 239 },
          safeBounds: { x: 19, y: 33, width: 172, height: 233 },
          headerBounds: null,
          footerBounds: null,
          respondentIdBounds: null,
          identifier: {
            payload: `S1|TEST|${bal_version}|000|2`,
            humanReadable: null,
            qrBounds: bal_geometry.qrRect,
            normalized: null,
            moduleCount: 21,
            quietZoneModules: 4,
            textBounds: null
          },
          alignmentMarkers: bal_geometry.markerRects.map((bal_r) => ({
            id: 'm',
            role: 'corner',
            rect: bal_r,
            normalized: { x: bal_r.x / 210, y: bal_r.y / 297, width: bal_r.width / 210, height: bal_r.height / 297 }
          })),
          itemBounds: [],
          answerRegions: []
        },
        {
          pageNumber: 3,
          width: 210,
          height: 297,
          margins: { top: 18, right: 16, bottom: 18, left: 16 },
          contentBounds: { x: 16, y: 30, width: 178, height: 239 },
          safeBounds: { x: 19, y: 33, width: 172, height: 233 },
          headerBounds: null,
          footerBounds: null,
          respondentIdBounds: null,
          identifier: {
            payload: `S1|TEST|${bal_version}|000|3`,
            humanReadable: null,
            qrBounds: bal_geometry.qrRect,
            normalized: null,
            moduleCount: 21,
            quietZoneModules: 4,
            textBounds: null
          },
          alignmentMarkers: bal_geometry.markerRects.map((bal_r) => ({
            id: 'm',
            role: 'corner',
            rect: bal_r,
            normalized: { x: bal_r.x / 210, y: bal_r.y / 297, width: bal_r.width / 210, height: bal_r.height / 297 }
          })),
          itemBounds: [],
          answerRegions: []
        }
      ]
    } as unknown as PrintLayoutRecord['geometry'],
    createdAt: 1,
    updatedAt: 2
  };
}

const bal_layouts = [bal_layout_for('q-1', 1), bal_layout_for('q-1', 2)];

function bal_page_image(bal_respondent: string, bal_page: number, bal_version = 1) {
  return bal_render_canonical_page(
    bal_canonical_spec(`S1|TEST|${bal_version}|${bal_respondent}|${bal_page}`),
    BAL_PPM
  );
}

function bal_processor() {
  return async (bal_input: {
    imageData: { data: Uint8ClampedArray; width: number; height: number };
    spec: { centersMm: { x: number; y: number }[]; widthMm: number; heightMm: number; qrCenterMm?: { x: number; y: number } };
    outWidthPx: number;
    outHeightPx: number;
    pxPerMm: number;
    manualCorners?: { x: number; y: number }[] | null;
  }) => bal_process_image(bal_input);
}

type bal_TestDecoder = { data: Uint8ClampedArray; width: number; height: number } | null;
let bal_decode_queue: bal_TestDecoder[] = [];

const bal_decode = async () => {
  const bal_next = bal_decode_queue.shift();
  if (!bal_next) throw new Error('decode failed');
  return bal_next;
};

const bal_encode = async (bal_image: { width: number; height: number }) => ({
  bytes: new Blob([new Uint8Array(1024)], { type: 'image/jpeg' }),
  width: bal_image.width,
  height: bal_image.height
});

async function bal_make_batch(bal_questionnaire_id = 'q-1', bal_version: number | null = 1): Promise<ScanBatchRecord> {
  return bal_new_batch_for_project('p-1', bal_questionnaire_id, bal_version, true);
}

async function bal_add_fixture_files(
  bal_batch: ScanBatchRecord,
  bal_files: { name: string; image?: ReturnType<typeof bal_page_image>; broken?: boolean }[]
) {
  bal_decode_queue = [];
  for (const bal_file of bal_files) {
    bal_decode_queue.push(
      bal_file.broken || !bal_file.image
        ? null
        : {
            data: bal_file.image.data,
            width: bal_file.image.width,
            height: bal_file.image.height
          }
    );
  }
  return bal_add_files_to_batch(
    bal_batch,
    bal_files.map((bal_file) => ({
      name: bal_file.name,
      type: 'image/jpeg',
      bytes: new Blob([new TextEncoder().encode(bal_file.name)], { type: 'image/jpeg' })
    }))
  );
}

beforeEach(async () => {
  await bal_clear('scanBatches');
  await bal_clear('scanPages');
  await bal_clear('scanAssets');
  await bal_clear('scanAuditEvents');
  bal_decode_queue = [];
});

describe('batch ingestion pipeline', () => {
  it('processes three shuffled fixture pages to ready with correct identities', async () => {
    const bal_batch = await bal_make_batch();
    await bal_add_fixture_files(bal_batch, [
      { name: 'IMG_1023.jpg', image: bal_page_image('001', 3) },
      { name: 'IMG_1021.jpg', image: bal_page_image('001', 1) },
      { name: 'IMG_1022.jpg', image: bal_page_image('001', 2) }
    ]);
    const bal_result = await bal_run_batch_queue(
      bal_batch.id,
      bal_layouts,
      bal_processor() as bal_ScanProcessor,
      bal_decode,
      bal_encode,
      () => {},
      () => false
    );
    expect(bal_result.processed).toBe(3);
    expect(bal_result.failed).toBe(0);
    const bal_pages = await ken_pori_scan_pages(bal_batch.id);
    expect(bal_pages.map((bal_p) => bal_p.status)).toEqual(['ready', 'ready', 'ready']);
    expect([...bal_pages].sort((bal_a, bal_b) => (bal_a.pageNumber as number) - (bal_b.pageNumber as number)).map((bal_p) => bal_p.pageNumber)).toEqual([1, 2, 3]);
    expect(new Set(bal_pages.map((bal_p) => bal_p.respondentId))).toEqual(new Set(['001']));
    expect(bal_pages.every((bal_p) => bal_p.quality !== null)).toBe(true);
    expect(bal_pages.every((bal_p) => bal_p.transform !== null)).toBe(true);
    const bal_after = (await dhon_scan_batch(bal_batch.id)) as ScanBatchRecord;
    expect(bal_after.summary.ready).toBe(3);
    expect(bal_after.summary.respondents).toBe(1);
  });

  it('groups pages per respondent and detects the missing page', async () => {
    const bal_batch = await bal_make_batch();
    await bal_add_fixture_files(bal_batch, [
      { name: 'a.jpg', image: bal_page_image('001', 1) },
      { name: 'b.jpg', image: bal_page_image('001', 2) }
    ]);
    await bal_run_batch_queue(bal_batch.id, bal_layouts, bal_processor() as bal_ScanProcessor, bal_decode, bal_encode, () => {}, () => false);
    const bal_pages = await ken_pori_scan_pages(bal_batch.id);
    const bal_groups = bal_group_pages(bal_pages, new Map([['q-1|1', 3]]));
    expect(bal_groups).toHaveLength(1);
    expect(bal_groups[0].missingPages).toEqual([3]);
    expect(bal_groups[0].duplicatePages).toEqual([]);
  });

  it('flags two different photos of the same page as duplicates without overwriting', async () => {
    const bal_batch = await bal_make_batch();
    await bal_add_fixture_files(bal_batch, [
      { name: 'first.jpg', image: bal_page_image('001', 1) },
      { name: 'second.jpg', image: bal_page_image('001', 1) }
    ]);
    await bal_run_batch_queue(bal_batch.id, bal_layouts, bal_processor() as bal_ScanProcessor, bal_decode, bal_encode, () => {}, () => false);
    const bal_pages = await ken_pori_scan_pages(bal_batch.id);
    expect(bal_pages.every((bal_p) => bal_p.status === 'duplicate')).toBe(true);
    expect(bal_compute_summary(bal_pages).duplicates).toBe(2);
  });

  it('deduplicates identical files by hash at import time', async () => {
    const bal_batch = await bal_make_batch();
    const bal_image = bal_page_image('007', 1);
    await bal_add_fixture_files(bal_batch, [{ name: 'one.jpg', image: bal_image }]);
    const bal_bytes = new Blob([new TextEncoder().encode('one.jpg')], { type: 'image/jpeg' });
    bal_decode_queue.push({ data: bal_image.data, width: bal_image.width, height: bal_image.height });
    const bal_second = await bal_add_files_to_batch(bal_batch, [{ name: 'two.jpg', type: 'image/jpeg', bytes: bal_bytes }]);
    expect(bal_second.added[0].status).toBe('duplicate');
  });

  it('keeps questionnaire versions separate instead of merging', async () => {
    const bal_batch = await bal_make_batch('q-1', null);
    await bal_add_fixture_files(bal_batch, [
      { name: 'v1.jpg', image: bal_page_image('001', 1, 1) },
      { name: 'v2.jpg', image: bal_page_image('001', 1, 2) }
    ]);
    await bal_run_batch_queue(bal_batch.id, bal_layouts, bal_processor() as bal_ScanProcessor, bal_decode, bal_encode, () => {}, () => false);
    const bal_pages = await ken_pori_scan_pages(bal_batch.id);
    const bal_v1 = bal_pages.find((bal_p) => bal_p.questionnaireVersion === 1);
    const bal_v2 = bal_pages.find((bal_p) => bal_p.questionnaireVersion === 2);
    expect(bal_v1?.status).toBe('ready');
    expect(bal_v2?.status).toBe('ready');
    expect(bal_v1?.id).not.toBe(bal_v2?.id);
    const bal_groups = bal_group_pages(bal_pages, new Map());
    expect(bal_groups).toHaveLength(2);
  });

  it('sends a page with no readable code to needs identification', async () => {
    const bal_batch = await bal_make_batch();
    const bal_blank = {
      data: new Uint8ClampedArray(600 * 800 * 4).fill(250),
      width: 600,
      height: 800
    };
    await bal_add_fixture_files(bal_batch, [
      { name: 'blank.jpg', image: bal_blank as unknown as ReturnType<typeof bal_page_image> }
    ]);
    await bal_run_batch_queue(bal_batch.id, bal_layouts, bal_processor() as bal_ScanProcessor, bal_decode, bal_encode, () => {}, () => false);
    const bal_pages = await ken_pori_scan_pages(bal_batch.id);
    expect(bal_pages[0].status).toBe('needs-review');
    expect(bal_pages[0].issues).toContain('unidentified');
  });

  it('isolates a broken file without failing the batch', async () => {
    const bal_batch = await bal_make_batch();
    await bal_add_fixture_files(bal_batch, [
      { name: 'broken.jpg', broken: true },
      { name: 'good.jpg', image: bal_page_image('002', 1) }
    ]);
    const bal_result = await bal_run_batch_queue(
      bal_batch.id,
      bal_layouts,
      bal_processor() as bal_ScanProcessor,
      bal_decode,
      bal_encode,
      () => {},
      () => false
    );
    expect(bal_result.processed).toBe(2);
    expect(bal_result.failed).toBe(1);
    const bal_pages = await ken_pori_scan_pages(bal_batch.id);
    const bal_broken = bal_pages.find((bal_p) => bal_p.sourceName === 'broken.jpg');
    const bal_good = bal_pages.find((bal_p) => bal_p.sourceName === 'good.jpg');
    expect(bal_broken?.status).toBe('failed');
    expect(bal_broken?.errorMessage).toContain('broken.jpg');
    expect(bal_good?.status).toBe('ready');
  });

  it('supports cancel with completed pages kept, then resumes the rest', async () => {
    const bal_batch = await bal_make_batch();
    await bal_add_fixture_files(bal_batch, [
      { name: 'p1.jpg', image: bal_page_image('005', 1) },
      { name: 'p2.jpg', image: bal_page_image('005', 2) },
      { name: 'p3.jpg', image: bal_page_image('005', 3) }
    ]);
    let bal_calls = 0;
    await bal_run_batch_queue(
      bal_batch.id,
      bal_layouts,
      bal_processor() as bal_ScanProcessor,
      bal_decode,
      bal_encode,
      () => {},
      () => ++bal_calls > 1
    );
    const bal_after_cancel = await ken_pori_scan_pages(bal_batch.id);
    expect(bal_after_cancel.filter((bal_p) => bal_p.status === 'ready')).toHaveLength(1);
    expect(bal_after_cancel.filter((bal_p) => bal_p.status === 'queued')).toHaveLength(2);
    const bal_cancelled = (await dhon_scan_batch(bal_batch.id)) as ScanBatchRecord;
    expect(bal_cancelled.status).toBe('cancelled');
    const bal_resume = await bal_run_batch_queue(
      bal_batch.id,
      bal_layouts,
      bal_processor() as bal_ScanProcessor,
      bal_decode,
      bal_encode,
      () => {},
      () => false
    );
    expect(bal_resume.cancelled).toBe(false);
    expect(bal_resume.processed).toBe(2);
    const bal_final = await ken_pori_scan_pages(bal_batch.id);
    expect(bal_final.every((bal_p) => bal_p.status === 'ready')).toBe(true);
  });

  it('rejects unsupported files with a specific message', async () => {
    const bal_batch = await bal_make_batch();
    const bal_result = await bal_add_files_to_batch(bal_batch, [
      { name: 'notes.txt', type: 'text/plain', bytes: new Blob(['hello']) }
    ]);
    expect(bal_result.unsupported).toHaveLength(1);
    expect(bal_result.unsupported[0].errorMessage).toContain('notes.txt');
  });
});

describe('manual assignment and correction', () => {
  it('validates manual assignment and warns about existing pages', async () => {
    const bal_existing = [
      {
        id: 'p-9',
        batchId: 'b-1',
        projectId: 'p-1',
        questionnaireId: 'q-1',
        questionnaireVersion: 1,
        respondentId: 'R1',
        pageNumber: 2,
        status: 'ready'
      } as ScanPageRecord
    ];
    const bal_ok = bal_validate_manual_assignment(
      { questionnaireId: 'q-1', version: 1, respondentId: 'R2', pageNumber: 1 },
      bal_layouts,
      bal_existing,
      'current'
    );
    expect(bal_ok.ok).toBe(true);
    expect(bal_ok.warning).toBeNull();
    const bal_conflict = bal_validate_manual_assignment(
      { questionnaireId: 'q-1', version: 1, respondentId: 'R1', pageNumber: 2 },
      bal_layouts,
      bal_existing,
      'current'
    );
    expect(bal_conflict.ok).toBe(true);
    expect(bal_conflict.warning).toContain('already has page 2');
    const bal_bad_page = bal_validate_manual_assignment(
      { questionnaireId: 'q-1', version: 1, respondentId: 'R3', pageNumber: 9 },
      bal_layouts,
      bal_existing,
      'current'
    );
    expect(bal_bad_page.ok).toBe(false);
    expect(bal_bad_page.error).toContain('between 1 and 3');
    const bal_missing_layout = bal_validate_manual_assignment(
      { questionnaireId: 'q-x', version: 1, respondentId: 'R3', pageNumber: 1 },
      bal_layouts,
      bal_existing,
      'current'
    );
    expect(bal_missing_layout.ok).toBe(false);
  });

  it('identifies payloads against layouts for review decisions', () => {
    const bal_identified = bal_resolve_identity(['S1|TEST|1|042|2'], bal_layouts);
    expect(bal_identified.questionnaireId).toBe('q-1');
    expect(bal_identified.respondentId).toBe('042');
    expect(bal_identified.pageNumber).toBe(2);
    const bal_unknown = bal_resolve_identity(['S1|ZZZZ|1|042|2'], bal_layouts);
    expect(bal_unknown.questionnaireId).toBeNull();
    expect(bal_unknown.issues).toContain('unidentified');
  });

  it('reprocesses a page with manual corner correction', async () => {
    const bal_batch = await bal_make_batch();
    const bal_hard_image = bal_page_image('011', 1);
    await bal_add_fixture_files(bal_batch, [{ name: 'hard.jpg', image: bal_hard_image }]);
    await bal_run_batch_queue(bal_batch.id, bal_layouts, bal_processor() as bal_ScanProcessor, bal_decode, bal_encode, () => {}, () => false);
    const bal_pages = await ken_pori_scan_pages(bal_batch.id);
    expect(bal_pages[0].status).toBe('ready');
    bal_decode_queue.push({
      data: bal_hard_image.data,
      width: bal_hard_image.width,
      height: bal_hard_image.height
    });
    const bal_corners = [
      { x: 50, y: 50 },
      { x: 1189, y: 50 },
      { x: 1189, y: 1702 },
      { x: 50, y: 1702 }
    ];
    const bal_corrected = await bal_apply_manual_corner_correction(
      bal_pages[0].id,
      bal_corners,
      bal_layouts,
      bal_processor() as bal_ScanProcessor,
      bal_decode,
      bal_encode
    );
    expect(bal_corrected?.status).toBe('ready');
    expect(bal_corrected?.alignment?.confidence).toBe('manual');
    expect(bal_corrected?.transform?.manualPoints).toEqual(bal_corners);
  });

  it('reprocessing keeps summary consistent', async () => {
    const bal_batch = await bal_make_batch();
    await bal_add_fixture_files(bal_batch, [{ name: 'solo.jpg', image: bal_page_image('021', 1) }]);
    await bal_run_batch_queue(bal_batch.id, bal_layouts, bal_processor() as bal_ScanProcessor, bal_decode, bal_encode, () => {}, () => false);
    const bal_pages = await ken_pori_scan_pages(bal_batch.id);
    const bal_solo_image = bal_page_image('021', 1);
    bal_decode_queue.push({
      data: bal_solo_image.data,
      width: bal_solo_image.width,
      height: bal_solo_image.height
    });
    const bal_again = await bal_reprocess_page(bal_pages[0].id, bal_layouts, bal_processor() as bal_ScanProcessor, bal_decode, bal_encode);
    expect(bal_again?.status).toBe('ready');
    const bal_after = (await dhon_scan_batch(bal_batch.id)) as ScanBatchRecord;
    expect(bal_after.summary.ready).toBe(1);
    expect(bal_empty_summary().totalPages).toBe(0);
  });
});
