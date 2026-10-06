import type {
  ProjectRecord,
  QuestionnaireRecord,
  ResponseScaleRecord
} from '../../models/types';
import type {
  PrintBatchRecord,
  PrintLayoutRecord
} from '../../models/print_models';
import type {
  ScanAssetRecord,
  ScanAuditEventRecord,
  ScanBatchRecord,
  ScanPageRecord
} from '../../models/scan_models';
import type {
  BlankReferenceRecord,
  RecognitionRunRecord,
  ResponseAuditEventRecord,
  ResponseRecord,
  DatasetSnapshotRecord
} from '../../models/response_models';
import type { SettingRow } from '../../db/settings_repo';
import {
  BAL_MAHIM_ASSET_SECTION_PREFIX,
  BAL_MAHIM_SECTION,
  BAL_MAHIM_PAYLOAD_VERSION,
  SectionType,
  bal_mahim_write
} from './mahim_container';
import { bal_cbor_pack } from './mahim_codec';
import type { BalMahimManifest, BalPayloadIssue, BalPrintPackage } from './mahim_payload';
import { bal_backup_filename } from './mahim_filenames';

export interface BalBackupOptions {
  includeResponses: boolean;
  includeOriginalScans: boolean;
  includeNormalizedPages: boolean;
  includeThumbnails: boolean;
}

export interface BalBackupInput {
  project: ProjectRecord;
  questionnaires: QuestionnaireRecord[];
  scales: ResponseScaleRecord[];
  layouts: PrintLayoutRecord[];
  batches: PrintBatchRecord[];
  scanBatches: ScanBatchRecord[];
  scanPages: ScanPageRecord[];
  scanAuditEvents: ScanAuditEventRecord[];
  responses: ResponseRecord[];
  recognitionRuns: RecognitionRunRecord[];
  responseAuditEvents: ResponseAuditEventRecord[];
  blankReferences: BlankReferenceRecord[];
  datasetSnapshots: DatasetSnapshotRecord[];
  assets: ScanAssetRecord[];
  settings: SettingRow<unknown>[];
  options: BalBackupOptions;
}

export interface BalBackupAssetSlot {
  section: string;
  kind: 'scan-asset' | 'blank-reference';
  mime: string;
  bytes: Uint8Array;
}

export interface BalBackupSummary {
  filename: string;
  byteLength: number;
  questionnaireCount: number;
  itemCount: number;
  scaleCount: number;
  layoutCount: number;
  batchCount: number;
  scanBatchCount: number;
  scanPageCount: number;
  assetCount: number;
  assetBytes: number;
  responseCount: number;
  includedResponses: boolean;
}

export interface BalBackupBuild {
  bytes: Uint8Array;
  manifest: BalMahimManifest;
  summary: BalBackupSummary;
}

export interface BalBackupScanPayload {
  batches: ScanBatchRecord[];
  pages: ScanPageRecord[];
  auditEvents: ScanAuditEventRecord[];
}

export interface BalBackupResponsePayload {
  responses: ResponseRecord[];
  recognitionRuns: RecognitionRunRecord[];
  auditEvents: ResponseAuditEventRecord[];
  datasetSnapshots: DatasetSnapshotRecord[];
  blankReferences: {
    id: string;
    fingerprint: string;
    pageNumber: number;
    questionnaireVersion: number;
    widthPx: number;
    heightPx: number;
    createdAt: number;
  }[];
}

export interface BalBackupSectionData {
  manifest: BalMahimManifest;
  project: ProjectRecord;
  questionnaires: QuestionnaireRecord[];
  scales: ResponseScaleRecord[];
  print: BalPrintPackage;
  scan: BalBackupScanPayload;
  responses: BalBackupResponsePayload;
  settings: SettingRow<unknown>[];
  assetIndex: {
    section: string;
    kind: 'scan-asset' | 'blank-reference';
    mime: string;
    assetId: string;
    pageId: string | null;
    scanAsset: {
      batchId: string;
      assetKind: 'source' | 'normalized';
      width: number;
      height: number;
      size: number;
      createdAt: number;
    } | null;
  }[];
}

export function bal_backup_strip_page(
  bal_page: ScanPageRecord,
  bal_include_thumbnails: boolean
): ScanPageRecord {
  if (bal_include_thumbnails) return bal_page;
  return { ...bal_page, thumbSource: null, thumbNormalized: null };
}

export async function bal_build_backup_package(
  bal_input: BalBackupInput
): Promise<{ build: BalBackupBuild } | { issues: BalPayloadIssue[] }> {
  const bal_issues: BalPayloadIssue[] = [];
  for (const bal_q of bal_input.questionnaires) {
    if (bal_q.projectId !== bal_input.project.id) {
      bal_issues.push({
        path: 'questionnaires.projectId',
        message: 'A packaged questionnaire does not belong to the project.'
      });
    }
  }
  if (bal_issues.length > 0) return { issues: bal_issues };

  const bal_pages = bal_input.scanPages.map((bal_page) =>
    bal_backup_strip_page(bal_page, bal_input.options.includeThumbnails)
  );
  const bal_included_assets = bal_input.assets.filter((bal_asset) =>
    bal_asset.kind === 'source'
      ? bal_input.options.includeOriginalScans
      : bal_input.options.includeNormalizedPages
  );
  const bal_blank_meta = bal_input.blankReferences.map((bal_ref) => ({
    id: bal_ref.id,
    fingerprint: bal_ref.fingerprint,
    pageNumber: bal_ref.pageNumber,
    questionnaireVersion: bal_ref.questionnaireVersion,
    widthPx: bal_ref.widthPx,
    heightPx: bal_ref.heightPx,
    createdAt: bal_ref.createdAt
  }));
  const bal_blank_bytes = bal_input.options.includeNormalizedPages
    ? bal_input.blankReferences
    : [];

  const bal_manifest: BalMahimManifest = {
    payloadVersion: BAL_MAHIM_PAYLOAD_VERSION,
    mode: 'project-backup',
    generator: 'svelp',
    exportedAt: new Date().toISOString(),
    projectIds: [bal_input.project.id],
    questionnaireIds: bal_input.questionnaires.map((bal_q) => bal_q.id),
    includesResponses: bal_input.options.includeResponses,
    includesScanImages:
      bal_input.options.includeOriginalScans || bal_input.options.includeNormalizedPages,
    contents: {
      projects: 1,
      questionnaires: bal_input.questionnaires.length,
      scales: bal_input.scales.length,
      printLayouts: bal_input.layouts.length,
      printBatches: bal_input.batches.length,
      scanBatches: bal_input.scanBatches.length,
      scanPages: bal_pages.length,
      assets: bal_included_assets.length + bal_blank_bytes.length,
      responses: bal_input.options.includeResponses ? bal_input.responses.length : 0
    }
  };

  const bal_scan: BalBackupScanPayload = {
    batches: bal_input.scanBatches,
    pages: bal_pages,
    auditEvents: bal_input.scanAuditEvents
  };
  const bal_responses: BalBackupResponsePayload = {
    responses: bal_input.options.includeResponses ? bal_input.responses : [],
    datasetSnapshots: bal_input.options.includeResponses ? bal_input.datasetSnapshots : [],
    recognitionRuns: bal_input.options.includeResponses ? bal_input.recognitionRuns : [],
    auditEvents: bal_input.options.includeResponses ? bal_input.responseAuditEvents : [],
    blankReferences: bal_blank_meta
  };

  const bal_asset_index: BalBackupSectionData['assetIndex'] = [];
  const bal_asset_slots: BalBackupAssetSlot[] = [];
  let bal_slot_index = 0;
  for (const bal_asset of bal_included_assets) {
    const bal_name = `${BAL_MAHIM_ASSET_SECTION_PREFIX}${bal_slot_index}`;
    bal_slot_index += 1;
    bal_asset_index.push({
      section: bal_name,
      kind: 'scan-asset',
      mime: bal_asset.mime,
      assetId: bal_asset.id,
      pageId: bal_asset.pageId,
      scanAsset: {
        batchId: bal_asset.batchId,
        assetKind: bal_asset.kind,
        width: bal_asset.width,
        height: bal_asset.height,
        size: bal_asset.size,
        createdAt: bal_asset.createdAt
      }
    });
    bal_asset_slots.push({
      section: bal_name,
      kind: 'scan-asset',
      mime: bal_asset.mime,
      bytes: new Uint8Array(await bal_asset.bytes.arrayBuffer())
    });
  }
  for (const bal_ref of bal_blank_bytes) {
    const bal_name = `${BAL_MAHIM_ASSET_SECTION_PREFIX}${bal_slot_index}`;
    bal_slot_index += 1;
    bal_asset_index.push({
      section: bal_name,
      kind: 'blank-reference',
      mime: bal_ref.mime,
      assetId: bal_ref.id,
      pageId: null,
      scanAsset: null
    });
    bal_asset_slots.push({
      section: bal_name,
      kind: 'blank-reference',
      mime: bal_ref.mime,
      bytes: new Uint8Array(await bal_ref.bytes.arrayBuffer())
    });
  }

  const bal_print: BalPrintPackage = {
    layouts: bal_input.layouts,
    batches: bal_input.batches
  };

  const bal_bytes = await bal_mahim_write(
    [
      {
        name: BAL_MAHIM_SECTION.manifest,
        type: SectionType.Metadata,
        data: bal_cbor_pack(bal_manifest)
      },
      {
        name: BAL_MAHIM_SECTION.project,
        type: SectionType.ApplicationPayload,
        data: bal_cbor_pack(bal_input.project)
      },
      {
        name: BAL_MAHIM_SECTION.questionnaires,
        type: SectionType.ApplicationPayload,
        data: bal_cbor_pack(bal_input.questionnaires)
      },
      {
        name: BAL_MAHIM_SECTION.scales,
        type: SectionType.ApplicationPayload,
        data: bal_cbor_pack(bal_input.scales)
      },
      {
        name: BAL_MAHIM_SECTION.print,
        type: SectionType.ApplicationPayload,
        data: bal_cbor_pack(bal_print)
      },
      {
        name: BAL_MAHIM_SECTION.scanMetadata,
        type: SectionType.ApplicationPayload,
        data: bal_cbor_pack(bal_scan)
      },
      {
        name: BAL_MAHIM_SECTION.responses,
        type: SectionType.ApplicationPayload,
        data: bal_cbor_pack(bal_responses)
      },
      {
        name: BAL_MAHIM_SECTION.settings,
        type: SectionType.ApplicationPayload,
        data: bal_cbor_pack(bal_input.settings)
      },
      {
        name: BAL_MAHIM_SECTION.assetIndex,
        type: SectionType.ApplicationPayload,
        data: bal_cbor_pack(bal_asset_index)
      }
    ],
    bal_asset_slots.map((bal_slot) => ({ name: bal_slot.section, data: bal_slot.bytes }))
  );

  return {
    build: {
      bytes: bal_bytes,
      manifest: bal_manifest,
      summary: {
        filename: bal_backup_filename(bal_input.project.title),
        byteLength: bal_bytes.length,
        questionnaireCount: bal_input.questionnaires.length,
        itemCount: bal_input.questionnaires.reduce(
          (bal_total, bal_q) =>
            bal_total +
            bal_q.sections.reduce((bal_sub, bal_section) => bal_sub + bal_section.items.length, 0),
          0
        ),
        scaleCount: bal_input.scales.length,
        layoutCount: bal_input.layouts.length,
        batchCount: bal_input.batches.length,
        scanBatchCount: bal_input.scanBatches.length,
        scanPageCount: bal_pages.length,
        assetCount: bal_asset_slots.length,
        assetBytes: bal_asset_slots.reduce((bal_total, bal_slot) => bal_total + bal_slot.bytes.length, 0),
        responseCount: bal_responses.responses.length,
        includedResponses: bal_input.options.includeResponses
      }
    }
  };
}
