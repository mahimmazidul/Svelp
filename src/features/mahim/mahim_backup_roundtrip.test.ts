import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { bal_clear, bal_get } from '../../db/client';
import { bal_save_project } from '../../db/projects_repo';
import { bal_save_questionnaire } from '../../db/questionnaires_repo';
import { bal_save_scale } from '../../db/scales_repo';
import { bal_save_batch_with_layout } from '../../db/print_repo';
import {
  bal_save_scan_batch,
  bal_save_scan_page,
  bal_save_scan_asset,
  bal_save_audit_event
} from '../../db/scan_repo';
import {
  bal_save_response,
  bal_save_blank_reference
} from '../../db/response_repo';
import { bal_build_backup_package, type BalBackupOptions } from './mahim_backup';
import { bal_inspect_mahim_package } from './mahim_import';
import { bal_commit_import } from './mahim_commit';
import {
  bal_project,
  bal_questionnaire,
  bal_scale,
  bal_layout
} from './mahim_test_fixtures';
import type { ScanBatchRecord, ScanPageRecord, ScanAssetRecord, ScanAuditEventRecord } from '../../models/scan_models';
import type { BlankReferenceRecord, ResponseRecord } from '../../models/response_models';
import { dhon_scan_asset } from '../../db/scan_repo';

const BAL_ALL_STORES = [
  'projects',
  'questionnaires',
  'responseScales',
  'printLayouts',
  'printBatches',
  'scanBatches',
  'scanPages',
  'scanAssets',
  'scanAuditEvents',
  'responses',
  'recognitionRuns',
  'responseAuditEvents',
  'blankReferences',
  'settings'
];

function bal_options(bal_overrides: Partial<BalBackupOptions> = {}): BalBackupOptions {
  return {
    includeResponses: true,
    includeOriginalScans: true,
    includeNormalizedPages: true,
    includeThumbnails: true,
    ...bal_overrides
  };
}

function bal_scan_batch(): ScanBatchRecord {
  return {
    id: 'scan-batch-1',
    projectId: 'proj-1',
    questionnaireId: 'q-1',
    questionnaireVersion: 3,
    status: 'review',
    keepOriginals: true,
    summary: {
      totalPages: 1,
      ready: 0,
      needsReview: 1,
      duplicates: 0,
      failed: 0,
      unsupported: 0,
      queued: 0,
      respondents: 1,
      complete: 0,
      incomplete: 1
    },
    createdAt: 1727600000000,
    updatedAt: 1727700000000
  };
}

function bal_scan_page(): ScanPageRecord {
  return {
    id: 'scan-page-1',
    batchId: 'scan-batch-1',
    projectId: 'proj-1',
    questionnaireId: 'q-1',
    questionnaireVersion: 3,
    respondentId: 'R-001',
    pageNumber: 1,
    status: 'needs-review',
    sourceAssetId: 'scan-asset-1',
    normalizedAssetId: 'scan-asset-2',
    sourceName: 'sheet-001.jpg',
    sourceType: 'image',
    sourceHash: 'abc123',
    sourceBytes: 1024,
    normalizedBytes: 512,
    thumbSource: 'data:image/jpeg;base64,AAAA',
    thumbNormalized: 'data:image/jpeg;base64,BBBB',
    identitySource: 'qr',
    payload: 'S1|WS2026|3|R-001|1',
    detectedPayloads: null,
    quality: null,
    alignment: null,
    transform: null,
    issues: ['poor-quality'],
    errorMessage: null,
    processingMs: 120,
    createdAt: 1727600000000,
    updatedAt: 1727700000000
  };
}

function bal_scan_asset(bal_id: string, bal_kind: 'source' | 'normalized'): ScanAssetRecord {
  return {
    id: bal_id,
    batchId: 'scan-batch-1',
    pageId: 'scan-page-1',
    kind: bal_kind,
    mime: 'image/jpeg',
    bytes: new Blob([new Uint8Array([1, 2, 3, bal_kind === 'source' ? 4 : 5])], { type: 'image/jpeg' }),
    width: 1000,
    height: 1400,
    size: 4,
    createdAt: 1727600000000
  };
}

function bal_audit_event(): ScanAuditEventRecord {
  return {
    id: 'scan-audit-1',
    batchId: 'scan-batch-1',
    pageId: 'scan-page-1',
    kind: 'manual-identification',
    detail: 'Respondent set manually.',
    createdAt: 1727600000000
  };
}

function bal_response(): ResponseRecord {
  return {
    id: 'R-001::i1',
    projectId: 'proj-1',
    batchId: 'scan-batch-1',
    questionnaireId: 'q-1',
    questionnaireVersion: 3,
    respondentId: 'R-001',
    itemId: 'i1',
    variableName: 'water_source',
    itemType: 'single_choice',
    rowId: null,
    columnId: null,
    value: ['o1'],
    codedValue: ['1'],
    status: 'accepted',
    confidence: 0.95,
    machineValue: ['o1'],
    machineStatus: 'accepted',
    machineConfidence: 0.95,
    manuallyReviewed: false,
    validationIssues: [],
    sourcePageId: 'scan-page-1',
    sourceRegionRect: { x: 0.14, y: 0.19, width: 0.02, height: 0.02 },
    algorithmVersion: 'R1',
    thresholdProfileName: 'default-v1',
    recognitionRunId: 'run-1',
    createdAt: 1727600000000,
    updatedAt: 1727700000000
  };
}

function bal_blank_reference(): BlankReferenceRecord {
  return {
    id: 'blank-1',
    fingerprint: 'fp-a37792f7',
    pageNumber: 1,
    questionnaireVersion: 3,
    mime: 'image/png',
    bytes: new Blob([new Uint8Array([9, 9, 9, 9])], { type: 'image/png' }),
    widthPx: 1239,
    heightPx: 1752,
    createdAt: 1727600000000
  };
}

async function bal_seed_device_a(): Promise<void> {
  await bal_save_project(bal_project());
  await bal_save_questionnaire(bal_questionnaire());
  await bal_save_scale(bal_scale());
  await bal_save_batch_with_layout(
    {
      id: 'print-batch-1',
      projectId: 'proj-1',
      questionnaireId: 'q-1',
      questionnaireVersion: 3,
      fingerprint: 'fp-a37792f7',
      layoutId: 'layout-1',
      respondentIds: ['R-001'],
      settings: bal_layout().settingsSnapshot,
      pageCount: 1,
      includeMachineIdentifier: true,
      includeHumanReadableId: true,
      createdAt: 1727600000000
    },
    bal_layout()
  );
  await bal_save_scan_batch(bal_scan_batch());
  await bal_save_scan_page(bal_scan_page());
  await bal_save_scan_asset(bal_scan_asset('scan-asset-1', 'source'));
  await bal_save_scan_asset(bal_scan_asset('scan-asset-2', 'normalized'));
  await bal_save_audit_event(bal_audit_event());
  await bal_save_response(bal_response());
  await bal_save_blank_reference(bal_blank_reference());
}

async function bal_wipe(): Promise<void> {
  for (const bal_store of BAL_ALL_STORES) {
    await bal_clear(bal_store);
  }
}

beforeEach(async () => {
  await bal_wipe();
});

describe('mahim backup round trip', () => {
  it('round trips everything on a clean device with assets intact', async () => {
    await bal_seed_device_a();
    const bal_backup = await bal_build_backup_package({
      project: bal_project(),
      questionnaires: [bal_questionnaire()],
      scales: [bal_scale()],
      layouts: [bal_layout()],
      batches: [
        {
          id: 'print-batch-1',
          projectId: 'proj-1',
          questionnaireId: 'q-1',
          questionnaireVersion: 3,
          fingerprint: 'fp-a37792f7',
          layoutId: 'layout-1',
          respondentIds: ['R-001'],
          settings: bal_layout().settingsSnapshot,
          pageCount: 1,
          includeMachineIdentifier: true,
          includeHumanReadableId: true,
          createdAt: 1727600000000
        }
      ],
      scanBatches: [bal_scan_batch()],
      scanPages: [bal_scan_page()],
      scanAuditEvents: [bal_audit_event()],
      responses: [bal_response()],
      recognitionRuns: [],
      responseAuditEvents: [],
      blankReferences: [bal_blank_reference()],
      assets: [bal_scan_asset('scan-asset-1', 'source'), bal_scan_asset('scan-asset-2', 'normalized')],
      settings: [{ key: 'recognition.profile', value: { name: 'default-v1' } }],
      options: bal_options()
    });
    if ('issues' in bal_backup) throw new Error(JSON.stringify(bal_backup.issues));
    expect(bal_backup.build.summary.assetCount).toBe(3);
    expect(bal_backup.build.summary.responseCount).toBe(1);
    await bal_wipe();

    const bal_blob = new Blob([bal_backup.build.bytes], { type: 'application/x-mahim' });
    const bal_outcome = await bal_inspect_mahim_package(bal_blob);
    if (!bal_outcome.ok || 'failure' in bal_outcome) throw new Error('inspect failed');
    expect(bal_outcome.inspected.manifest.mode).toBe('project-backup');
    expect(bal_outcome.inspected.manifest.contents.scanPages).toBe(1);
    expect(bal_outcome.inspected.manifest.contents.assets).toBe(3);
    const bal_report = await bal_commit_import(bal_outcome.inspected, 'merge');
    expect(bal_report.written.projects).toBe(1);
    expect(bal_report.written.scanPages).toBe(1);
    expect(bal_report.written.scanAssets).toBe(2);
    expect(bal_report.written.blankReferences).toBe(1);
    expect(bal_report.written.responses).toBe(1);

    const bal_asset = await dhon_scan_asset('scan-asset-1');
    expect(bal_asset).toBeDefined();
    expect(bal_asset?.bytes.size).toBe(4);
    const bal_bytes = new Uint8Array(await bal_asset!.bytes.arrayBuffer());
    expect(Array.from(bal_bytes)).toEqual([1, 2, 3, 4]);
    const bal_blank = await bal_get<BlankReferenceRecord>('blankReferences', 'blank-1');
    expect(bal_blank?.widthPx).toBe(1239);
    const bal_response_row = await bal_get<ResponseRecord>('responses', 'R-001::i1');
    expect(bal_response_row?.confidence).toBeCloseTo(0.95, 9);
    expect(bal_response_row?.value).toEqual(['o1']);
    const bal_page_row = await bal_get<ScanPageRecord>('scanPages', 'scan-page-1');
    expect(bal_page_row?.thumbSource).toBe('data:image/jpeg;base64,AAAA');
    expect(bal_page_row?.issues).toEqual(['poor-quality']);
    const bal_setting = await bal_get<{ key: string; value: unknown }>('settings', 'recognition.profile');
    expect(bal_setting?.value).toEqual({ name: 'default-v1' });
  });

  it('keeps excluded scans and responses out of the file', async () => {
    await bal_seed_device_a();
    const bal_backup = await bal_build_backup_package({
      project: bal_project(),
      questionnaires: [bal_questionnaire()],
      scales: [bal_scale()],
      layouts: [bal_layout()],
      batches: [],
      scanBatches: [bal_scan_batch()],
      scanPages: [bal_scan_page()],
      scanAuditEvents: [bal_audit_event()],
      responses: [bal_response()],
      recognitionRuns: [],
      responseAuditEvents: [],
      blankReferences: [bal_blank_reference()],
      assets: [bal_scan_asset('scan-asset-1', 'source'), bal_scan_asset('scan-asset-2', 'normalized')],
      settings: [],
      options: bal_options({
        includeResponses: false,
        includeOriginalScans: false,
        includeNormalizedPages: false,
        includeThumbnails: false
      })
    });
    if ('issues' in bal_backup) throw new Error(JSON.stringify(bal_backup.issues));
    expect(bal_backup.build.summary.assetCount).toBe(0);
    expect(bal_backup.build.summary.responseCount).toBe(0);
    expect(bal_backup.build.manifest.includesResponses).toBe(false);
    expect(bal_backup.build.manifest.includesScanImages).toBe(false);
    await bal_wipe();

    const bal_outcome = await bal_inspect_mahim_package(
      new Blob([bal_backup.build.bytes], { type: 'application/x-mahim' })
    );
    if (!bal_outcome.ok || 'failure' in bal_outcome) throw new Error('inspect failed');
    expect(bal_outcome.inspected.assetSections.length).toBe(0);
    const bal_report = await bal_commit_import(bal_outcome.inspected, 'merge');
    expect(bal_report.written.scanAssets).toBe(0);
    expect(bal_report.written.responses).toBe(0);
    expect(bal_report.written.blankReferences).toBe(0);
    expect(bal_report.written.scanPages).toBe(1);
    const bal_page_row = await bal_get<ScanPageRecord>('scanPages', 'scan-page-1');
    expect(bal_page_row?.thumbSource).toBeNull();
    expect(bal_page_row?.thumbNormalized).toBeNull();
  });

  it('re-importing a backup on the same device writes nothing new', async () => {
    await bal_seed_device_a();
    const bal_backup = await bal_build_backup_package({
      project: bal_project(),
      questionnaires: [bal_questionnaire()],
      scales: [bal_scale()],
      layouts: [bal_layout()],
      batches: [],
      scanBatches: [bal_scan_batch()],
      scanPages: [bal_scan_page()],
      scanAuditEvents: [bal_audit_event()],
      responses: [bal_response()],
      recognitionRuns: [],
      responseAuditEvents: [],
      blankReferences: [bal_blank_reference()],
      assets: [bal_scan_asset('scan-asset-1', 'source')],
      settings: [],
      options: bal_options()
    });
    if ('issues' in bal_backup) throw new Error('backup failed');
    const bal_blob = new Blob([bal_backup.build.bytes], { type: 'application/x-mahim' });
    const bal_first = await bal_inspect_mahim_package(bal_blob);
    if (!bal_first.ok || 'failure' in bal_first) throw new Error('inspect failed');
    await bal_commit_import(bal_first.inspected, 'merge');
    const bal_second = await bal_commit_import(bal_first.inspected, 'merge');
    expect(bal_second.written.projects).toBe(0);
    expect(bal_second.written.scanAssets).toBe(0);
    expect(bal_second.written.blankReferences).toBe(0);
    expect(bal_second.skipped.scanPages).toBe(1);
  });
});
