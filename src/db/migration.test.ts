import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { BAL_DB_VERSION } from './client';

describe('local database migration v1 to current', () => {
  it('creates the responseScales store and preserves phase 1 records', async () => {
    const bal_req = indexedDB.open('svelp', 1);
    bal_req.onupgradeneeded = () => {
      const bal_db_v1 = bal_req.result;
      bal_db_v1.createObjectStore('projects', { keyPath: 'id' });
      bal_db_v1
        .createObjectStore('questionnaires', { keyPath: 'id' })
        .createIndex('projectId', 'projectId');
      bal_db_v1.createObjectStore('settings', { keyPath: 'key' });
    };
    await new Promise<void>((bal_resolve, bal_reject) => {
      bal_req.onsuccess = () => {
        const bal_db_v1 = bal_req.result;
        const bal_tx = bal_db_v1.transaction('projects', 'readwrite');
        bal_tx.objectStore('projects').put({
          id: 'legacy-project',
          title: 'Legacy 2024 Survey',
          description: 'Made in phase 1',
          status: 'active',
          createdAt: 1000,
          updatedAt: 2000
        });
        bal_tx.oncomplete = () => {
          bal_db_v1.close();
          bal_resolve();
        };
        bal_tx.onerror = () => bal_reject(bal_tx.error);
      };
      bal_req.onerror = () => bal_reject(bal_req.error);
    });

    const { open_kala_joshim, bal_get } = await import('./client');
    const bal_db = await open_kala_joshim();
    expect(bal_db.version).toBe(BAL_DB_VERSION);
    expect(bal_db.objectStoreNames.contains('responseScales')).toBe(true);
    expect(bal_db.objectStoreNames.contains('printLayouts')).toBe(true);
    expect(bal_db.objectStoreNames.contains('printBatches')).toBe(true);
    expect(bal_db.objectStoreNames.contains('projects')).toBe(true);

    const bal_legacy = await bal_get<{ id: string; title: string }>(
      'projects',
      'legacy-project'
    );
    expect(bal_legacy?.title).toBe('Legacy 2024 Survey');
    bal_db.close();
  });
});
