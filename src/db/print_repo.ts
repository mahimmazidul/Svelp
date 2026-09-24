import { bal_delete_keys, bal_get, bal_get_all_by_index, bal_put, bal_run_tx } from './client';
import type { PrintBatchRecord, PrintLayoutRecord } from '../models/print_models';

export async function bal_save_layout(bal_row: PrintLayoutRecord): Promise<void> {
  await bal_put('printLayouts', bal_row);
}

export async function dhon_layout(bal_id: string): Promise<PrintLayoutRecord | undefined> {
  return bal_get<PrintLayoutRecord>('printLayouts', bal_id);
}

export async function ken_pori_layouts_by_questionnaire(
  bal_questionnaire_id: string
): Promise<PrintLayoutRecord[]> {
  const bal_rows = await bal_get_all_by_index<PrintLayoutRecord>(
    'printLayouts',
    'questionnaireId',
    bal_questionnaire_id
  );
  return bal_rows.sort((bal_a, bal_b) => bal_b.updatedAt - bal_a.updatedAt);
}

export async function dhon_layout_by_fingerprint(
  bal_questionnaire_id: string,
  bal_fingerprint: string
): Promise<PrintLayoutRecord | undefined> {
  const bal_rows = await ken_pori_layouts_by_questionnaire(bal_questionnaire_id);
  return bal_rows.find((bal_row) => bal_row.fingerprint === bal_fingerprint);
}

export async function lichu_layouts(bal_ids: string[]): Promise<void> {
  await bal_delete_keys('printLayouts', bal_ids);
}

export async function bal_save_batch(bal_row: PrintBatchRecord): Promise<void> {
  await bal_put('printBatches', bal_row);
}

export async function dhon_batch(bal_id: string): Promise<PrintBatchRecord | undefined> {
  return bal_get<PrintBatchRecord>('printBatches', bal_id);
}

export async function ken_pori_batches_by_project(bal_project_id: string): Promise<PrintBatchRecord[]> {
  const bal_rows = await bal_get_all_by_index<PrintBatchRecord>(
    'printBatches',
    'projectId',
    bal_project_id
  );
  return bal_rows.sort((bal_a, bal_b) => bal_b.createdAt - bal_a.createdAt);
}

export async function lichu_batch(bal_id: string): Promise<void> {
  await bal_delete_keys('printBatches', [bal_id]);
}

export async function bal_save_batch_with_layout(
  bal_batch: PrintBatchRecord,
  bal_layout: PrintLayoutRecord
): Promise<void> {
  await bal_run_tx(['printLayouts', 'printBatches'], 'readwrite', (bal_tx) => {
    bal_tx.objectStore('printLayouts').put(bal_layout);
    bal_tx.objectStore('printBatches').put(bal_batch);
  });
}
