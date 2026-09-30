import { describe, expect, it } from 'vitest';
import { bal_run_benchmark } from './reading_benchmark';

describe('recognition benchmark', () => {
  const bal_report = bal_run_benchmark();

  it('never auto-accepts an incorrect answer in any fixture', () => {
    expect(bal_report.counters.incorrectAutoAccepted).toBe(0);
  });

  it('never auto-accepts a blank or uncertain case', () => {
    expect(bal_report.counters.blanksAccepted).toBe(0);
    expect(bal_report.counters.missedReviewAccepted).toBe(0);
  });

  it('produces no false marks on the blank fixture', () => {
    const bal_blank = bal_report.scenarios.find((bal_s) => bal_s.id === 'blank-page');
    expect(bal_blank?.pass).toBe(true);
  });

  it('auto-accepts every clear-mark fixture with the exact ground truth', () => {
    expect(bal_report.counters.correctAutoAccepted).toBeGreaterThanOrEqual(18);
    expect(bal_report.counters.clearAcceptsRoutedToReview).toBe(0);
  });

  it('routes every uncertain fixture to review', () => {
    expect(bal_report.counters.correctReviewRouting).toBeGreaterThanOrEqual(9);
  });

  it('detects blanks without routing them to review', () => {
    expect(bal_report.counters.correctBlanks).toBeGreaterThanOrEqual(8);
    expect(bal_report.counters.blanksRoutedToReview).toBe(0);
  });

  it('keeps the handwritten field out of machine interpretation', () => {
    expect(bal_report.counters.manualOnlyRecognized).toBeGreaterThanOrEqual(1);
  });

  it('every scenario passes with no detail failures', () => {
    const bal_failed = bal_report.scenarios.filter((bal_s) => !bal_s.pass);
    expect(bal_failed.map((bal_s) => `${bal_s.id}: ${bal_s.details.join(' | ')}`)).toEqual([]);
  });

  it('covers the planned fixture families', () => {
    expect(bal_report.counters.scenarioCount).toBeGreaterThanOrEqual(26);
    expect(bal_report.counters.expectationChecks).toBeGreaterThanOrEqual(38);
  });
});
