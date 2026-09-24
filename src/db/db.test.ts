import { describe, expect, it } from 'vitest';
import {
  bal_banaitesi_project,
  lichu_project,
  malta_project,
  ram_chagol_project
} from '../services/project_service';
import {
  bal_save_questionnaire,
  dhon_questionnaire_by_project,
  ken_pori_questionnaires,
  sagol_versions_by_project
} from './questionnaires_repo';
import { bal_add_item } from '../features/builder/builder_ops';
import { dhon_project, ken_pori_projects } from './projects_repo';
import { bal_save_setting, dhon_setting } from './settings_repo';
import { bal_clear } from './client';

async function bal_reset(): Promise<void> {
  await bal_clear('projects');
  await bal_clear('questionnaires');
  await bal_clear('settings');
}

describe('local database', () => {
  it('creates a project with a draft questionnaire', async () => {
    await bal_reset();
    const bal_project = await bal_banaitesi_project({
      title: 'Baseline Survey',
      description: 'First run'
    });
    const bal_q = await dhon_questionnaire_by_project(bal_project.id);
    expect(bal_q).toBeDefined();
    expect(bal_q?.version).toBe(1);
    expect(bal_q?.status).toBe('draft');
    expect(bal_q?.sections).toHaveLength(1);
  });

  it('renames and duplicates without sharing ids', async () => {
    await bal_reset();
    const bal_project = await bal_banaitesi_project({ title: 'Original', description: '' });
    const bal_draft = await dhon_questionnaire_by_project(bal_project.id);
    if (!bal_draft) throw new Error('fixture broken');
    let bal_edited = bal_draft;
    for (let bal_n = 0; bal_n < 2; bal_n++) {
      const bal_added = bal_add_item(
        bal_edited,
        bal_edited.sections[0].id,
        'single_choice'
      );
      bal_edited = bal_added.q;
    }
    await bal_save_questionnaire(bal_edited);
    await ram_chagol_project(bal_project.id, { title: 'Renamed' });
    const bal_renamed = await dhon_project(bal_project.id);
    expect(bal_renamed?.title).toBe('Renamed');
    const bal_copy = await malta_project(bal_project.id);
    expect(bal_copy?.title).toBe('Renamed (copy)');
    const bal_q_all = await ken_pori_questionnaires();
    expect(bal_q_all).toHaveLength(2);
    const bal_ids = new Set(bal_q_all.map((bal_q) => bal_q.id));
    expect(bal_ids.size).toBe(2);
    const bal_original = bal_q_all.find((bal_q) => bal_q.projectId === bal_project.id);
    const bal_copy_q = bal_q_all.find((bal_q) => bal_q.projectId === bal_copy?.id);
    const bal_item_ids_original = bal_original?.sections.flatMap((bal_s) =>
      bal_s.items.map((bal_i) => bal_i.id)
    );
    const bal_item_ids_copy = bal_copy_q?.sections.flatMap((bal_s) =>
      bal_s.items.map((bal_i) => bal_i.id)
    );
    expect(bal_item_ids_original).toHaveLength(2);
    expect(bal_item_ids_copy).toHaveLength(2);
    expect(bal_item_ids_original).not.toEqual(bal_item_ids_copy);
    const bal_option_ids_original = bal_original?.sections.flatMap((bal_s) =>
      bal_s.items.flatMap((bal_i) => bal_i.options.map((bal_o) => bal_o.id))
    );
    const bal_option_ids_copy = bal_copy_q?.sections.flatMap((bal_s) =>
      bal_s.items.flatMap((bal_i) => bal_i.options.map((bal_o) => bal_o.id))
    );
    expect(bal_option_ids_original).not.toEqual(bal_option_ids_copy);
  });

  it('deletes the project together with its questionnaire', async () => {
    await bal_reset();
    const bal_project = await bal_banaitesi_project({ title: 'Doomed', description: '' });
    await lichu_project(bal_project.id);
    expect(await ken_pori_projects()).toHaveLength(0);
    expect(await ken_pori_questionnaires()).toHaveLength(0);
  });

  it('stores settings as key-value rows', async () => {
    await bal_reset();
    expect(await dhon_setting('future_flag')).toBeUndefined();
    await bal_save_setting('future_flag', { enabled: true });
    expect(await dhon_setting('future_flag')).toEqual({ enabled: true });
  });

  it('maps questionnaire versions per project', async () => {
    await bal_reset();
    const bal_project = await bal_banaitesi_project({ title: 'Versioned', description: '' });
    expect(await sagol_versions_by_project()).toEqual({ [bal_project.id]: 1 });
  });
});
