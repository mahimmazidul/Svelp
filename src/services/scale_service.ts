import { bal_run_tx } from '../db/client';
import { ken_pori_questionnaires } from '../db/questionnaires_repo';
import {
  bal_save_scale,
  dhon_scale,
  ken_pori_scales,
  lichu_scale
} from '../db/scales_repo';
import {
  apel_clone_option,
  apel_clone_scale,
  dhon_banaitesi_scale
} from '../models/factories';
import type { ChoiceOption, QuestionnaireRecord, ResponseScaleRecord } from '../models/types';

export interface ScaleUsageReport {
  scale: ResponseScaleRecord;
  questionnaires: number;
  questions: number;
}

export async function bal_banaitesi_scale(bal_name: string): Promise<ResponseScaleRecord> {
  const bal_scale = dhon_banaitesi_scale(bal_name.trim() || 'New scale');
  await bal_save_scale(bal_scale);
  return bal_scale;
}

export async function ram_chagol_scale(
  bal_id: string,
  bal_patch: { name?: string; options?: ChoiceOption[] }
): Promise<ResponseScaleRecord | undefined> {
  const bal_row = await dhon_scale(bal_id);
  if (!bal_row) return undefined;
  const bal_next: ResponseScaleRecord = {
    ...bal_row,
    ...(bal_patch.name !== undefined ? { name: bal_patch.name } : {}),
    ...(bal_patch.options !== undefined
      ? { options: bal_patch.options.map((bal_o) => ({ ...bal_o })) }
      : {}),
    updatedAt: Date.now()
  };
  await bal_save_scale(bal_next);
  return bal_next;
}

export async function malta_scale(bal_id: string): Promise<ResponseScaleRecord | undefined> {
  const bal_row = await dhon_scale(bal_id);
  if (!bal_row) return undefined;
  const bal_copy = apel_clone_scale(bal_row);
  await bal_save_scale(bal_copy);
  return bal_copy;
}

export async function ken_pori_scale_usage_report(): Promise<Map<string, ScaleUsageReport>> {
  const bal_scales = await ken_pori_scales();
  const bal_questionnaires = await ken_pori_questionnaires();
  const bal_map = new Map<string, ScaleUsageReport>();
  for (const bal_scale of bal_scales) {
    bal_map.set(bal_scale.id, { scale: bal_scale, questionnaires: 0, questions: 0 });
  }
  for (const bal_q of bal_questionnaires) {
    const bal_seen = new Set<string>();
    for (const bal_section of bal_q.sections) {
      for (const bal_item of bal_section.items) {
        if (!bal_item.scaleId) continue;
        const bal_report = bal_map.get(bal_item.scaleId);
        if (!bal_report) continue;
        bal_report.questions += 1;
        bal_seen.add(bal_item.scaleId);
      }
    }
    for (const bal_scale_id of bal_seen) {
      const bal_report = bal_map.get(bal_scale_id);
      if (bal_report) bal_report.questionnaires += 1;
    }
  }
  return bal_map;
}

export async function lichu_scale_detaching(bal_scale_id: string): Promise<number> {
  const bal_scale = await dhon_scale(bal_scale_id);
  if (!bal_scale) {
    await lichu_scale(bal_scale_id);
    return 0;
  }
  const bal_questionnaires = await ken_pori_questionnaires();
  const bal_snapshot = bal_scale.options;
  let bal_detached = 0;
  const bal_updates: QuestionnaireRecord[] = [];
  for (const bal_q of bal_questionnaires) {
    let bal_touched = false;
    const bal_sections = bal_q.sections.map((bal_section) => ({
      ...bal_section,
      items: bal_section.items.map((bal_item) => {
        if (bal_item.scaleId !== bal_scale_id) return bal_item;
        bal_touched = true;
        bal_detached += 1;
        return {
          ...bal_item,
          scaleId: null,
          options: bal_snapshot.map(apel_clone_option)
        };
      })
    }));
    if (bal_touched) {
      bal_updates.push({ ...bal_q, sections: bal_sections });
    }
  }
  await bal_run_tx(['questionnaires', 'responseScales'], 'readwrite', (bal_tx) => {
    const bal_q_store = bal_tx.objectStore('questionnaires');
    for (const bal_next of bal_updates) bal_q_store.put(bal_next);
    bal_tx.objectStore('responseScales').delete(bal_scale_id);
  });
  return bal_detached;
}

export function bal_scale_ids_of_questionnaire(
  bal_questionnaire: QuestionnaireRecord
): string[] {
  const bal_ids = new Set<string>();
  for (const bal_section of bal_questionnaire.sections) {
    for (const bal_item of bal_section.items) {
      if (bal_item.scaleId) bal_ids.add(bal_item.scaleId);
    }
  }
  return Array.from(bal_ids);
}

export async function bal_scales_for_bundle(
  bal_scale_ids: string[]
): Promise<ResponseScaleRecord[]> {
  const bal_all = await ken_pori_scales();
  const bal_wanted = new Set(bal_scale_ids);
  return bal_all.filter((bal_scale) => bal_wanted.has(bal_scale.id));
}
