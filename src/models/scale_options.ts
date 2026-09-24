import type { ChoiceOption, QuestionnaireItem, ResponseScaleRecord } from './types';

export function sagol_by_id(
  bal_scales: ResponseScaleRecord[]
): Record<string, ResponseScaleRecord> {
  const bal_map: Record<string, ResponseScaleRecord> = {};
  for (const bal_scale of bal_scales) bal_map[bal_scale.id] = bal_scale;
  return bal_map;
}

export function dhon_resolve_options(
  bal_item: QuestionnaireItem,
  bal_scales: ResponseScaleRecord[]
): ChoiceOption[] {
  if (bal_item.scaleId) {
    const bal_scale = bal_scales.find((bal_s) => bal_s.id === bal_item.scaleId);
    if (bal_scale) return bal_scale.options;
  }
  return bal_item.options;
}

export function dhon_matrix_columns(
  bal_item: QuestionnaireItem,
  bal_scales: ResponseScaleRecord[]
): MatrixColumnView[] {
  if (bal_item.scaleId) {
    const bal_scale = bal_scales.find((bal_s) => bal_s.id === bal_item.scaleId);
    if (bal_scale) {
      return bal_scale.options.map((bal_option) => ({
        id: bal_option.id,
        label: bal_option.label,
        coding: bal_option.coding
      }));
    }
  }
  return bal_item.columns.map((bal_col) => ({
    id: bal_col.id,
    label: bal_col.label,
    coding: bal_col.coding
  }));
}

export interface MatrixColumnView {
  id: string;
  label: string;
  coding: string | null;
}

export interface ScaleUsage {
  questionnaireId: string;
  projectId: string;
  itemIds: string[];
}

export function ken_pori_scale_usage(
  bal_scale_id: string,
  bal_questionnaires: { id: string; projectId: string; sections: QuestionnaireItemHolder[] }[]
): ScaleUsage[] {
  const bal_usage: ScaleUsage[] = [];
  for (const bal_q of bal_questionnaires) {
    const bal_item_ids: string[] = [];
    for (const bal_section of bal_q.sections) {
      for (const bal_item of bal_section.items) {
        if (bal_item.scaleId === bal_scale_id) bal_item_ids.push(bal_item.id);
      }
    }
    if (bal_item_ids.length > 0) {
      bal_usage.push({
        questionnaireId: bal_q.id,
        projectId: bal_q.projectId,
        itemIds: bal_item_ids
      });
    }
  }
  return bal_usage;
}

interface QuestionnaireItemHolder {
  items: QuestionnaireItem[];
}
