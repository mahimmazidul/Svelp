import { describe, expect, it } from 'vitest';
import {
  BAL_RECOGNITION_CONTROL_BOUNDS,
  bal_controls_match_default,
  bal_controls_to_profile,
  bal_profile_name_for_controls,
  bal_profile_to_controls
} from './recognition_settings';
import { BAL_DEFAULT_THRESHOLD_PROFILE } from '../models/response_models';

describe('recognition settings profile', () => {
  it('keeps the default profile at neutral controls', () => {
    const bal_controls = {
      markSensitivity: 1,
      ambiguityTolerance: BAL_DEFAULT_THRESHOLD_PROFILE.ambiguitySeparation,
      autoAcceptConfidence: BAL_DEFAULT_THRESHOLD_PROFILE.acceptanceConfidence
    };
    const bal_profile = bal_controls_to_profile(bal_controls);
    expect(bal_profile.markCenterRatio).toBeCloseTo(BAL_DEFAULT_THRESHOLD_PROFILE.markCenterRatio, 12);
    expect(bal_profile.markAddedRatio).toBeCloseTo(BAL_DEFAULT_THRESHOLD_PROFILE.markAddedRatio, 12);
    expect(bal_profile.strokeAreaPx).toBeCloseTo(BAL_DEFAULT_THRESHOLD_PROFILE.strokeAreaPx, 12);
    expect(bal_profile_name_for_controls(bal_controls)).toBe('default-v1');
  });

  it('lowers mark thresholds when sensitivity rises', () => {
    const bal_profile = bal_controls_to_profile({ markSensitivity: 2, ambiguityTolerance: 0.3, autoAcceptConfidence: 0.75 });
    expect(bal_profile.markCenterRatio).toBeCloseTo(BAL_DEFAULT_THRESHOLD_PROFILE.markCenterRatio / 2, 12);
    expect(bal_profile.markAddedRatio).toBeCloseTo(BAL_DEFAULT_THRESHOLD_PROFILE.markAddedRatio / 2, 12);
    expect(bal_profile.strokeAreaPx).toBeCloseTo(BAL_DEFAULT_THRESHOLD_PROFILE.strokeAreaPx / 2, 12);
    expect(bal_profile_name_for_controls({ markSensitivity: 2, ambiguityTolerance: 0.3, autoAcceptConfidence: 0.75 })).toBe(
      'custom-v1'
    );
  });

  it('maps ambiguity tolerance and auto-accept threshold directly', () => {
    const bal_profile = bal_controls_to_profile({ markSensitivity: 1, ambiguityTolerance: 0.42, autoAcceptConfidence: 0.9 });
    expect(bal_profile.ambiguitySeparation).toBe(0.42);
    expect(bal_profile.acceptanceConfidence).toBe(0.9);
  });

  it('round-trips controls through a profile', () => {
    const bal_controls = { markSensitivity: 1.35, ambiguityTolerance: 0.22, autoAcceptConfidence: 0.82 };
    const bal_round = bal_profile_to_controls(bal_controls_to_profile(bal_controls));
    expect(bal_round.markSensitivity).toBeCloseTo(bal_controls.markSensitivity, 6);
    expect(bal_round.ambiguityTolerance).toBeCloseTo(bal_controls.ambiguityTolerance, 6);
    expect(bal_round.autoAcceptConfidence).toBeCloseTo(bal_controls.autoAcceptConfidence, 6);
  });

  it('clamps out-of-range controls when reading back', () => {
    const bal_loose = bal_profile_to_controls({
      ...BAL_DEFAULT_THRESHOLD_PROFILE,
      markCenterRatio: 0.0001,
      ambiguitySeparation: 0.9,
      acceptanceConfidence: 0.1
    });
    expect(bal_loose.markSensitivity).toBe(BAL_RECOGNITION_CONTROL_BOUNDS.markSensitivity.max);
    expect(bal_loose.ambiguityTolerance).toBe(BAL_RECOGNITION_CONTROL_BOUNDS.ambiguityTolerance.max);
    expect(bal_loose.autoAcceptConfidence).toBe(BAL_RECOGNITION_CONTROL_BOUNDS.autoAcceptConfidence.min);
  });

  it('detects non-default controls', () => {
    expect(bal_controls_match_default({ markSensitivity: 1, ambiguityTolerance: 0.3, autoAcceptConfidence: 0.75 })).toBe(
      true
    );
    expect(bal_controls_match_default({ markSensitivity: 1.1, ambiguityTolerance: 0.3, autoAcceptConfidence: 0.75 })).toBe(
      false
    );
  });
});
