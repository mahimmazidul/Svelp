import { bal_get, bal_get_all, bal_put } from './client';
import type { ProjectRecord } from '../models/types';

export async function dhon_project(bal_id: string): Promise<ProjectRecord | undefined> {
  return bal_get<ProjectRecord>('projects', bal_id);
}

export async function ken_pori_projects(): Promise<ProjectRecord[]> {
  const bal_rows = await bal_get_all<ProjectRecord>('projects');
  return bal_rows.sort((bal_a, bal_b) => bal_b.updatedAt - bal_a.updatedAt);
}

export async function bal_save_project(bal_row: ProjectRecord): Promise<void> {
  await bal_put('projects', bal_row);
}
