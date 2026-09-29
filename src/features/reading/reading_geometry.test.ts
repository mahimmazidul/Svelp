import { describe, expect, it } from 'vitest';
import { bal_reading_regions_for_page, bal_selection_rules_from_questionnaire } from './reading_geometry';
import { bal_build_print_document } from '../print/print_layout';
import { bal_frequency_scale, bal_mixed_survey } from '../print/print_fixtures';
import type { QuestionnaireItem } from '../../models/types';

function bal_item_with_validation(bal_patch: Partial<QuestionnaireItem>): QuestionnaireItem {
  return {
    id: 'mv1',
    type: 'multiple_choice',
    variableName: 'meals',
    label: 'Meals',
    required: false,
    options: [],
    coding: null,
    validation: { minSelections: 1, maxSelections: 3 },
    scannerConfig: null,
    printConfig: null,
    metadata: null,
    scaleId: null,
    placeholder: null,
    heading: null,
    emphasis: 'normal',
    rows: [],
    columns: [],
    selectionMode: 'single',
    consent: null,
    signature: null,
    unitLabel: null,
    ...bal_patch
  };
}

describe('reading geometry bridge', () => {
  it('maps print answer regions to reading regions on the right page', () => {
    const bal_doc = bal_build_print_document({
      questionnaire: bal_mixed_survey(),
      scales: [bal_frequency_scale()]
    });
    for (const bal_page of bal_doc.pages) {
      const bal_regions = bal_reading_regions_for_page(bal_doc, bal_page.pageNumber);
      expect(bal_regions).toHaveLength(bal_page.geometry.answerRegions.length);
      for (const bal_region of bal_regions) {
        expect(bal_region.rectMm.x).toBeGreaterThanOrEqual(0);
        expect(bal_region.rectMm.y).toBeGreaterThanOrEqual(0);
        expect(bal_region.rectMm.width).toBeGreaterThan(0);
      }
    }
  });

  it('keeps checkbox multiple and bubble single semantics from the layout', () => {
    const bal_doc = bal_build_print_document({
      questionnaire: bal_mixed_survey(),
      scales: [bal_frequency_scale()]
    });
    const bal_all = bal_doc.pages.flatMap((bal_p) => bal_reading_regions_for_page(bal_doc, bal_p.pageNumber));
    const bal_multiple = bal_all.filter((bal_r) => bal_r.selection === 'multiple');
    expect(bal_multiple.length).toBeGreaterThan(0);
    for (const bal_region of bal_multiple) {
      expect(bal_region.markerType).toBe('checkbox');
    }
    const bal_single_bubble = bal_all.find((bal_r) => bal_r.selection === 'single');
    expect(bal_single_bubble?.markerType).toBe('bubble');
  });

  it('extracts selection rules only where validation sets bounds', () => {
    const bal_doc = bal_build_print_document({
      questionnaire: bal_mixed_survey(),
      scales: [bal_frequency_scale()]
    });
    const bal_plain = bal_selection_rules_from_questionnaire(bal_mixed_survey());
    for (const bal_key of Object.keys(bal_plain)) {
      const bal_rules = bal_plain[bal_key];
      expect(bal_rules.minSelections !== null || bal_rules.maxSelections !== null).toBe(true);
    }
    void bal_doc;

    const bal_q = bal_mixed_survey();
    bal_q.sections[1].items = [
      ...bal_q.sections[1].items,
      bal_item_with_validation({ id: 'mv9', validation: { minSelections: null, maxSelections: 2 } })
    ];
    const bal_rules = bal_selection_rules_from_questionnaire(bal_q);
    expect(bal_rules.mv9).toEqual({ minSelections: null, maxSelections: 2 });
  });
});
