import { writable } from 'svelte/store';
import { dhon_project } from '../db/projects_repo';
import type { ProjectRecord } from '../models/types';

export interface ProjectContext {
  status: 'idle' | 'loading' | 'ready' | 'not-found' | 'error';
  project: ProjectRecord | null;
}

const bal_store = writable<ProjectContext>({ status: 'idle', project: null });

export const project_context = {
  subscribe: bal_store.subscribe,
  async load(bal_project_id: string): Promise<void> {
    bal_store.set({ status: 'loading', project: null });
    try {
      const bal_row = await dhon_project(bal_project_id);
      if (bal_row) {
        bal_store.set({ status: 'ready', project: bal_row });
      } else {
        bal_store.set({ status: 'not-found', project: null });
      }
    } catch {
      bal_store.set({ status: 'error', project: null });
    }
  }
};
