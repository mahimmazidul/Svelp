import {
  bal_delete_keys,
  bal_get,
  bal_get_all,
  bal_get_all_by_index,
  bal_put,
  bal_run_tx
} from './client';
import type { QuestionnaireRecord } from '../models/types';

export async function dhon_questionnaire(
  bal_id: string
): Promise<QuestionnaireRecord | undefined> {
  return bal_get<QuestionnaireRecord>('questionnaires', bal_id);
}

export async function ken_pori_questionnaires(): Promise<QuestionnaireRecord[]> {
  return bal_get_all<QuestionnaireRecord>('questionnaires');
}

export async function dhon_questionnaire_by_project(
  bal_project_id: string
): Promise<QuestionnaireRecord | undefined> {
  const bal_rows = await bal_get_all_by_index<QuestionnaireRecord>(
    'questionnaires',
    'projectId',
    bal_project_id
  );
  return bal_rows.sort((bal_a, bal_b) => bal_b.version - bal_a.version)[0];
}

export async function bal_save_questionnaire(bal_row: QuestionnaireRecord): Promise<void> {
  await bal_put('questionnaires', bal_row);
}

export async function bal_save_questionnaire_pair(
  bal_questionnaire: QuestionnaireRecord
): Promise<void> {
  await bal_run_tx(['questionnaires'], 'readwrite', (bal_tx) => {
    bal_tx.objectStore('questionnaires').put(bal_questionnaire);
  });
}

export async function lichu_questionnaires(bal_ids: string[]): Promise<void> {
  await bal_delete_keys('questionnaires', bal_ids);
}

export async function sagol_versions_by_project(): Promise<Record<string, number>> {
  const bal_rows = await ken_pori_questionnaires();
  const bal_map: Record<string, number> = {};
  for (const bal_row of bal_rows) {
    bal_map[bal_row.projectId] = bal_row.version;
  }
  return bal_map;
}
