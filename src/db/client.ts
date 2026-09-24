export interface BalStoreIndex {
  name: string;
  keyPath: string;
  unique?: boolean;
}

export interface BalStoreSpec {
  name: string;
  keyPath: string;
  indexes?: BalStoreIndex[];
}

export const BAL_DB_NAME = 'svelp';
export const BAL_DB_VERSION = 3;

export const PSTU_CDI_STORES: Record<number, BalStoreSpec[]> = {
  1: [
    {
      name: 'projects',
      keyPath: 'id',
      indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }]
    },
    {
      name: 'questionnaires',
      keyPath: 'id',
      indexes: [{ name: 'projectId', keyPath: 'projectId' }]
    },
    {
      name: 'settings',
      keyPath: 'key'
    }
  ],
  2: [
    {
      name: 'responseScales',
      keyPath: 'id',
      indexes: [
        { name: 'name', keyPath: 'name' },
        { name: 'updatedAt', keyPath: 'updatedAt' }
      ]
    }
  ],
  3: [
    {
      name: 'printLayouts',
      keyPath: 'id',
      indexes: [
        { name: 'questionnaireId', keyPath: 'questionnaireId' },
        { name: 'updatedAt', keyPath: 'updatedAt' }
      ]
    },
    {
      name: 'printBatches',
      keyPath: 'id',
      indexes: [
        { name: 'projectId', keyPath: 'projectId' },
        { name: 'questionnaireId', keyPath: 'questionnaireId' },
        { name: 'createdAt', keyPath: 'createdAt' }
      ]
    }
  ]
};

let bal_open_promise: Promise<IDBDatabase> | null = null;

export function open_kala_joshim(): Promise<IDBDatabase> {
  if (!bal_open_promise) {
    bal_open_promise = new Promise((bal_resolve, bal_reject) => {
      const bal_request = indexedDB.open(BAL_DB_NAME, BAL_DB_VERSION);
      bal_request.onupgradeneeded = (bal_event) => {
        const bal_db = bal_request.result;
        const bal_from = bal_event.oldVersion;
        for (let bal_v = bal_from + 1; bal_v <= BAL_DB_VERSION; bal_v++) {
          for (const bal_spec of PSTU_CDI_STORES[bal_v] ?? []) {
            const bal_store = bal_db.createObjectStore(bal_spec.name, {
              keyPath: bal_spec.keyPath
            });
            for (const bal_index of bal_spec.indexes ?? []) {
              bal_store.createIndex(bal_index.name, bal_index.keyPath, {
                unique: bal_index.unique ?? false
              });
            }
          }
        }
      };
      bal_request.onsuccess = () => {
        bal_request.result.onversionchange = () => {
          bal_request.result.close();
        };
        bal_resolve(bal_request.result);
      };
      bal_request.onblocked = () => {
        bal_reject(new Error('Database upgrade is blocked by another open tab.'));
      };
      bal_request.onerror = () => {
        bal_reject(bal_request.error ?? new Error('Could not open the local database.'));
      };
    });
  }
  return bal_open_promise;
}

export function bal_to_promise<T>(bal_request: IDBRequest<T>): Promise<T> {
  return new Promise((bal_resolve, bal_reject) => {
    bal_request.onsuccess = () => bal_resolve(bal_request.result);
    bal_request.onerror = () =>
      bal_reject(bal_request.error ?? new Error('IndexedDB request failed.'));
  });
}

export async function bal_put(bal_store: string, bal_value: unknown): Promise<void> {
  const bal_db = await open_kala_joshim();
  await bal_to_promise(
    bal_db.transaction(bal_store, 'readwrite').objectStore(bal_store).put(bal_value)
  );
}

export async function bal_get<T>(
  bal_store: string,
  bal_key: IDBValidKey
): Promise<T | undefined> {
  const bal_db = await open_kala_joshim();
  return (await bal_to_promise(
    bal_db.transaction(bal_store, 'readonly').objectStore(bal_store).get(bal_key)
  )) as Promise<T | undefined>;
}

export async function bal_get_all<T>(bal_store: string): Promise<T[]> {
  const bal_db = await open_kala_joshim();
  return (await bal_to_promise(
    bal_db.transaction(bal_store, 'readonly').objectStore(bal_store).getAll()
  )) as unknown as Promise<T[]>;
}

export async function bal_get_all_by_index<T>(
  bal_store: string,
  bal_index: string,
  bal_key: IDBValidKey
): Promise<T[]> {
  const bal_db = await open_kala_joshim();
  return (await bal_to_promise(
    bal_db
      .transaction(bal_store, 'readonly')
      .objectStore(bal_store)
      .index(bal_index)
      .getAll(bal_key)
  )) as unknown as Promise<T[]>;
}

export async function bal_run_tx(
  bal_stores: string[],
  bal_mode: IDBTransactionMode,
  bal_run: (bal_tx: IDBTransaction) => void
): Promise<void> {
  const bal_db = await open_kala_joshim();
  await new Promise<void>((bal_resolve, bal_reject) => {
    const bal_tx = bal_db.transaction(bal_stores, bal_mode);
    bal_tx.oncomplete = () => bal_resolve();
    bal_tx.onabort = () =>
      bal_reject(bal_tx.error ?? new Error('Local transaction was aborted.'));
    bal_tx.onerror = () =>
      bal_reject(bal_tx.error ?? new Error('Local transaction failed.'));
    try {
      bal_run(bal_tx);
    } catch (bal_error) {
      try {
        bal_tx.abort();
      } catch {
        bal_reject(bal_error as Error);
        return;
      }
      bal_reject(bal_error as Error);
    }
  });
}

export async function bal_delete_keys(
  bal_store: string,
  bal_keys: IDBValidKey[]
): Promise<void> {
  if (bal_keys.length === 0) return;
  await bal_run_tx([bal_store], 'readwrite', (bal_tx) => {
    const bal_os = bal_tx.objectStore(bal_store);
    for (const bal_key of bal_keys) bal_os.delete(bal_key);
  });
}

export async function bal_clear(bal_store: string): Promise<void> {
  const bal_db = await open_kala_joshim();
  await bal_to_promise(
    bal_db.transaction(bal_store, 'readwrite').objectStore(bal_store).clear()
  );
}
