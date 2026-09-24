import type { QuestionnaireRecord, ResponseScaleRecord } from '../../models/types';
import { derive_numbering } from '../../models/numbering';
import { bal_line_height, bal_wrap_text } from './print_fonts';
import { bal_band_heights, bal_normalize_print_settings } from './print_settings';
import {
  bal_page_regions,
  bal_paper_dimensions,
  type PageRegions,
  type PrintMargins
} from './print_paper';
import {
  bal_build_chunks,
  bal_chunk_may_split,
  bal_split_chunk,
  type bal_MatrixHeadChunk,
  type bal_PrintChunk,
  type bal_PrintContext
} from './print_blocks';

export interface bal_PlacedChunk {
  chunk: bal_PrintChunk;
  page: number;
  y: number;
}

export interface bal_PrintPage {
  pageNumber: number;
  regions: PageRegions;
  chunks: bal_PlacedChunk[];
}

export interface bal_LayoutResult {
  pages: bal_PrintPage[];
  chunks: bal_PlacedChunk[];
}

export interface bal_LayoutInput {
  questionnaire: QuestionnaireRecord;
  scales: ResponseScaleRecord[];
  margins?: PrintMargins;
}

interface bal_ActiveMatrix {
  head: bal_MatrixHeadChunk;
  headPage: number;
}

export function bal_paginate(bal_input: bal_LayoutInput): bal_LayoutResult {
  const bal_settings = bal_normalize_print_settings(bal_input.questionnaire.printSettings);
  const bal_dims = bal_paper_dimensions(
    bal_input.questionnaire.paperSize,
    bal_input.questionnaire.orientation
  );
  const bal_bands = bal_band_heights(bal_settings);
  const bal_regions = bal_page_regions(
    bal_dims.width,
    bal_dims.height,
    bal_input.margins ?? bal_settings.margins,
    bal_bands.header,
    bal_bands.footer
  );
  const bal_ctx: bal_PrintContext = {
    settings: bal_settings,
    contentWidth: bal_regions.content.width,
    numbering: derive_numbering(bal_input.questionnaire),
    scales: bal_input.scales
  };
  const bal_bottom = bal_regions.content.y + bal_regions.content.height;

  const bal_make_continuation = (bal_head: bal_MatrixHeadChunk): bal_MatrixHeadChunk => {
    const bal_lh = bal_line_height(bal_ctx.settings.theme.baseFontSize);
    const bal_title = bal_head.stemLines
      .join(' ')
      .replace(/\s*\*\s*$/, '')
      .replace(/\.\s*$/, '');
    const bal_lines = bal_wrap_text(
      `${bal_title}, continued`,
      { family: bal_ctx.settings.theme.fontFamily, bold: true },
      bal_ctx.settings.theme.baseFontSize,
      bal_ctx.contentWidth - 9
    );
    return {
      ...bal_head,
      height: bal_lines.length * bal_lh + 1 + bal_head.headerHeight,
      keepWithNext: true,
      stemLines: bal_lines,
      continuationOf: bal_title
    };
  };

  const bal_pages: bal_PrintPage[] = [];
  const bal_placed: bal_PlacedChunk[] = [];
  const bal_queue: bal_PrintChunk[] = [...bal_build_chunks(bal_input.questionnaire, bal_ctx)];
  let bal_page_number = 1;
  let bal_y = bal_regions.content.y;
  let bal_active_matrix: bal_ActiveMatrix | null = null;

  const bal_page = (bal_n: number): bal_PrintPage => {
    let bal_found = bal_pages.find((bal_p) => bal_p.pageNumber === bal_n);
    if (!bal_found) {
      bal_found = { pageNumber: bal_n, regions: bal_regions, chunks: [] };
      bal_pages.push(bal_found);
    }
    return bal_found;
  };
  bal_page(1);

  const bal_new_page = (): bal_PrintChunk | null => {
    bal_page_number += 1;
    bal_page(bal_page_number);
    bal_y = bal_regions.content.y;
    if (bal_active_matrix && bal_active_matrix.headPage < bal_page_number) {
      const bal_injected = bal_make_continuation(bal_active_matrix.head);
      bal_queue.unshift(bal_injected);
      return bal_injected;
    }
    return null;
  };

  const bal_place = (bal_chunk: bal_PrintChunk): void => {
    bal_page(bal_page_number).chunks.push({ chunk: bal_chunk, page: bal_page_number, y: bal_y });
    bal_placed.push({ chunk: bal_chunk, page: bal_page_number, y: bal_y });
    bal_y += bal_chunk.height;
  };

  while (bal_queue.length > 0) {
    const bal_chunk = bal_queue.shift() as bal_PrintChunk;

    if (bal_chunk.kind === 'matrix-head') {
      bal_active_matrix = { head: bal_chunk, headPage: bal_page_number };
    } else if (bal_chunk.kind !== 'matrix-row') {
      bal_active_matrix = null;
    }

    if (bal_chunk.forcedBreakBefore && bal_y > bal_regions.content.y) {
      const bal_injected = bal_new_page();
      if (bal_injected) {
        bal_queue.splice(1, 0, bal_chunk);
        continue;
      }
    }

    if (bal_chunk.keepWithNext) {
      const bal_next_height = bal_queue.length > 0 ? bal_queue[0].height : 0;
      if (bal_y + bal_chunk.height + bal_next_height > bal_bottom && bal_y > bal_regions.content.y) {
        const bal_injected = bal_new_page();
        if (bal_injected) {
          bal_queue.splice(1, 0, bal_chunk);
          continue;
        }
      }
    }

    if (bal_y + bal_chunk.height <= bal_bottom) {
      bal_place(bal_chunk);
      continue;
    }

    if (bal_chunk_may_split(bal_chunk)) {
      const bal_available = bal_bottom - bal_y;
      const bal_split = bal_split_chunk(bal_chunk, bal_ctx, bal_available);
      if (bal_split) {
        const [bal_head, bal_rest] = bal_split;
        if (bal_head.height <= bal_available && bal_head.height > 0) {
          bal_place(bal_head);
          const bal_injected = bal_new_page();
          if (bal_injected) {
            bal_queue.splice(1, 0, bal_rest);
            continue;
          }
          bal_place(bal_rest);
          continue;
        }
      }
    }

    const bal_injected = bal_new_page();
    if (bal_injected) {
      bal_queue.splice(1, 0, bal_chunk);
      continue;
    }
    bal_place(bal_chunk);
  }

  return { pages: bal_pages, chunks: bal_placed };
}
