import { describe, expect, it } from 'vitest';
import {
  dhon_banaitesi_item,
  dhon_banaitesi_questionnaire,
  dhon_banaitesi_section,
  dhon_banaitesi_scale
} from '../../models/factories';
import type { QuestionnaireItem, QuestionnaireRecord, ResponseScaleRecord } from '../../models/types';
import {
  bal_build_chunks,
  type bal_QuestionChunk,
  type bal_ScaleTableHeadChunk,
  type bal_ScaleTableRowChunk,
  type bal_PrintContext
} from './print_blocks';
import { bal_paginate } from './print_paginate';
import { bal_build_print_document } from './print_layout';
import { bal_default_print_settings } from './print_settings';
import { derive_numbering } from '../../models/numbering';

function bal_likert_scale(): ResponseScaleRecord {
  const bal_scale = dhon_banaitesi_scale('agree5');
  bal_scale.id = 'scale-agree5';
  bal_scale.options = [
    { id: 'opt-agree-1', label: 'Strongly disagree', coding: '1' },
    { id: 'opt-agree-2', label: 'Disagree', coding: '2' },
    { id: 'opt-agree-3', label: 'Neutral', coding: '3' },
    { id: 'opt-agree-4', label: 'Agree', coding: '4' },
    { id: 'opt-agree-5', label: 'Strongly agree', coding: '5' }
  ];
  return bal_scale;
}

function bal_frequency_scale(): ResponseScaleRecord {
  const bal_scale = dhon_banaitesi_scale('frequency5');
  bal_scale.id = 'scale-frequency5';
  bal_scale.options = [
    { id: 'opt-freq-1', label: 'Never', coding: '0' },
    { id: 'opt-freq-2', label: 'Sometimes', coding: '1' },
    { id: 'opt-freq-3', label: 'Often', coding: '2' },
    { id: 'opt-freq-4', label: 'Always', coding: '3' }
  ];
  return bal_scale;
}

function bal_likert_item(bal_index: number, bal_scale_id: string): QuestionnaireItem {
  const bal_item = dhon_banaitesi_item('likert_scale', `att${bal_index}`);
  bal_item.label = `Statement number ${bal_index} about food waste attitudes`;
  bal_item.scaleId = bal_scale_id;
  return bal_item;
}

function bal_context(bal_q: QuestionnaireRecord, bal_scales: ResponseScaleRecord[]): bal_PrintContext {
  return {
    settings: bal_default_print_settings(),
    contentWidth: 178,
    numbering: derive_numbering(bal_q),
    scales: bal_scales
  };
}

describe('shared-scale table grouping', () => {
  it('groups adjacent same-scale likert items into one table', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p-t', title: 'Scale tables' });
    const bal_section = dhon_banaitesi_section('Attitudes');
    bal_section.items = [1, 2, 3, 4, 5].map((bal_i) => bal_likert_item(bal_i, 'scale-agree5'));
    bal_q.sections = [bal_section];
    const bal_chunks = bal_build_chunks(bal_q, bal_context(bal_q, [bal_likert_scale()]));
    const bal_table_rows = bal_chunks.filter(
      (bal_c) => bal_c.kind === 'scale-table-row'
    ) as bal_ScaleTableRowChunk[];
    const bal_table_heads = bal_chunks.filter(
      (bal_c) => bal_c.kind === 'scale-table-head'
    ) as bal_ScaleTableHeadChunk[];
    expect(bal_table_rows).toHaveLength(5);
    expect(bal_table_heads).toHaveLength(1);
    expect(bal_table_heads[0].columnLabels.map((bal_c) => bal_c.join(' '))).toEqual([
      'Strongly disagree',
      'Disagree',
      'Neutral',
      'Agree',
      'Strongly agree'
    ]);
    expect(bal_table_rows.map((bal_r) => bal_r.variableName)).toEqual([
      'att1',
      'att2',
      'att3',
      'att4',
      'att5'
    ]);
    expect(bal_table_rows[0].optionIds).toEqual([
      'opt-agree-1',
      'opt-agree-2',
      'opt-agree-3',
      'opt-agree-4',
      'opt-agree-5'
    ]);
  });

  it('does not group items with different resolved options', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p-t', title: 'Mixed scales' });
    const bal_section = dhon_banaitesi_section('Attitudes');
    const bal_single = dhon_banaitesi_item('single_choice', 'color');
    bal_single.label = 'Favorite color';
    bal_single.options = [
      { id: 'opt-red', label: 'Red', coding: '1' },
      { id: 'opt-blue', label: 'Blue', coding: '2' }
    ];
    bal_section.items = [bal_likert_item(1, 'scale-agree5'), bal_single];
    bal_q.sections = [bal_section];
    const bal_chunks = bal_build_chunks(
      bal_q,
      bal_context(bal_q, [bal_likert_scale(), bal_frequency_scale()])
    );
    expect(bal_chunks.filter((bal_c) => bal_c.kind === 'scale-table-head')).toHaveLength(0);
    expect(bal_chunks.filter((bal_c) => bal_c.kind === 'question')).toHaveLength(2);
  });

  it('does not group across sections or an instruction item between', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p-t', title: 'Boundaries' });
    const bal_a = dhon_banaitesi_section('Attitudes A');
    bal_a.items = [1, 2].map((bal_i) => bal_likert_item(bal_i, 'scale-agree5'));
    const bal_b = dhon_banaitesi_section('Attitudes B');
    const bal_instruction = dhon_banaitesi_item('instruction', null);
    bal_instruction.label = 'Now think about the last seven days.';
    const bal_split = dhon_banaitesi_item('likert_scale', 'att3');
    bal_split.label = 'Split run item';
    bal_split.scaleId = 'scale-agree5';
    bal_b.items = [bal_instruction, bal_split];
    bal_q.sections = [bal_a, bal_b];
    const bal_chunks = bal_build_chunks(bal_q, bal_context(bal_q, [bal_likert_scale()]));
    const bal_heads = bal_chunks.filter((bal_c) => bal_c.kind === 'scale-table-head');
    expect(bal_heads).toHaveLength(1);
    const bal_rows = bal_chunks.filter((bal_c) => bal_c.kind === 'scale-table-row');
    expect(bal_rows).toHaveLength(2);
    expect(bal_rows.every((bal_r) => bal_r.sectionId === bal_a.id)).toBe(true);
  });

  it('does not group when the next item forces a page break', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p-t', title: 'Breaks' });
    const bal_section = dhon_banaitesi_section('Attitudes');
    const bal_first = bal_likert_item(1, 'scale-agree5');
    const bal_second = bal_likert_item(2, 'scale-agree5');
    bal_second.printConfig = { pageBreakBefore: true };
    bal_section.items = [bal_first, bal_second];
    bal_q.sections = [bal_section];
    const bal_chunks = bal_build_chunks(bal_q, bal_context(bal_q, [bal_likert_scale()]));
    expect(bal_chunks.filter((bal_c) => bal_c.kind === 'scale-table-head')).toHaveLength(0);
    expect(bal_chunks.filter((bal_c) => bal_c.kind === 'question')).toHaveLength(2);
    expect(bal_chunks.some((bal_c) => bal_c.forcedBreakBefore)).toBe(true);
  });

  it('groups a run of yes_no items and renders an isolated yes_no inline', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p-t', title: 'Yes no runs' });
    const bal_section = dhon_banaitesi_section('Knowledge');
    const bal_yes1 = dhon_banaitesi_item('yes_no', 'k1');
    bal_yes1.label = 'Do you plan meals?';
    const bal_yes2 = dhon_banaitesi_item('yes_no', 'k2');
    bal_yes2.label = 'Do you check dates?';
    const bal_yes3 = dhon_banaitesi_item('yes_no', 'k3');
    bal_yes3.label = 'A third standalone item with a fairly long label that wraps';
    bal_yes3.options = [
      { id: 'opt-k3-ha', label: 'Ha', coding: '1' },
      { id: 'opt-k3-na', label: 'Na', coding: '0' }
    ];
    bal_section.items = [bal_yes1, bal_yes2, bal_yes3];
    bal_q.sections = [bal_section];
    const bal_chunks = bal_build_chunks(bal_q, bal_context(bal_q, []));
    const bal_heads = bal_chunks.filter(
      (bal_c) => bal_c.kind === 'scale-table-head'
    ) as bal_ScaleTableHeadChunk[];
    expect(bal_heads).toHaveLength(1);
    expect(bal_heads[0].columnLabels.map((bal_c) => bal_c.join(' '))).toEqual(['Yes', 'No']);
    const bal_rows = bal_chunks.filter(
      (bal_c) => bal_c.kind === 'scale-table-row'
    ) as bal_ScaleTableRowChunk[];
    expect(bal_rows).toHaveLength(2);
    const bal_standalone = bal_chunks.find(
      (bal_c) => bal_c.kind === 'question'
    ) as bal_QuestionChunk;
    expect(bal_standalone.itemId).toBe(bal_yes3.id);
    expect(bal_standalone.inlineOptions).toBe(true);
    expect(bal_standalone.optionRows).toHaveLength(2);
    expect(bal_standalone.optionRows[0].rowTop).toBe(bal_standalone.optionRows[1].rowTop);
    expect(
      bal_standalone.optionRows.every((bal_r) => bal_r.markerX > bal_ctx_stem_end(bal_standalone))
    ).toBe(true);
  });

  it('keeps multiple_choice items out of scale tables', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p-t', title: 'Multiple' });
    const bal_section = dhon_banaitesi_section('Habits');
    const bal_multi = dhon_banaitesi_item('multiple_choice', 'habits');
    bal_multi.label = 'Which do you reuse?';
    bal_multi.options = [
      { id: 'opt-bag', label: 'Bags', coding: '1' },
      { id: 'opt-jar', label: 'Jars', coding: '2' },
      { id: 'opt-box', label: 'Boxes', coding: '3' }
    ];
    bal_multi.selectionMode = 'multiple';
    bal_section.items = [bal_multi, bal_likert_item(1, 'scale-agree5'), bal_likert_item(2, 'scale-agree5')];
    bal_q.sections = [bal_section];
    const bal_chunks = bal_build_chunks(bal_q, bal_context(bal_q, [bal_likert_scale()]));
    expect(bal_chunks.filter((bal_c) => bal_c.kind === 'scale-table-head')).toHaveLength(1);
    expect(bal_chunks.filter((bal_c) => bal_c.kind === 'scale-table-row')).toHaveLength(2);
    const bal_multi_chunk = bal_chunks.find((bal_c) => bal_c.kind === 'question') as bal_QuestionChunk;
    expect(bal_multi_chunk.itemId).toBe(bal_multi.id);
    expect(bal_multi_chunk.inlineOptions).toBe(false);
  });

  it('splits long tables across pages with a repeated header and intact rows', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p-t', title: 'Long run' });
    const bal_section = dhon_banaitesi_section('Attitudes');
    bal_section.items = Array.from({ length: 40 }, (bal_null, bal_i) => {
      void bal_null;
      return bal_likert_item(bal_i + 1, 'scale-agree5');
    });
    bal_q.sections = [bal_section];
    const bal_result = bal_paginate({ questionnaire: bal_q, scales: [bal_likert_scale()] });
    expect(bal_result.pages.length).toBeGreaterThan(1);
    const bal_page_heads = bal_result.pages.map((bal_p) =>
      bal_p.chunks.filter((bal_c) => bal_c.chunk.kind === 'scale-table-head').length
    );
    expect(bal_page_heads.filter((bal_n) => bal_n > 0).length).toBe(bal_result.pages.length);
    for (const bal_page of bal_result.pages) {
      for (const bal_placed of bal_page.chunks) {
        if (bal_placed.chunk.kind === 'scale-table-row') {
          expect(bal_placed.chunk.height).toBeLessThanOrEqual(bal_page.regions.content.height);
        }
      }
    }
  });

  it('produces choice answer regions per member item and column', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p-t', title: 'Regions' });
    const bal_section = dhon_banaitesi_section('Attitudes');
    bal_section.items = [1, 2, 3].map((bal_i) => bal_likert_item(bal_i, 'scale-agree5'));
    bal_q.sections = [bal_section];
    const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: [bal_likert_scale()] });
    const bal_regions = bal_doc.pages.flatMap((bal_p) => bal_p.geometry.answerRegions);
    const bal_table_regions = bal_regions.filter((bal_r) => bal_r.kind === 'choice');
    expect(bal_table_regions).toHaveLength(15);
    const bal_by_item = new Map<string, number>();
    for (const bal_region of bal_table_regions) bal_by_item.set(bal_region.itemId, (bal_by_item.get(bal_region.itemId) ?? 0) + 1);
    expect([...bal_by_item.values()]).toEqual([5, 5, 5]);
    const bal_first = bal_table_regions[0];
    expect(bal_first.optionCode).toBe('1');
    expect(bal_first.markerType).toBe('bubble');
    expect(bal_first.selection).toBe('single');
    expect(bal_first.rowId).toBeNull();
  });

  it('leaves the questionnaire schema untouched after grouping', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p-t', title: 'Pure presentation' });
    const bal_section = dhon_banaitesi_section('Attitudes');
    bal_section.items = [1, 2].map((bal_i) => bal_likert_item(bal_i, 'scale-agree5'));
    bal_q.sections = [bal_section];
    const bal_scales = [bal_likert_scale()];
    bal_build_chunks(bal_q, bal_context(bal_q, bal_scales));
    expect(bal_q.sections[0].items).toHaveLength(2);
    expect(bal_q.sections[0].items.every((bal_i) => bal_i.type === 'likert_scale')).toBe(true);
    expect(bal_q.sections[0].items.every((bal_i) => bal_i.scaleId === 'scale-agree5')).toBe(true);
  });

  it('keeps row regions within their column cells and marks separated', () => {
    const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p-t', title: 'Separation' });
    const bal_section = dhon_banaitesi_section('Attitudes');
    bal_section.items = [1, 2, 3].map((bal_i) => bal_likert_item(bal_i, 'scale-agree5'));
    bal_q.sections = [bal_section];
    const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: [bal_likert_scale()] });
    const bal_regions = bal_doc.pages[0].geometry.answerRegions.filter((bal_r) => bal_r.kind === 'choice');
    const bal_by_item = new Map<string, number[]>();
    for (const bal_region of bal_regions) {
      const bal_list = bal_by_item.get(bal_region.itemId) ?? [];
      bal_list.push(bal_region.rect.x + bal_region.rect.width / 2);
      bal_by_item.set(bal_region.itemId, bal_list);
    }
    for (const bal_centers of bal_by_item.values()) {
      bal_centers.sort((bal_a, bal_b) => bal_a - bal_b);
      for (let bal_i = 1; bal_i < bal_centers.length; bal_i++) {
        expect(bal_centers[bal_i] - bal_centers[bal_i - 1]).toBeGreaterThanOrEqual(5);
      }
    }
  });
});

function bal_ctx_stem_end(bal_chunk: bal_QuestionChunk): number {
  return bal_chunk.stemIndent;
}
