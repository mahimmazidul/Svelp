import type { QuestionnaireRecord } from '../../models/types';
import type { AnswerRegion, bal_PrintDocument } from '../print/print_layout';
import type { bal_ReadingRegion } from './reading_fixtures';
import type { bal_SelectionRules } from './reading_interpret';

export function bal_reading_region_from_answer(bal_region: AnswerRegion): bal_ReadingRegion {
  return {
    itemId: bal_region.itemId,
    variableName: bal_region.variableName,
    itemType: bal_region.itemType,
    kind: bal_region.kind,
    selection: bal_region.selection,
    markerType: bal_region.markerType,
    optionId: bal_region.optionId,
    optionCode: bal_region.optionCode,
    rowId: bal_region.rowId,
    columnId: bal_region.columnId,
    rectMm: {
      x: bal_region.rect.x,
      y: bal_region.rect.y,
      width: bal_region.rect.width,
      height: bal_region.rect.height
    }
  };
}

export function bal_reading_regions_for_page(
  bal_doc: bal_PrintDocument,
  bal_page_number: number
): bal_ReadingRegion[] {
  const bal_page = bal_doc.pages.find((bal_p) => bal_p.pageNumber === bal_page_number);
  if (!bal_page) return [];
  return bal_page.geometry.answerRegions.map((bal_region) => bal_reading_region_from_answer(bal_region));
}

export function bal_selection_rules_from_questionnaire(
  bal_questionnaire: QuestionnaireRecord
): Record<string, bal_SelectionRules> {
  const bal_rules: Record<string, bal_SelectionRules> = {};
  for (const bal_section of bal_questionnaire.sections) {
    for (const bal_item of bal_section.items) {
      const bal_min = bal_item.validation?.minSelections ?? null;
      const bal_max = bal_item.validation?.maxSelections ?? null;
      if (bal_min !== null || bal_max !== null) {
        bal_rules[bal_item.id] = { minSelections: bal_min, maxSelections: bal_max };
      }
    }
  }
  return bal_rules;
}
