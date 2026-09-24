import { describe, expect, it } from 'vitest';
import {
  bal_create_eta_estimator,
  bal_eta_seconds,
  bal_eta_label,
  bal_format_eta,
  bal_record_stage
} from './scan_eta';

describe('eta estimator', () => {
  it('returns estimating until enough samples exist', () => {
    const bal_estimator = bal_create_eta_estimator();
    expect(bal_eta_seconds(bal_estimator, [{ stage: 'total', count: 10 }])).toBeNull();
    expect(bal_eta_label(bal_estimator, [{ stage: 'total', count: 10 }])).toBe('Estimating…');
    bal_record_stage(bal_estimator, 'total', 5000);
    expect(bal_eta_seconds(bal_estimator, [{ stage: 'total', count: 10 }])).toBe(50);
  });

  it('extrapolates from stage averages when stages are known', () => {
    const bal_estimator = bal_create_eta_estimator();
    for (let bal_i = 0; bal_i < 4; bal_i++) {
      bal_record_stage(bal_estimator, 'decode', 100);
      bal_record_stage(bal_estimator, 'align', 300);
    }
    const bal_seconds = bal_eta_seconds(bal_estimator, [
      { stage: 'decode', count: 10 },
      { stage: 'align', count: 10 }
    ]);
    expect(bal_seconds).toBe(4);
  });

  it('uses the global average as fallback for unseen stages', () => {
    const bal_estimator = bal_create_eta_estimator();
    bal_record_stage(bal_estimator, 'total', 2000);
    const bal_seconds = bal_eta_seconds(bal_estimator, [{ stage: 'persist', count: 3 }]);
    expect(bal_seconds).toBe(6);
  });

  it('ignores invalid samples and never produces NaN, Infinity, or negatives', () => {
    const bal_estimator = bal_create_eta_estimator();
    bal_record_stage(bal_estimator, 'total', Number.NaN);
    bal_record_stage(bal_estimator, 'total', -5);
    bal_record_stage(bal_estimator, 'total', Number.POSITIVE_INFINITY);
    expect(bal_eta_seconds(bal_estimator, [{ stage: 'total', count: 5 }])).toBeNull();
    for (let bal_i = 0; bal_i < 5; bal_i++) bal_record_stage(bal_estimator, 'total', 1000);
    const bal_seconds = bal_eta_seconds(bal_estimator, [{ stage: 'total', count: 0 }]);
    expect(bal_seconds).toBe(0);
    expect(Number.isNaN(bal_seconds)).toBe(false);
  });

  it('weights recent samples through smoothing', () => {
    const bal_estimator = bal_create_eta_estimator();
    for (let bal_i = 0; bal_i < 5; bal_i++) bal_record_stage(bal_estimator, 'total', 10000);
    for (let bal_i = 0; bal_i < 5; bal_i++) bal_record_stage(bal_estimator, 'total', 1000);
    const bal_seconds = bal_eta_seconds(bal_estimator, [{ stage: 'total', count: 10 }]);
    expect(bal_seconds).toBeGreaterThan(10);
    expect(bal_seconds).toBeLessThan(100);
  });

  it('formats durations for display', () => {
    expect(bal_format_eta(null)).toBe('Estimating…');
    expect(bal_format_eta(-3)).toBe('Estimating…');
    expect(bal_format_eta(0)).toBe('Almost done');
    expect(bal_format_eta(30)).toBe('Less than a minute remaining');
    expect(bal_format_eta(60)).toBe('About a minute remaining');
    expect(bal_format_eta(180)).toBe('About 3 minutes remaining');
  });

  it('returns zero when nothing remains', () => {
    const bal_estimator = bal_create_eta_estimator();
    expect(bal_eta_seconds(bal_estimator, [])).toBe(0);
  });

  it('keeps the sample buffer bounded', () => {
    const bal_estimator = bal_create_eta_estimator(4);
    for (let bal_i = 0; bal_i < 200; bal_i++) bal_record_stage(bal_estimator, 'total', 100);
    expect(bal_estimator.samples.length).toBeLessThanOrEqual(16);
  });
});
