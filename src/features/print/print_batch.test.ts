import { describe, expect, it } from 'vitest';
import {
  bal_format_respondent_id,
  bal_plan_respondent_ids,
  bal_questionnaire_fingerprint
} from './print_batch';
import { bal_short_survey } from './print_fixtures';

describe('sequential respondent ids', () => {
  it('generates zero padded ids with a prefix', () => {
    const bal_plan = bal_plan_respondent_ids({
      mode: 'sequential',
      count: 60,
      start: 1,
      prefix: 'FFQ-',
      padding: 3,
      customIds: ''
    });
    expect(bal_plan.valid).toBe(true);
    expect(bal_plan.respondentIds[0]).toBe('FFQ-001');
    expect(bal_plan.respondentIds[59]).toBe('FFQ-060');
    expect(bal_plan.respondentIds).toHaveLength(60);
    expect(bal_plan.duplicates).toEqual([]);
  });

  it('supports anonymous numeric ids', () => {
    const bal_plan = bal_plan_respondent_ids({
      mode: 'sequential',
      count: 3,
      start: 1,
      prefix: '',
      padding: 3,
      customIds: ''
    });
    expect(bal_plan.respondentIds).toEqual(['001', '002', '003']);
  });

  it('grows padding to fit the final number', () => {
    const bal_plan = bal_plan_respondent_ids({
      mode: 'sequential',
      count: 5,
      start: 998,
      prefix: 'R-',
      padding: 2,
      customIds: ''
    });
    expect(bal_plan.respondentIds).toEqual(['R-0998', 'R-0999', 'R-1000', 'R-1001', 'R-1002']);
  });

  it('keeps custom padding when it is wide enough', () => {
    expect(bal_format_respondent_id(7, 'X-', 4)).toBe('X-0007');
  });

  it('rejects oversized batches', () => {
    const bal_plan = bal_plan_respondent_ids({
      mode: 'sequential',
      count: 501,
      start: 1,
      prefix: '',
      padding: 3,
      customIds: ''
    });
    expect(bal_plan.valid).toBe(false);
    expect(bal_plan.errors.join(' ')).toContain('500');
  });
});

describe('custom respondent id lists', () => {
  it('parses pasted ids and ignores empty lines', () => {
    const bal_plan = bal_plan_respondent_ids({
      mode: 'list',
      count: 0,
      start: 0,
      prefix: '',
      padding: 0,
      customIds: 'DFD-A01\nDFD-A02\n\n  DFD-B07  \nDFD-C12\n'
    });
    expect(bal_plan.valid).toBe(true);
    expect(bal_plan.respondentIds).toEqual(['DFD-A01', 'DFD-A02', 'DFD-B07', 'DFD-C12']);
  });

  it('detects duplicate ids and refuses to plan', () => {
    const bal_plan = bal_plan_respondent_ids({
      mode: 'list',
      count: 0,
      start: 0,
      prefix: '',
      padding: 0,
      customIds: 'DFD-A01\nDFD-A02\nDFD-A01'
    });
    expect(bal_plan.valid).toBe(false);
    expect(bal_plan.duplicates).toEqual(['DFD-A01']);
    expect(bal_plan.errors.join(' ')).toContain('Duplicate');
  });

  it('detects duplicates in sequential mode too', () => {
    const bal_plan = bal_plan_respondent_ids({
      mode: 'sequential',
      count: 1,
      start: 1,
      prefix: '',
      padding: 1,
      customIds: ''
    });
    expect(bal_plan.duplicates).toEqual([]);
    expect(bal_plan.valid).toBe(true);
  });
});

describe('questionnaire fingerprint', () => {
  it('is stable for unchanged content', () => {
    const bal_q = bal_short_survey();
    expect(bal_questionnaire_fingerprint(bal_q)).toBe(bal_questionnaire_fingerprint(bal_q));
  });

  it('changes when content, paper, or orientation changes', () => {
    const bal_q = bal_short_survey();
    const bal_base = bal_questionnaire_fingerprint(bal_q);
    bal_q.sections[0].items[0].label = 'Changed question';
    const bal_changed = bal_questionnaire_fingerprint(bal_q);
    expect(bal_changed).not.toBe(bal_base);
    bal_q.orientation = 'landscape';
    expect(bal_questionnaire_fingerprint(bal_q)).not.toBe(bal_changed);
  });
});
