import { beforeEach, describe, expect, it } from 'vitest';
import { bal_banaitesi_project } from './project_service';
import { hati_bundle, biriyani_project } from './backup_service';
import {
  bal_scale_ids_of_questionnaire,
  bal_scales_for_bundle
} from './scale_service';
import {
  bal_save_questionnaire,
  dhon_questionnaire_by_project
} from '../db/questionnaires_repo';
import { ken_pori_scales } from '../db/scales_repo';
import { dhon_project, ken_pori_projects } from '../db/projects_repo';
import { bal_clear } from '../db/client';
import { normalize_questionnaire } from '../models/factories';
import {
  bal_paste_matrix_columns,
  bal_paste_matrix_rows,
  bal_add_item,
  ram_chagol_selection_mode,
  dhon_update_item
} from '../features/builder/builder_ops';
import type { ResponseScaleRecord } from '../models/types';

async function bal_reset(): Promise<void> {
  await bal_clear('projects');
  await bal_clear('questionnaires');
  await bal_clear('responseScales');
  await bal_clear('settings');
}

describe('bundle round trip', () => {
  beforeEach(async () => {
    await bal_reset();
  });

  it('preserves matrix, scale, consent, coding, and validation exactly', async () => {
    const bal_ffq = await bal_banaitesi_scale_fixture();
    const bal_project = await bal_banaitesi_project({ title: 'FFQ Study', description: 'd' });
    const bal_q_raw = await dhon_questionnaire_by_project(bal_project.id);
    if (!bal_q_raw) throw new Error('fixture broken');
    let bal_q = normalize_questionnaire(bal_q_raw);
    const bal_section = bal_q.sections[0];

    const bal_matrix = bal_add_item(bal_q, bal_section.id, 'matrix');
    bal_q = bal_matrix.q;
    bal_q = dhon_update_item(bal_q, bal_matrix.itemId as string, {
      label: 'Food frequency',
      scaleId: bal_ffq.id,
      rows: [],
      columns: [],
      validation: { requireAllRows: true }
    });
    bal_q = bal_paste_matrix_rows(bal_q, bal_matrix.itemId as string, ['Rice', 'Fish']);
    bal_q = bal_paste_matrix_columns(bal_q, bal_matrix.itemId as string, ['Never', 'Weekly']);
    bal_q = bal_paste_matrix_columns(
      bal_q,
      bal_matrix.itemId as string,
      ['Daily']
    );
    bal_q = ram_chagol_selection_mode(bal_q, bal_matrix.itemId as string, 'multiple');

    const bal_consent = bal_add_item(bal_q, bal_section.id, 'consent');
    bal_q = bal_consent.q;
    bal_q = dhon_update_item(bal_q, bal_consent.itemId as string, {
      label: 'Consent',
      required: true,
      consent: {
        title: 'Informed consent',
        introduction: 'You are invited.',
        sections: [{ id: 'c1', kind: 'risks', title: 'Risks', body: 'Minimal.' }],
        acknowledgementLabel: 'I agree to participate.'
      }
    });

    const bal_choice = bal_add_item(bal_q, bal_section.id, 'single_choice');
    bal_q = bal_choice.q;
    bal_q = dhon_update_item(bal_q, bal_choice.itemId as string, {
      label: 'How often do you eat fish?',
      variableName: 'fish_frequency',
      scaleId: bal_ffq.id
    });

    const bal_number = bal_add_item(bal_q, bal_section.id, 'number');
    bal_q = bal_number.q;
    bal_q = dhon_update_item(bal_q, bal_number.itemId as string, {
      label: 'Age',
      variableName: 'age_years',
      unitLabel: 'years',
      validation: { min: 0, max: 120, step: 1, decimalAllowed: false }
    });
    await bal_save_questionnaire(bal_q);

    const bal_scale_ids = bal_scale_ids_of_questionnaire(bal_q);
    const bal_scales = await bal_scales_for_bundle(bal_scale_ids);
    const bal_project_row = await dhon_project(bal_project.id);
    if (!bal_project_row) throw new Error('fixture broken');
    const bal_bundle = hati_bundle(bal_project_row, bal_q, bal_scales);

    const bal_text = JSON.parse(JSON.stringify(bal_bundle));
    await bal_reset();
    expect(await ken_pori_projects()).toHaveLength(0);
    expect(await ken_pori_scales()).toHaveLength(0);

    const bal_outcome = await biriyani_project(JSON.stringify(bal_text));
    expect(bal_outcome.status).toBe('imported');

    const bal_restored_q_raw = await dhon_questionnaire_by_project(bal_outcome.project.id);
    if (!bal_restored_q_raw) throw new Error('restore broken');
    const bal_restored = normalize_questionnaire(bal_restored_q_raw);
    expect(bal_restored.id).toBe(bal_q.id);
    expect(bal_restored.sections).toEqual(bal_q.sections);

    const bal_restored_scales = await ken_pori_scales();
    expect(bal_restored_scales).toHaveLength(1);
    expect(bal_restored_scales[0].id).toBe('scale-ffq');
    expect(bal_restored_scales[0].options.map((bal_o) => bal_o.label)).toEqual([
      'Never',
      'Weekly',
      'Daily'
    ]);

    const bal_matrix_item = bal_restored.sections[0].items[0];
    expect(bal_matrix_item.type).toBe('matrix');
    expect(bal_matrix_item.rows.map((bal_r) => bal_r.label)).toEqual(['Rice', 'Fish']);
    expect(bal_matrix_item.columns.map((bal_c) => bal_c.label)).toEqual([
      'Never',
      'Weekly',
      'Daily'
    ]);
    expect(bal_matrix_item.selectionMode).toBe('multiple');
    expect(bal_matrix_item.scaleId).toBeNull();
    const bal_choice_item = bal_restored.sections[0].items[2];
    expect(bal_choice_item.scaleId).toBe('scale-ffq');
    const bal_consent_item = bal_restored.sections[0].items[1];
    expect(bal_consent_item.consent?.acknowledgementLabel).toBe('I agree to participate.');
    expect(bal_consent_item.consent?.sections[0].id).toBe('c1');
    const bal_number_item = bal_restored.sections[0].items[3];
    expect(bal_number_item.validation).toEqual({
      min: 0,
      max: 120,
      step: 1,
      decimalAllowed: false
    });
  });

  it('imports an existing scale id as a copy and remaps references', async () => {
    const bal_existing = await bal_banaitesi_scale_fixture();
    expect(bal_existing.id).toBe('scale-ffq');
    const bal_text = JSON.stringify({
      format: 'svelp.project',
      formatVersion: 2,
      exportedAt: '2026-01-01T00:00:00.000Z',
      project: {
        id: 'proj-x',
        title: 'Outside',
        description: '',
        status: 'active',
        createdAt: 1,
        updatedAt: 2
      },
      questionnaire: {
        id: 'q-x',
        projectId: 'proj-x',
        title: 'Outside',
        description: null,
        version: 1,
        language: 'en',
        paperSize: 'a4',
        orientation: 'portrait',
        theme: null,
        status: 'draft',
        metadata: null,
        sections: [
          {
            id: 'sec-1',
            type: 'section',
            title: 'S',
            description: null,
            items: [
              {
                id: 'item-1',
                type: 'single_choice',
                variableName: 'v1',
                label: 'Q',
                required: false,
                options: [],
                coding: null,
                validation: null,
                scannerConfig: null,
                printConfig: null,
                metadata: null,
                scaleId: 'scale-ffq',
                placeholder: null,
                heading: null,
                emphasis: 'normal',
                rows: [],
                columns: [],
                selectionMode: 'single',
                consent: null,
                signature: null,
                unitLabel: null
              }
            ],
            printConfig: null,
            metadata: null
          }
        ],
        createdAt: 1,
        updatedAt: 2
      },
      scales: [
        {
          id: 'scale-ffq',
          name: 'FFQ Frequency',
          options: [
            { id: 's-o1', label: 'Never', coding: '0' },
            { id: 's-o2', label: 'Daily', coding: '3' }
          ],
          createdAt: 1,
          updatedAt: 2
        }
      ]
    });

    const bal_outcome = await biriyani_project(bal_text);
    expect(bal_outcome.status).toBe('imported');
    const bal_scales = await ken_pori_scales();
    expect(bal_scales).toHaveLength(2);
    const bal_imported_scale = bal_scales.find(
      (bal_s) => bal_s.name === 'FFQ Frequency (imported)'
    );
    expect(bal_imported_scale).toBeDefined();

    const bal_imported_q = await dhon_questionnaire_by_project(bal_outcome.project.id);
    const bal_item = bal_imported_q?.sections[0].items[0];
    expect(bal_item?.scaleId).toBe(bal_imported_scale?.id);
    expect(bal_item?.scaleId).not.toBe('scale-ffq');
  });
});

async function bal_banaitesi_scale_fixture(): Promise<ResponseScaleRecord> {
  const { bal_banaitesi_scale } = await import('./scale_service');
  const bal_scale = await bal_banaitesi_scale('FFQ Frequency');
  const bal_pinned: ResponseScaleRecord = {
    ...bal_scale,
    id: 'scale-ffq',
    options: [
      { id: 'f1', label: 'Never', coding: '0' },
      { id: 'f2', label: 'Weekly', coding: '2' },
      { id: 'f3', label: 'Daily', coding: '3' }
    ]
  };
  const { bal_save_scale } = await import('../db/scales_repo');
  const { lichu_scale } = await import('../db/scales_repo');
  await lichu_scale(bal_scale.id);
  await bal_save_scale(bal_pinned);
  return bal_pinned;
}
