import {
  bal_get,
  bal_get_all,
  bal_get_all_by_index_tx,
  bal_run_tx_async
} from '../../db/client';
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
  ResponseRecord
} from '../../models/response_models';
import type {
  PrintBatchRecord,
  PrintLayoutRecord
} from '../../models/print_models';
import type {
  QuestionnaireRecord,
  ResponseScaleRecord
} from '../../models/types';
import type { SettingRow } from '../../db/settings_repo';
import type { BalInspectedPackage } from './mahim_import';
import { bal_payload_equal } from './mahim_payload';
import { bal_mahim_open } from './mahim_container';
import { ken_pori_projects } from '../../db/projects_repo';
import { dhon_questionnaire } from '../../db/questionnaires_repo';
import { dhon_scale } from '../../db/scales_repo';
import { dhon_layout, dhon_batch } from '../../db/print_repo';
import { dhon_scan_batch, dhon_scan_page, dhon_scan_asset } from '../../db/scan_repo';
import { dhon_response } from '../../db/response_repo';

export type BalImportResolution = 'merge' | 'replace';

export interface BalImportCounts {
  projects: number;
  questionnaires: number;
  scales: number;
  printLayouts: number;
  printBatches: number;
  scanBatches: number;
  scanPages: number;
  scanAssets: number;
  scanAuditEvents: number;
  responses: number;
  recognitionRuns: number;
  responseAuditEvents: number;
  blankReferences: number;
  settings: number;
}

export interface BalImportReport {
  projectId: string;
  projectTitle: string;
  mode: string;
  resolution: BalImportResolution;
  written: BalImportCounts;
  skipped: BalImportCounts;
}

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

function bal_zero_counts(): BalImportCounts {
  return {
    projects: 0,
    questionnaires: 0,
    scales: 0,
    printLayouts: 0,
    printBatches: 0,
    scanBatches: 0,
    scanPages: 0,
    scanAssets: 0,
    scanAuditEvents: 0,
    responses: 0,
    recognitionRuns: 0,
    responseAuditEvents: 0,
    blankReferences: 0,
    settings: 0
  };
}

async function bal_read_asset_bytes(
  bal_inspected: BalInspectedPackage,
  bal_section: string
): Promise<Uint8Array | null> {
  try {
    const bal_reader = await bal_mahim_open(bal_inspected.source);
    return await bal_reader.getSection(bal_section);
  } catch {
    return null;
  }
}

export async function bal_commit_import(
  bal_inspected: BalInspectedPackage,
  bal_resolution: BalImportResolution
): Promise<BalImportReport> {
  const bal_report: BalImportReport = {
    projectId: bal_inspected.project.id,
    projectTitle: bal_inspected.project.title,
    mode: bal_inspected.manifest.mode,
    resolution: bal_resolution,
    written: bal_zero_counts(),
    skipped: bal_zero_counts()
  };

  const bal_local_projects = await ken_pori_projects();
  const bal_local_project = bal_local_projects.find(
    (bal_p) => bal_p.id === bal_inspected.project.id
  );
  const bal_project_dedupe =
    bal_local_project !== undefined &&
    bal_payload_equal(bal_local_project, bal_inspected.project);
  if (bal_project_dedupe) {
    bal_report.skipped.projects = 1;
  } else {
    bal_report.written.projects = 1;
  }

  const bal_questionnaire_rows: QuestionnaireRecord[] = [];
  for (const bal_q of bal_inspected.questionnaires) {
    const bal_local = await dhon_questionnaire(bal_q.id);
    if (bal_local && bal_payload_equal(bal_local, bal_q)) {
      bal_report.skipped.questionnaires += 1;
      continue;
    }
    bal_questionnaire_rows.push(bal_q);
    bal_report.written.questionnaires += 1;
  }

  const bal_scale_rows: ResponseScaleRecord[] = [];
  for (const bal_scale of bal_inspected.scales) {
    const bal_local = await dhon_scale(bal_scale.id);
    if (bal_local && bal_payload_equal(bal_local, bal_scale)) {
      bal_report.skipped.scales += 1;
      continue;
    }
    bal_scale_rows.push(bal_scale);
    bal_report.written.scales += 1;
  }

  const bal_layout_rows: PrintLayoutRecord[] = [];
  for (const bal_layout of bal_inspected.print.layouts) {
    const bal_local = await dhon_layout(bal_layout.id);
    if (bal_local && bal_payload_equal(bal_local, bal_layout)) {
      bal_report.skipped.printLayouts += 1;
      continue;
    }
    bal_layout_rows.push(bal_layout);
    bal_report.written.printLayouts += 1;
  }
  const bal_batch_rows: PrintBatchRecord[] = [];
  for (const bal_batch of bal_inspected.print.batches) {
    const bal_local = await dhon_batch(bal_batch.id);
    if (bal_local && bal_payload_equal(bal_local, bal_batch)) {
      bal_report.skipped.printBatches += 1;
      continue;
    }
    bal_batch_rows.push(bal_batch);
    bal_report.written.printBatches += 1;
  }

  const bal_scan_batch_rows: ScanBatchRecord[] = [];
  const bal_scan_page_rows: ScanPageRecord[] = [];
  const bal_scan_audit_rows: ScanAuditEventRecord[] = [];
  if (bal_inspected.scan) {
    for (const bal_batch of bal_inspected.scan.batches) {
      const bal_local = await dhon_scan_batch(bal_batch.id);
      if (bal_local && bal_payload_equal(bal_local, bal_batch)) {
        bal_report.skipped.scanBatches += 1;
        continue;
      }
      bal_scan_batch_rows.push(bal_batch);
      bal_report.written.scanBatches += 1;
    }
    for (const bal_page of bal_inspected.scan.pages) {
      const bal_local = await dhon_scan_page(bal_page.id);
      if (bal_local && bal_payload_equal(bal_local, bal_page)) {
        bal_report.skipped.scanPages += 1;
        continue;
      }
      bal_scan_page_rows.push(bal_page);
      bal_report.written.scanPages += 1;
    }
    for (const bal_event of bal_inspected.scan.auditEvents) {
      const bal_local = await bal_get('scanAuditEvents', bal_event.id);
      if (bal_local && bal_payload_equal(bal_local, bal_event)) continue;
      bal_scan_audit_rows.push(bal_event);
      bal_report.written.scanAuditEvents += 1;
    }
  }

  const bal_response_rows: ResponseRecord[] = [];
  const bal_run_rows: RecognitionRunRecord[] = [];
  const bal_response_audit_rows: ResponseAuditEventRecord[] = [];
  if (bal_inspected.responses && bal_inspected.manifest.includesResponses) {
    for (const bal_response of bal_inspected.responses.responses) {
      const bal_local = await dhon_response(bal_response.id);
      if (bal_local && bal_payload_equal(bal_local, bal_response)) {
        bal_report.skipped.responses += 1;
        continue;
      }
      bal_response_rows.push(bal_response);
      bal_report.written.responses += 1;
    }
    for (const bal_run of bal_inspected.responses.recognitionRuns) {
      const bal_local = await bal_get('recognitionRuns', bal_run.id);
      if (bal_local && bal_payload_equal(bal_local, bal_run)) continue;
      bal_run_rows.push(bal_run);
      bal_report.written.recognitionRuns += 1;
    }
    for (const bal_event of bal_inspected.responses.auditEvents) {
      const bal_local = await bal_get('responseAuditEvents', bal_event.id);
      if (bal_local && bal_payload_equal(bal_local, bal_event)) continue;
      bal_response_audit_rows.push(bal_event);
      bal_report.written.responseAuditEvents += 1;
    }
  }

  const bal_blank_rows: BlankReferenceRecord[] = [];
  if (bal_inspected.responses && bal_inspected.manifest.includesScanImages) {
    for (const bal_ref of bal_inspected.responses.blankReferences) {
      const bal_entry = bal_inspected.assetIndex.find(
        (bal_e) => bal_e.kind === 'blank-reference' && bal_e.assetId === bal_ref.id
      );
      if (!bal_entry) continue;
      const bal_local = await bal_get('blankReferences', bal_ref.id);
      if (bal_local) {
        bal_report.skipped.blankReferences += 1;
        continue;
      }
      const bal_bytes = await bal_read_asset_bytes(bal_inspected, bal_entry.section);
      if (!bal_bytes) continue;
      bal_blank_rows.push({
        id: bal_ref.id,
        fingerprint: bal_ref.fingerprint,
        pageNumber: bal_ref.pageNumber,
        questionnaireVersion: bal_ref.questionnaireVersion,
        mime: bal_entry.mime,
        bytes: new Blob([bal_bytes], { type: bal_entry.mime }),
        widthPx: bal_ref.widthPx,
        heightPx: bal_ref.heightPx,
        createdAt: bal_ref.createdAt
      });
      bal_report.written.blankReferences += 1;
    }
  }

  const bal_asset_rows: ScanAssetRecord[] = [];
  for (const bal_entry of bal_inspected.assetIndex) {
    if (bal_entry.kind !== 'scan-asset' || !bal_entry.scanAsset) continue;
    const bal_local = await dhon_scan_asset(bal_entry.assetId);
    if (bal_local) {
      bal_report.skipped.scanAssets += 1;
      continue;
    }
    const bal_bytes = await bal_read_asset_bytes(bal_inspected, bal_entry.section);
    if (!bal_bytes) continue;
    bal_asset_rows.push({
      id: bal_entry.assetId,
      batchId: bal_entry.scanAsset.batchId,
      pageId: bal_entry.pageId ?? '',
      kind: bal_entry.scanAsset.assetKind,
      mime: bal_entry.mime,
      bytes: new Blob([bal_bytes], { type: bal_entry.mime }),
      width: bal_entry.scanAsset.width,
      height: bal_entry.scanAsset.height,
      size: bal_entry.scanAsset.size,
      createdAt: bal_entry.scanAsset.createdAt
    });
    bal_report.written.scanAssets += 1;
  }

  const bal_local_settings = await bal_get_all<SettingRow<unknown>>('settings');
  const bal_local_setting_keys = new Set(bal_local_settings.map((bal_row) => bal_row.key));
  const bal_setting_rows = bal_inspected.settings.filter(
    (bal_row) => !bal_local_setting_keys.has(bal_row.key)
  );
  bal_report.written.settings = bal_setting_rows.length;

  await bal_run_tx_async(BAL_ALL_STORES, 'readwrite', async (bal_tx) => {
    if (bal_resolution === 'replace' && bal_local_project !== undefined) {
      const bal_project_id = bal_inspected.project.id;
      const bal_q_keys = await bal_get_all_by_index_tx<QuestionnaireRow>(
        bal_tx,
        'questionnaires',
        'projectId',
        bal_project_id
      );
      for (const bal_row of bal_q_keys) bal_tx.objectStore('questionnaires').delete(bal_row.id);
      const bal_batch_keys = await bal_get_all_by_index_tx<PrintBatchRow>(
        bal_tx,
        'printBatches',
        'projectId',
        bal_project_id
      );
      for (const bal_row of bal_batch_keys) bal_tx.objectStore('printBatches').delete(bal_row.id);
      const bal_layout_keys = await bal_get_all_by_index_tx<PrintLayoutRow>(
        bal_tx,
        'printLayouts',
        'questionnaireId',
        ...bal_q_keys.map((bal_row) => bal_row.id)
      );
      for (const bal_row of bal_layout_keys) bal_tx.objectStore('printLayouts').delete(bal_row.id);
      const bal_scan_batch_keys = await bal_get_all_by_index_tx<ScanBatchRow>(
        bal_tx,
        'scanBatches',
        'projectId',
        bal_project_id
      );
      for (const bal_row of bal_scan_batch_keys) {
        bal_tx.objectStore('scanBatches').delete(bal_row.id);
        const bal_page_rows = await bal_get_all_by_index_tx<ScanPageRow>(
          bal_tx,
          'scanPages',
          'batchId',
          bal_row.id
        );
        for (const bal_page of bal_page_rows) {
          bal_tx.objectStore('scanPages').delete(bal_page.id);
          const bal_asset_rows_local = await bal_get_all_by_index_tx<{ id: string }>(
            bal_tx,
            'scanAssets',
            'pageId',
            bal_page.id
          );
          for (const bal_asset of bal_asset_rows_local) {
            bal_tx.objectStore('scanAssets').delete(bal_asset.id);
          }
        }
        const bal_event_rows = await bal_get_all_by_index_tx<{ id: string }>(
          bal_tx,
          'scanAuditEvents',
          'batchId',
          bal_row.id
        );
        for (const bal_event of bal_event_rows) bal_tx.objectStore('scanAuditEvents').delete(bal_event.id);
      }
      const bal_project_responses = await bal_get_all_by_index_tx<{ id: string }>(
        bal_tx,
        'responses',
        'projectId',
        bal_project_id
      );
      for (const bal_response of bal_project_responses) bal_tx.objectStore('responses').delete(bal_response.id);
      bal_tx.objectStore('projects').delete(bal_project_id);
    }
    if (!bal_project_dedupe || bal_resolution === 'replace') {
      bal_tx.objectStore('projects').put(bal_inspected.project);
    }
    for (const bal_q of bal_questionnaire_rows) bal_tx.objectStore('questionnaires').put(bal_q);
    for (const bal_scale of bal_scale_rows) bal_tx.objectStore('responseScales').put(bal_scale);
    for (const bal_layout of bal_layout_rows) bal_tx.objectStore('printLayouts').put(bal_layout);
    for (const bal_batch of bal_batch_rows) bal_tx.objectStore('printBatches').put(bal_batch);
    for (const bal_batch of bal_scan_batch_rows) bal_tx.objectStore('scanBatches').put(bal_batch);
    for (const bal_page of bal_scan_page_rows) bal_tx.objectStore('scanPages').put(bal_page);
    for (const bal_asset of bal_asset_rows) bal_tx.objectStore('scanAssets').put(bal_asset);
    for (const bal_event of bal_scan_audit_rows) bal_tx.objectStore('scanAuditEvents').put(bal_event);
    for (const bal_response of bal_response_rows) bal_tx.objectStore('responses').put(bal_response);
    for (const bal_run of bal_run_rows) bal_tx.objectStore('recognitionRuns').put(bal_run);
    for (const bal_event of bal_response_audit_rows) bal_tx.objectStore('responseAuditEvents').put(bal_event);
    for (const bal_blank of bal_blank_rows) bal_tx.objectStore('blankReferences').put(bal_blank);
    for (const bal_setting of bal_setting_rows) bal_tx.objectStore('settings').put(bal_setting);
  });
  return bal_report;
}

interface QuestionnaireRow {
  id: string;
}
interface PrintBatchRow {
  id: string;
}
interface PrintLayoutRow {
  id: string;
}
interface ScanBatchRow {
  id: string;
}
interface ScanPageRow {
  id: string;
}
