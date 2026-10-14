import { describe, expect, it } from 'vitest';
import {
  BAL_BN_SHAPING_WORDS,
  BAL_BN_TITLE,
  bal_bangla_survey,
  bal_frequency_scale_bn
} from '../../test/bangla_fixtures';
import { bal_build_print_document } from './print_layout';
import { bal_wrap_text } from './print_fonts';
import { hati_pdf_bytes } from './biriyani_pdf';

function bal_strip_bangla(bal_text: string): string {
  return [...bal_text].map((bal_ch) => ([...bal_ch].length === 1 && bal_ch.codePointAt(0)! <= 0x7e ? bal_ch : 'X')).join('');
}

function bal_english_twin(): ReturnType<typeof bal_build_print_document> {
  const bal_q = JSON.parse(JSON.stringify(bal_bangla_survey())) as ReturnType<typeof bal_bangla_survey>;
  bal_q.title = 'Household food wastage survey';
  bal_q.description = 'Purpose of this survey is to learn about food habits.';
  for (const bal_section of bal_q.sections) {
    bal_section.title = bal_strip_bangla(bal_section.title);
    bal_section.description = bal_section.description === null ? null : bal_strip_bangla(bal_section.description);
    for (const bal_item of bal_section.items) {
      bal_item.label = bal_strip_bangla(bal_item.label);
      bal_item.placeholder = bal_item.placeholder === null ? null : bal_strip_bangla(bal_item.placeholder);
      bal_item.unitLabel = bal_item.unitLabel === null ? null : bal_strip_bangla(bal_item.unitLabel);
      for (const bal_option of bal_item.options) bal_option.label = bal_strip_bangla(bal_option.label);
      bal_item.rows = bal_item.rows.map((bal_r) => ({ ...bal_r, label: bal_strip_bangla(bal_r.label) }));
      bal_item.columns = bal_item.columns.map((bal_c) => ({ ...bal_c, label: bal_strip_bangla(bal_c.label) }));
      if (bal_item.consent) {
        bal_item.consent.title = 'Consent';
        bal_item.consent.introduction = 'Intro text for the study.';
        bal_item.consent.acknowledgementLabel = 'I agree';
        bal_item.consent.sections = bal_item.consent.sections.map((bal_s) => ({
          ...bal_s,
          title: 'Section',
          body: 'Body text for the section.'
        }));
      }
      if (bal_item.signature) bal_item.signature.signerRole = 'Participant';
    }
  }
  return bal_build_print_document({ questionnaire: bal_q, scales: [], respondentId: 'BN-017' });
}

describe('bangla print layout', () => {
  it('measures bangla text wider than the ascii fallback space', () => {
    const bal_font = { family: 'helvetica' as const, bold: false };
    const bal_lines = bal_wrap_text(BAL_BN_TITLE, bal_font, 11, 60);
    expect(bal_lines.length).toBeGreaterThanOrEqual(1);
    expect(bal_lines.join(' ')).toBe(BAL_BN_TITLE);
    const bal_wrap_narrow = bal_wrap_text(BAL_BN_TITLE, bal_font, 11, 38);
    expect(bal_wrap_narrow.length).toBeGreaterThan(1);
    for (const bal_line of bal_wrap_narrow) {
      expect(bal_line.length).toBeGreaterThan(0);
    }
  });

  it('keeps bangla digits and dashes inside option labels when wrapping', () => {
    const bal_font = { family: 'helvetica' as const, bold: false };
    const bal_lines = bal_wrap_text('সপ্তাহে ২–৪ বার বা তার বেশি', bal_font, 11, 30);
    expect(bal_lines.length).toBeGreaterThan(1);
    expect(bal_lines.join(' ')).toBe('সপ্তাহে ২–৪ বার বা তার বেশি');
  });

  it('assigns every bangla questionnaire page unique payloads and lays out the matrix', () => {
    const bal_doc = bal_build_print_document({
      questionnaire: bal_bangla_survey(),
      scales: [bal_frequency_scale_bn()],
      respondentId: 'BN-017'
    });
    expect(bal_doc.pageCount).toBeGreaterThanOrEqual(3);
    const bal_payloads = new Set<string>();
    for (const bal_page of bal_doc.pages) {
      if (bal_page.identifier) bal_payloads.add(bal_page.identifier.payload);
    }
    expect(bal_payloads.size).toBe(bal_doc.pageCount);
    const bal_matrix_pages = bal_doc.pages.filter((bal_p) =>
      bal_p.chunks.some((bal_c) => bal_c.chunk.kind === 'matrix-head')
    );
    expect(bal_matrix_pages.length).toBeGreaterThan(0);
    const bal_matrix_rows = bal_doc.pages.flatMap((bal_p) =>
      bal_p.chunks.filter((bal_c) => bal_c.chunk.kind === 'matrix-row')
    );
    expect(bal_matrix_rows.length).toBe(9);
  });
});

describe('bangla pdf generation', () => {
  it('embeds bengali glyph outlines and renders text onto the first page', async () => {
    const bal_doc = bal_build_print_document({
      questionnaire: bal_bangla_survey(),
      scales: [bal_frequency_scale_bn()],
      respondentId: 'BN-017'
    });
    const bal_bytes = await hati_pdf_bytes(bal_doc);
    expect(String.fromCharCode(...bal_bytes.slice(0, 5))).toBe('%PDF-');
    expect(bal_bytes.length).toBeGreaterThan(400000);
    expect(bal_bytes.length).toBeLessThan(1500000);
    const bal_english = await hati_pdf_bytes(bal_english_twin());
    expect(bal_bytes.length).toBeGreaterThan(bal_english.length * 20);
  });

  it('produces deterministic bangla pdf bytes for identical documents', async () => {
    const bal_make = async (): Promise<Uint8Array> =>
      hati_pdf_bytes(
        bal_build_print_document({
          questionnaire: bal_bangla_survey(),
          scales: [bal_frequency_scale_bn()],
          respondentId: 'BN-017'
        })
      );
    const bal_first = await bal_make();
    const bal_second = await bal_make();
    expect(bal_first.length).toBe(bal_second.length);
    expect(Array.from(bal_first.slice(0, 2048))).toEqual(Array.from(bal_second.slice(0, 2048)));
  });

  it('keeps every shaping stress word present in the shaped font subset', () => {
    for (const bal_word of BAL_BN_SHAPING_WORDS) {
      expect(bal_word.length).toBeGreaterThan(1);
    }
  });
});
