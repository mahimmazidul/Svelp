export interface ScanPageIdentifier {
  format: string;
  studyCode: string;
  version: number;
  respondentId: string;
  pageNumber: number;
}

export type PayloadRejectionCode =
  | 'not-svelp-format'
  | 'field-count'
  | 'bad-format-version'
  | 'bad-study-code'
  | 'bad-version'
  | 'bad-respondent'
  | 'bad-page-number';

export type PayloadRejection = { code: PayloadRejectionCode; reason: string };

export type ScanPayloadResult =
  | { ok: true; identifier: ScanPageIdentifier }
  | { ok: false; rejection: PayloadRejection };

export const SCAN_PAYLOAD_FORMAT = 'S1';
export const BAL_MIN_PAGE_NUMBER = 1;
export const BAL_MAX_PAGE_NUMBER = 200;
export const BAL_MAX_RESPONDENT_LENGTH = 32;
export const BAL_MAX_CODE_LENGTH = 8;

function bal_digits_only(bal_value: string): boolean {
  return /^[0-9]+$/.test(bal_value);
}

export function bal_parse_page_payload(bal_raw: string): ScanPayloadResult {
  const bal_text = bal_raw.trim();
  if (!bal_text.includes('|')) {
    return {
      ok: false,
      rejection: { code: 'not-svelp-format', reason: 'The scanned code is not a Svelp page identifier.' }
    };
  }
  const bal_fields = bal_text.split('|');
  if (bal_fields.length !== 5) {
    return {
      ok: false,
      rejection: { code: 'field-count', reason: 'The page identifier has an unexpected structure.' }
    };
  }
  const [bal_format, bal_code, bal_version_text, bal_respondent, bal_page_text] = bal_fields;
  if (bal_format !== SCAN_PAYLOAD_FORMAT) {
    return {
      ok: false,
      rejection: {
        code: 'bad-format-version',
        reason: `The page identifier format ${bal_format} is not supported by this version of Svelp.`
      }
    };
  }
  if (!/^[A-Z0-9]{1,8}$/.test(bal_code)) {
    return {
      ok: false,
      rejection: { code: 'bad-study-code', reason: 'The study code section is malformed.' }
    };
  }
  if (!bal_digits_only(bal_version_text) || bal_version_text.length > 4 || Number(bal_version_text) < 1) {
    return {
      ok: false,
      rejection: { code: 'bad-version', reason: 'The questionnaire version section is malformed.' }
    };
  }
  if (
    bal_respondent.length === 0 ||
    bal_respondent.length > BAL_MAX_RESPONDENT_LENGTH ||
    /[|]/.test(bal_respondent)
  ) {
    return {
      ok: false,
      rejection: { code: 'bad-respondent', reason: 'The respondent section is malformed.' }
    };
  }
  if (
    !bal_digits_only(bal_page_text) ||
    bal_page_text.length > 3 ||
    Number(bal_page_text) < BAL_MIN_PAGE_NUMBER ||
    Number(bal_page_text) > BAL_MAX_PAGE_NUMBER
  ) {
    return {
      ok: false,
      rejection: { code: 'bad-page-number', reason: 'The page number section is out of range.' }
    };
  }
  return {
    ok: true,
    identifier: {
      format: bal_format,
      studyCode: bal_code,
      version: Number(bal_version_text),
      respondentId: bal_respondent,
      pageNumber: Number(bal_page_text)
    }
  };
}

export function bal_payload_matches_expected(
  bal_identifier: ScanPageIdentifier,
  bal_expected: { studyCode: string; version: number; pageCount: number }
): PayloadRejection | null {
  if (bal_identifier.studyCode !== bal_expected.studyCode) {
    return { code: 'bad-study-code', reason: 'The code belongs to a different study.' };
  }
  if (bal_identifier.version !== bal_expected.version) {
    return { code: 'bad-version', reason: 'The code references a different questionnaire version.' };
  }
  if (bal_identifier.pageNumber > bal_expected.pageCount) {
    return {
      code: 'bad-page-number',
      reason: `The code references page ${bal_identifier.pageNumber} but this questionnaire has ${bal_expected.pageCount} pages.`
    };
  }
  return null;
}
