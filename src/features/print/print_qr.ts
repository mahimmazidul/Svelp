import qrcode from 'qrcode-generator';

export interface PageIdentifierInput {
  studyCode: string;
  respondentId: string;
  version: number;
  pageNumber: number;
  pageCount: number;
}

export function bal_clean_study_code(bal_raw: string): string {
  const bal_cleaned = bal_raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
  return bal_cleaned.length > 0 ? bal_cleaned : 'S1';
}

export function bal_identifier_payload(bal_input: PageIdentifierInput): string {
  return `S1|${bal_clean_study_code(bal_input.studyCode)}|${bal_input.version}|${bal_input.respondentId}|${bal_input.pageNumber}`;
}

export function bal_human_readable(bal_input: PageIdentifierInput): string {
  const bal_code = bal_clean_study_code(bal_input.studyCode);
  const bal_respondent = bal_input.respondentId.trim().length > 0 ? bal_input.respondentId : '-';
  return `${bal_code}-${bal_respondent} P${bal_input.pageNumber}/${bal_input.pageCount}`;
}

export function bal_qr_matrix(bal_payload: string): boolean[][] {
  const bal_qr = qrcode(0, 'M');
  bal_qr.addData(bal_payload);
  bal_qr.make();
  const bal_count = bal_qr.getModuleCount();
  const bal_matrix: boolean[][] = [];
  for (let bal_row = 0; bal_row < bal_count; bal_row++) {
    const bal_line: boolean[] = [];
    for (let bal_col = 0; bal_col < bal_count; bal_col++) {
      bal_line.push(bal_qr.isDark(bal_row, bal_col));
    }
    bal_matrix.push(bal_line);
  }
  return bal_matrix;
}

export function bal_qr_module_count(bal_payload: string): number {
  return bal_qr_matrix(bal_payload).length;
}

export const BAL_QR_QUIET_ZONE_MODULES = 4;
