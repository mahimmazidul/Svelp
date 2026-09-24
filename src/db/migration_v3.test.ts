import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { bal_clear } from './client';
import {
  bal_save_batch,
  bal_save_batch_with_layout,
  bal_save_layout,
  dhon_layout,
  dhon_layout_by_fingerprint,
  ken_pori_batches_by_project,
  ken_pori_layouts_by_questionnaire,
  lichu_layouts
} from './print_repo';
import type { PrintBatchRecord, PrintLayoutRecord } from '../models/print_models';

describe('print stores', () => {
  beforeEach(async () => {
    await bal_clear('printLayouts');
    await bal_clear('printBatches');
  });

  function bal_layout(bal_id: string, bal_fingerprint: string): PrintLayoutRecord {
    return {
      id: bal_id,
      questionnaireId: 'q-1',
      projectId: 'p-1',
      questionnaireVersion: 3,
      fingerprint: bal_fingerprint,
      paperSize: 'a4',
      orientation: 'portrait',
      settingsSnapshot: {} as PrintLayoutRecord['settingsSnapshot'],
      geometry: { pages: [] } as unknown as PrintLayoutRecord['geometry'],
      createdAt: 1,
      updatedAt: 2
    };
  }

  it('saves and retrieves layouts by questionnaire and fingerprint', async () => {
    await bal_save_layout(bal_layout('lay-1', 'abc'));
    await bal_save_layout(bal_layout('lay-2', 'def'));
    const bal_found = await dhon_layout_by_fingerprint('q-1', 'def');
    expect(bal_found?.id).toBe('lay-2');
    const bal_all = await ken_pori_layouts_by_questionnaire('q-1');
    expect(bal_all).toHaveLength(2);
    expect(await dhon_layout('lay-1')).toBeDefined();
  });

  it('deletes layouts by id', async () => {
    await bal_save_layout(bal_layout('lay-1', 'abc'));
    await lichu_layouts(['lay-1']);
    expect(await dhon_layout('lay-1')).toBeUndefined();
  });

  it('saves batch and layout in one transaction', async () => {
    const bal_batch: PrintBatchRecord = {
      id: 'batch-1',
      projectId: 'p-1',
      questionnaireId: 'q-1',
      questionnaireVersion: 3,
      fingerprint: 'abc',
      layoutId: 'lay-tx',
      respondentIds: ['001', '002'],
      settings: {} as PrintBatchRecord['settings'],
      pageCount: 2,
      includeMachineIdentifier: true,
      includeHumanReadableId: true,
      createdAt: 5
    };
    await bal_save_batch_with_layout(bal_batch, bal_layout('lay-tx', 'abc'));
    const bal_rows = await ken_pori_batches_by_project('p-1');
    expect(bal_rows.map((bal_r) => bal_r.id)).toEqual(['batch-1']);
    expect((await dhon_layout('lay-tx'))?.fingerprint).toBe('abc');
  });

  it('persists respondent ids exactly', async () => {
    const bal_batch: PrintBatchRecord = {
      id: 'batch-2',
      projectId: 'p-1',
      questionnaireId: 'q-1',
      questionnaireVersion: 1,
      fingerprint: 'zzz',
      layoutId: 'lay-2',
      respondentIds: ['FFQ-001', 'FFQ-002', 'FFQ-003'],
      settings: {} as PrintBatchRecord['settings'],
      pageCount: 1,
      includeMachineIdentifier: true,
      includeHumanReadableId: false,
      createdAt: 9
    };
    await bal_save_batch(bal_batch);
    const bal_rows = await ken_pori_batches_by_project('p-1');
    expect(bal_rows[0].respondentIds).toEqual(['FFQ-001', 'FFQ-002', 'FFQ-003']);
  });
});
