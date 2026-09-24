import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  bal_save_scan_asset,
  bal_save_audit_event,
  bal_save_scan_batch,
  bal_save_scan_page,
  bal_save_scan_pages,
  bal_scan_batch_stats,
  dhon_scan_asset,
  dhon_scan_batch,
  dhon_scan_page,
  ken_pori_audit_events,
  ken_pori_scan_batches,
  ken_pori_scan_pages
} from './scan_repo';
import type {
  ScanAssetRecord,
  ScanAuditEventRecord,
  ScanBatchRecord,
  ScanPageRecord
} from '../models/scan_models';

function bal_batch(bal_id: string): ScanBatchRecord {
  return {
    id: bal_id,
    projectId: 'p-1',
    questionnaireId: null,
    questionnaireVersion: null,
    status: 'ingesting',
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
    updatedAt: 2
  };
}

function bal_page(bal_id: string, bal_batch_id: string): ScanPageRecord {
  return {
    id: bal_id,
    batchId: bal_batch_id,
    projectId: 'p-1',
    questionnaireId: null,
    questionnaireVersion: null,
    respondentId: null,
    pageNumber: null,
    status: 'queued',
    sourceAssetId: null,
    normalizedAssetId: null,
    sourceName: `${bal_id}.jpg`,
    sourceType: 'image',
    sourceHash: `hash-${bal_id}`,
    sourceBytes: 1000,
    normalizedBytes: 0,
    thumbSource: null,
    thumbNormalized: null,
    identitySource: null,
    payload: null,
    detectedPayloads: null,
    quality: null,
    alignment: null,
    transform: null,
    issues: [],
    errorMessage: null,
    processingMs: 0,
    createdAt: 1,
    updatedAt: 2
  };
}

describe('scan repositories', () => {
  beforeEach(async () => {
    const { bal_clear } = await import('./client');
    await bal_clear('scanBatches');
    await bal_clear('scanPages');
    await bal_clear('scanAssets');
    await bal_clear('scanAuditEvents');
  });

  it('stores and lists batches per project newest first', async () => {
    const bal_older = { ...bal_batch('b1'), createdAt: 10 };
    const bal_newer = { ...bal_batch('b2'), createdAt: 20 };
    await bal_save_scan_batch(bal_older);
    await bal_save_scan_batch(bal_newer);
    const bal_rows = await ken_pori_scan_batches('p-1');
    expect(bal_rows.map((bal_r) => bal_r.id)).toEqual(['b2', 'b1']);
    expect((await dhon_scan_batch('b1'))?.status).toBe('ingesting');
  });

  it('stores pages in order and bulk updates them', async () => {
    await bal_save_scan_batch(bal_batch('b1'));
    await bal_save_scan_page(bal_page('pg1', 'b1'));
    await bal_save_scan_page(bal_page('pg2', 'b1'));
    const bal_loaded = await ken_pori_scan_pages('b1');
    expect(bal_loaded.map((bal_r) => bal_r.id)).toEqual(['pg1', 'pg2']);

    await bal_save_scan_pages([
      { ...(await dhon_scan_page('pg1'))!, status: 'ready' },
      { ...(await dhon_scan_page('pg2'))!, status: 'needs-review' }
    ]);
    const bal_after = await ken_pori_scan_pages('b1');
    expect(bal_after.map((bal_r) => bal_r.status)).toEqual(['ready', 'needs-review']);
  });

  it('stores blobs as assets and reports batch sizes', async () => {
    const bal_asset: ScanAssetRecord = {
      id: 'asset-1',
      batchId: 'b1',
      pageId: 'pg1',
      kind: 'source',
      mime: 'image/jpeg',
      bytes: new Blob([new Uint8Array(2048)], { type: 'image/jpeg' }),
      width: 100,
      height: 141,
      size: 2048,
      createdAt: 1
    };
    await bal_save_scan_asset(bal_asset);
    const bal_loaded = await dhon_scan_asset('asset-1');
    expect(bal_loaded?.bytes.size).toBe(2048);
    expect(bal_loaded?.mime).toBe('image/jpeg');
  });

  it('appends audit events newest first', async () => {
    const bal_event: ScanAuditEventRecord = {
      id: 'a1',
      batchId: 'b1',
      pageId: 'pg1',
      kind: 'manual-identification',
      detail: 'Assigned respondent R-1 page 2',
      createdAt: 5
    };
    const bal_event2 = { ...bal_event, id: 'a2', createdAt: 9 };
    await bal_save_audit_event(bal_event);
    await bal_save_audit_event(bal_event2);
    const bal_rows = await ken_pori_audit_events('b1');
    expect(bal_rows.map((bal_r) => bal_r.id)).toEqual(['a2', 'a1']);
  });

  it('sums stored byte sizes without loading blobs into accounting', async () => {
    await bal_save_scan_batch(bal_batch('b1'));
    const bal_first = bal_page('pg1', 'b1');
    const bal_second = { ...bal_page('pg2', 'b1'), normalizedBytes: 500, sourceBytes: 800 };
    await bal_save_scan_pages([bal_first, bal_second]);
    const bal_stats = await bal_scan_batch_stats('b1');
    expect(bal_stats.sourceBytes).toBe(1800);
    expect(bal_stats.normalizedBytes).toBe(500);
    expect(bal_stats.pages).toBe(2);
  });
});
