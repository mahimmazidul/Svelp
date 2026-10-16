import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { builder_state, bal_save_error_text } from './builder_state';
import { bal_clear } from '../../db/client';
import { bal_save_project } from '../../db/projects_repo';
import { bal_save_questionnaire } from '../../db/questionnaires_repo';
import { dhon_banaitesi_questionnaire, dhon_banaitesi_item } from '../../models/factories';
import { bal_source_apply_plan } from '../source/bal_source_pipeline';
import type { ProjectRecord, QuestionnaireRecord } from '../../models/types';

const bal_fail = vi.hoisted(() => ({ puts: 0, scale_puts: 0 }));

vi.mock('../../db/questionnaires_repo', async (bal_import_original) => {
  const bal_original = await bal_import_original<typeof import('../../db/questionnaires_repo')>();
  return {
    ...bal_original,
    async bal_save_questionnaire(bal_row: QuestionnaireRecord): Promise<void> {
      if (bal_fail.puts > 0) {
        bal_fail.puts -= 1;
        throw new DOMException('injected clone failure', 'DataCloneError');
      }
      return bal_original.bal_save_questionnaire(bal_row);
    }
  };
});

vi.mock('../../db/scales_repo', async (bal_import_original) => {
  const bal_original = await bal_import_original<typeof import('../../db/scales_repo')>();
  return {
    ...bal_original,
    async bal_save_scale(bal_row: unknown): Promise<void> {
      if (bal_fail.scale_puts > 0) {
        bal_fail.scale_puts -= 1;
        throw new TypeError('injected scale failure');
      }
      return bal_original.bal_save_scale(bal_row as never);
    }
  };
});

async function bal_stored_row(bal_project_id: string): Promise<QuestionnaireRecord | undefined> {
  const { dhon_questionnaire_by_project } = await import('../../db/questionnaires_repo');
  return dhon_questionnaire_by_project(bal_project_id);
}

async function bal_seed(): Promise<{ bal_project_id: string; bal_questionnaire: QuestionnaireRecord }> {
  const bal_project_id = 'proj-save-test';
  const bal_project: ProjectRecord = {
    id: bal_project_id,
    title: 'Save State Probe',
    description: '',
    status: 'active',
    createdAt: 1,
    updatedAt: 1
  };
  await bal_save_project(bal_project);
  const bal_questionnaire = dhon_banaitesi_questionnaire({ projectId: bal_project_id, title: 'Probe survey' });
  await bal_save_questionnaire(bal_questionnaire);
  return { bal_project_id, bal_questionnaire };
}

function bal_with_one_item(bal_questionnaire: QuestionnaireRecord): QuestionnaireRecord {
  const bal_item = dhon_banaitesi_item('single_choice', 'probe_sex');
  bal_item.label = 'Probe sex';
  bal_item.options = [
    { id: 'opt-a', label: 'Male', coding: '1' },
    { id: 'opt-b', label: 'Female', coding: '2' }
  ];
  return {
    ...bal_questionnaire,
    sections: [
      {
        id: 'sec-1',
        type: 'section',
        title: 'Probe section',
        description: null,
        printConfig: null,
        metadata: null,
        items: [bal_item]
      }
    ]
  } as QuestionnaireRecord;
}

function bal_proxied(bal_questionnaire: QuestionnaireRecord): QuestionnaireRecord {
  const bal_sections: QuestionnaireRecord['sections'] = new Proxy(bal_questionnaire.sections, {});
  return { ...bal_questionnaire, sections: bal_sections };
}

describe('builder_state save reliability', () => {
  beforeEach(async () => {
    bal_fail.puts = 0;
    bal_fail.scale_puts = 0;
    await bal_clear('projects');
    await bal_clear('questionnaires');
    await bal_clear('responseScales');
    builder_state.reset_for_tests();
  });

  it('persists an applied questionnaire and reports saved', async () => {
    const { bal_project_id, bal_questionnaire } = await bal_seed();
    await builder_state.load(bal_project_id);
    builder_state.apply_source(bal_with_one_item(bal_questionnaire), []);
    expect(builder_state.current().saveStatus).toBe('dirty');
    await builder_state.flush();
    const bal_state = builder_state.current();
    expect(bal_state.saveStatus).toBe('saved');
    expect(bal_state.saveError).toBeNull();
    expect((await bal_stored_row(bal_project_id))?.sections[0]?.items.length).toBe(1);
  });

  it('deep-clones proxied questionnaire graphs so persistence cannot hit DataCloneError', async () => {
    const { bal_project_id, bal_questionnaire } = await bal_seed();
    await builder_state.load(bal_project_id);
    builder_state.apply_source(bal_proxied(bal_with_one_item(bal_questionnaire)), []);
    await builder_state.flush();
    const bal_state = builder_state.current();
    expect(bal_state.saveStatus).toBe('saved');
    expect(bal_state.saveError).toBeNull();
    const bal_stored = await bal_stored_row(bal_project_id);
    expect(() => structuredClone(bal_stored)).not.toThrow();
    expect(bal_stored?.sections[0]?.items.length).toBe(1);
  });

  it('keeps the previous stored questionnaire and exposes the root error when persistence fails', async () => {
    const { bal_project_id, bal_questionnaire } = await bal_seed();
    await builder_state.load(bal_project_id);
    bal_fail.puts = 1;
    builder_state.apply_source(bal_with_one_item(bal_questionnaire), []);
    await builder_state.flush();
    const bal_state = builder_state.current();
    expect(bal_state.saveStatus).toBe('error');
    expect(bal_state.saveError).toContain('DataCloneError');
    expect(bal_state.saveError).toContain('Stage: questionnaire persistence');
    expect(bal_state.saveError).toContain(bal_questionnaire.id);
    const bal_stored = await bal_stored_row(bal_project_id);
    expect(bal_stored?.sections[0]?.items.length).toBe(0);
    expect(bal_stored?.title).toBe('Probe survey');
  });

  it('succeeds on retry after a save failure and clears the error', async () => {
    const { bal_project_id, bal_questionnaire } = await bal_seed();
    await builder_state.load(bal_project_id);
    bal_fail.puts = 1;
    builder_state.apply_source(bal_with_one_item(bal_questionnaire), []);
    await builder_state.flush();
    expect(builder_state.current().saveStatus).toBe('error');
    builder_state.apply_source(bal_with_one_item(bal_questionnaire), []);
    await builder_state.flush();
    const bal_state = builder_state.current();
    expect(bal_state.saveStatus).toBe('saved');
    expect(bal_state.saveError).toBeNull();
    expect((await bal_stored_row(bal_project_id))?.sections[0]?.items.length).toBe(1);
  });

  it('reports scale persistence failures with their own stage', async () => {
    const { bal_project_id, bal_questionnaire } = await bal_seed();
    await builder_state.load(bal_project_id);
    bal_fail.scale_puts = 1;
    const bal_scale = {
      id: 'scale-probe',
      name: 'probe_scale',
      options: [{ id: 'po1', label: 'Often', coding: '1' }],
      createdAt: 1,
      updatedAt: 1
    };
    builder_state.apply_source(bal_with_one_item(bal_questionnaire), [bal_scale as never]);
    await builder_state.flush();
    const bal_state = builder_state.current();
    expect(bal_state.saveStatus).toBe('error');
    expect(bal_state.saveError).toContain('Stage: scale persistence');
    expect(bal_state.saveError).toContain('TypeError: injected scale failure');
    void bal_project_id;
  });

  it('keeps parser validity distinct from persistence state', async () => {
    const { bal_project_id, bal_questionnaire } = await bal_seed();
    await builder_state.load(bal_project_id);
    bal_fail.puts = 1;
    builder_state.apply_source(bal_with_one_item(bal_questionnaire), []);
    await builder_state.flush();
    const bal_source = [
      'svelp 1',
      '',
      'title "Test Survey"',
      '',
      'section background "Background"',
      'description "A short test survey."'
    ].join('\n');
    const bal_outcome = bal_source_apply_plan(bal_source, builder_state.current().questionnaire, [], new Set());
    expect(bal_outcome.ok).toBe(true);
    expect(builder_state.current().saveStatus).toBe('error');
  });

  it('never produces an apply plan for invalid source', () => {
    const bal_bad = 'svelp 1\n\ntitle "Broken"\n\nsingle broken "Pick"\noption a "A" code 1\noption b "B" code 1\n';
    const bal_outcome = bal_source_apply_plan(bal_bad, null, [], new Set());
    expect(bal_outcome.ok).toBe(false);
    expect(bal_outcome.applyPlan).toBeNull();
    expect(bal_outcome.problems.errors.some((bal_e) => bal_e.message.includes('Duplicate code'))).toBe(true);
  });

  it('formats save errors with name, cause, stage, and ids', () => {
    const bal_text = bal_save_error_text(
      new DOMException('no space', 'QuotaExceededError'),
      'questionnaire persistence',
      'q-1',
      'p-1'
    );
    expect(bal_text).toContain('Error: Failed to save questionnaire');
    expect(bal_text).toContain('Cause: QuotaExceededError: no space');
    expect(bal_text).toContain('Stage: questionnaire persistence');
    expect(bal_text).toContain('Questionnaire: q-1');
    expect(bal_text).toContain('Project: p-1');
  });
});
