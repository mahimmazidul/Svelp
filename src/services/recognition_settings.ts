import {
  BAL_DEFAULT_THRESHOLD_PROFILE,
  BAL_READER_ALGORITHM_VERSION,
  BAL_THRESHOLD_PROFILE_NAME,
  type RecognitionProfileRecord,
  type RecognitionThresholdProfile
} from '../models/response_models';
import { dhon_setting, bal_save_setting } from '../db/settings_repo';

const BAL_RECOGNITION_PROFILE_KEY = 'recognition-profile';

export const BAL_CUSTOM_PROFILE_NAME = 'custom-v1';

export interface bal_RecognitionControls {
  markSensitivity: number;
  ambiguityTolerance: number;
  autoAcceptConfidence: number;
}

export const BAL_RECOGNITION_CONTROL_BOUNDS = {
  markSensitivity: { min: 0.5, max: 2, step: 0.05, default: 1 },
  ambiguityTolerance: { min: 0.1, max: 0.6, step: 0.01, default: BAL_DEFAULT_THRESHOLD_PROFILE.ambiguitySeparation },
  autoAcceptConfidence: { min: 0.5, max: 0.95, step: 0.01, default: BAL_DEFAULT_THRESHOLD_PROFILE.acceptanceConfidence }
};

export function bal_controls_to_profile(bal_controls: bal_RecognitionControls): RecognitionThresholdProfile {
  return {
    ...BAL_DEFAULT_THRESHOLD_PROFILE,
    markCenterRatio: BAL_DEFAULT_THRESHOLD_PROFILE.markCenterRatio / bal_controls.markSensitivity,
    markAddedRatio: BAL_DEFAULT_THRESHOLD_PROFILE.markAddedRatio / bal_controls.markSensitivity,
    strokeAreaPx: BAL_DEFAULT_THRESHOLD_PROFILE.strokeAreaPx / bal_controls.markSensitivity,
    ambiguousFloorRatio: BAL_DEFAULT_THRESHOLD_PROFILE.ambiguousFloorRatio / bal_controls.markSensitivity,
    ambiguitySeparation: bal_controls.ambiguityTolerance,
    acceptanceConfidence: bal_controls.autoAcceptConfidence
  };
}

export function bal_profile_to_controls(
  bal_profile: RecognitionThresholdProfile
): bal_RecognitionControls {
  const bal_bounds = BAL_RECOGNITION_CONTROL_BOUNDS;
  const bal_clamp = (bal_value: number, bal_bound: { min: number; max: number }): number =>
    Math.min(bal_bound.max, Math.max(bal_bound.min, bal_value));
  return {
    markSensitivity: bal_clamp(
      BAL_DEFAULT_THRESHOLD_PROFILE.markCenterRatio / bal_profile.markCenterRatio,
      bal_bounds.markSensitivity
    ),
    ambiguityTolerance: bal_clamp(bal_profile.ambiguitySeparation, bal_bounds.ambiguityTolerance),
    autoAcceptConfidence: bal_clamp(bal_profile.acceptanceConfidence, bal_bounds.autoAcceptConfidence)
  };
}

export function bal_controls_match_default(bal_controls: bal_RecognitionControls): boolean {
  const bal_bounds = BAL_RECOGNITION_CONTROL_BOUNDS;
  return (
    Math.abs(bal_controls.markSensitivity - bal_bounds.markSensitivity.default) < 1e-9 &&
    Math.abs(bal_controls.ambiguityTolerance - bal_bounds.ambiguityTolerance.default) < 1e-9 &&
    Math.abs(bal_controls.autoAcceptConfidence - bal_bounds.autoAcceptConfidence.default) < 1e-9
  );
}

export async function bal_load_recognition_profile(): Promise<RecognitionProfileRecord> {
  const bal_saved = await dhon_setting<RecognitionProfileRecord>(BAL_RECOGNITION_PROFILE_KEY);
  if (!bal_saved) {
    return {
      algorithmVersion: BAL_READER_ALGORITHM_VERSION,
      thresholdProfile: BAL_DEFAULT_THRESHOLD_PROFILE,
      acceptanceThreshold: BAL_DEFAULT_THRESHOLD_PROFILE.acceptanceConfidence,
      createdAt: Date.now()
    };
  }
  return bal_saved;
}

export async function bal_save_recognition_profile(
  bal_controls: bal_RecognitionControls
): Promise<RecognitionProfileRecord> {
  const bal_record: RecognitionProfileRecord = {
    algorithmVersion: BAL_READER_ALGORITHM_VERSION,
    thresholdProfile: bal_controls_to_profile(bal_controls),
    acceptanceThreshold: bal_controls.autoAcceptConfidence,
    createdAt: Date.now()
  };
  await bal_save_setting(BAL_RECOGNITION_PROFILE_KEY, bal_record);
  return bal_record;
}

export function bal_profile_name_for_controls(bal_controls: bal_RecognitionControls): string {
  return bal_controls_match_default(bal_controls) ? BAL_THRESHOLD_PROFILE_NAME : BAL_CUSTOM_PROFILE_NAME;
}
