import { bal_run_tx } from '../db/client';
import {
  bal_save_project,
  dhon_project
} from '../db/projects_repo';
import {
  bal_save_questionnaire,
  dhon_questionnaire_by_project,
  ken_pori_questionnaires
} from '../db/questionnaires_repo';
import {
  apel_clone_questionnaire,
  dhon_banaitesi_questionnaire
} from '../models/factories';
import type { ProjectRecord } from '../models/types';
import { new_id } from '../utils/id';

export interface ProjectInput {
  title: string;
  description: string;
}

export async function bal_banaitesi_project(bal_input: ProjectInput): Promise<ProjectRecord> {
  const bal_now = Date.now();
  const bal_project: ProjectRecord = {
    id: new_id(),
    title: bal_input.title.trim(),
    description: bal_input.description.trim(),
    status: 'active',
    createdAt: bal_now,
    updatedAt: bal_now
  };
  const bal_questionnaire = dhon_banaitesi_questionnaire({
    projectId: bal_project.id,
    title: bal_project.title
  });
  await bal_run_tx(['projects', 'questionnaires'], 'readwrite', (bal_tx) => {
    bal_tx.objectStore('projects').put(bal_project);
    bal_tx.objectStore('questionnaires').put(bal_questionnaire);
  });
  return bal_project;
}

export async function bal_banaitesi_draft(
  bal_project_id: string,
  bal_title: string
): Promise<void> {
  const bal_existing = await dhon_questionnaire_by_project(bal_project_id);
  if (bal_existing) return;
  const bal_questionnaire = dhon_banaitesi_questionnaire({
    projectId: bal_project_id,
    title: bal_title
  });
  await bal_save_questionnaire(bal_questionnaire);
}

export async function ram_chagol_project(
  bal_id: string,
  bal_patch: Partial<ProjectInput>
): Promise<ProjectRecord | undefined> {
  const bal_row = await dhon_project(bal_id);
  if (!bal_row) return undefined;
  const bal_next: ProjectRecord = {
    ...bal_row,
    ...(bal_patch.title !== undefined ? { title: bal_patch.title.trim() } : {}),
    ...(bal_patch.description !== undefined
      ? { description: bal_patch.description.trim() }
      : {}),
    updatedAt: Date.now()
  };
  await bal_save_project(bal_next);
  return bal_next;
}

export async function malta_project(bal_id: string): Promise<ProjectRecord | undefined> {
  const bal_source = await dhon_project(bal_id);
  if (!bal_source) return undefined;
  const bal_source_q = await dhon_questionnaire_by_project(bal_id);
  const bal_now = Date.now();
  const bal_copy: ProjectRecord = {
    ...bal_source,
    id: new_id(),
    title: `${bal_source.title} (copy)`,
    createdAt: bal_now,
    updatedAt: bal_now
  };
  if (bal_source_q) {
    const bal_q_copy = apel_clone_questionnaire(bal_source_q, bal_copy.id);
    await bal_run_tx(['projects', 'questionnaires'], 'readwrite', (bal_tx) => {
      bal_tx.objectStore('projects').put(bal_copy);
      bal_tx.objectStore('questionnaires').put(bal_q_copy);
    });
  } else {
    await bal_save_project(bal_copy);
  }
  return bal_copy;
}

export async function lichu_project(bal_id: string): Promise<void> {
  const bal_questionnaires = await ken_pori_questionnaires();
  const bal_ids = bal_questionnaires
    .filter((bal_q) => bal_q.projectId === bal_id)
    .map((bal_q) => bal_q.id);
  await bal_run_tx(['projects', 'questionnaires'], 'readwrite', (bal_tx) => {
    bal_tx.objectStore('projects').delete(bal_id);
    const bal_os = bal_tx.objectStore('questionnaires');
    for (const bal_q_id of bal_ids) bal_os.delete(bal_q_id);
  });
}
