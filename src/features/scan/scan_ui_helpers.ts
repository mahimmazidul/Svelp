import type { ScanIssueCategory, ScanPageRecord } from '../../models/scan_models';

export interface bal_ReviewCategory {
  id: ScanIssueCategory;
  title: string;
  description: string;
}

export const BAL_REVIEW_CATEGORIES: bal_ReviewCategory[] = [
  { id: 'unidentified', title: 'Needs identification', description: 'No readable Svelp code was found. Assign the respondent and page yourself.' },
  { id: 'multiple-identifiers', title: 'Multiple identifiers', description: 'More than one questionnaire matches this code.' },
  { id: 'possible-multiple-sheets', title: 'Possible two-sheet photo', description: 'Several codes were detected in one photo.' },
  { id: 'alignment-failed', title: 'Missing markers', description: 'The page edges could not be recovered automatically.' },
  { id: 'corner-correction-required', title: 'Corner correction', description: 'One marker was inferred; confirm or fix the page corners.' },
  { id: 'duplicate', title: 'Duplicates', description: 'The same page appears more than once.' },
  { id: 'poor-quality', title: 'Poor quality', description: 'Blur, darkness, glare, or low resolution may make this page unusable.' },
  { id: 'version-mismatch', title: 'Version mismatch', description: 'This page references a different questionnaire version.' },
  { id: 'unsupported-file', title: 'Unsupported files', description: 'These files cannot be read on this device.' },
  { id: 'failed-decode', title: 'Failed to decode', description: 'The file could not be opened.' }
];

export function bal_page_categories(bal_page: ScanPageRecord): ScanIssueCategory[] {
  return bal_page.issues;
}

export function bal_category_pages(
  bal_pages: ScanPageRecord[],
  bal_category: ScanIssueCategory
): ScanPageRecord[] {
  return bal_pages.filter(
    (bal_page) =>
      bal_page.issues.includes(bal_category) &&
      bal_page.status !== 'ready' &&
      bal_page.status !== 'queued'
  );
}

export function bal_review_pages(bal_pages: ScanPageRecord[]): ScanPageRecord[] {
  return bal_pages.filter(
    (bal_page) =>
      (bal_page.status === 'needs-review' || bal_page.status === 'duplicate' || bal_page.status === 'failed' || bal_page.status === 'unsupported') &&
      bal_page.issues.length > 0
  );
}

export function bal_status_tone(bal_status: ScanPageRecord['status']): 'neutral' | 'success' | 'warning' | 'accent' {
  switch (bal_status) {
    case 'ready':
      return 'success';
    case 'needs-review':
    case 'duplicate':
      return 'warning';
    case 'failed':
    case 'unsupported':
      return 'accent';
    default:
      return 'neutral';
  }
}

export function bal_status_label(bal_status: ScanPageRecord['status']): string {
  switch (bal_status) {
    case 'queued':
      return 'Queued';
    case 'decoding':
    case 'identifying':
    case 'aligning':
    case 'normalizing':
      return 'Processing';
    case 'ready':
      return 'Ready';
    case 'needs-review':
      return 'Needs review';
    case 'duplicate':
      return 'Duplicate';
    case 'unsupported':
      return 'Unsupported';
    case 'failed':
      return 'Failed';
    default:
      return bal_status;
  }
}

export function bal_page_title(bal_page: ScanPageRecord): string {
  if (bal_page.respondentId !== null && bal_page.pageNumber !== null) {
    return `Respondent ${bal_page.respondentId} — page ${bal_page.pageNumber}`;
  }
  return bal_page.sourceName;
}

export function bal_format_bytes(bal_bytes: number): string {
  if (bal_bytes < 1024) return `${bal_bytes} B`;
  if (bal_bytes < 1024 * 1024) return `${(bal_bytes / 1024).toFixed(0)} KB`;
  return `${(bal_bytes / (1024 * 1024)).toFixed(1)} MB`;
}
