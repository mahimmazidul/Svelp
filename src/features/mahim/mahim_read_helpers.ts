import { bal_get_all_by_index } from '../../db/client';
import type {
  ScanAssetRecord,
  ScanAuditEventRecord,
  ScanBatchRecord,
  ScanPageRecord
} from '../../models/scan_models';
import type {
  DatasetSnapshotRecord,
  BlankReferenceRecord,
  RecognitionRunRecord,
  ResponseAuditEventRecord,
  ResponseRecord
} from '../../models/response_models';
import { ken_pori_responses_by_project } from '../../db/response_repo';

export async function ken_pori_scan_batches(
  bal_project_id: string
): Promise<ScanBatchRecord[]> {
  return bal_get_all_by_index<ScanBatchRecord>('scanBatches', 'projectId', bal_project_id);
}

export async function ken_pori_scan_pages_by_project(
  bal_project_id: string
): Promise<ScanPageRecord[]> {
  return bal_get_all_by_index<ScanPageRecord>('scanPages', 'projectId', bal_project_id);
}

export async function ken_pori_scan_assets(
  bal_batch_ids: string[]
): Promise<ScanAssetRecord[]> {
  const bal_rows: ScanAssetRecord[] = [];
  for (const bal_batch_id of bal_batch_ids) {
    bal_rows.push(
      ...(await bal_get_all_by_index<ScanAssetRecord>('scanAssets', 'batchId', bal_batch_id))
    );
  }
  return bal_rows;
}

export async function ken_pori_scan_audit_by_project(
  bal_project_id: string
): Promise<ScanAuditEventRecord[]> {
  const bal_batches = await ken_pori_scan_batches(bal_project_id);
  const bal_rows: ScanAuditEventRecord[] = [];
  for (const bal_batch of bal_batches) {
    bal_rows.push(
      ...(await bal_get_all_by_index<ScanAuditEventRecord>(
        'scanAuditEvents',
        'batchId',
        bal_batch.id
      ))
    );
  }
  return bal_rows.sort((bal_a, bal_b) => bal_a.createdAt - bal_b.createdAt);
}

export async function ken_pori_response_runs_by_project(
  bal_project_id: string
): Promise<RecognitionRunRecord[]> {
  return bal_get_all_by_index<RecognitionRunRecord>('recognitionRuns', 'projectId', bal_project_id);
}

export async function ken_pori_response_audit_by_project(
  bal_project_id: string
): Promise<ResponseAuditEventRecord[]> {
  return bal_get_all_by_index<ResponseAuditEventRecord>(
    'responseAuditEvents',
    'projectId',
    bal_project_id
  );
}

export async function ken_pori_dataset_snapshots(
  bal_project_id: string
): Promise<DatasetSnapshotRecord[]> {
  return bal_get_all_by_index<DatasetSnapshotRecord>('datasetSnapshots', 'projectId', bal_project_id);
}

export async function ken_pori_responses_for_project(
  bal_project_id: string
): Promise<ResponseRecord[]> {
  return ken_pori_responses_by_project(bal_project_id);
}

export async function ken_pori_blank_references_for_fingerprints(
  bal_fingerprints: string[]
): Promise<BlankReferenceRecord[]> {
  const bal_rows: BlankReferenceRecord[] = [];
  for (const bal_fingerprint of bal_fingerprints) {
    const bal_part = await bal_get_all_by_index<BlankReferenceRecord>(
      'blankReferences',
      'fingerprint',
      bal_fingerprint
    );
    bal_rows.push(...bal_part);
  }
  return bal_rows;
}
