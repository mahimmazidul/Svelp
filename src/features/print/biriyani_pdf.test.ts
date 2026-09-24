import { describe, expect, it } from 'vitest';
import { hati_pdf_bytes, hati_pdf_bytes_many } from './biriyani_pdf';
import { bal_build_print_document } from './print_layout';
import { bal_consent_heavy, bal_ffq, bal_frequency_scale, bal_mixed_survey, bal_short_survey } from './print_fixtures';

function bal_count_pdf_pages(bal_bytes: Uint8Array): number {
  const bal_text = new TextDecoder('latin1').decode(bal_bytes);
  return (bal_text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

describe('pdf generation', () => {
  it('produces a valid single-page pdf for a short survey', async () => {
    const bal_doc = bal_build_print_document({ questionnaire: bal_short_survey(), scales: [] });
    const bal_bytes = await hati_pdf_bytes(bal_doc);
    const bal_header = String.fromCharCode(...bal_bytes.slice(0, 5));
    expect(bal_header).toBe('%PDF-');
    expect(bal_count_pdf_pages(bal_bytes)).toBe(1);
    expect(bal_bytes.length).toBeGreaterThan(1000);
  });

  it('emits one pdf page per laid-out page for a mixed survey', async () => {
    const bal_doc = bal_build_print_document({ questionnaire: bal_mixed_survey(), scales: [] });
    const bal_bytes = await hati_pdf_bytes(bal_doc);
    expect(bal_count_pdf_pages(bal_bytes)).toBe(bal_doc.pageCount);
    expect(bal_doc.pageCount).toBeGreaterThan(1);
  });

  it('handles a large FFQ with matrix continuation', async () => {
    const bal_doc = bal_build_print_document({
      questionnaire: bal_ffq(60),
      scales: [bal_frequency_scale()]
    });
    const bal_bytes = await hati_pdf_bytes(bal_doc);
    expect(bal_count_pdf_pages(bal_bytes)).toBe(bal_doc.pageCount);
    expect(bal_doc.pageCount).toBeGreaterThan(2);
    expect(bal_bytes.length).toBeLessThan(5_000_000);
  });

  it('renders consent-heavy forms with signatures', async () => {
    const bal_doc = bal_build_print_document({ questionnaire: bal_consent_heavy(), scales: [] });
    const bal_bytes = await hati_pdf_bytes(bal_doc);
    expect(bal_count_pdf_pages(bal_bytes)).toBe(bal_doc.pageCount);
  });

  it('stays deterministic for identical documents', async () => {
    const bal_q = bal_mixed_survey();
    const bal_a = await hati_pdf_bytes(bal_build_print_document({ questionnaire: bal_q, scales: [] }));
    const bal_b = await hati_pdf_bytes(bal_build_print_document({ questionnaire: bal_q, scales: [] }));
    expect(bal_a.length).toBe(bal_b.length);
    expect(bal_count_pdf_pages(bal_a)).toBe(bal_count_pdf_pages(bal_b));
  });

  it('produces landscape pages when the questionnaire is landscape', async () => {
    const bal_q = bal_short_survey();
    bal_q.orientation = 'landscape';
    const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: [] });
    expect(bal_doc.pages[0].regions.width).toBeCloseTo(297, 1);
    const bal_bytes = await hati_pdf_bytes(bal_doc);
    expect(String.fromCharCode(...bal_bytes.slice(0, 5))).toBe('%PDF-');
  });
});

describe('batch pdf generation', () => {
  it('merges multiple respondent documents into one pdf', async () => {
    const bal_q = bal_short_survey();
    const bal_docs = ['001', '002', '003'].map((bal_r) =>
      bal_build_print_document({ questionnaire: bal_q, scales: [], respondentId: bal_r })
    );
    const bal_bytes = await hati_pdf_bytes_many(bal_docs);
    expect(String.fromCharCode(...bal_bytes.slice(0, 5))).toBe('%PDF-');
    expect(bal_count_pdf_pages(bal_bytes)).toBe(3);
    const bal_single = await hati_pdf_bytes(bal_docs[0]);
    expect(bal_bytes.length).toBeGreaterThan(bal_single.length * 2);
  });

  it('writes distinct page identifiers for each merged respondent', async () => {
    const bal_q = bal_short_survey();
    const bal_docs = ['001', '002'].map((bal_r) =>
      bal_build_print_document({ questionnaire: bal_q, scales: [], respondentId: bal_r })
    );
    bal_docs.forEach((bal_doc) => {
      const bal_payloads = bal_doc.pages.map((bal_p) => bal_doc.pages.length && bal_p.geometry.identifier?.payload);
      expect(new Set(bal_payloads).size).toBe(bal_doc.pageCount);
    });
  });
});
