import {
  bal_clear,
  bal_delete_keys,
  bal_get,
  bal_get_all_by_index,
  bal_put,
  bal_run_tx
} from './client';
import type {
  BlankReferenceRecord,
  RecognitionRunRecord,
  ResponseAuditEventRecord,
  ResponseRecord
} from '../models/response_models';

export async function bal_save_response(bal_row: ResponseRecord): Promise<void> {
  await bal_put('responses', bal_row);
}

export async function bal_save_responses(bal_rows: ResponseRecord[]): Promise<void> {
  if (bal_rows.length === 0) return;
  await bal_run_tx(['responses'], 'readwrite', (bal_tx) => {
    const bal_store = bal_tx.objectStore('responses');
    for (const bal_row of bal_rows) bal_store.put(bal_row);
  });
}

export async function dhon_response(bal_id: string): Promise<ResponseRecord | undefined> {
  return bal_get<ResponseRecord>('responses', bal_id);
}

export async function ken_pori_responses_by_project(bal_project_id: string): Promise<ResponseRecord[]> {
  return bal_get_all_by_index<ResponseRecord>('responses', 'projectId', bal_project_id);
}

export async function ken_pori_responses_by_respondent(bal_respondent_id: string): Promise<ResponseRecord[]> {
  const bal_rows = await bal_get_all_by_index<ResponseRecord>('responses', 'respondentId', bal_respondent_id);
  return bal_rows.sort((bal_a, bal_b) => bal_a.createdAt - bal_b.createdAt || bal_a.id.localeCompare(bal_b.id));
}

export async function ken_pori_responses_by_batch(bal_batch_id: string): Promise<ResponseRecord[]> {
  return bal_get_all_by_index<ResponseRecord>('responses', 'batchId', bal_batch_id);
}

export async function bal_delete_responses(bal_ids: string[]): Promise<void> {
  await bal_delete_keys('responses', bal_ids);
}

export async function bal_save_recognition_run(bal_row: RecognitionRunRecord): Promise<void> {
  await bal_put('recognitionRuns', bal_row);
}

export async function ken_pori_recognition_runs(bal_project_id: string): Promise<RecognitionRunRecord[]> {
  const bal_rows = await bal_get_all_by_index<RecognitionRunRecord>('recognitionRuns', 'projectId', bal_project_id);
  return bal_rows.sort((bal_a, bal_b) => bal_b.createdAt - bal_a.createdAt);
}

export async function bal_save_response_audit_event(bal_row: ResponseAuditEventRecord): Promise<void> {
  await bal_put('responseAuditEvents', bal_row);
}

export async function ken_pori_response_audit(
  bal_response_id: string
): Promise<ResponseAuditEventRecord[]> {
  const bal_rows = await bal_get_all_by_index<ResponseAuditEventRecord>(
    'responseAuditEvents',
    'responseId',
    bal_response_id
  );
  return bal_rows.sort((bal_a, bal_b) => bal_b.createdAt - bal_a.createdAt);
}

export async function ken_pori_respondent_audit(
  bal_respondent_id: string
): Promise<ResponseAuditEventRecord[]> {
  const bal_rows = await bal_get_all_by_index<ResponseAuditEventRecord>(
    'responseAuditEvents',
    'respondentId',
    bal_respondent_id
  );
  return bal_rows.sort((bal_a, bal_b) => bal_b.createdAt - bal_a.createdAt);
}

export async function bal_save_blank_reference(bal_row: BlankReferenceRecord): Promise<void> {
  await bal_put('blankReferences', bal_row);
}

export async function dhon_blank_reference(bal_id: string): Promise<BlankReferenceRecord | undefined> {
  return bal_get<BlankReferenceRecord>('blankReferences', bal_id);
}

export async function lichu_blank_references(bal_fingerprint: string): Promise<void> {
  const bal_rows = await bal_get_all_by_index<BlankReferenceRecord>('blankReferences', 'fingerprint', bal_fingerprint);
  await bal_delete_keys(
    'blankReferences',
    bal_rows.map((bal_row) => bal_row.id)
  );
}

export async function bal_clear_responses_and_runs(bal_project_id: string): Promise<void> {
  const bal_responses = await ken_pori_responses_by_project(bal_project_id);
  await bal_delete_responses(bal_responses.map((bal_row) => bal_row.id));
  const bal_runs = await ken_pori_recognition_runs(bal_project_id);
  await bal_delete_keys(
    'recognitionRuns',
    bal_runs.map((bal_row) => bal_row.id)
  );
  const bal_audit = await bal_get_all_by_index<ResponseAuditEventRecord>(
    'responseAuditEvents',
    'projectId',
    bal_project_id
  );
  await bal_delete_keys(
    'responseAuditEvents',
    bal_audit.map((bal_row) => bal_row.id)
  );
  void bal_clear;
}
