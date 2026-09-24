import {
  bal_delete_keys,
  bal_get,
  bal_get_all,
  bal_get_all_by_index,
  bal_put,
  bal_run_tx
} from './client';
import type {
  ScanAssetRecord,
  ScanAuditEventRecord,
  ScanBatchRecord,
  ScanPageRecord
} from '../models/scan_models';

export async function bal_save_scan_batch(bal_row: ScanBatchRecord): Promise<void> {
  await bal_put('scanBatches', bal_row);
}

export async function dhon_scan_batch(bal_id: string): Promise<ScanBatchRecord | undefined> {
  return bal_get<ScanBatchRecord>('scanBatches', bal_id);
}

export async function ken_pori_scan_batches(bal_project_id: string): Promise<ScanBatchRecord[]> {
  const bal_rows = await bal_get_all_by_index<ScanBatchRecord>('scanBatches', 'projectId', bal_project_id);
  return bal_rows.sort((bal_a, bal_b) => bal_b.createdAt - bal_a.createdAt);
}

export async function bal_save_scan_page(bal_row: ScanPageRecord): Promise<void> {
  await bal_put('scanPages', bal_row);
}

export async function dhon_scan_page(bal_id: string): Promise<ScanPageRecord | undefined> {
  return bal_get<ScanPageRecord>('scanPages', bal_id);
}

export async function ken_pori_scan_pages(bal_batch_id: string): Promise<ScanPageRecord[]> {
  const bal_rows = await bal_get_all_by_index<ScanPageRecord>('scanPages', 'batchId', bal_batch_id);
  return bal_rows.sort((bal_a, bal_b) => bal_a.createdAt - bal_b.createdAt);
}

export async function bal_save_scan_pages(bal_rows: ScanPageRecord[]): Promise<void> {
  if (bal_rows.length === 0) return;
  await bal_run_tx(['scanPages'], 'readwrite', (bal_tx) => {
    const bal_store = bal_tx.objectStore('scanPages');
    for (const bal_row of bal_rows) bal_store.put(bal_row);
  });
}

export async function bal_save_scan_asset(bal_row: ScanAssetRecord): Promise<void> {
  await bal_put('scanAssets', bal_row);
}

export async function dhon_scan_asset(bal_id: string): Promise<ScanAssetRecord | undefined> {
  return bal_get<ScanAssetRecord>('scanAssets', bal_id);
}

export async function bal_save_scan_assets(bal_rows: ScanAssetRecord[]): Promise<void> {
  if (bal_rows.length === 0) return;
  await bal_run_tx(['scanAssets'], 'readwrite', (bal_tx) => {
    const bal_store = bal_tx.objectStore('scanAssets');
    for (const bal_row of bal_rows) bal_store.put(bal_row);
  });
}

export async function bal_save_audit_event(bal_row: ScanAuditEventRecord): Promise<void> {
  await bal_put('scanAuditEvents', bal_row);
}

export async function ken_pori_audit_events(bal_batch_id: string): Promise<ScanAuditEventRecord[]> {
  const bal_rows = await bal_get_all_by_index<ScanAuditEventRecord>(
    'scanAuditEvents',
    'batchId',
    bal_batch_id
  );
  return bal_rows.sort((bal_a, bal_b) => bal_b.createdAt - bal_a.createdAt);
}

export async function lichu_scan_page_assets(bal_page: ScanPageRecord): Promise<void> {
  const bal_ids = [bal_page.sourceAssetId, bal_page.normalizedAssetId].filter(
    (bal_id): bal_id is string => bal_id !== null
  );
  await bal_delete_keys('scanAssets', bal_ids);
}

export async function lichu_scan_batch(bal_batch_id: string): Promise<void> {
  const bal_pages = await ken_pori_scan_pages(bal_batch_id);
  const bal_asset_ids: string[] = [];
  for (const bal_page of bal_pages) {
    if (bal_page.sourceAssetId) bal_asset_ids.push(bal_page.sourceAssetId);
    if (bal_page.normalizedAssetId) bal_asset_ids.push(bal_page.normalizedAssetId);
  }
  await bal_run_tx(
    ['scanAssets', 'scanPages', 'scanAuditEvents', 'scanBatches'],
    'readwrite',
    (bal_tx) => {
      const bal_asset_store = bal_tx.objectStore('scanAssets');
      for (const bal_id of bal_asset_ids) bal_asset_store.delete(bal_id);
      bal_tx.objectStore('scanPages').delete(bal_batch_id + '');
      const bal_page_store = bal_tx.objectStore('scanPages');
      for (const bal_page of bal_pages) bal_page_store.delete(bal_page.id);
      const bal_audit_index = bal_tx.objectStore('scanAuditEvents').index('batchId');
      bal_audit_index.getAllKeys(bal_batch_id).onsuccess = () => {};
      void bal_audit_index;
      bal_tx.objectStore('scanBatches').delete(bal_batch_id);
    }
  );
  const bal_events = await bal_get_all_by_index<ScanAuditEventRecord>(
    'scanAuditEvents',
    'batchId',
    bal_batch_id
  );
  if (bal_events.length > 0) {
    await bal_delete_keys(
      'scanAuditEvents',
      bal_events.map((bal_event) => bal_event.id)
    );
  }
}

export async function bal_scan_batch_stats(bal_batch_id: string): Promise<{
  sourceBytes: number;
  normalizedBytes: number;
  pages: number;
}> {
  const bal_pages = await ken_pori_scan_pages(bal_batch_id);
  let bal_source = 0;
  let bal_normalized = 0;
  for (const bal_page of bal_pages) {
    bal_source += bal_page.sourceBytes;
    bal_normalized += bal_page.normalizedBytes;
  }
  return { sourceBytes: bal_source, normalizedBytes: bal_normalized, pages: bal_pages.length };
}

export async function ken_pori_all_batches(): Promise<ScanBatchRecord[]> {
  return bal_get_all<ScanBatchRecord>('scanBatches');
}
