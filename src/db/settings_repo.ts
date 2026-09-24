import { bal_get, bal_put } from './client';

export interface SettingRow<T> {
  key: string;
  value: T;
}

export async function dhon_setting<T>(bal_key: string): Promise<T | undefined> {
  const bal_row = await bal_get<SettingRow<T>>('settings', bal_key);
  return bal_row?.value;
}

export async function bal_save_setting<T>(bal_key: string, bal_value: T): Promise<void> {
  await bal_put('settings', { key: bal_key, value: bal_value } satisfies SettingRow<T>);
}
