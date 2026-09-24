export type bal_EtaStage =
  | 'decode'
  | 'identify'
  | 'align'
  | 'normalize'
  | 'quality'
  | 'persist'
  | 'total';

export interface bal_EtaSample {
  stage: bal_EtaStage;
  ms: number;
  at: number;
}

export interface bal_EtaEstimator {
  windowSize: number;
  samples: bal_EtaSample[];
  stageAverages: Map<bal_EtaStage, number>;
  globalAverage: number;
  globalSamples: number;
}

export interface bal_EtaRemaining {
  stage: bal_EtaStage;
  count: number;
}

export function bal_create_eta_estimator(bal_window_size = 8): bal_EtaEstimator {
  return {
    windowSize: Math.max(3, bal_window_size),
    samples: [],
    stageAverages: new Map(),
    globalAverage: 0,
    globalSamples: 0
  };
}

function bal_smooth(bal_previous: number, bal_value: number): number {
  return bal_previous === 0 ? bal_value : bal_previous * 0.6 + bal_value * 0.4;
}

function bal_sane(bal_ms: number): boolean {
  return Number.isFinite(bal_ms) && bal_ms >= 0;
}

export function bal_record_stage(
  bal_estimator: bal_EtaEstimator,
  bal_stage: bal_EtaStage,
  bal_ms: number
): void {
  if (!bal_sane(bal_ms)) return;
  const bal_now = Date.now();
  bal_estimator.samples.push({ stage: bal_stage, ms: bal_ms, at: bal_now });
  if (bal_estimator.samples.length > bal_estimator.windowSize * 4) {
    bal_estimator.samples.splice(0, bal_estimator.samples.length - bal_estimator.windowSize * 4);
  }
  const bal_stage_window = bal_estimator.samples.filter((bal_s) => bal_s.stage === bal_stage).slice(-bal_estimator.windowSize);
  if (bal_stage_window.length > 0) {
    const bal_latest = bal_stage_window[bal_stage_window.length - 1].ms;
    const bal_previous = bal_estimator.stageAverages.get(bal_stage) ?? 0;
    bal_estimator.stageAverages.set(bal_stage, bal_smooth(bal_previous, bal_latest));
  }
  const bal_total_window = bal_estimator.samples.filter((bal_s) => bal_s.stage === 'total').slice(-bal_estimator.windowSize);
  if (bal_total_window.length > 0) {
    const bal_latest = bal_total_window[bal_total_window.length - 1].ms;
    bal_estimator.globalAverage = bal_smooth(bal_estimator.globalAverage, bal_latest);
    bal_estimator.globalSamples += 1;
  }
}

export function bal_eta_seconds(
  bal_estimator: bal_EtaEstimator,
  bal_remaining: bal_EtaRemaining[]
): number | null {
  if (bal_remaining.length === 0) return 0;
  let bal_total_ms = 0;
  let bal_covered = true;
  for (const bal_item of bal_remaining) {
    if (bal_item.count <= 0) continue;
    const bal_stage_average = bal_estimator.stageAverages.get(bal_item.stage);
    if (bal_stage_average !== undefined && bal_stage_average > 0) {
      bal_total_ms += bal_stage_average * bal_item.count;
    } else if (bal_estimator.globalAverage > 0) {
      bal_total_ms += bal_estimator.globalAverage * bal_item.count;
    } else {
      bal_covered = false;
      break;
    }
  }
  if (!bal_covered) return null;
  const bal_seconds = Math.round(bal_total_ms / 1000);
  if (!Number.isFinite(bal_seconds) || bal_seconds < 0) return null;
  return bal_seconds;
}

export function bal_format_eta(bal_seconds: number | null): string {
  if (bal_seconds === null || !Number.isFinite(bal_seconds) || bal_seconds < 0) {
    return 'Estimating…';
  }
  if (bal_seconds === 0) return 'Almost done';
  if (bal_seconds < 60) return 'Less than a minute remaining';
  const bal_minutes = Math.round(bal_seconds / 60);
  if (bal_minutes === 1) return 'About a minute remaining';
  return `About ${bal_minutes} minutes remaining`;
}

export function bal_eta_label(
  bal_estimator: bal_EtaEstimator,
  bal_remaining: bal_EtaRemaining[]
): string {
  return bal_format_eta(bal_eta_seconds(bal_estimator, bal_remaining));
}
