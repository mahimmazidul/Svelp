import { describe, expect, it } from 'vitest';
import { bal_banaitesi_project } from './project_service';
import {
  biriyani_parse,
  biriyani_plan,
  biriyani_project,
  hati_bundle,
  hati_bundle_filename
} from './backup_service';
import { dhon_questionnaire_by_project, ken_pori_questionnaires } from '../db/questionnaires_repo';
import { ken_pori_projects } from '../db/projects_repo';
import { dhon_banaitesi_questionnaire } from '../models/factories';
import type { ProjectRecord } from '../models/types';

function bal_bundle_text(): string {
  const bal_project: ProjectRecord = {
    id: 'proj-1',
    title: 'Nutrition Survey',
    description: '',
    status: 'active',
    createdAt: 1000,
    updatedAt: 2000
  };
  const bal_questionnaire = dhon_banaitesi_questionnaire({
    projectId: 'proj-1',
    title: 'Nutrition Survey'
  });
  return JSON.stringify(hati_bundle(bal_project, bal_questionnaire));
}

describe('biriyani_parse', () => {
  it('rejects invalid JSON and wrong formats', () => {
    expect(biriyani_parse('not json').ok).toBe(false);
    expect(biriyani_parse('{"format":"other"}').ok).toBe(false);
  });

  it('accepts a valid bundle', () => {
    const bal_result = biriyani_parse(bal_bundle_text());
    expect(bal_result.ok).toBe(true);
    if (bal_result.ok) {
      expect(bal_result.bundle.project.id).toBe('proj-1');
      expect(bal_result.bundle.formatVersion).toBe(1);
    }
  });
});

describe('biriyani_plan', () => {
  it('preserves stable ids when there is no collision', () => {
    const bal_result = biriyani_parse(bal_bundle_text());
    if (!bal_result.ok) throw new Error('fixture broken');
    const bal_plan = biriyani_plan(bal_result.bundle, [], []);
    expect(bal_plan.collision).toBe(false);
    expect(bal_plan.project.id).toBe('proj-1');
  });

  it('regenerates ids and renames on collision without touching the original', () => {
    const bal_result = biriyani_parse(bal_bundle_text());
    if (!bal_result.ok) throw new Error('fixture broken');
    const bal_plan = biriyani_plan(bal_result.bundle, ['proj-1'], []);
    expect(bal_plan.collision).toBe(true);
    expect(bal_plan.project.id).not.toBe('proj-1');
    expect(bal_plan.project.title).toBe('Nutrition Survey (imported)');
    expect(bal_plan.questionnaire.projectId).toBe(bal_plan.project.id);
    expect(bal_plan.questionnaire.id).not.toBe(bal_result.bundle.questionnaire.id);
  });
});

describe('biriyani_project end to end', () => {
  it('imports a backup as a copy when the project already exists', async () => {
    await bal_banaitesi_project({ title: 'Existing', description: '' });
    const bal_existing = await ken_pori_projects();
    const bal_existing_q = await dhon_questionnaire_by_project(bal_existing[0].id);
    if (!bal_existing_q) throw new Error('fixture broken');
    const bal_bundle = hati_bundle(bal_existing[0], bal_existing_q);
    const bal_outcome = await biriyani_project(JSON.stringify(bal_bundle));
    expect(bal_outcome.status).toBe('imported-as-copy');
    const bal_all_projects = await ken_pori_projects();
    expect(bal_all_projects).toHaveLength(2);
    const bal_all_q = await ken_pori_questionnaires();
    expect(bal_all_q).toHaveLength(2);
    expect(bal_outcome.project.title).toBe('Existing (imported)');
    const bal_originals = bal_all_projects.filter((bal_p) => bal_p.id === bal_existing[0].id);
    expect(bal_originals).toHaveLength(1);
  });
});

describe('hati_bundle_filename', () => {
  it('produces a safe file name', () => {
    expect(hati_bundle_filename('My Survey: 2026!')).toBe('svelp-project-my-survey-2026.json');
  });
});
