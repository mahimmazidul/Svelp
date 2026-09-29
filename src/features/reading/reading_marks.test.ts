import { describe, expect, it } from 'vitest';
import {
  bal_render_blank_instrument,
  bal_render_marked_scan,
  type bal_MarkSpec,
  type bal_ReadingRegion
} from './reading_fixtures';
import { bal_crop_region, bal_extract_region_features } from './reading_extract';
import { bal_calibrate_thresholds, bal_page_noise_floor, bal_score_region } from './reading_marks';
import { bal_read_page } from './reading_engine';
import type { RecognitionThresholdProfile } from '../../models/response_models';
import { BAL_DEFAULT_THRESHOLD_PROFILE } from '../../models/response_models';

const BAL_PPM = 5.9;

function bal_choice_region(
  bal_index: number,
  bal_item_id = 'q1',
  bal_marker: 'bubble' | 'checkbox' = 'bubble',
  bal_selection: 'single' | 'multiple' = 'single'
): bal_ReadingRegion {
  return {
    itemId: bal_item_id,
    variableName: 'fish_freq',
    itemType: 'single_choice',
    kind: 'choice',
    selection: bal_selection,
    markerType: bal_marker,
    optionId: `opt-${bal_index}`,
    optionCode: String(bal_index + 1),
    rowId: null,
    columnId: null,
    rectMm: { x: 150, y: 40 + bal_index * 12, width: 7.6, height: 7.6 }
  };
}

function bal_features_for(
  bal_regions: bal_ReadingRegion[],
  bal_marks: bal_MarkSpec[],
  bal_effects = {}
) {
  const bal_blank = bal_render_blank_instrument(bal_regions, BAL_PPM);
  const bal_scan = bal_render_marked_scan(bal_blank, bal_regions, bal_marks, BAL_PPM, bal_effects);
  return bal_regions.map((bal_region) => {
    const bal_scan_crop = bal_crop_region(bal_scan, bal_region, BAL_PPM, 2.6);
    const bal_blank_crop = bal_crop_region(bal_blank, bal_region, BAL_PPM, 2.6);
    return bal_extract_region_features(bal_scan_crop, bal_blank_crop, 45);
  });
}

const bal_quality_good = {
  blurStatus: 'good',
  exposureStatus: 'good',
  glareStatus: 'good',
  resolutionStatus: 'good',
  alignmentStatus: 'good'
};

describe('added-ink extraction', () => {
  it('produces near-zero features when scan matches the blank reference', () => {
    const bal_regions = [0, 1, 2, 3].map((bal_i) => bal_choice_region(bal_i));
    const bal_features = bal_features_for(bal_regions, []);
    for (const bal_feature of bal_features) {
      expect(bal_feature.addedRatio).toBeLessThan(0.01);
      expect(bal_feature.centerRatio).toBeLessThan(0.01);
      expect(bal_feature.strokeArea).toBeLessThan(5);
    }
  });

  it('sees a filled bubble but not the printed ring', () => {
    const bal_regions = [0, 1, 2, 3].map((bal_i) => bal_choice_region(bal_i));
    const bal_features = bal_features_for(bal_regions, [{ regionIndex: 2, style: 'fill' }]);
    expect(bal_features[2].centerRatio).toBeGreaterThan(0.6);
    expect(bal_features[0].centerRatio).toBeLessThan(0.02);
    expect(bal_features[2].blankInkRatio).toBeGreaterThan(0.05);
  });

  it('detects tick, cross, and slash strokes', () => {
    const bal_regions = [0, 1, 2, 3].map((bal_i) => bal_choice_region(bal_i));
    const bal_features = bal_features_for(bal_regions, [
      { regionIndex: 0, style: 'tick' },
      { regionIndex: 1, style: 'cross' },
      { regionIndex: 2, style: 'slash' }
    ]);
    expect(bal_features[0].strokeArea).toBeGreaterThan(14);
    expect(bal_features[1].strokeArea).toBeGreaterThan(14);
    expect(bal_features[2].strokeArea).toBeGreaterThan(14);
    expect(bal_features[3].strokeArea).toBeLessThan(8);
  });

  it('keeps partial and faint marks below full-fill evidence', () => {
    const bal_regions = [0, 1, 2].map((bal_i) => bal_choice_region(bal_i));
    const bal_features = bal_features_for(bal_regions, [
      { regionIndex: 0, style: 'fill' },
      { regionIndex: 1, style: 'partial' },
      { regionIndex: 2, style: 'faint' }
    ]);
    expect(bal_features[0].centerRatio).toBeGreaterThan(bal_features[1].centerRatio);
    expect(bal_features[2].centerRatio).toBeLessThan(bal_features[0].centerRatio);
    expect(bal_features[2].centerRatio).toBeGreaterThan(0.1);
  });

  it('survives a mild page shadow and light noise', () => {
    const bal_regions = [0, 1, 2, 3].map((bal_i) => bal_choice_region(bal_i));
    const bal_features = bal_features_for(
      bal_regions,
      [{ regionIndex: 1, style: 'fill' }],
      { shadowStrength: 30, noiseSeed: 5, noiseAmount: 8 }
    );
    expect(bal_features[1].centerRatio).toBeGreaterThan(0.4);
    expect(bal_features[0].centerRatio).toBeLessThan(0.05);
  });

  it('keeps a marked region detectable under mild blur', () => {
    const bal_regions = [0, 1, 2].map((bal_i) => bal_choice_region(bal_i));
    const bal_features = bal_features_for(
      bal_regions,
      [{ regionIndex: 0, style: 'fill' }],
      { blurRadius: 2 }
    );
    expect(bal_features[0].centerRatio).toBeGreaterThan(0.3);
  });

  it('marks glare over a region but not glare elsewhere', () => {
    const bal_regions = [0, 1].map((bal_i) => bal_choice_region(bal_i));
    const bal_center = {
      x: (bal_regions[0].rectMm.x + 3.8) * BAL_PPM,
      y: (bal_regions[0].rectMm.y + 3.8) * BAL_PPM
    };
    const bal_over = bal_features_for(bal_regions, [], {
      glareSpots: [{ cx: bal_center.x, cy: bal_center.y, r: 20 }]
    });
    expect(bal_over[0].glareRatio).toBeGreaterThan(0.3);
    const bal_away = bal_features_for(bal_regions, [], {
      glareSpots: [{ cx: 100, cy: 100, r: 25 }]
    });
    expect(bal_away[0].glareRatio).toBeLessThan(0.05);
  });
});

describe('mark scoring and calibration', () => {
  it('scores a fill above the default threshold and a blank below', () => {
    const bal_regions = [0, 1].map((bal_i) => bal_choice_region(bal_i));
    const bal_features = bal_features_for(bal_regions, [{ regionIndex: 0, style: 'fill' }]);
    const bal_calibrated = bal_calibrate_thresholds(bal_features, BAL_DEFAULT_THRESHOLD_PROFILE);
    const bal_mark = bal_score_region(bal_features[0], bal_calibrated, BAL_DEFAULT_THRESHOLD_PROFILE);
    const bal_empty = bal_score_region(bal_features[1], bal_calibrated, BAL_DEFAULT_THRESHOLD_PROFILE);
    expect(bal_mark.markDetected).toBe(true);
    expect(bal_empty.markDetected).toBe(false);
    expect(bal_mark.normalizedInkScore).toBeGreaterThan(0.8);
    expect(bal_empty.normalizedInkScore).toBeLessThan(0.05);
  });

  it('raises thresholds when the page has a high noise floor', () => {
    const bal_profile: RecognitionThresholdProfile = {
      ...BAL_DEFAULT_THRESHOLD_PROFILE,
      noiseMultiplier: 3
    };
    const bal_noisy = [0, 1, 2, 3].map(() => ({
      addedRatio: 0.02,
      centerRatio: 0.01,
      strokeArea: 3,
      strokeDarkArea: 1,
      meanInkDepth: 0.2,
      ringNoise: 0.06,
      glareRatio: 0,
      darknessDepth: 0.2,
      blankInkRatio: 0.1,
      componentCount: 2
    }));
    const bal_calibrated = bal_calibrate_thresholds(bal_noisy, bal_profile);
    expect(bal_calibrated.noiseFloor).toBeCloseTo(0.06, 5);
    const bal_scored = bal_score_region(bal_noisy[0], bal_calibrated, bal_profile);
    expect(bal_scored.diagnostics.effectiveCenterRatio).toBeGreaterThan(bal_profile.markCenterRatio);
    expect(bal_page_noise_floor(bal_noisy)).toBeCloseTo(0.06, 5);
  });

  it('detects tick, cross, slash, partial, faint, and pencil marks', () => {
    const bal_regions = [0, 1, 2, 3, 4, 5].map((bal_i) => bal_choice_region(bal_i));
    const bal_features = bal_features_for(bal_regions, [
      { regionIndex: 0, style: 'fill' },
      { regionIndex: 1, style: 'tick' },
      { regionIndex: 2, style: 'cross' },
      { regionIndex: 3, style: 'slash' },
      { regionIndex: 4, style: 'partial' },
      { regionIndex: 5, style: 'pencil' }
    ]);
    const bal_calibrated = bal_calibrate_thresholds(bal_features, BAL_DEFAULT_THRESHOLD_PROFILE);
    for (let bal_i = 0; bal_i < 6; bal_i++) {
      const bal_mark = bal_score_region(bal_features[bal_i], bal_calibrated, BAL_DEFAULT_THRESHOLD_PROFILE);
      expect(bal_mark.markDetected, `style index ${bal_i}`).toBe(true);
    }
  });
});

describe('page interpretation', () => {
  it('reads one filled bubble as an accepted single-choice answer', () => {
    const bal_regions = [0, 1, 2, 3].map((bal_i) => bal_choice_region(bal_i));
    const bal_blank = bal_render_blank_instrument(bal_regions, BAL_PPM);
    const bal_scan = bal_render_marked_scan(bal_blank, bal_regions, [{ regionIndex: 2, style: 'fill' }], BAL_PPM);
    const bal_output = bal_read_page({
      image: bal_scan,
      blank: bal_blank,
      regions: bal_regions,
      quality: bal_quality_good,
      pxPerMm: BAL_PPM,
      profile: BAL_DEFAULT_THRESHOLD_PROFILE,
      selectionRules: {}
    });
    expect(bal_output.items).toHaveLength(1);
    expect(bal_output.items[0].status).toBe('accepted');
    expect(bal_output.items[0].value).toEqual([
      { optionId: 'opt-2', optionCode: '3', columnId: null }
    ]);
    expect(bal_output.items[0].confidence).toBeGreaterThan(0.75);
  });

  it('reports blank for an untouched question', () => {
    const bal_regions = [0, 1, 2].map((bal_i) => bal_choice_region(bal_i));
    const bal_blank = bal_render_blank_instrument(bal_regions, BAL_PPM);
    const bal_output = bal_read_page({
      image: bal_blank,
      blank: bal_blank,
      regions: bal_regions,
      quality: bal_quality_good,
      pxPerMm: BAL_PPM,
      profile: BAL_DEFAULT_THRESHOLD_PROFILE,
      selectionRules: {}
    });
    expect(bal_output.items[0].status).toBe('blank');
    expect(bal_output.items[0].value).toEqual([]);
  });

  it('flags two marked single-choice options for review', () => {
    const bal_regions = [0, 1, 2, 3].map((bal_i) => bal_choice_region(bal_i));
    const bal_blank = bal_render_blank_instrument(bal_regions, BAL_PPM);
    const bal_scan = bal_render_marked_scan(
      bal_blank,
      bal_regions,
      [
        { regionIndex: 0, style: 'fill' },
        { regionIndex: 2, style: 'fill' }
      ],
      BAL_PPM
    );
    const bal_output = bal_read_page({
      image: bal_scan,
      blank: bal_blank,
      regions: bal_regions,
      quality: bal_quality_good,
      pxPerMm: BAL_PPM,
      profile: BAL_DEFAULT_THRESHOLD_PROFILE,
      selectionRules: {}
    });
    expect(bal_output.items[0].status).toBe('multiple-marks');
    expect(bal_output.items[0].value).toHaveLength(2);
  });

  it('does not auto-accept a soft pencil smudge', () => {
    const bal_regions = [0, 1, 2].map((bal_i) => bal_choice_region(bal_i));
    const bal_blank = bal_render_blank_instrument(bal_regions, BAL_PPM);
    const bal_scan = bal_render_marked_scan(bal_blank, bal_regions, [{ regionIndex: 1, style: 'pencil' }], BAL_PPM, {
      blurRadius: 3
    });
    const bal_output = bal_read_page({
      image: bal_scan,
      blank: bal_blank,
      regions: bal_regions,
      quality: bal_quality_good,
      pxPerMm: BAL_PPM,
      profile: BAL_DEFAULT_THRESHOLD_PROFILE,
      selectionRules: {}
    });
    expect(['ambiguous', 'needs-review']).toContain(bal_output.items[0].status);
    expect(bal_output.items[0].status).not.toBe('blank');
  });

  it('reads multiple-choice selections and flags over-selection', () => {
    const bal_regions = [0, 1, 2, 3, 4].map((bal_i) => bal_choice_region(bal_i, 'm1', 'checkbox', 'multiple'));
    const bal_blank = bal_render_blank_instrument(bal_regions, BAL_PPM);
    const bal_ok_scan = bal_render_marked_scan(
      bal_blank,
      bal_regions,
      [
        { regionIndex: 1, style: 'tick' },
        { regionIndex: 3, style: 'cross' }
      ],
      BAL_PPM
    );
    const bal_ok = bal_read_page({
      image: bal_ok_scan,
      blank: bal_blank,
      regions: bal_regions,
      quality: bal_quality_good,
      pxPerMm: BAL_PPM,
      profile: BAL_DEFAULT_THRESHOLD_PROFILE,
      selectionRules: { m1: { minSelections: 1, maxSelections: 3 } }
    });
    expect(bal_ok.items[0].status).toBe('accepted');
    expect(bal_ok.items[0].value.map((bal_v) => bal_v.optionId).sort()).toEqual(['opt-1', 'opt-3']);

    const bal_over_scan = bal_render_marked_scan(
      bal_blank,
      bal_regions,
      [
        { regionIndex: 0, style: 'tick' },
        { regionIndex: 1, style: 'tick' },
        { regionIndex: 2, style: 'tick' },
        { regionIndex: 3, style: 'tick' }
      ],
      BAL_PPM
    );
    const bal_over = bal_read_page({
      image: bal_over_scan,
      blank: bal_blank,
      regions: bal_regions,
      quality: bal_quality_good,
      pxPerMm: BAL_PPM,
      profile: BAL_DEFAULT_THRESHOLD_PROFILE,
      selectionRules: { m1: { minSelections: 1, maxSelections: 3 } }
    });
    expect(bal_over.items[0].status).toBe('multiple-marks');
    expect(bal_over.items[0].value).toHaveLength(4);
  });

  it('reads a matrix row and keeps the row id', () => {
    const bal_row_regions = (bal_row_id: string, bal_y: number) =>
      [0, 1, 2, 3].map((bal_c) => ({
        itemId: 'mx1',
        variableName: 'matrix_agree',
        itemType: 'matrix',
        kind: 'matrix' as const,
        selection: 'single' as const,
        markerType: 'bubble' as const,
        optionId: null,
        optionCode: String(bal_c + 1),
        rowId: bal_row_id,
        columnId: `col-${bal_c}`,
        rectMm: { x: 120 + bal_c * 14, y: bal_y, width: 7.6, height: 7.6 }
      }));
    const bal_regions = [...bal_row_regions('row-a', 40), ...bal_row_regions('row-b', 60)];
    const bal_blank = bal_render_blank_instrument(bal_regions, BAL_PPM);
    const bal_scan = bal_render_marked_scan(bal_blank, bal_regions, [{ regionIndex: 6, style: 'fill' }], BAL_PPM);
    const bal_output = bal_read_page({
      image: bal_scan,
      blank: bal_blank,
      regions: bal_regions,
      quality: bal_quality_good,
      pxPerMm: BAL_PPM,
      profile: BAL_DEFAULT_THRESHOLD_PROFILE,
      selectionRules: {}
    });
    expect(bal_output.items).toHaveLength(2);
    const bal_row_b = bal_output.items.find((bal_item) => bal_item.rowId === 'row-b');
    expect(bal_row_b?.status).toBe('accepted');
    expect(bal_row_b?.value[0].columnId).toBe('col-2');
    expect(bal_row_b?.codedValue).toEqual(['3']);
    const bal_row_a = bal_output.items.find((bal_item) => bal_item.rowId === 'row-a');
    expect(bal_row_a?.status).toBe('blank');
  });

  it('marks a two-mark matrix row for review', () => {
    const bal_row_regions = (bal_row_id: string, bal_y: number) =>
      [0, 1, 2, 3].map((bal_c) => ({
        itemId: 'mx1',
        variableName: 'matrix_agree',
        itemType: 'matrix',
        kind: 'matrix' as const,
        selection: 'single' as const,
        markerType: 'bubble' as const,
        optionId: null,
        optionCode: String(bal_c + 1),
        rowId: bal_row_id,
        columnId: `col-${bal_c}`,
        rectMm: { x: 120 + bal_c * 14, y: bal_y, width: 7.6, height: 7.6 }
      }));
    const bal_regions = bal_row_regions('row-a', 40);
    const bal_blank = bal_render_blank_instrument(bal_regions, BAL_PPM);
    const bal_scan = bal_render_marked_scan(
      bal_blank,
      bal_regions,
      [
        { regionIndex: 1, style: 'fill' },
        { regionIndex: 3, style: 'cross' }
      ],
      BAL_PPM
    );
    const bal_output = bal_read_page({
      image: bal_scan,
      blank: bal_blank,
      regions: bal_regions,
      quality: bal_quality_good,
      pxPerMm: BAL_PPM,
      profile: BAL_DEFAULT_THRESHOLD_PROFILE,
      selectionRules: {}
    });
    expect(bal_output.items[0].status).toBe('multiple-marks');
  });

  it('sends glare-covered regions to unreadable without touching clear regions', () => {
    const bal_regions = [0, 1].map((bal_i) => bal_choice_region(bal_i));
    const bal_blank = bal_render_blank_instrument(bal_regions, BAL_PPM);
    const bal_scan = bal_render_marked_scan(
      bal_blank,
      bal_regions,
      [{ regionIndex: 1, style: 'fill' }],
      BAL_PPM,
      {
        glareSpots: [
          {
            cx: (bal_regions[0].rectMm.x + 3.8) * BAL_PPM,
            cy: (bal_regions[0].rectMm.y + 3.8) * BAL_PPM,
            r: 22
          }
        ]
      }
    );
    const bal_output = bal_read_page({
      image: bal_scan,
      blank: bal_blank,
      regions: bal_regions,
      quality: bal_quality_good,
      pxPerMm: BAL_PPM,
      profile: BAL_DEFAULT_THRESHOLD_PROFILE,
      selectionRules: {}
    });
    expect(bal_output.items[0].status).toBe('unreadable');
    expect(bal_output.items[0].reason).toContain('Glare');
  });

  it('downgrades a clear answer on a badly blurred page to review', () => {
    const bal_regions = [0, 1, 2].map((bal_i) => bal_choice_region(bal_i));
    const bal_blank = bal_render_blank_instrument(bal_regions, BAL_PPM);
    const bal_scan = bal_render_marked_scan(
      bal_blank,
      bal_regions,
      [{ regionIndex: 1, style: 'fill' }],
      BAL_PPM,
      { blurRadius: 4 }
    );
    const bal_output = bal_read_page({
      image: bal_scan,
      blank: bal_blank,
      regions: bal_regions,
      quality: { ...bal_quality_good, blurStatus: 'error' },
      pxPerMm: BAL_PPM,
      profile: BAL_DEFAULT_THRESHOLD_PROFILE,
      selectionRules: {}
    });
    expect(bal_output.items[0].status).toBe('needs-review');
  });

  it('collects written regions as manual-only without reading them', () => {
    const bal_regions: bal_ReadingRegion[] = [
      ...[0, 1].map((bal_i) => bal_choice_region(bal_i)),
      {
        itemId: 't1',
        variableName: 'village_name',
        itemType: 'short_text',
        kind: 'text',
        selection: 'written',
        markerType: 'line',
        optionId: null,
        optionCode: null,
        rowId: null,
        columnId: null,
        rectMm: { x: 20, y: 40, width: 80, height: 8 }
      }
    ];
    const bal_blank = bal_render_blank_instrument(bal_regions, BAL_PPM);
    const bal_output = bal_read_page({
      image: bal_blank,
      blank: bal_blank,
      regions: bal_regions,
      quality: bal_quality_good,
      pxPerMm: BAL_PPM,
      profile: BAL_DEFAULT_THRESHOLD_PROFILE,
      selectionRules: {}
    });
    expect(bal_output.manualOnlyRegions).toHaveLength(1);
    expect(bal_output.manualOnlyRegions[0].itemId).toBe('t1');
    expect(bal_output.items).toHaveLength(1);
  });

  it('reads a yes/no pair with both marks as multiple marks', () => {
    const bal_regions: bal_ReadingRegion[] = [
      { ...bal_choice_region(0, 'yn1'), itemType: 'yes_no', optionId: 'yes', optionCode: '1' },
      { ...bal_choice_region(1, 'yn1'), itemType: 'yes_no', optionId: 'no', optionCode: '2' }
    ];
    const bal_blank = bal_render_blank_instrument(bal_regions, BAL_PPM);
    const bal_scan = bal_render_marked_scan(
      bal_blank,
      bal_regions,
      [
        { regionIndex: 0, style: 'tick' },
        { regionIndex: 1, style: 'tick' }
      ],
      BAL_PPM
    );
    const bal_output = bal_read_page({
      image: bal_scan,
      blank: bal_blank,
      regions: bal_regions,
      quality: bal_quality_good,
      pxPerMm: BAL_PPM,
      profile: BAL_DEFAULT_THRESHOLD_PROFILE,
      selectionRules: {}
    });
    expect(bal_output.items[0].status).toBe('multiple-marks');
  });

  it('reads a consent box as present or blank', () => {
    const bal_regions: bal_ReadingRegion[] = [
      {
        itemId: 'c1',
        variableName: null,
        itemType: 'consent',
        kind: 'consent',
        selection: 'written',
        markerType: 'checkbox',
        optionId: null,
        optionCode: null,
        rowId: null,
        columnId: null,
        rectMm: { x: 30, y: 50, width: 7.6, height: 7.6 }
      }
    ];
    const bal_blank = bal_render_blank_instrument(bal_regions, BAL_PPM);
    const bal_signed = bal_render_marked_scan(bal_blank, bal_regions, [{ regionIndex: 0, style: 'tick' }], BAL_PPM);
    const bal_signed_output = bal_read_page({
      image: bal_signed,
      blank: bal_blank,
      regions: bal_regions,
      quality: bal_quality_good,
      pxPerMm: BAL_PPM,
      profile: BAL_DEFAULT_THRESHOLD_PROFILE,
      selectionRules: {}
    });
    expect(bal_signed_output.items[0].status).toBe('accepted');
    const bal_empty_output = bal_read_page({
      image: bal_blank,
      blank: bal_blank,
      regions: bal_regions,
      quality: bal_quality_good,
      pxPerMm: BAL_PPM,
      profile: BAL_DEFAULT_THRESHOLD_PROFILE,
      selectionRules: {}
    });
    expect(bal_empty_output.items[0].status).toBe('blank');
  });
});
