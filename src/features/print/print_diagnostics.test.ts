import { describe, expect, it } from 'vitest';
import { bal_build_print_document } from './print_layout';
import { bal_page_utilization } from './print_diagnostics';
import { bal_validate_print } from './print_validate';
import { bal_food_wastage_benchmark, bal_benchmark_scales } from '../../test/print_benchmark_fixtures';
import { bal_short_survey } from './print_fixtures';
import type { bal_PrintDocument } from './print_layout';
import type { PrintSettings } from '../../models/types';

describe('page utilization diagnostics', () => {
  it('reports usable, occupied, and whitespace per page', () => {
    const bal_doc = bal_build_print_document({
      questionnaire: bal_food_wastage_benchmark(),
      scales: bal_benchmark_scales()
    });
    const bal_report = bal_page_utilization(bal_doc);
    expect(bal_report.pages).toHaveLength(bal_doc.pageCount);
    for (const bal_page of bal_report.pages) {
      expect(bal_page.usableMm).toBeGreaterThan(200);
      expect(bal_page.occupiedMm).toBeGreaterThan(0);
      expect(bal_page.whitespaceMm).toBeGreaterThanOrEqual(0);
      expect(bal_page.whitespaceRatio).toBeGreaterThanOrEqual(0);
    }
    expect(bal_report.totalWhitespaceMm).toBeGreaterThan(0);
  });

  it('flags a nearly empty final page on multi-page documents', () => {
    const bal_doc = bal_build_print_document({ questionnaire: bal_short_survey(), scales: [] });
    const bal_page = bal_doc.pages[0];
    const bal_synthetic = {
      ...bal_doc,
      pageCount: 2,
      pages: [
        ...bal_doc.pages,
        {
          ...bal_page,
          pageNumber: 2,
          chunks: bal_page.chunks.slice(0, 1)
        }
      ]
    };
    const bal_report = bal_page_utilization(bal_synthetic as bal_PrintDocument);
    const bal_final = bal_report.pages[bal_report.pages.length - 1];
    expect(bal_final.suspicious).toBe(true);
    expect(bal_final.reasons).toContain('nearly-empty-final-page');
    expect(bal_report.suspiciousPages).toContain(2);
  });

  it('validates dense benchmark documents without geometry errors', () => {
    const bal_q = bal_food_wastage_benchmark();
    bal_q.printSettings = { ...bal_q.printSettings, density: 'dense' } as PrintSettings;
    const bal_doc = bal_build_print_document({
      questionnaire: bal_q,
      scales: bal_benchmark_scales()
    });
    const bal_report = bal_validate_print(bal_doc);
    const bal_errors = bal_report.issues.filter((bal_i) => bal_i.severity === 'error');
    expect(bal_errors).toEqual([]);
  });
});
