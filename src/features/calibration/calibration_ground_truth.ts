export type bal_ExpectedStatus =
  | 'accept'
  | 'blank'
  | 'multiple'
  | 'ambiguous'
  | 'review'
  | 'manual-only'
  | 'unreadable';

export interface bal_GroundTruthAnswer {
  itemId: string;
  rowId: string | null;
  expectedStatus: bal_ExpectedStatus;
  expectedValue: string[];
}

export interface bal_GroundTruthPage {
  pageNumber: number;
  qrPayload: string;
  answers: bal_GroundTruthAnswer[];
}

export interface bal_GroundTruthDoc {
  questionnaireId: string;
  questionnaireVersion: number;
  printProfile: string;
  respondentId: string;
  pages: bal_GroundTruthPage[];
}

export interface bal_GroundTruthIssue {
  path: string;
  message: string;
}

const BAL_KNOWN_STATUSES: bal_ExpectedStatus[] = [
  'accept',
  'blank',
  'multiple',
  'ambiguous',
  'review',
  'manual-only',
  'unreadable'
];

const BAL_REVIEW_STATUSES = new Set<bal_ExpectedStatus>(['multiple', 'ambiguous', 'review', 'unreadable']);

export function bal_is_review_expected(bal_status: bal_ExpectedStatus): boolean {
  return BAL_REVIEW_STATUSES.has(bal_status);
}

export function bal_ground_truth_issues(bal_doc: unknown): bal_GroundTruthIssue[] {
  const bal_issues: bal_GroundTruthIssue[] = [];
  if (!bal_doc || typeof bal_doc !== 'object') {
    return [{ path: '$', message: 'ground truth must be an object' }];
  }
  const bal_root = bal_doc as Record<string, unknown>;
  for (const bal_field of ['questionnaireId', 'printProfile', 'respondentId']) {
    if (typeof bal_root[bal_field] !== 'string' || (bal_root[bal_field] as string).length === 0) {
      bal_issues.push({ path: `$.${bal_field}`, message: 'must be a non-empty string' });
    }
  }
  if (!Number.isInteger(bal_root.questionnaireVersion)) {
    bal_issues.push({ path: '$.questionnaireVersion', message: 'must be an integer' });
  }
  if (!Array.isArray(bal_root.pages) || bal_root.pages.length === 0) {
    bal_issues.push({ path: '$.pages', message: 'must be a non-empty array' });
    return bal_issues;
  }
  const bal_seen_pages = new Set<number>();
  (bal_root.pages as unknown[]).forEach((bal_page, bal_page_index) => {
    const bal_path = `$.pages[${bal_page_index}]`;
    if (!bal_page || typeof bal_page !== 'object') {
      bal_issues.push({ path: bal_path, message: 'page must be an object' });
      return;
    }
    const bal_page_record = bal_page as Record<string, unknown>;
    if (!Number.isInteger(bal_page_record.pageNumber) || (bal_page_record.pageNumber as number) < 1) {
      bal_issues.push({ path: `${bal_path}.pageNumber`, message: 'must be a positive integer' });
    } else if (bal_seen_pages.has(bal_page_record.pageNumber as number)) {
      bal_issues.push({ path: `${bal_path}.pageNumber`, message: 'duplicate page number' });
    } else {
      bal_seen_pages.add(bal_page_record.pageNumber as number);
    }
    if (typeof bal_page_record.qrPayload !== 'string' || (bal_page_record.qrPayload as string).length === 0) {
      bal_issues.push({ path: `${bal_path}.qrPayload`, message: 'must be a non-empty string' });
    }
    if (!Array.isArray(bal_page_record.answers)) {
      bal_issues.push({ path: `${bal_path}.answers`, message: 'must be an array' });
      return;
    }
    const bal_seen_rows = new Set<string>();
    (bal_page_record.answers as unknown[]).forEach((bal_answer, bal_answer_index) => {
      const bal_answer_path = `${bal_path}.answers[${bal_answer_index}]`;
      if (!bal_answer || typeof bal_answer !== 'object') {
        bal_issues.push({ path: bal_answer_path, message: 'answer must be an object' });
        return;
      }
      const bal_answer_record = bal_answer as Record<string, unknown>;
      if (typeof bal_answer_record.itemId !== 'string' || (bal_answer_record.itemId as string).length === 0) {
        bal_issues.push({ path: `${bal_answer_path}.itemId`, message: 'must be a non-empty string' });
      }
      if (bal_answer_record.rowId !== null && typeof bal_answer_record.rowId !== 'string') {
        bal_issues.push({ path: `${bal_answer_path}.rowId`, message: 'must be a string or null' });
      }
      const bal_row_key = `${String(bal_answer_record.itemId)}::${String(bal_answer_record.rowId)}`;
      if (bal_seen_rows.has(bal_row_key)) {
        bal_issues.push({ path: bal_answer_path, message: 'duplicate itemId/rowId pair' });
      }
      bal_seen_rows.add(bal_row_key);
      if (!BAL_KNOWN_STATUSES.includes(bal_answer_record.expectedStatus as bal_ExpectedStatus)) {
        bal_issues.push({ path: `${bal_answer_path}.expectedStatus`, message: 'unknown expected status' });
      }
      if (!Array.isArray(bal_answer_record.expectedValue)) {
        bal_issues.push({ path: `${bal_answer_path}.expectedValue`, message: 'must be an array of ids' });
      } else if (
        bal_answer_record.expectedStatus === 'accept' &&
        (bal_answer_record.expectedValue as unknown[]).length === 0
      ) {
        bal_issues.push({ path: `${bal_answer_path}.expectedValue`, message: 'accept requires at least one id' });
      } else if (
        bal_answer_record.expectedStatus === 'accept' &&
        bal_answer_record.expectedStatus === 'accept' &&
        (bal_answer_record.expectedValue as unknown[]).some((bal_v) => typeof bal_v !== 'string')
      ) {
        bal_issues.push({ path: `${bal_answer_path}.expectedValue`, message: 'ids must be strings' });
      }
    });
  });
  return bal_issues;
}

export function bal_parse_ground_truth(bal_raw: unknown): { doc: bal_GroundTruthDoc | null; issues: bal_GroundTruthIssue[] } {
  const bal_issues = bal_ground_truth_issues(bal_raw);
  if (bal_issues.length > 0) return { doc: null, issues: bal_issues };
  return { doc: bal_raw as bal_GroundTruthDoc, issues: [] };
}

export function bal_serialize_ground_truth(bal_doc: bal_GroundTruthDoc): string {
  return JSON.stringify(bal_doc, null, 2);
}
