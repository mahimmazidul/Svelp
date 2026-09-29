import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { bal_clear } from '../../db/client';
import { bal_banaitesi_project } from '../../services/project_service';
import { dhon_questionnaire_by_project } from '../../db/questionnaires_repo';
import { ken_pori_scales } from '../../db/scales_repo';
import { ken_pori_layouts_by_questionnaire } from '../../db/print_repo';
import { bal_add_item } from '../builder/builder_ops';
import { bal_default_print_settings } from '../print/print_settings';
import { bal_build_print_document } from '../print/print_layout';
import { bal_save_batch_with_layout } from '../../db/print_repo';
import type { PrintBatchRecord, PrintLayoutRecord } from '../../models/print_models';
import { bal_build_transfer_package } from './mahim_transfer';
import { bal_inspect_mahim_package } from './mahim_import';
import { bal_plan_collisions } from './mahim_collision';
import { bal_commit_import } from './mahim_commit';
import { bal_resolve_identity } from '../../services/scan_service';

const BAL_ALL_STORES = [
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
];

async function bal_wipe_device(): Promise<void> {
  for (const bal_store of BAL_ALL_STORES) {
    await bal_clear(bal_store);
  }
}

async function bal_build_device_a(): Promise<Uint8Array> {
  const bal_project = await bal_banaitesi_project({
    title: 'Rice Yield Study',
    description: 'Seasonal yield survey'
  });
  const bal_q = await dhon_questionnaire_by_project(bal_project.id);
  if (!bal_q) throw new Error('questionnaire missing');
  const bal_section = bal_q.sections[0];
  const bal_add1 = bal_add_item(bal_q, bal_section.id, 'single_choice');
  const bal_with_one = bal_add1.q;
  const bal_add2 = bal_add_item(bal_with_one, bal_section.id, 'yes_no');
  const bal_current = bal_add2.q;
  if (!bal_current) throw new Error('questionnaire missing after edit');
  const bal_printed = {
    ...bal_current,
    printSettings: {
      ...bal_default_print_settings(),
      header: {
        ...bal_default_print_settings().header,
        showStudyCode: true,
        studyCode: 'RYS2026'
      },
      showMachineIdentifier: true,
      scannerMode: true
    }
  };
  const bal_scales = await ken_pori_scales();
  const bal_document = bal_build_print_document({
    questionnaire: bal_printed,
    scales: bal_scales.filter((bal_scale) =>
      bal_printed.sections.some((bal_section) =>
        bal_section.items.some((bal_item) => bal_item.scaleId === bal_scale.id)
      )
    )
  });
  const bal_layout: PrintLayoutRecord = {
    id: 'layout-device-a',
    questionnaireId: bal_printed.id,
    projectId: bal_project.id,
    questionnaireVersion: bal_printed.version,
    fingerprint: bal_document.fingerprint,
    paperSize: bal_printed.paperSize,
    orientation: bal_printed.orientation,
    settingsSnapshot: bal_printed.printSettings,
    geometry: bal_document.geometry,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  const bal_batch: PrintBatchRecord = {
    id: 'batch-device-a',
    projectId: bal_project.id,
    questionnaireId: bal_printed.id,
    questionnaireVersion: bal_printed.version,
    fingerprint: bal_document.fingerprint,
    layoutId: bal_layout.id,
    respondentIds: ['R-001', 'R-002'],
    settings: bal_printed.printSettings,
    pageCount: bal_document.pageCount,
    includeMachineIdentifier: true,
    includeHumanReadableId: true,
    createdAt: Date.now()
  };
  await bal_save_batch_with_layout(bal_batch, bal_layout);
  const bal_result = await bal_build_transfer_package({
    project: bal_project,
    questionnaire: bal_printed,
    scales: bal_scales,
    layouts: [bal_layout],
    batches: [bal_batch]
  });
  if ('issues' in bal_result) throw new Error(JSON.stringify(bal_result.issues));
  return bal_result.build.bytes;
}

beforeEach(async () => {
  await bal_wipe_device();
});

describe('mahim cross-device transfer', () => {
  it('moves a printed questionnaire between devices with scanner identity intact', async () => {
    const bal_bytes = await bal_build_device_a();
    await bal_wipe_device();

    const bal_empty = await ken_pori_layouts_by_questionnaire('anything');
    expect(bal_empty).toEqual([]);

    const bal_blob = new Blob([bal_bytes], { type: 'application/x-mahim' });
    const bal_outcome = await bal_inspect_mahim_package(bal_blob);
    if (!bal_outcome.ok || 'failure' in bal_outcome) {
      throw new Error(JSON.stringify(bal_outcome));
    }
    const bal_plan = await bal_plan_collisions(bal_outcome.inspected);
    expect(bal_plan.project.action).toBe('add');
    const bal_report = await bal_commit_import(bal_outcome.inspected, 'merge');
    expect(bal_report.written.projects).toBe(1);
    expect(bal_report.written.questionnaires).toBe(1);
    expect(bal_report.written.printLayouts).toBe(1);
    expect(bal_report.written.printBatches).toBe(1);

    const bal_layouts = await bal_get_layouts_all();
    expect(bal_layouts.length).toBe(1);
    const bal_layout = bal_layouts[0];
    expect(bal_layout.fingerprint).toBe(bal_layout.geometry.fingerprint);
    const bal_page = bal_layout.geometry.pages[0];
    expect(bal_page.identifier).not.toBeNull();
    const bal_payload = bal_page.identifier?.payload ?? '';
    const bal_parts = bal_payload.split('|');
    expect(bal_parts.length).toBe(5);
    expect(bal_parts[0]).toBe('S1');
    expect(bal_parts[1]).toBe('RYS2026');
    expect(Number(bal_parts[2])).toBe(bal_layout.questionnaireVersion);
    expect(bal_parts[4]).toBe('1');
    const bal_regions = bal_page.answerRegions;
    expect(bal_regions.length).toBeGreaterThanOrEqual(2);
    for (const bal_region of bal_regions) {
      expect(bal_region.normalized.x).toBeGreaterThanOrEqual(0);
      expect(bal_region.normalized.x + bal_region.normalized.width).toBeLessThanOrEqual(1.000002);
    }
    const bal_first = bal_regions[0];
    expect(bal_first.rect.width).toBeGreaterThan(0);
    expect(Number.isFinite(bal_first.rect.x)).toBe(true);

    const bal_scan_payload = `S1|${'RYS2026'}|${bal_layout.questionnaireVersion}|R-001|1`;
    const bal_identity = bal_resolve_identity([bal_scan_payload], bal_layouts);
    expect(bal_identity.questionnaireId).toBe(bal_layout.questionnaireId);
    expect(bal_identity.questionnaireVersion).toBe(bal_layout.questionnaireVersion);
    expect(bal_identity.respondentId).toBe('R-001');
    expect(bal_identity.issues).toEqual([]);
    expect(bal_identity.layout?.layout.id).toBe('layout-device-a');

    const bal_again = await bal_inspect_mahim_package(bal_blob);
    if (!bal_again.ok || 'failure' in bal_again) throw new Error('second inspect failed');
    const bal_second_plan = await bal_plan_collisions(bal_again.inspected);
    expect(bal_second_plan.project.action).toBe('dedupe');
    expect(bal_second_plan.questionnaires[0].action).toBe('dedupe');
    const bal_rerun = await bal_commit_import(bal_again.inspected, 'merge');
    expect(bal_rerun.written.projects).toBe(0);
    expect(bal_rerun.written.questionnaires).toBe(0);
  });
});

async function bal_get_layouts_all(): Promise<PrintLayoutRecord[]> {
  const { bal_get_all } = await import('../../db/client');
  return bal_get_all<PrintLayoutRecord>('printLayouts');
}
