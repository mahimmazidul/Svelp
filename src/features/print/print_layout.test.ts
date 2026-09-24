import { describe, expect, it } from 'vitest';
import { bal_build_print_document, type bal_PrintDocument } from './print_layout';
import {
  bal_consent_heavy,
  bal_custom_matrix,
  bal_ffq,
  bal_frequency_scale,
  bal_mixed_survey,
  bal_short_survey
} from './print_fixtures';
import type { QuestionnaireRecord } from '../../models/types';

function bal_doc_with_scanner(bal_q: QuestionnaireRecord, bal_respondent = '037'): bal_PrintDocument {
  bal_q.printSettings = {
    ...bal_q.printSettings,
    showMachineIdentifier: true,
    scannerMode: true,
    header: {
      showTitle: true,
      showInstitution: false,
      institution: '',
      showStudyCode: true,
      studyCode: 'FFQ',
      showVersion: true,
      showRespondentId: true,
      respondentIdLabel: 'Respondent ID'
    },
    footer: {
      showPageNumbers: true,
      showStudyCode: true,
      confidentialityNote: 'Confidential',
      showHumanIdentifier: true
    }
  } as QuestionnaireRecord['printSettings'];
  return bal_build_print_document({ questionnaire: bal_q, scales: [bal_frequency_scale()], respondentId: bal_respondent });
}

describe('document geometry invariants', () => {
  it('keeps item bounds inside page content bounds on every page', () => {
    for (const bal_q of [bal_mixed_survey(), bal_consent_heavy(), bal_ffq(60)]) {
      const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: [bal_frequency_scale()] });
      for (const bal_page of bal_doc.pages) {
        for (const bal_bound of bal_page.geometry.itemBounds) {
          expect(bal_bound.rect.x).toBeGreaterThanOrEqual(bal_page.geometry.contentBounds.x - 0.001);
          expect(bal_bound.rect.y).toBeGreaterThanOrEqual(bal_page.geometry.contentBounds.y - 0.001);
          expect(bal_bound.rect.y + bal_bound.rect.height).toBeLessThanOrEqual(
            bal_page.geometry.contentBounds.y + bal_page.geometry.contentBounds.height + 0.001
          );
        }
      }
    }
  });

  it('keeps answer regions at least one margin away from the paper edge', () => {
    const bal_doc = bal_doc_with_scanner(bal_ffq(20));
    for (const bal_page of bal_doc.pages) {
      for (const bal_region of bal_page.geometry.answerRegions) {
        expect(bal_region.rect.x).toBeGreaterThanOrEqual(bal_page.geometry.margins.left - 0.001);
        expect(bal_region.rect.y).toBeGreaterThanOrEqual(bal_page.geometry.margins.top - 0.001);
        expect(bal_region.rect.x + bal_region.rect.width).toBeLessThanOrEqual(
          bal_page.geometry.width - bal_page.geometry.margins.right + 0.001
        );
        expect(bal_region.rect.y + bal_region.rect.height).toBeLessThanOrEqual(
          bal_page.geometry.height - bal_page.geometry.margins.bottom + 0.001
        );
      }
    }
  });

  it('produces non-overlapping answer regions', () => {
    for (const bal_doc of [
      bal_build_print_document({ questionnaire: bal_mixed_survey(), scales: [] }),
      bal_build_print_document({ questionnaire: bal_ffq(60), scales: [bal_frequency_scale()] }),
      bal_build_print_document({ questionnaire: bal_consent_heavy(), scales: [] })
    ]) {
      for (const bal_page of bal_doc.pages) {
        const bal_regions = bal_page.geometry.answerRegions;
        for (let bal_i = 0; bal_i < bal_regions.length; bal_i++) {
          for (let bal_j = bal_i + 1; bal_j < bal_regions.length; bal_j++) {
            const bal_a = bal_regions[bal_i].rect;
            const bal_b = bal_regions[bal_j].rect;
            const bal_separated =
              bal_a.x + bal_a.width <= bal_b.x + 0.01 ||
              bal_b.x + bal_b.width <= bal_a.x + 0.01 ||
              bal_a.y + bal_a.height <= bal_b.y + 0.01 ||
              bal_b.y + bal_b.height <= bal_a.y + 0.01;
            expect(bal_separated).toBe(true);
          }
        }
      }
    }
  });

  it('emits normalized coordinates between zero and one', () => {
    const bal_doc = bal_build_print_document({ questionnaire: bal_ffq(12), scales: [bal_frequency_scale()] });
    for (const bal_page of bal_doc.pages) {
      for (const bal_region of bal_page.geometry.answerRegions) {
        for (const bal_value of [
          bal_region.normalized.x,
          bal_region.normalized.y,
          bal_region.normalized.width,
          bal_region.normalized.height
        ]) {
          expect(bal_value).toBeGreaterThanOrEqual(0);
          expect(bal_value).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('matrix geometry', () => {
  it('maps every logical row and column exactly once across pages', () => {
    const bal_doc = bal_build_print_document({
      questionnaire: bal_ffq(60),
      scales: [bal_frequency_scale()]
    });
    const bal_cells = bal_doc.geometry.pages.flatMap((bal_p) =>
      bal_p.answerRegions.filter((bal_r) => bal_r.kind === 'matrix')
    );
    expect(bal_cells).toHaveLength(60 * 4);
    const bal_pairs = new Set(bal_cells.map((bal_r) => `${bal_r.rowId}|${bal_r.columnId}`));
    expect(bal_pairs.size).toBe(240);
    for (const bal_cell of bal_cells) {
      expect(bal_cell.optionCode).not.toBeNull();
      expect(bal_cell.selection).toBe('single');
    }
  });

  it('records continuation rows with correct page attribution', () => {
    const bal_doc = bal_build_print_document({
      questionnaire: bal_custom_matrix(40, ['Never', 'Sometimes', 'Daily']),
      scales: []
    });
    const bal_rows_by_page = new Map<number, Set<string>>();
    for (const bal_page of bal_doc.geometry.pages) {
      const bal_ids = new Set(
        bal_page.answerRegions
          .filter((bal_r) => bal_r.kind === 'matrix')
          .map((bal_r) => bal_r.rowId as string)
      );
      if (bal_ids.size > 0) bal_rows_by_page.set(bal_page.pageNumber, bal_ids);
    }
    expect(bal_rows_by_page.size).toBeGreaterThan(1);
    const bal_all = new Set([...bal_rows_by_page.values()].flatMap((bal_s) => [...bal_s]));
    expect(bal_all.size).toBe(40);
  });
});

describe('page identifiers', () => {
  it('attaches a payload per page carrying respondent and page number', () => {
    const bal_doc = bal_doc_with_scanner(bal_short_survey(), '042');
    expect(bal_doc.pages.length).toBe(1);
    const bal_id = bal_doc.pages[0].geometry.identifier;
    expect(bal_id?.payload).toBe('S1|FFQ|1|042|1');
    expect(bal_id?.humanReadable).toBe('FFQ-042 P1/1');
    expect(bal_id?.qrBounds).not.toBeNull();
    expect(bal_id?.moduleCount).toBeGreaterThan(0);
  });

  it('keeps the QR bounds inside the footer band with quiet zone clearance', () => {
    const bal_doc = bal_doc_with_scanner(bal_mixed_survey());
    for (const bal_page of bal_doc.pages) {
      const bal_footer = bal_page.geometry.footerBounds;
      const bal_qr = bal_page.geometry.identifier?.qrBounds;
      expect(bal_footer).not.toBeNull();
      expect(bal_qr).not.toBeNull();
      expect(bal_qr?.x).toBeGreaterThanOrEqual(bal_footer!.x);
      expect(bal_qr!.y).toBeGreaterThanOrEqual(bal_footer!.y);
      expect(bal_qr!.y + bal_qr!.height).toBeLessThanOrEqual(bal_footer!.y + bal_footer!.height + 0.001);
    }
  });

  it('omits identifiers when the machine identifier is disabled', () => {
    const bal_q = bal_short_survey();
    bal_q.printSettings = {
      margins: { top: 18, right: 16, bottom: 18, left: 16 },
      theme: { name: 'academic', fontFamily: 'times', baseFontSize: 11, headingScale: 1.25, lineWeight: 0.25 },
      density: 'standard',
      questionSpacing: 6.5,
      header: { showTitle: true, showInstitution: false, institution: '', showStudyCode: false, studyCode: '', showVersion: true, showRespondentId: false, respondentIdLabel: '' },
      footer: { showPageNumbers: true, showStudyCode: false, confidentialityNote: '', showHumanIdentifier: false },
      showMachineIdentifier: false,
      scannerMode: false,
      marker: { diameterMm: 4.8, regionPaddingMm: 1.4 },
      identifier: { sizeMm: 20, errorCorrection: 'M' },
      respondentArea: { enabled: false, label: '' },
      logo: null
    };
    const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: [] });
    expect(bal_doc.pages[0].geometry.identifier).toBeNull();
    expect(bal_doc.pages[0].geometry.respondentIdBounds).toBeNull();
  });
});

describe('alignment markers', () => {
  it('places four markers on each page only in scanner mode', () => {
    const bal_plain = bal_build_print_document({ questionnaire: bal_short_survey(), scales: [] });
    expect(bal_plain.pages[0].geometry.alignmentMarkers).toHaveLength(0);

    const bal_scanner = bal_doc_with_scanner(bal_short_survey());
    const bal_markers = bal_scanner.pages[0].geometry.alignmentMarkers;
    expect(bal_markers).toHaveLength(4);
    for (const bal_marker of bal_markers) {
      expect(bal_marker.rect.x).toBeGreaterThanOrEqual(5);
      expect(bal_marker.rect.y).toBeGreaterThanOrEqual(5);
      expect(bal_marker.normalized.x).toBeGreaterThan(0);
      expect(bal_marker.normalized.x + bal_marker.normalized.width).toBeLessThan(1);
    }
  });
});

describe('respondent batches into geometry', () => {
  it('changes only the identifier payload between respondents', () => {
    const bal_q = bal_mixed_survey();
    const bal_a = bal_doc_with_scanner(bal_q, '001');
    const bal_b = bal_doc_with_scanner(bal_q, '002');
    expect(bal_a.pageCount).toBe(bal_b.pageCount);
    for (let bal_i = 0; bal_i < bal_a.pageCount; bal_i++) {
      expect(bal_a.pages[bal_i].geometry.answerRegions).toEqual(bal_b.pages[bal_i].geometry.answerRegions);
      expect(bal_a.pages[bal_i].geometry.identifier?.payload).not.toBe(
        bal_b.pages[bal_i].geometry.identifier?.payload
      );
      expect(bal_a.pages[bal_i].geometry.identifier?.payload).toContain('|001|');
    }
  });
});
