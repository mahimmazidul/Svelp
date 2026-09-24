import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { BAL_DB_VERSION, open_kala_joshim } from './client';

describe('local database migration to v4', () => {
  it('creates scan stores while preserving earlier stores and records', async () => {
    const { bal_clear, bal_put } = await import('./client');
    await bal_clear('projects');
    await bal_clear('scanBatches');
    await bal_put('projects', {
      id: 'legacy-1',
      title: 'Kept project',
      description: '',
      status: 'active',
      createdAt: 1,
      updatedAt: 2
    });
    const bal_db = await open_kala_joshim();
    expect(bal_db.version).toBe(BAL_DB_VERSION);
    for (const bal_store of ['scanBatches', 'scanPages', 'scanAssets', 'scanAuditEvents']) {
      expect(bal_db.objectStoreNames.contains(bal_store)).toBe(true);
    }
    expect(bal_db.objectStoreNames.contains('projects')).toBe(true);
    expect(bal_db.objectStoreNames.contains('responseScales')).toBe(true);
    expect(bal_db.objectStoreNames.contains('printLayouts')).toBe(true);
    const { bal_get } = await import('./client');
    const bal_row = await bal_get<{ id: string; title: string }>('projects', 'legacy-1');
    expect(bal_row?.title).toBe('Kept project');
    bal_db.close();
  });
});
