import { describe, expect, it } from 'vitest';
import {
  BAL_QR_QUIET_ZONE_MODULES,
  bal_clean_study_code,
  bal_human_readable,
  bal_identifier_payload,
  bal_qr_matrix,
  bal_qr_module_count
} from './print_qr';

describe('page identifier payload', () => {
  it('encodes code, version, respondent, and page compactly', () => {
    expect(
      bal_identifier_payload({ studyCode: 'FFQ', respondentId: '037', version: 2, pageNumber: 1, pageCount: 3 })
    ).toBe('S1|FFQ|2|037|1');
  });

  it('sanitizes the study code', () => {
    expect(bal_clean_study_code('ffq 2026!')).toBe('FFQ2026');
    expect(bal_clean_study_code('')).toBe('S1');
    expect(bal_clean_study_code('verylongcodethatexceeds')).toBe('VERYLONG');
  });

  it('produces distinct payloads per respondent and page', () => {
    const bal_base = { studyCode: 'FFQ', version: 1, pageCount: 4 };
    const bal_a = bal_identifier_payload({ ...bal_base, respondentId: '001', pageNumber: 1 });
    const bal_b = bal_identifier_payload({ ...bal_base, respondentId: '002', pageNumber: 1 });
    const bal_c = bal_identifier_payload({ ...bal_base, respondentId: '001', pageNumber: 2 });
    expect(new Set([bal_a, bal_b, bal_c]).size).toBe(3);
  });

  it('renders a readable fallback', () => {
    expect(
      bal_human_readable({ studyCode: 'FFQ', respondentId: '037', version: 2, pageNumber: 2, pageCount: 3 })
    ).toBe('FFQ-037 P2/3');
  });

  it('keeps the fallback readable without a respondent', () => {
    expect(
      bal_human_readable({ studyCode: 'FFQ', respondentId: '', version: 1, pageNumber: 1, pageCount: 2 })
    ).toBe('FFQ-- P1/2');
  });
});

describe('qr matrix', () => {
  it('generates a square boolean matrix deterministically', () => {
    const bal_payload = bal_identifier_payload({ studyCode: 'FFQ', respondentId: '037', version: 2, pageNumber: 1, pageCount: 3 });
    const bal_a = bal_qr_matrix(bal_payload);
    const bal_b = bal_qr_matrix(bal_payload);
    expect(bal_a).toEqual(bal_b);
    expect(bal_a.length).toBe(bal_a[0].length);
    expect(bal_a.length).toBe(bal_qr_module_count(bal_payload));
    expect(bal_a.flat().some((bal_dark) => bal_dark)).toBe(true);
    expect(bal_a.flat().some((bal_dark) => !bal_dark)).toBe(true);
  });

  it('keeps module counts modest for short payloads', () => {
    const bal_count = bal_qr_module_count('S1|FFQ|2|037|1');
    expect(bal_count).toBeGreaterThanOrEqual(21);
    expect(bal_count).toBeLessThanOrEqual(29);
  });

  it('changes the matrix when the payload changes', () => {
    const bal_a = bal_qr_matrix('S1|FFQ|2|037|1');
    const bal_b = bal_qr_matrix('S1|FFQ|2|037|2');
    expect(bal_a).not.toEqual(bal_b);
  });

  it('exposes the quiet zone constant for renderers', () => {
    expect(BAL_QR_QUIET_ZONE_MODULES).toBe(4);
  });
});
