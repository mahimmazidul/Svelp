import { bal_delete_keys, bal_get, bal_get_all, bal_put } from './client';
import type { ResponseScaleRecord } from '../models/types';

export async function ken_pori_scales(): Promise<ResponseScaleRecord[]> {
  const bal_rows = await bal_get_all<ResponseScaleRecord>('responseScales');
  return bal_rows.sort(
    (bal_a, bal_b) => bal_a.name.localeCompare(bal_b.name) || bal_a.id.localeCompare(bal_b.id)
  );
}

export async function dhon_scale(bal_id: string): Promise<ResponseScaleRecord | undefined> {
  return bal_get<ResponseScaleRecord>('responseScales', bal_id);
}

export async function bal_save_scale(bal_row: ResponseScaleRecord): Promise<void> {
  await bal_put('responseScales', bal_row);
}

export async function lichu_scale(bal_id: string): Promise<void> {
  await bal_delete_keys('responseScales', [bal_id]);
}
