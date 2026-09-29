import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { BAL_DB_VERSION, open_kala_joshim } from './client';

describe('local database migration to v5', () => {
  it('creates response stores while preserving scan and questionnaire data', async () => {
    const { bal_clear, bal_put, bal_get } = await import('./client');
    await bal_clear('scanBatches');
    await bal_clear('responses');
    await bal_put('scanBatches', {
      id: 'legacy-scan',
      projectId: 'p-1',
      questionnaireId: null,
      questionnaireVersion: null,
      status: 'done',
      keepOriginals: true,
      summary: {
        totalPages: 0,
        ready: 0,
        needsReview: 0,
        duplicates: 0,
        failed: 0,
        unsupported: 0,
        queued: 0,
        respondents: 0,
        complete: 0,
        incomplete: 0
      },
      createdAt: 1,
      updatedAt: 2
    });
    const { ken_pori_scan_batches } = await import('./scan_repo');
    const bal_batches = await ken_pori_scan_batches('p-1');
    expect(bal_batches).toHaveLength(1);
    expect(bal_batches[0].id).toBe('legacy-scan');
    const bal_row = await bal_get<{ id: string }>('scanBatches', 'legacy-scan');
    expect(bal_row?.id).toBe('legacy-scan');
    const bal_db = await open_kala_joshim();
    expect(bal_db.version).toBe(BAL_DB_VERSION);
    for (const bal_store of ['responses', 'recognitionRuns', 'responseAuditEvents', 'blankReferences']) {
      expect(bal_db.objectStoreNames.contains(bal_store)).toBe(true);
    }
    for (const bal_store of ['scanBatches', 'scanPages', 'scanAssets', 'printLayouts', 'questionnaires']) {
      expect(bal_db.objectStoreNames.contains(bal_store)).toBe(true);
    }
    bal_db.close();
  });
});
