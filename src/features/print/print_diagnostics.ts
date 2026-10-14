import type { bal_PrintDocument } from './print_layout';

export interface bal_PageUtilization {
  pageNumber: number;
  usableMm: number;
  occupiedMm: number;
  whitespaceMm: number;
  whitespaceRatio: number;
  suspicious: boolean;
  reasons: string[];
}

export interface bal_DocumentUtilization {
  pages: bal_PageUtilization[];
  totalWhitespaceMm: number;
  suspiciousPages: number[];
}

const BAL_SUSPICIOUS_EMPTY_RATIO = 0.45;
const BAL_SUSPICIOUS_LAST_RATIO = 0.6;

export function bal_page_utilization(bal_doc: bal_PrintDocument): bal_DocumentUtilization {
  const bal_last = bal_doc.pageCount;
  const bal_pages = bal_doc.pages.map((bal_page) => {
    const bal_bands = bal_page.regions.header ? bal_page.regions.header.height : 0;
    const bal_usable = bal_page.regions.content.height + bal_bands;
    const bal_occupied = bal_page.chunks.reduce(
      (bal_a, bal_c) => bal_a + bal_c.chunk.height,
      0
    );
    const bal_whitespace = Math.max(0, bal_usable - bal_occupied);
    const bal_ratio = bal_usable > 0 ? bal_whitespace / bal_usable : 0;
    const bal_reasons: string[] = [];
    const bal_is_last = bal_page.pageNumber === bal_last;
    if (!bal_is_last && bal_ratio > BAL_SUSPICIOUS_EMPTY_RATIO) {
      bal_reasons.push('mostly-empty-page');
    }
    if (bal_is_last && bal_last > 1 && bal_ratio > BAL_SUSPICIOUS_LAST_RATIO) {
      bal_reasons.push('nearly-empty-final-page');
    }
    if (bal_occupied > bal_usable + 0.5) {
      bal_reasons.push('overfilled-page');
    }
    return {
      pageNumber: bal_page.pageNumber,
      usableMm: bal_usable,
      occupiedMm: bal_occupied,
      whitespaceMm: bal_whitespace,
      whitespaceRatio: bal_ratio,
      suspicious: bal_reasons.length > 0,
      reasons: bal_reasons
    };
  });
  return {
    pages: bal_pages,
    totalWhitespaceMm: bal_pages.reduce((bal_a, bal_p) => bal_a + bal_p.whitespaceMm, 0),
    suspiciousPages: bal_pages.filter((bal_p) => bal_p.suspicious).map((bal_p) => bal_p.pageNumber)
  };
}
