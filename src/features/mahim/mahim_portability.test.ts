import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { bal_clear } from '../../db/client';
import { bal_save_project } from '../../db/projects_repo';
import { bal_save_questionnaire } from '../../db/questionnaires_repo';
import { bal_save_scale } from '../../db/scales_repo';
import { bal_build_transfer_package } from './mahim_transfer';
import {
  bal_backup_filename,
  bal_transfer_filename
} from './mahim_filenames';
import {
  bal_inspect_mahim_package,
  type BalInspectedPackage
} from './mahim_import';
import { bal_plan_collisions, bal_build_copy_remapping, bal_apply_copy_remapping } from './mahim_collision';
import { bal_commit_import } from './mahim_commit';
import { createMahimWriter, encodeCbor, SectionType } from '../../../vendor/mahim/index.js';
import { dhon_questionnaire, ken_pori_questionnaires } from '../../db/questionnaires_repo';
import { ken_pori_projects } from '../../db/projects_repo';
import { ken_pori_scales } from '../../db/scales_repo';
import {
  bal_project as bal_project_fixture,
  bal_questionnaire as bal_questionnaire_fixture,
  bal_scale as bal_scale_fixture,
  bal_layout as bal_layout_fixture
} from './mahim_test_fixtures';

async function bal_reset_db(): Promise<void> {
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
    'settings'
  ]) {
    await bal_clear(bal_store);
  }
}

async function bal_build_package_blob(): Promise<Blob> {
  const bal_result = await bal_build_transfer_package({
    project: bal_project_fixture(),
    questionnaire: bal_questionnaire_fixture(),
    scales: [bal_scale_fixture()],
    layouts: [bal_layout_fixture()],
    batches: []
  });
  if ('issues' in bal_result) throw new Error('unexpected export issues');
  return new Blob([bal_result.build.bytes], { type: 'application/x-mahim' });
}

beforeEach(async () => {
  await bal_reset_db();
});

describe('mahim import inspection', () => {
  it('inspects a transfer package without decoding assets', async () => {
    const bal_blob = await bal_build_package_blob();
    const bal_outcome = await bal_inspect_mahim_package(bal_blob);
    if (!bal_outcome.ok || 'failure' in bal_outcome) {
      throw new Error(JSON.stringify(bal_outcome));
    }
    expect(bal_outcome.inspected.manifest.mode).toBe('questionnaire-transfer');
    expect(bal_outcome.inspected.project.title).toBe('Water Survey 2026');
    expect(bal_outcome.inspected.questionnaires[0].version).toBe(3);
    expect(bal_outcome.inspected.print.layouts).toHaveLength(1);
    expect(bal_outcome.report.valid).toBe(true);
    expect(bal_outcome.inspected.header.applicationIdentifier).toBe('svelp');
  });

  it('rejects a valid MAHIM file from another application', async () => {
    const bal_bytes = await createMahimWriter()
      .setApplication({ identifier: 'example', payloadVersion: 1 })
      .addSection({
        type: SectionType.Metadata,
        name: 'manifest',
        data: encodeCbor({ note: 'other app' })
      })
      .finalize();
    const bal_outcome = await bal_inspect_mahim_package(new Blob([bal_bytes]));
    expect(bal_outcome.ok).toBe(false);
    if (!bal_outcome.ok && 'failure' in bal_outcome) {
      expect(bal_outcome.failure.kind).toBe('other-application');
    } else {
      throw new Error('expected rejection');
    }
  });

  it('rejects a file that is not MAHIM at all', async () => {
    const bal_outcome = await bal_inspect_mahim_package(
      new Blob([new TextEncoder().encode('{"format":"svelp.project"}')])
    );
    expect(bal_outcome.ok).toBe(false);
  });

  it('reports a newer Svelp payload version as unsupported', async () => {
    const bal_bytes = await createMahimWriter({ fileDigest: true })
      .setApplication({ identifier: 'svelp', payloadVersion: 2 })
      .addSection({
        type: SectionType.Metadata,
        name: 'manifest',
        data: encodeCbor({ payloadVersion: 2, mode: 'questionnaire-transfer' })
      })
      .finalize();
    const bal_outcome = await bal_inspect_mahim_package(new Blob([bal_bytes]));
    expect(bal_outcome.ok).toBe(false);
    if (!bal_outcome.ok && 'issues' in bal_outcome) {
      expect(bal_outcome.issues[0].message).toContain('newer Svelp data format');
    } else {
      throw new Error('expected rejection');
    }
  });

  it('rejects a corrupt package via integrity verification', async () => {
    const bal_blob = await bal_build_package_blob();
    const bal_bytes = new Uint8Array(await bal_blob.arrayBuffer());
    bal_bytes[bal_bytes.length - 40] ^= 0xff;
    const bal_outcome = await bal_inspect_mahim_package(new Blob([bal_bytes]));
    expect(bal_outcome.ok).toBe(false);
  });

  it('rejects an invalid Svelp payload structure', async () => {
    const bal_bytes = await createMahimWriter({ fileDigest: true })
      .setApplication({ identifier: 'svelp', payloadVersion: 1 })
      .addSection({
        type: SectionType.Metadata,
        name: 'manifest',
        data: encodeCbor({
          payloadVersion: 1,
          mode: 'questionnaire-transfer',
          generator: 'svelp',
          exportedAt: '2026-09-30T00:00:00.000Z',
          projectIds: ['proj-1'],
          questionnaireIds: ['q-1'],
          includesResponses: false,
          includesScanImages: false,
          contents: {}
        })
      })
      .addSection({
        type: SectionType.ApplicationPayload,
        name: 'project',
        data: encodeCbor({ id: 'proj-1', title: 42, status: 'active' })
      })
      .addSection({
        type: SectionType.ApplicationPayload,
        name: 'questionnaires',
        data: encodeCbor([])
      })
      .addSection({
        type: SectionType.ApplicationPayload,
        name: 'scales',
        data: encodeCbor([])
      })
      .addSection({
        type: SectionType.ApplicationPayload,
        name: 'print',
        data: encodeCbor({ layouts: [], batches: [] })
      })
      .finalize();
    const bal_outcome = await bal_inspect_mahim_package(new Blob([bal_bytes]));
    expect(bal_outcome.ok).toBe(false);
    if (!bal_outcome.ok && 'issues' in bal_outcome) {
      expect(bal_outcome.issues.length).toBeGreaterThan(0);
    } else {
      throw new Error('expected rejection');
    }
  });
});

describe('mahim collision planning', () => {
  it('plans add on an empty device', async () => {
    const bal_blob = await bal_build_package_blob();
    const bal_outcome = await bal_inspect_mahim_package(bal_blob);
    if (!bal_outcome.ok || 'failure' in bal_outcome) throw new Error('inspect failed');
    const bal_plan = await bal_plan_collisions(bal_outcome.inspected);
    expect(bal_plan.project.action).toBe('add');
    expect(bal_plan.questionnaires[0].action).toBe('add');
    expect(bal_plan.requiresUserChoice).toBe(false);
  });

  it('dedupes identical content and reports it', async () => {
    await bal_save_project(bal_project_fixture());
    await bal_save_questionnaire(bal_questionnaire_fixture());
    await bal_save_scale(bal_scale_fixture());
    const bal_blob = await bal_build_package_blob();
    const bal_outcome = await bal_inspect_mahim_package(bal_blob);
    if (!bal_outcome.ok || 'failure' in bal_outcome) throw new Error('inspect failed');
    const bal_plan = await bal_plan_collisions(bal_outcome.inspected);
    expect(bal_plan.project.action).toBe('dedupe');
    expect(bal_plan.questionnaires[0].action).toBe('dedupe');
    expect(bal_plan.scales[0].action).toBe('dedupe');
    expect(bal_plan.requiresUserChoice).toBe(false);
  });

  it('flags an immutable version conflict on differing content', async () => {
    const bal_local_q = bal_questionnaire_fixture();
    bal_local_q.sections[0].title = 'Renamed locally';
    await bal_save_project(bal_project_fixture());
    await bal_save_questionnaire(bal_local_q);
    const bal_blob = await bal_build_package_blob();
    const bal_outcome = await bal_inspect_mahim_package(bal_blob);
    if (!bal_outcome.ok || 'failure' in bal_outcome) throw new Error('inspect failed');
    const bal_plan = await bal_plan_collisions(bal_outcome.inspected);
    expect(bal_plan.questionnaires[0].action).toBe('conflict');
    expect(bal_plan.integrityConflict).toBe(true);
    expect(bal_plan.requiresUserChoice).toBe(true);
  });

  it('plans an update when the file carries a newer version', async () => {
    const bal_old_q = bal_questionnaire_fixture();
    bal_old_q.version = 2;
    await bal_save_project(bal_project_fixture());
    await bal_save_questionnaire(bal_old_q);
    const bal_blob = await bal_build_package_blob();
    const bal_outcome = await bal_inspect_mahim_package(bal_blob);
    if (!bal_outcome.ok || 'failure' in bal_outcome) throw new Error('inspect failed');
    const bal_plan = await bal_plan_collisions(bal_outcome.inspected);
    expect(bal_plan.questionnaires[0].action).toBe('update');
  });
});

describe('mahim import commit', () => {
  it('imports into a clean device with identities intact', async () => {
    const bal_blob = await bal_build_package_blob();
    const bal_outcome = await bal_inspect_mahim_package(bal_blob);
    if (!bal_outcome.ok || 'failure' in bal_outcome) throw new Error('inspect failed');
    const bal_report = await bal_commit_import(bal_outcome.inspected, 'merge');
    expect(bal_report.written.projects).toBe(1);
    expect(bal_report.written.questionnaires).toBe(1);
    expect(bal_report.written.scales).toBe(1);
    expect(bal_report.written.printLayouts).toBe(1);
    const bal_projects = await ken_pori_projects();
    expect(bal_projects[0].id).toBe('proj-1');
    expect(bal_projects[0].title).toBe('Water Survey 2026');
    const bal_q = await dhon_questionnaire('q-1');
    expect(bal_q?.version).toBe(3);
    expect(bal_q?.sections[0].items[0].scaleId).toBe('scale-agree');
    expect(bal_q?.sections[0].items[0].variableName).toBe('water_source');
    const bal_scales = await ken_pori_scales();
    expect(bal_scales[0].options[0].coding).toBe('5');
  });

  it('re-importing the same file writes nothing new', async () => {
    const bal_blob = await bal_build_package_blob();
    const bal_outcome = await bal_inspect_mahim_package(bal_blob);
    if (!bal_outcome.ok || 'failure' in bal_outcome) throw new Error('inspect failed');
    await bal_commit_import(bal_outcome.inspected, 'merge');
    const bal_second = await bal_commit_import(bal_outcome.inspected, 'merge');
    expect(bal_second.written.projects).toBe(0);
    expect(bal_second.written.questionnaires).toBe(0);
    expect(bal_second.written.scales).toBe(0);
    expect(bal_second.skipped.projects).toBe(1);
    expect(bal_second.skipped.questionnaires).toBe(1);
    expect((await ken_pori_questionnaires()).length).toBe(1);
  });

  it('replace removes local rows before writing the incoming ones', async () => {
    const bal_local_q = bal_questionnaire_fixture();
    bal_local_q.sections[0].title = 'Local rename';
    bal_local_q.updatedAt = 999;
    await bal_save_project(bal_project_fixture());
    await bal_save_questionnaire(bal_local_q);
    const bal_blob = await bal_build_package_blob();
    const bal_outcome = await bal_inspect_mahim_package(bal_blob);
    if (!bal_outcome.ok || 'failure' in bal_outcome) throw new Error('inspect failed');
    const bal_report = await bal_commit_import(bal_outcome.inspected, 'replace');
    expect(bal_report.resolution).toBe('replace');
    const bal_q = await dhon_questionnaire('q-1');
    expect(bal_q?.sections[0].title).toBe('Background');
    expect((await ken_pori_questionnaires()).length).toBe(1);
  });
});

describe('mahim copy import', () => {
  it('rewrites identity while preserving questionnaire structure', async () => {
    const bal_blob = await bal_build_package_blob();
    const bal_outcome = await bal_inspect_mahim_package(bal_blob);
    if (!bal_outcome.ok || 'failure' in bal_outcome) throw new Error('inspect failed');
    const bal_remap = await bal_build_copy_remapping(bal_outcome.inspected);
    const bal_copy = bal_apply_copy_remapping(bal_outcome.inspected, bal_remap);
    expect(bal_copy.project.id).not.toBe('proj-1');
    expect(bal_copy.project.title).toBe('Water Survey 2026 (imported)');
    expect(bal_copy.questionnaires[0].projectId).toBe(bal_copy.project.id);
    expect(bal_copy.print.layouts[0].projectId).toBe(bal_copy.project.id);
    expect(bal_copy.print.layouts[0].geometry.pages[0].answerRegions[0].itemId).toBe('i1');
    const bal_report = await bal_commit_import(bal_copy, 'merge');
    expect(bal_report.written.projects).toBe(1);
    const bal_projects = await ken_pori_projects();
    expect(bal_projects.length).toBe(1);
    expect(bal_projects[0].title).toContain('(imported)');
  });
});

describe('mahim filenames', () => {
  it('uses the required naming patterns', () => {
    expect(bal_transfer_filename('Community Health', 2)).toBe('Community-Health-v2.mahim');
    expect(bal_backup_filename('Community Health', new Date(2026, 8, 30))).toBe(
      'Community-Health-backup-2026-09-30.mahim'
    );
  });
});

export type { BalInspectedPackage };
