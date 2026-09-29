import type { RecognitionThresholdProfile } from '../../models/response_models';
import type { bal_SyntheticPage } from './reading_fixtures';
import type { bal_ReadingRegion } from './reading_fixtures';
import { bal_crop_region, bal_extract_region_features, type bal_RegionFeatures } from './reading_extract';
import { bal_calibrate_thresholds, bal_score_region, type bal_MarkResult } from './reading_marks';
import {
  bal_interpret_consent,
  bal_interpret_multiple_choice,
  bal_interpret_single_choice,
  type bal_ItemReading,
  type bal_OptionMark,
  type bal_QualitySignals,
  type bal_SelectionRules
} from './reading_interpret';

export interface bal_ReadPageInput {
  image: bal_SyntheticPage;
  blank: bal_SyntheticPage;
  regions: bal_ReadingRegion[];
  quality: bal_QualitySignals;
  pxPerMm: number;
  profile: RecognitionThresholdProfile;
  selectionRules: Record<string, bal_SelectionRules>;
}

export interface bal_ReadPageOutput {
  marks: (bal_MarkResult & { regionIndex: number })[];
  items: bal_ItemReading[];
  manualOnlyRegions: bal_ReadingRegion[];
}

const BAL_READABLE_KINDS = new Set(['choice', 'matrix', 'consent']);

const BAL_EMPTY_MARK: bal_MarkResult = {
  markDetected: false,
  rawInkScore: 0,
  normalizedInkScore: 0,
  localNoiseEstimate: 0,
  inkDepth: 0,
  confidence: 0,
  glareExceeded: false,
  diagnostics: {
    addedRatio: 0,
    centerRatio: 0,
    strokeArea: 0,
    strokeDarkArea: 0,
    meanInkDepth: 0,
    glareRatio: 0,
    effectiveCenterRatio: 0,
    effectiveAddedRatio: 0,
    noiseFloor: 0,
    glareExceeded: false
  }
};

export function bal_read_page(bal_input: bal_ReadPageInput): bal_ReadPageOutput {
  const bal_features: bal_RegionFeatures[] = [];
  const bal_readable_indexes: number[] = [];
  bal_input.regions.forEach((bal_region, bal_index) => {
    if (!BAL_READABLE_KINDS.has(bal_region.kind)) {
      bal_features.push({
        addedRatio: 0,
        centerRatio: 0,
        strokeArea: 0,
        strokeDarkArea: 0,
        meanInkDepth: 0,
        ringNoise: 0,
        glareRatio: 0,
        darknessDepth: 0,
        blankInkRatio: 0,
        componentCount: 0
      });
      return;
    }
    const bal_scan_crop = bal_crop_region(bal_input.image, bal_region, bal_input.pxPerMm, bal_input.profile.regionMarginMm);
    const bal_blank_crop = bal_crop_region(bal_input.blank, bal_region, bal_input.pxPerMm, bal_input.profile.regionMarginMm);
    bal_features.push(bal_extract_region_features(bal_scan_crop, bal_blank_crop, bal_input.profile.inkDeltaGray));
    bal_readable_indexes.push(bal_index);
  });
  const bal_calibrated = bal_calibrate_thresholds(
    bal_readable_indexes.map((bal_index) => bal_features[bal_index]),
    bal_input.profile
  );
  const bal_marks: (bal_MarkResult & { regionIndex: number })[] = [];
  const bal_marks_by_index = new Map<number, bal_MarkResult>();
  for (const bal_index of bal_readable_indexes) {
    const bal_mark = bal_score_region(bal_features[bal_index], bal_calibrated, bal_input.profile);
    bal_marks.push({ ...bal_mark, regionIndex: bal_index });
    bal_marks_by_index.set(bal_index, bal_mark);
  }

  const bal_items: bal_ItemReading[] = [];
  const bal_manual_only: bal_ReadingRegion[] = [];
  const bal_groups = new Map<string, bal_ReadingRegion[]>();
  for (const bal_region of bal_input.regions) {
    if (!BAL_READABLE_KINDS.has(bal_region.kind)) {
      bal_manual_only.push(bal_region);
      continue;
    }
    const bal_key =
      bal_region.kind === 'matrix' ? `${bal_region.itemId}::${bal_region.rowId ?? ''}` : bal_region.itemId;
    const bal_existing = bal_groups.get(bal_key);
    if (bal_existing) bal_existing.push(bal_region);
    else bal_groups.set(bal_key, [bal_region]);
  }
  for (const bal_group_regions of bal_groups.values()) {
    const bal_first = bal_group_regions[0];
    const bal_options: bal_OptionMark[] = bal_group_regions.map((bal_region) => ({
      optionId: bal_region.optionId,
      optionCode: bal_region.optionCode,
      columnId: bal_region.columnId,
      mark: bal_marks_by_index.get(bal_input.regions.indexOf(bal_region)) ?? BAL_EMPTY_MARK
    }));
    if (bal_first.kind === 'consent') {
      bal_items.push(bal_interpret_consent(bal_first.itemId, bal_options, bal_input.quality));
      continue;
    }
    const bal_row_id = bal_first.kind === 'matrix' ? bal_first.rowId : null;
    if (bal_first.selection === 'multiple') {
      bal_items.push(
        bal_interpret_multiple_choice(
          bal_first.itemId,
          bal_first.variableName,
          bal_first.itemType,
          bal_row_id,
          bal_options,
          bal_input.selectionRules[bal_first.itemId] ?? { minSelections: null, maxSelections: null },
          bal_input.quality,
          bal_input.profile
        )
      );
    } else {
      bal_items.push(
        bal_interpret_single_choice(
          bal_first.itemId,
          bal_first.variableName,
          bal_first.itemType,
          bal_row_id,
          bal_options,
          bal_input.quality,
          bal_input.profile
        )
      );
    }
  }
  return { marks: bal_marks, items: bal_items, manualOnlyRegions: bal_manual_only };
}
