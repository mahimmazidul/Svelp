import { beforeEach, describe, expect, it } from 'vitest';
import {
  bal_banaitesi_scale,
  ken_pori_scale_usage_report,
  lichu_scale_detaching,
  malta_scale,
  ram_chagol_scale,
  bal_scale_ids_of_questionnaire,
  bal_scales_for_bundle
} from './scale_service';
import { bal_banaitesi_project } from './project_service';
import { dhon_questionnaire_by_project, bal_save_questionnaire } from '../db/questionnaires_repo';
import { ken_pori_scales } from '../db/scales_repo';
import {
  bal_add_item,
  komola_assign_scale
} from '../features/builder/builder_ops';
import { normalize_questionnaire } from '../models/factories';
import { bal_clear } from '../db/client';

async function bal_reset(): Promise<void> {
  await bal_clear('projects');
  await bal_clear('questionnaires');
  await bal_clear('responseScales');
  await bal_clear('settings');
}

describe('response scales', () => {
  beforeEach(async () => {
    await bal_reset();
  });

  it('creates, renames, and duplicates scales', async () => {
    const bal_scale = await bal_banaitesi_scale('FFQ Frequency');
    expect(bal_scale.name).toBe('FFQ Frequency');
    expect(bal_scale.options.length).toBeGreaterThanOrEqual(2);

    await ram_chagol_scale(bal_scale.id, { name: 'Food frequency' });
    const bal_renamed = (await ken_pori_scales()).find((bal_s) => bal_s.id === bal_scale.id);
    expect(bal_renamed?.name).toBe('Food frequency');

    const bal_copy = await malta_scale(bal_scale.id);
    expect(bal_copy?.name).toBe('Food frequency (copy)');
    expect(bal_copy?.id).not.toBe(bal_scale.id);
    const bal_all = await ken_pori_scales();
    expect(bal_all).toHaveLength(2);
  });

  it('reports usage across questionnaires', async () => {
    const bal_scale = await bal_banaitesi_scale('Agreement');
    const bal_project = await bal_banaitesi_project({ title: 'P', description: '' });
    const bal_q_raw = await dhon_questionnaire_by_project(bal_project.id);
    if (!bal_q_raw) throw new Error('fixture broken');
    let bal_q = normalize_questionnaire(bal_q_raw);
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'single_choice');
    bal_q = bal_added.q;
    bal_q = komola_assign_scale(bal_q, bal_added.itemId as string, bal_scale.id);
    await bal_save_questionnaire(bal_q);

    const bal_report = await ken_pori_scale_usage_report();
    const bal_entry = bal_report.get(bal_scale.id);
    expect(bal_entry?.questions).toBe(1);
    expect(bal_entry?.questionnaires).toBe(1);
  });

  it('detaches referencing questions with a snapshot when deleted', async () => {
    const bal_scale = await bal_banaitesi_scale('Frequency');
    await ram_chagol_scale(bal_scale.id, {
      options: [
        { id: 'o1', label: 'Never', coding: '0' },
        { id: 'o2', label: 'Daily', coding: '3' }
      ]
    });
    const bal_project = await bal_banaitesi_project({ title: 'P', description: '' });
    const bal_q_raw = await dhon_questionnaire_by_project(bal_project.id);
    if (!bal_q_raw) throw new Error('fixture broken');
    let bal_q = normalize_questionnaire(bal_q_raw);
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'single_choice');
    bal_q = bal_added.q;
    bal_q = komola_assign_scale(bal_q, bal_added.itemId as string, bal_scale.id);
    await bal_save_questionnaire(bal_q);

    const bal_detached = await lichu_scale_detaching(bal_scale.id);
    expect(bal_detached).toBe(1);
    expect(await ken_pori_scales()).toHaveLength(0);

    const bal_after = await dhon_questionnaire_by_project(bal_project.id);
    const bal_after_item = bal_after?.sections[0].items[0];
    expect(bal_after_item?.scaleId).toBeNull();
    expect(bal_after_item?.options.map((bal_o) => bal_o.label)).toEqual(['Never', 'Daily']);
    expect(bal_after_item?.options.map((bal_o) => bal_o.coding)).toEqual(['0', '3']);
  });

  it('collects scale ids for bundle export', async () => {
    const bal_scale_a = await bal_banaitesi_scale('A');
    const bal_scale_b = await bal_banaitesi_scale('B');
    const bal_project = await bal_banaitesi_project({ title: 'P', description: '' });
    const bal_q_raw = await dhon_questionnaire_by_project(bal_project.id);
    if (!bal_q_raw) throw new Error('fixture broken');
    let bal_q = normalize_questionnaire(bal_q_raw);
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'single_choice');
    bal_q = bal_added.q;
    bal_q = komola_assign_scale(bal_q, bal_added.itemId as string, bal_scale_a.id);
    await bal_save_questionnaire(bal_q);

    const bal_ids = bal_scale_ids_of_questionnaire(bal_q);
    expect(bal_ids).toEqual([bal_scale_a.id]);
    const bal_bundle_scales = await bal_scales_for_bundle(bal_ids);
    expect(bal_bundle_scales.map((bal_s) => bal_s.id)).toEqual([bal_scale_a.id]);
    expect(bal_bundle_scales.map((bal_s) => bal_s.id)).not.toContain(bal_scale_b.id);
  });
});
