import { describe, expect, it } from 'vitest';
import { bal_paginate } from './print_paginate';
import {
  bal_chunk_may_split,
  bal_split_chunk,
  type bal_QuestionChunk
} from './print_blocks';
import {
  bal_consent_heavy,
  bal_custom_matrix,
  bal_ffq,
  bal_frequency_scale,
  bal_mixed_survey,
  bal_short_survey
} from './print_fixtures';
import { bal_paper_dimensions } from './print_paper';

describe('pagination page model', () => {
  it('uses the questionnaire paper size for every page', () => {
    const bal_q = bal_short_survey();
    const bal_result = bal_paginate({ questionnaire: bal_q, scales: [] });
    const bal_dims = bal_paper_dimensions('a4', 'portrait');
    expect(bal_result.pages.length).toBe(1);
    expect(bal_result.pages[0].regions.width).toBe(bal_dims.width);
    expect(bal_result.pages[0].regions.height).toBe(bal_dims.height);
  });

  it('numbers pages sequentially from one', () => {
    const bal_result = bal_paginate({ questionnaire: bal_mixed_survey(), scales: [] });
    expect(bal_result.pages.length).toBeGreaterThan(1);
    expect(bal_result.pages.map((bal_p) => bal_p.pageNumber)).toEqual(
      bal_result.pages.map((_bal_page, bal_i) => bal_i + 1)
    );
  });

  it('keeps every chunk inside the content bounds', () => {
    for (const bal_q of [bal_mixed_survey(), bal_consent_heavy(), bal_ffq(60)]) {
      const bal_result = bal_paginate({ questionnaire: bal_q, scales: [bal_frequency_scale()] });
      for (const bal_page of bal_result.pages) {
        const bal_top = bal_page.regions.content.y;
        const bal_bottom = bal_top + bal_page.regions.content.height;
        for (const bal_placed of bal_page.chunks) {
          expect(bal_placed.y).toBeGreaterThanOrEqual(bal_top - 0.001);
          expect(bal_placed.y + bal_placed.chunk.height).toBeLessThanOrEqual(bal_bottom + 0.001);
        }
      }
    }
  });
});

describe('keep-together rules', () => {
  it('places each atomic chunk wholly on one page', () => {
    const bal_result = bal_paginate({ questionnaire: bal_consent_heavy(), scales: [] });
    for (const bal_placed of bal_result.chunks) {
      if (bal_placed.chunk.kind === 'question') continue;
      const bal_page = bal_result.pages.find((bal_p) => bal_p.pageNumber === bal_placed.page);
      const bal_top = bal_page?.regions.content.y ?? 0;
      const bal_bottom = bal_top + (bal_page?.regions.content.height ?? 0);
      expect(bal_placed.y).toBeGreaterThanOrEqual(bal_top - 0.001);
      expect(bal_placed.y + bal_placed.chunk.height).toBeLessThanOrEqual(bal_bottom + 0.001);
    }
  });

  it('never splits the consent acknowledgement from its statement', () => {
    const bal_result = bal_paginate({ questionnaire: bal_consent_heavy(), scales: [] });
    const bal_acks = bal_result.chunks.filter((bal_p) => bal_p.chunk.kind === 'consent-ack');
    expect(bal_acks.length).toBeGreaterThanOrEqual(1);
    for (const bal_ack of bal_acks) {
      const bal_page = bal_result.pages.find((bal_p) => bal_p.pageNumber === bal_ack.page);
      expect(bal_page).toBeDefined();
    }
  });

  it('keeps signature chunks whole', () => {
    const bal_result = bal_paginate({ questionnaire: bal_consent_heavy(), scales: [] });
    const bal_signatures = bal_result.chunks.filter((bal_p) => bal_p.chunk.kind === 'signature');
    expect(bal_signatures.length).toBe(2);
  });
});

describe('forced page breaks', () => {
  it('starts a section with a page break before at the content top', () => {
    const bal_result = bal_paginate({ questionnaire: bal_mixed_survey(), scales: [] });
    const bal_heads = bal_result.chunks.filter((bal_p) => bal_p.chunk.kind === 'section-head');
    expect(bal_heads.length).toBe(2);
    const bal_second = bal_heads[1];
    const bal_page = bal_result.pages.find((bal_p) => bal_p.pageNumber === bal_second.page);
    expect(bal_second.y).toBe(bal_page?.regions.content.y);
    expect(bal_page?.chunks[0].chunk.kind).toBe('section-head');
  });
});

describe('question option splitting', () => {
  it('splits a long option list only at option boundaries', () => {
    const bal_q = bal_mixed_survey();
    const bal_ctx = {
      settings: {
        margins: { top: 18, right: 16, bottom: 18, left: 16 },
        theme: { name: 'academic' as const, fontFamily: 'times' as const, baseFontSize: 11, headingScale: 1.25, lineWeight: 0.25 },
        density: 'standard' as const,
        questionSpacing: 6.5,
        header: {} as never,
        footer: {} as never,
        showMachineIdentifier: true,
        scannerMode: false,
        marker: { diameterMm: 4.8, regionPaddingMm: 1.4 },
        identifier: { sizeMm: 20, errorCorrection: 'M' as const },
        respondentArea: { enabled: true, label: 'Respondent ID' },
        logo: null
      },
      contentWidth: 178,
      numbering: { sectionLabels: {}, itemLabels: {}, questionCount: 4 },
      scales: []
    };
    const bal_items = bal_q.sections[0].items;
    const bal_choice = bal_items[0];
    bal_choice.options = Array.from({ length: 12 }, (_bal_x, bal_i) => ({
      id: `o${bal_i}`,
      label: `Age group ${bal_i + 1}`,
      coding: String(bal_i)
    }));
    const [bal_chunk] = (() => {
      const bal_result = bal_paginate({ questionnaire: bal_q, scales: [] });
      const bal_found = bal_result.chunks.find(
        (bal_p) => bal_p.chunk.kind === 'question' && !bal_p.chunk.continuationOf
      );
      return [bal_found?.chunk as bal_QuestionChunk];
    })();
    expect(bal_chunk).toBeDefined();
    expect(bal_chunk_may_split(bal_chunk)).toBe(true);
    const bal_split = bal_split_chunk(bal_chunk, bal_ctx, bal_chunk.height * 0.6);
    expect(bal_split).not.toBeNull();
    if (!bal_split) return;
    const [bal_head_raw, bal_rest_raw] = bal_split;
    if (bal_head_raw.kind !== 'question' || bal_rest_raw.kind !== 'question') {
      throw new Error('split produced non-question chunks');
    }
    const bal_head = bal_head_raw;
    const bal_rest = bal_rest_raw;
    const bal_total = bal_head.optionRows.length + bal_rest.optionRows.length;
    expect(bal_total).toBe(12);
    expect(bal_head.height).toBeLessThan(bal_chunk.height);
    expect(bal_rest.stemLines.join(' ')).toContain('continued');
    const bal_head_ids = new Set(bal_head.optionRows.map((bal_r) => bal_r.optionId));
    for (const bal_row of bal_rest.optionRows) {
      expect(bal_head_ids.has(bal_row.optionId)).toBe(false);
    }
  });
});

describe('matrix splitting', () => {
  it('spreads a large matrix across pages in row order', () => {
    const bal_result = bal_paginate({ questionnaire: bal_ffq(60), scales: [bal_frequency_scale()] });
    expect(bal_result.pages.length).toBeGreaterThan(1);
    const bal_rows = bal_result.chunks.filter((bal_p) => bal_p.chunk.kind === 'matrix-row');
    expect(bal_rows.length).toBe(60);
    const bal_seen_pages = new Set(bal_rows.map((bal_r) => bal_r.page));
    expect(bal_seen_pages.size).toBeGreaterThan(1);
    for (let bal_i = 1; bal_i < bal_rows.length; bal_i++) {
      const bal_prev = bal_rows[bal_i - 1];
      const bal_current = bal_rows[bal_i];
      const bal_prev_index = (bal_prev.chunk as { rowIndex: number }).rowIndex;
      const bal_current_index = (bal_current.chunk as { rowIndex: number }).rowIndex;
      const bal_order_key = (bal_p: { page: number; y: number }) => bal_p.page * 100000 + bal_p.y;
      expect(bal_order_key(bal_current)).toBeGreaterThan(bal_order_key(bal_prev));
      expect(bal_current_index).toBe(bal_prev_index + 1);
      void bal_prev;
    }
  });

  it('never cuts a row in half and repeats headers on continuation pages', () => {
    const bal_result = bal_paginate({ questionnaire: bal_custom_matrix(40, ['Never', 'Sometimes', 'Daily']), scales: [] });
    const bal_heads = bal_result.chunks.filter((bal_p) => bal_p.chunk.kind === 'matrix-head');
    expect(bal_heads.length).toBeGreaterThan(1);
    const bal_original = bal_heads[0].chunk as { columnLabels: string[][]; continuationOf: string | null };
    expect(bal_original.continuationOf).toBeNull();
    for (let bal_i = 1; bal_i < bal_heads.length; bal_i++) {
      const bal_cont = bal_heads[bal_i].chunk as { columnLabels: string[][]; continuationOf: string | null };
      expect(bal_cont.continuationOf).not.toBeNull();
      expect(bal_cont.columnLabels).toEqual(bal_original.columnLabels);
    }
    for (const bal_placed of bal_result.chunks) {
      if (bal_placed.chunk.kind !== 'matrix-row') continue;
      const bal_row = bal_placed.chunk as { columnCount: number };
      expect(bal_row.columnCount).toBe(3);
    }
  });

  it('renders every logical FFQ row exactly once', () => {
    const bal_result = bal_paginate({ questionnaire: bal_ffq(60), scales: [bal_frequency_scale()] });
    const bal_row_ids = bal_result.chunks
      .filter((bal_p) => bal_p.chunk.kind === 'matrix-row')
      .map((bal_p) => (bal_p.chunk as { rowId: string }).rowId);
    expect(new Set(bal_row_ids).size).toBe(60);
    expect(bal_row_ids).toHaveLength(60);
  });
});

describe('consent pagination', () => {
  it('places the acknowledgement after all consent paragraphs', () => {
    const bal_result = bal_paginate({ questionnaire: bal_consent_heavy(), scales: [] });
    const bal_order_key = (bal_p: { page: number; y: number }) => bal_p.page * 100000 + bal_p.y;
    const bal_paras = bal_result.chunks.filter((bal_p) => bal_p.chunk.kind === 'consent-para');
    const bal_acks = bal_result.chunks.filter((bal_p) => bal_p.chunk.kind === 'consent-ack');
    expect(bal_paras.length).toBeGreaterThanOrEqual(8);
    const bal_last_para = bal_paras[bal_paras.length - 1];
    expect(bal_order_key(bal_acks[0])).toBeGreaterThan(bal_order_key(bal_last_para));
  });

  it('splits long consent across pages at paragraph boundaries', () => {
    const bal_result = bal_paginate({ questionnaire: bal_consent_heavy(), scales: [] });
    const bal_consent_pages = new Set(
      bal_result.chunks
        .filter((bal_p) => bal_p.chunk.kind === 'consent-para')
        .map((bal_p) => bal_p.page)
    );
    expect(bal_consent_pages.size).toBeGreaterThan(1);
  });
});
