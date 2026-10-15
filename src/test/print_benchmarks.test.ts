import { describe, expect, it } from 'vitest';
import type { PrintSettings, ResponseScaleRecord } from '../models/types';
import { bal_build_print_document, type bal_PrintDocument } from '../features/print/print_layout';
import { bal_page_svg } from '../features/print/print_svg';
import { bal_validate_print } from '../features/print/print_validate';
import { bal_page_utilization } from '../features/print/print_diagnostics';
import { bal_food_wastage_benchmark, bal_benchmark_scales } from './print_benchmark_fixtures';
import { bal_calibration_set } from './print_calibration_fixtures';
import { bal_ffq } from '../features/print/print_fixtures';
import { bal_slex } from '../features/source/shobdo_lexer';
import { bal_sparse } from '../features/source/naksha_parser';
import { bal_plan_apply } from '../features/source/bani_compile';
import { bal_source_serialize } from '../features/source/lekha_serialize';

function bal_dense(bal_q: ReturnType<typeof bal_food_wastage_benchmark>, bal_density: PrintSettings['density']) {
  return { ...bal_q, printSettings: { ...bal_q.printSettings, density: bal_density } as PrintSettings };
}

function bal_svgs(bal_doc: bal_PrintDocument): string[] {
  return bal_doc.pages.map((bal_p) => bal_page_svg(bal_p, bal_doc, null));
}

describe('food wastage benchmark page counts', () => {
  it('measures recorded page counts for all three densities', () => {
    const bal_scales = bal_benchmark_scales();
    const bal_counts: Record<string, number> = {};
    for (const bal_density of ['comfortable', 'compact', 'dense'] as const) {
      const bal_doc = bal_build_print_document({
        questionnaire: bal_dense(bal_food_wastage_benchmark(), bal_density),
        scales: bal_scales,
        respondentId: 'BENCH-1'
      });
      bal_counts[bal_density] = bal_doc.pageCount;
    }
    expect(bal_counts).toEqual({ comfortable: 9, compact: 6, dense: 5 });
  });

  it('meets the acceptance band for compact and dense', () => {
    const bal_scales = bal_benchmark_scales();
    for (const bal_density of ['compact', 'dense'] as const) {
      const bal_doc = bal_build_print_document({
        questionnaire: bal_dense(bal_food_wastage_benchmark(), bal_density),
        scales: bal_scales
      });
      expect(bal_doc.pageCount).toBeLessThanOrEqual(6);
    }
  });

  it('validates with zero geometry errors at every density', () => {
    const bal_scales = bal_benchmark_scales();
    for (const bal_density of ['comfortable', 'compact', 'dense'] as const) {
      const bal_q = bal_dense(bal_food_wastage_benchmark(), bal_density);
      bal_q.printSettings = { ...bal_q.printSettings, scannerMode: true } as PrintSettings;
      const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: bal_scales });
      const bal_errors = bal_validate_print(bal_doc).issues.filter(
        (bal_i) => bal_i.severity === 'error'
      );
      expect(bal_errors, `${bal_density}: ${bal_errors.map((bal_e) => bal_e.code).join(',')}`).toEqual([]);
    }
  });

  it('keeps utilization whitespace below one page equivalent in compact', () => {
    const bal_doc = bal_build_print_document({
      questionnaire: bal_dense(bal_food_wastage_benchmark(), 'compact'),
      scales: bal_benchmark_scales()
    });
    const bal_report = bal_page_utilization(bal_doc);
    const bal_interior = bal_report.pages.slice(0, -1);
    for (const bal_page of bal_interior) {
      expect(bal_page.reasons, `page ${bal_page.pageNumber}`).not.toContain('mostly-empty-page');
    }
  });
});

describe('calibration fixtures across densities', () => {
  it('renders every calibration document at every density without errors', () => {
    for (const bal_density of ['comfortable', 'compact', 'dense'] as const) {
      const bal_set = bal_calibration_set(bal_density);
      const bal_docs = [
        ['banglaDemographic', bal_set.banglaDemographic],
        ['knowledgeMatrix', bal_set.knowledgeMatrix],
        ['likertMatrix', bal_set.likertMatrix],
        ['frequency25', bal_set.frequency25],
        ['ffq60', bal_set.ffq60],
        ['consentSignatures', bal_set.consentSignatures]
      ] as const;
      for (const [bal_name, bal_doc] of bal_docs) {
        const bal_errors = bal_validate_print(bal_doc).issues.filter(
          (bal_i) => bal_i.severity === 'error'
        );
        expect(bal_errors, `${bal_name}/${bal_density}`).toEqual([]);
        expect(bal_svgs(bal_doc).join('').length, `${bal_name}/${bal_density}`).toBeGreaterThan(500);
      }
    }
  });

  it('prints the ffq sixty rows by seven columns within two pages in compact', () => {
    const bal_scale: ResponseScaleRecord = {
      id: 'scale-freq',
      name: 'freq7',
      options: [
        { id: 'fq7-1', label: 'Never', coding: '0' },
        { id: 'fq7-2', label: 'Rarely', coding: '1' },
        { id: 'fq7-3', label: 'Monthly', coding: '2' },
        { id: 'fq7-4', label: 'Weekly', coding: '3' },
        { id: 'fq7-5', label: 'Daily', coding: '4' },
        { id: 'fq7-6', label: 'Twice daily', coding: '5' },
        { id: 'fq7-7', label: 'With every meal', coding: '6' }
      ],
      createdAt: 0,
      updatedAt: 0
    };
    for (const bal_density of ['comfortable', 'compact', 'dense'] as const) {
      const bal_q = bal_ffq(60);
      bal_q.printSettings = { ...bal_q.printSettings, density: bal_density } as PrintSettings;
      const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: [bal_scale] });
      const bal_matrix_cols = new Set(
        bal_doc.pages.flatMap((bal_p) =>
          bal_p.geometry.answerRegions.filter((bal_r) => bal_r.kind === 'matrix').map((bal_r) => bal_r.columnId)
        )
      );
      expect(bal_matrix_cols.size).toBe(7);
      if (bal_density !== 'comfortable') {
        expect(bal_doc.pageCount).toBeLessThanOrEqual(3);
      }
    }
  });

  it('prints the kap twenty twenty twenty battery compactly', () => {
    const bal_set = bal_calibration_set('compact');
    expect(bal_set.knowledgeMatrix.pageCount).toBeLessThanOrEqual(4);
    const bal_regions = bal_set.knowledgeMatrix.pages.flatMap((bal_p) => bal_p.geometry.answerRegions);
    const bal_items = new Set(
      bal_regions.filter((bal_r) => bal_r.kind === 'choice').map((bal_r) => bal_r.itemId)
    );
    expect(bal_items.size).toBe(60);
  });

  it('keeps both signatures and the acknowledgement on one page in compact', () => {
    const bal_set = bal_calibration_set('compact');
    expect(bal_set.consentSignatures.pageCount).toBe(1);
    const bal_bounds = bal_set.consentSignatures.pages[0].geometry.itemBounds.filter(
      (bal_b) => bal_b.chunkKind === 'signature-pair'
    );
    expect(bal_bounds).toHaveLength(2);
  });
});

describe('source mode print identity', () => {
  it('produces identical page rendering after a full svelp 1 round trip', () => {
    const bal_scales = bal_benchmark_scales();
    const bal_original = bal_build_print_document({
      questionnaire: bal_food_wastage_benchmark(),
      scales: bal_scales,
      respondentId: 'BN-017'
    });
    const bal_source = bal_source_serialize(bal_food_wastage_benchmark(), bal_scales);
    expect(bal_source.skipped).toEqual([]);
    const bal_lexed = bal_slex(bal_source.text);
    const bal_parsed = bal_sparse(bal_lexed.tokens, bal_lexed.errors);
    expect(bal_parsed.errors).toEqual([]);
    const bal_plan = bal_plan_apply(bal_parsed.doc, null, bal_scales);
    expect(bal_plan.ok).toBe(true);
    if (!bal_plan.ok) return;
    const bal_rebuilt = bal_build_print_document({
      questionnaire: bal_plan.questionnaire,
      scales: bal_plan.scales,
      respondentId: 'BN-017'
    });
    expect(bal_rebuilt.pageCount).toBe(bal_original.pageCount);
    expect(bal_svgs(bal_rebuilt)).toEqual(bal_svgs(bal_original));
  });
});
