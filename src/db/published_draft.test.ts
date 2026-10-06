import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { bal_save_questionnaire, dhon_questionnaire_by_project, ken_pori_questionnaires } from './questionnaires_repo';
import { bal_save_project } from './projects_repo';
import { builder_state } from '../features/builder/builder_state';
import type { ProjectRecord, QuestionnaireRecord } from '../models/types';

function bal_published_q(): QuestionnaireRecord {
  const bal_now = 1700000000000;
  return {
    id: 'q-pub-1',
    projectId: 'proj-pub',
    title: 'Published probe',
    description: null,
    version: 3,
    language: 'en',
    paperSize: 'a4',
    orientation: 'portrait',
    theme: null,
    status: 'published',
    metadata: null,
    printSettings: null,
    sections: [],
    createdAt: bal_now,
    updatedAt: bal_now
  };
}

describe('builder published guard', () => {
  beforeEach(async () => {
    indexedDB = new IDBFactory();
    const bal_project: ProjectRecord = {
      id: 'proj-pub',
      title: 'Pub project',
      description: '',
      status: 'active',
      createdAt: 1,
      updatedAt: 1
    };
    await bal_save_project(bal_project);
  });

  it('derives a new draft instead of editing a published version', async () => {
    await bal_save_questionnaire(bal_published_q());
    await builder_state.load('proj-pub');
    const bal_state = builder_state.current();
    expect(bal_state.status).toBe('ready');
    expect(bal_state.questionnaire?.status).toBe('draft');
    expect(bal_state.questionnaire?.version).toBe(4);
    expect(bal_state.questionnaire?.id).not.toBe('q-pub-1');
    const bal_rows = await ken_pori_questionnaires();
    expect(bal_rows).toHaveLength(2);
    const bal_published = bal_rows.find((bal_r) => bal_r.status === 'published');
    expect(bal_published?.version).toBe(3);
    expect(bal_published?.sections).toEqual([]);
    await builder_state.load('proj-pub');
    expect(await ken_pori_questionnaires()).toHaveLength(2);
    expect(await dhon_questionnaire_by_project('proj-pub')).toMatchObject({ status: 'draft' });
  });
});
