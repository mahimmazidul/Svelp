import { describe, expect, it } from 'vitest';
import { validate_questionnaire, type ValidationIssue } from './questionnaire_validation';
import {
  dhon_banaitesi_item,
  dhon_banaitesi_questionnaire,
  dhon_banaitesi_section,
  komola_option
} from './factories';
import type { ResponseScaleRecord } from './types';

function bal_codes(bal_issues: ValidationIssue[]): string[] {
  return bal_issues.map((bal_issue) => bal_issue.code);
}

function bal_scale(bal_id: string, bal_count: number): ResponseScaleRecord {
  return {
    id: bal_id,
    name: 'Frequency',
    options: Array.from({ length: bal_count }, (_bal_unused, bal_i) => {
      const bal_option = komola_option(`Point ${bal_i + 1}`);
      bal_option.coding = String(bal_i);
      return bal_option;
    }),
    createdAt: 0,
    updatedAt: 0
  };
}

describe('validate_questionnaire', () => {
  it('detects duplicate variable names with item navigation', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p', title: 'T' });
    const bal_a = dhon_banaitesi_item('single_choice', 'same');
    bal_a.label = 'A';
    const bal_b = dhon_banaitesi_item('single_choice', 'same');
    bal_b.label = 'B';
    bal_q.sections[0].items = [bal_a, bal_b];
    const bal_issues = validate_questionnaire(bal_q, []);
    expect(bal_codes(bal_issues)).toContain('duplicate-variable');
    const bal_dup = bal_issues.find((bal_i) => bal_i.code === 'duplicate-variable');
    expect(bal_dup?.itemId).toBe(bal_b.id);
    expect(bal_dup?.sectionId).toBe(bal_q.sections[0].id);
  });

  it('flags empty labels and missing variables', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p', title: 'T' });
    const bal_item = dhon_banaitesi_item('number', null);
    bal_q.sections[0].items = [bal_item];
    const bal_codes_found = bal_codes(validate_questionnaire(bal_q, []));
    expect(bal_codes_found).toContain('empty-label');
    expect(bal_codes_found).toContain('missing-variable');
  });

  it('detects fewer than two options and duplicate codes', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p', title: 'T' });
    const bal_item = dhon_banaitesi_item('single_choice', 'v1');
    bal_item.label = 'Q';
    bal_item.options = [{ id: 'o1', label: 'One', coding: '1' }];
    bal_q.sections[0].items = [bal_item];
    expect(bal_codes(validate_questionnaire(bal_q, []))).toContain('too-few-options');

    const bal_item2 = dhon_banaitesi_item('single_choice', 'v2');
    bal_item2.label = 'Q2';
    bal_item2.options = [
      { id: 'o1', label: 'One', coding: '5' },
      { id: 'o2', label: 'Two', coding: '5' },
      { id: 'o3', label: 'Three', coding: '5' }
    ];
    bal_q.sections[0].items = [bal_item2];
    expect(bal_codes(validate_questionnaire(bal_q, []))).toContain('duplicate-code');
  });

  it('detects invalid numeric ranges and selection limits', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p', title: 'T' });
    const bal_num = dhon_banaitesi_item('number', 'age');
    bal_num.label = 'Age';
    bal_num.validation = { min: 10, max: 2, step: 0, decimalAllowed: true };
    const bal_multi = dhon_banaitesi_item('multiple_choice', 'picks');
    bal_multi.label = 'Picks';
    bal_multi.validation = { minSelections: 4, maxSelections: 2 };
    bal_q.sections[0].items = [bal_num, bal_multi];
    const bal_found = bal_codes(validate_questionnaire(bal_q, []));
    expect(bal_found).toContain('invalid-range');
    expect(bal_found).toContain('invalid-selection-limits');
  });

  it('detects matrices without rows or columns', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p', title: 'T' });
    const bal_matrix = dhon_banaitesi_item('matrix', 'ffq');
    bal_matrix.label = 'Food frequency';
    bal_q.sections[0].items = [bal_matrix];
    const bal_found = bal_codes(validate_questionnaire(bal_q, []));
    expect(bal_found).toContain('matrix-no-rows');
    expect(bal_found).toContain('matrix-no-columns');
  });

  it('detects empty consent acknowledgement', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p', title: 'T' });
    const bal_consent = dhon_banaitesi_item('consent', null);
    bal_consent.label = 'Consent';
    bal_consent.required = true;
    bal_consent.consent = {
      title: 'Consent',
      introduction: 'Intro',
      sections: [],
      acknowledgementLabel: '   '
    };
    bal_q.sections[0].items = [bal_consent];
    expect(bal_codes(validate_questionnaire(bal_q, []))).toContain(
      'empty-consent-acknowledgement'
    );
  });

  it('detects broken and thin scale references', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p', title: 'T' });
    const bal_item = dhon_banaitesi_item('single_choice', 'v1');
    bal_item.label = 'Q';
    bal_item.scaleId = 'missing-scale';
    bal_item.options = [];
    bal_q.sections[0].items = [bal_item];
    const bal_found = bal_codes(validate_questionnaire(bal_q, []));
    expect(bal_found).toContain('broken-scale-reference');

    const bal_item2 = dhon_banaitesi_item('single_choice', 'v2');
    bal_item2.label = 'Q2';
    bal_item2.scaleId = 'thin';
    bal_item2.options = [];
    bal_q.sections[0].items = [bal_item, bal_item2];
    const bal_issues = validate_questionnaire(bal_q, [bal_scale('thin', 1)]);
    expect(bal_codes(bal_issues)).toContain('empty-scale');
    expect(bal_issues.find((bal_i) => bal_i.code === 'empty-scale')?.scaleId).toBe('thin');
    expect(bal_found).not.toContain('too-few-options');
  });

  it('accepts a fully valid questionnaire with no issues', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p', title: 'T' });
    const bal_freq = bal_scale('s1', 4);
    const bal_item = dhon_banaitesi_item('single_choice', 'v1');
    bal_item.label = 'Which staple do you eat most often?';
    bal_item.scaleId = 's1';
    bal_item.options = [];
    const bal_matrix = dhon_banaitesi_item('matrix', 'ffq');
    bal_matrix.label = 'Food frequency';
    bal_matrix.scaleId = 's1';
    bal_matrix.rows = [
      { id: 'r1', label: 'Rice' },
      { id: 'r2', label: 'Fish' }
    ];
    const bal_section2 = dhon_banaitesi_section('Consent');
    const bal_consent = dhon_banaitesi_item('consent', null);
    bal_consent.label = 'Consent';
    bal_consent.required = true;
    bal_consent.consent = {
      title: 'Consent',
      introduction: 'Intro',
      sections: [],
      acknowledgementLabel: 'I agree'
    };
    bal_section2.items = [bal_consent];
    bal_q.sections = [...bal_q.sections, bal_section2];
    bal_q.sections[0].items = [bal_item, bal_matrix];
    const bal_issues = validate_questionnaire(bal_q, [bal_freq]);
    expect(bal_issues).toEqual([]);
  });
});
