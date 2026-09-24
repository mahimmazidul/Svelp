import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { bal_generate_batch } from './print_service';
import { bal_plan_respondent_ids } from '../features/print/print_batch';
import { bal_ffq, bal_frequency_scale, bal_short_survey } from '../features/print/print_fixtures';
import { dhon_batch, dhon_layout, dhon_layout_by_fingerprint } from '../db/print_repo';
import { bal_clear } from '../db/client';
import { bal_save_questionnaire } from '../db/questionnaires_repo';
import { bal_questionnaire_fingerprint } from '../features/print/print_batch';

describe('print batch generation', () => {
  beforeEach(async () => {
    await bal_clear('printLayouts');
    await bal_clear('printBatches');
  });

  it('generates a batch with one document per respondent', async () => {
    const bal_outcome = await bal_generate_batch({
      questionnaire: bal_short_survey(),
      scales: [],
      projectId: 'p-1',
      plan: { mode: 'sequential', count: 5, start: 1, prefix: 'S-', padding: 3, customIds: '' }
    });
    expect(bal_outcome.documents).toHaveLength(5);
    expect(bal_outcome.batch.respondentIds).toEqual(['S-001', 'S-002', 'S-003', 'S-004', 'S-005']);
    expect(bal_outcome.batch.pageCount).toBe(bal_outcome.documents[0].pageCount);
    const bal_payloads = new Set(
      bal_outcome.documents.map((bal_doc) => bal_doc.pages[0].geometry.identifier?.payload)
    );
    expect(bal_payloads.size).toBe(5);
  });

  it('persists the batch and layout with version and fingerprint', async () => {
    const bal_q = bal_ffq(20);
    const bal_fingerprint = bal_questionnaire_fingerprint(bal_q);
    const bal_outcome = await bal_generate_batch({
      questionnaire: bal_q,
      scales: [bal_frequency_scale()],
      projectId: 'p-9',
      plan: { mode: 'sequential', count: 2, start: 1, prefix: '', padding: 3, customIds: '' }
    });
    const bal_batch = await dhon_batch(bal_outcome.batch.id);
    expect(bal_batch?.questionnaireVersion).toBe(bal_q.version);
    expect(bal_batch?.fingerprint).toBe(bal_fingerprint);
    expect(bal_batch?.layoutId).toBe(bal_outcome.layout.id);
    const bal_layout = await dhon_layout(bal_outcome.layout.id);
    expect(bal_layout?.fingerprint).toBe(bal_fingerprint);
    expect(bal_layout?.geometry.pages.length).toBe(bal_outcome.layout.geometry.pages.length);
  });

  it('reuses one layout per questionnaire content across batches', async () => {
    const bal_q = bal_short_survey();
    const bal_first = await bal_generate_batch({
      questionnaire: bal_q,
      scales: [],
      projectId: 'p-1',
      plan: { mode: 'sequential', count: 1, start: 1, prefix: '', padding: 3, customIds: '' }
    });
    const bal_second = await bal_generate_batch({
      questionnaire: bal_q,
      scales: [],
      projectId: 'p-1',
      plan: { mode: 'sequential', count: 1, start: 2, prefix: '', padding: 3, customIds: '' }
    });
    expect(bal_second.layout.id).toBe(bal_first.layout.id);
    const bal_rows = await dhon_layout_by_fingerprint(bal_q.id, bal_first.layout.fingerprint);
    expect(bal_rows?.id).toBe(bal_first.layout.id);
  });

  it('keeps questionnaire records untouched by batch generation', async () => {
    const bal_q = bal_short_survey();
    await bal_save_questionnaire(bal_q);
    const bal_before = JSON.stringify(bal_q.sections);
    await bal_generate_batch({
      questionnaire: bal_q,
      scales: [],
      projectId: 'p-1',
      plan: { mode: 'sequential', count: 3, start: 1, prefix: '', padding: 2, customIds: '' }
    });
    expect(JSON.stringify(bal_q.sections)).toBe(bal_before);
  });

  it('refuses invalid plans without writing anything', async () => {
    await expect(
      bal_generate_batch({
        questionnaire: bal_short_survey(),
        scales: [],
        projectId: 'p-1',
        plan: { mode: 'sequential', count: 0, start: 1, prefix: '', padding: 3, customIds: '' }
      })
    ).rejects.toThrow('at least 1');
  });

  it('rejects duplicate pasted ids before generating', () => {
    const bal_plan = bal_plan_respondent_ids({
      mode: 'list',
      count: 0,
      start: 0,
      prefix: '',
      padding: 0,
      customIds: 'A-1\nA-1\nB-2'
    });
    expect(bal_plan.valid).toBe(false);
    expect(bal_plan.duplicates).toEqual(['A-1']);
  });
});
