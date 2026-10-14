import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { bal_clear, bal_get } from '../db/client';
import { bal_save_project } from '../db/projects_repo';
import { bal_save_questionnaire, dhon_questionnaire_by_project } from '../db/questionnaires_repo';
import { bal_save_scale } from '../db/scales_repo';
import {
  BAL_BN_CONSENT_INTRO,
  BAL_BN_DESCRIPTION,
  BAL_BN_MATRIX_ROWS,
  BAL_BN_OPT_DAILY,
  BAL_BN_OPT_MONTHLY_1_3,
  BAL_BN_OPT_NEVER,
  BAL_BN_OPT_WEEKLY_2_4,
  BAL_BN_OPT_WEEKLY_ONCE,
  BAL_BN_Q_WASTE_FREQ,
  BAL_BN_SECTION,
  BAL_BN_TITLE,
  BAL_BN_UNIT_YEARS,
  bal_bangla_survey,
  bal_frequency_scale_bn
} from '../test/bangla_fixtures';
import {
  bal_build_codebook,
  bal_build_export_rows,
  bal_build_json_dataset,
  bal_codebook_to_csv,
  bal_export_columns,
  bal_export_headers,
  bal_to_csv
} from './export/export_dataset';
import { bal_source_from_questionnaire } from './source/bal_source_pipeline';
import { bal_source_apply_plan } from './source/bal_source_pipeline';
import type { ResponseRecord } from '../models/response_models';

function bal_response_for(bal_item_id: string, bal_value: string[], bal_variable: string | null): ResponseRecord {
  const bal_q = bal_bangla_survey();
  return {
    id: `BN-017::${bal_item_id}`,
    projectId: 'p-bn',
    batchId: null,
    questionnaireId: bal_q.id,
    questionnaireVersion: bal_q.version,
    respondentId: 'BN-017',
    itemId: bal_item_id,
    variableName: bal_variable,
    itemType: 'single_choice',
    rowId: null,
    columnId: null,
    value: bal_value,
    codedValue: null,
    status: 'accepted',
    confidence: 0.98,
    machineValue: bal_value,
    machineStatus: 'accepted',
    machineConfidence: 0.98,
    manuallyReviewed: false,
    validationIssues: [],
    sourcePageId: null,
    sourceRegionRect: null,
    algorithmVersion: 'test',
    thresholdProfileName: 'default-v1',
    recognitionRunId: null,
    createdAt: 1,
    updatedAt: 1
  };
}

async function bal_wipe(): Promise<void> {
  for (const bal_store of [
    'projects',
    'questionnaires',
    'responseScales',
    'printLayouts',
    'printBatches',
    'scanBatches',
    'scanPages',
    'scanAssets',
    'scanAuditEvents',
    'responses',
    'recognitionRuns',
    'responseAuditEvents',
    'blankReferences',
    'datasetSnapshots',
    'settings'
  ]) {
    await bal_clear(bal_store);
  }
}

describe('bangla export round trips', () => {
  beforeEach(async () => {
    await bal_wipe();
  });

  it('survives csv export with bangla headers labels commas quotes and multiline values', () => {
    const bal_q = bal_bangla_survey();
    const bal_scales = [bal_frequency_scale_bn()];
    const bal_columns = bal_export_columns(bal_q, { optionColumns: false });
    const bal_flat = bal_q.sections.flatMap((bal_s) => bal_s.items);
    const bal_notes = bal_flat.find((bal_i) => bal_i.variableName === 'outside_food_notes');
    if (!bal_notes) throw new Error('notes item missing');
    const bal_multiline = `লাইন এক\nতারপর, "দ্বিতীয়" লাইন`;
    const bal_responses = [
      bal_response_for(bal_flat[2].id, ['25'], 'age'),
      { ...bal_response_for(bal_notes.id, [bal_multiline], 'outside_food_notes'), itemType: 'long_text' }
    ];
    const bal_rows = bal_build_export_rows(bal_columns, bal_q, bal_scales, bal_responses, ['BN-017']);
    const bal_csv = bal_to_csv(bal_rows, bal_export_headers(bal_columns, false), false);
    expect(bal_csv).toContain('"লাইন এক\nতারপর, ""দ্বিতীয়"" লাইন"');
    expect(bal_csv).toContain('BN-017');
    const bal_codebook = bal_build_codebook(bal_columns, bal_q, bal_scales);
    expect(bal_codebook.some((bal_r) => bal_r.sectionTitle === BAL_BN_SECTION)).toBe(true);
    expect(bal_codebook.some((bal_r) => bal_r.unit === BAL_BN_UNIT_YEARS)).toBe(true);
    const bal_bom_csv = bal_to_csv(bal_rows, bal_export_headers(bal_columns, false), true);
    expect(bal_bom_csv.charCodeAt(0)).toBe(0xfeff);
    expect(bal_bom_csv.slice(1)).toBe(bal_csv);
    for (const bal_row of bal_rows) {
      expect(Object.keys(bal_row)[0]).toBe('respondent_id');
    }
  });

  it('round trips bangla values through the json dataset byte for byte', () => {
    const bal_q = bal_bangla_survey();
    const bal_scales = [bal_frequency_scale_bn()];
    const bal_columns = bal_export_columns(bal_q, { optionColumns: false });
    const bal_flat = bal_q.sections.flatMap((bal_s) => bal_s.items);
    const bal_notes = bal_flat.find((bal_i) => bal_i.variableName === 'outside_food_notes');
    if (!bal_notes) throw new Error('notes item missing');
    const bal_responses = [
      { ...bal_response_for(bal_notes.id, [BAL_BN_DESCRIPTION], 'outside_food_notes'), itemType: 'long_text' }
    ];
    const bal_json = bal_build_json_dataset(bal_columns, bal_q, bal_scales, bal_responses, ['BN-017']);
    const bal_parsed = JSON.parse(bal_json) as {
      title: string;
      respondents: Record<string, string>[];
    };
    expect(bal_parsed.title).toBe(BAL_BN_TITLE);
    const bal_note_key = Object.keys(bal_parsed.respondents[0]).find((bal_k) => bal_k.startsWith('outside_food_notes'));
    expect(bal_note_key).toBeDefined();
    expect(bal_parsed.respondents[0][bal_note_key ?? '']).toBe(BAL_BN_DESCRIPTION);
    expect(bal_json.includes(BAL_BN_DESCRIPTION)).toBe(true);
  });

  it('writes a bangla codebook with section titles units and option labels', () => {
    const bal_q = bal_bangla_survey();
    const bal_scales = [bal_frequency_scale_bn()];
    const bal_columns = bal_export_columns(bal_q, { optionColumns: false });
    const bal_codebook = bal_build_codebook(bal_columns, bal_q, bal_scales);
    expect(bal_codebook.some((bal_r) => bal_r.sectionTitle === BAL_BN_SECTION)).toBe(true);
    expect(bal_codebook.some((bal_r) => bal_r.unit === BAL_BN_UNIT_YEARS)).toBe(true);
    expect(bal_codebook.some((bal_r) => bal_r.questionLabel === BAL_BN_Q_WASTE_FREQ)).toBe(true);
    for (const bal_label of [
      BAL_BN_OPT_NEVER,
      BAL_BN_OPT_MONTHLY_1_3,
      BAL_BN_OPT_WEEKLY_ONCE,
      BAL_BN_OPT_WEEKLY_2_4,
      BAL_BN_OPT_DAILY
    ]) {
      expect(bal_codebook.some((bal_r) => bal_r.optionLabel === bal_label)).toBe(true);
    }
    expect(bal_codebook.some((bal_r) => bal_r.matrixRowLabel === BAL_BN_MATRIX_ROWS[0])).toBe(true);
    const bal_codebook_csv = bal_codebook_to_csv(bal_codebook, false);
    expect(bal_codebook_csv).toContain(BAL_BN_SECTION);
    expect(bal_codebook_to_csv(bal_codebook, true).charCodeAt(0)).toBe(0xfeff);
  });

  it('round trips the full bangla questionnaire through mahim export and clean import', async () => {
    const { bal_build_backup_package } = await import('./mahim/mahim_backup');
    const { bal_inspect_mahim_package } = await import('./mahim/mahim_import');
    const { bal_commit_import } = await import('./mahim/mahim_commit');

    const bal_q = bal_bangla_survey();
    const bal_scale = bal_frequency_scale_bn();
    await bal_save_project({
      id: 'p-bn',
      title: 'খাদ্য অপচয় গবেষণা',
      description: BAL_BN_DESCRIPTION,
      status: 'active',
      createdAt: 1,
      updatedAt: 1
    });
    await bal_save_questionnaire(bal_q);
    await bal_save_scale(bal_scale);

    const bal_backup = await bal_build_backup_package({
      project: {
        id: 'p-bn',
        title: 'খাদ্য অপচয় গবেষণা',
        description: BAL_BN_DESCRIPTION,
        status: 'active',
        createdAt: 1,
        updatedAt: 1
      },
      questionnaires: [bal_q],
      scales: [bal_scale],
      layouts: [],
      batches: [],
      scanBatches: [],
      scanPages: [],
      scanAuditEvents: [],
      responses: [],
      recognitionRuns: [],
      responseAuditEvents: [],
      blankReferences: [],
      datasetSnapshots: [],
      assets: [],
      settings: [],
      options: {
        includeResponses: false,
        includeOriginalScans: false,
        includeNormalizedPages: false,
        includeThumbnails: false
      }
    });
    if ('issues' in bal_backup) throw new Error(JSON.stringify(bal_backup.issues));
    await bal_wipe();

    const bal_blob = new Blob([bal_backup.build.bytes], { type: 'application/x-mahim' });
    const bal_outcome = await bal_inspect_mahim_package(bal_blob);
    if (!bal_outcome.ok || 'failure' in bal_outcome) throw new Error('inspect failed');
    const bal_report = await bal_commit_import(bal_outcome.inspected, 'merge');
    expect(bal_report.written.projects).toBe(1);
    expect(bal_report.written.questionnaires).toBe(1);
    expect(bal_report.written.scales).toBe(1);

    const bal_reloaded = await dhon_questionnaire_by_project('p-bn');
    expect(bal_reloaded?.title).toBe(BAL_BN_TITLE);
    expect(bal_reloaded?.description).toBe(BAL_BN_DESCRIPTION);
    expect(bal_reloaded?.sections[0].title).toBe(BAL_BN_SECTION);
    const bal_flat = (bal_reloaded?.sections ?? []).flatMap((bal_s) => bal_s.items);
    const bal_matrix = bal_flat.find((bal_i) => bal_i.type === 'matrix');
    expect(bal_matrix?.rows.map((bal_r) => bal_r.label)).toEqual(BAL_BN_MATRIX_ROWS);
    const bal_consent = bal_flat.find((bal_i) => bal_i.type === 'consent');
    expect(bal_consent?.consent?.introduction).toBe(BAL_BN_CONSENT_INTRO);
    const bal_reloaded_scale = await bal_get<{ id: string; options: { label: string }[] }>(
      'responseScales',
      'scale-bn-frequency'
    );
    expect(bal_reloaded_scale?.options.map((bal_o) => bal_o.label)).toEqual([
      BAL_BN_OPT_NEVER,
      BAL_BN_OPT_MONTHLY_1_3,
      BAL_BN_OPT_WEEKLY_ONCE,
      BAL_BN_OPT_WEEKLY_2_4,
      BAL_BN_OPT_DAILY
    ]);
  });

  it('round trips bangla labels through source mode parse and serialize', async () => {
    const bal_q = bal_bangla_survey();
    const bal_scale = bal_frequency_scale_bn();
    const bal_first = bal_source_from_questionnaire(bal_q, [bal_scale]);
    expect(bal_first.skipped).toEqual([]);
    expect(bal_first.text).toContain(`title "${BAL_BN_TITLE}"`);
    expect(bal_first.text).toContain('unit "বছর"');
    expect(bal_first.text).toContain('option opt_0 "কখনও না"');
    expect(bal_first.text).toContain('rows {');
    expect(bal_first.text).toContain('ভাত');

    const { bal_slex } = await import('./source/shobdo_lexer');
    const { bal_sparse } = await import('./source/naksha_parser');
    const { bal_plan_apply } = await import('./source/bani_compile');
    const bal_lexed = bal_slex(bal_first.text);
    const bal_parsed = bal_sparse(bal_lexed.tokens, bal_lexed.errors);
    expect(bal_parsed.errors).toEqual([]);
    const bal_plan = bal_plan_apply(bal_parsed.doc, null, [bal_scale]);
    if (!bal_plan.ok) throw new Error(bal_plan.errors.join('; '));

    const bal_second = bal_source_from_questionnaire(bal_plan.questionnaire, bal_plan.scales);
    expect(bal_second.skipped).toEqual([]);

    const bal_reapply = bal_source_apply_plan(bal_second.text, bal_plan.questionnaire, bal_plan.scales, new Set());
    expect(bal_reapply.ok).toBe(true);
    const bal_replan = bal_reapply.ok ? bal_reapply.applyPlan : null;
    expect(bal_replan).not.toBeNull();
    if (bal_replan && bal_replan.ok) {
      expect(bal_replan.changes.variablesRenamed).toEqual([]);
      expect(bal_replan.changes.itemsRemoved).toBe(0);
      expect(bal_replan.changes.itemsAdded).toBe(0);
    }
    const bal_third = bal_source_from_questionnaire(bal_plan.questionnaire, bal_plan.scales);
    expect(bal_third.text).toBe(bal_second.text);
  });
});
