import type {
  ItemTypeName,
  QuestionnaireItem,
  QuestionnaireRecord,
  ResponseScaleRecord
} from '../../models/types';
import { item_descriptor } from '../../models/item_catalog';
import { dhon_matrix_columns, dhon_resolve_options } from '../../models/scale_options';
import type { DerivedNumbering } from '../../models/numbering';
import type { PrintSettings } from '../../models/types';
import { bal_line_height, bal_measure_text, bal_wrap_text, type PrintFontStyle } from './print_fonts';
import { bal_row_spacing } from './print_settings';
import type { PhysicalRect } from './print_paper';

export type bal_PrintChunk =
  | bal_SectionHeadChunk
  | bal_InstructionChunk
  | bal_QuestionChunk
  | bal_MatrixHeadChunk
  | bal_MatrixRowChunk
  | bal_ConsentParaChunk
  | bal_ConsentAckChunk
  | bal_SignatureChunk;

export interface bal_ChunkBase {
  kind: string;
  itemType: ItemTypeName;
  itemId: string | null;
  sectionId: string;
  height: number;
  keepWithNext: boolean;
  forcedBreakBefore: boolean;
}

export interface bal_SectionHeadChunk extends bal_ChunkBase {
  kind: 'section-head';
  sectionIndex: number;
  title: string;
  descriptionLines: string[];
}

export interface bal_InstructionChunk extends bal_ChunkBase {
  kind: 'instruction';
  heading: string | null;
  headingLines: string[];
  bodyLines: string[];
  callout: boolean;
}

export interface bal_OptionRowLayout {
  optionId: string;
  optionCode: string | null;
  labelLines: string[];
  markerCenterY: number;
  markerX: number;
  region: PhysicalRect;
  rowTop: number;
  rowHeight: number;
}

export interface bal_QuestionChunk extends bal_ChunkBase {
  kind: 'question';
  numberLabel: string;
  variableName: string | null;
  stemLines: string[];
  required: boolean;
  stemIndent: number;
  stemTop: number;
  optionRows: bal_OptionRowLayout[];
  tail: 'none' | 'line' | 'small-box' | 'wide-box' | 'date-box';
  tailTop: number;
  tailHeight: number;
  tailWidth: number;
  unitLabel: string | null;
  continuationOf: string | null;
}

export interface bal_MatrixHeadChunk extends bal_ChunkBase {
  kind: 'matrix-head';
  numberLabel: string;
  stemLines: string[];
  required: boolean;
  columnLabels: string[][];
  columnWidths: number[];
  headerHeight: number;
  labelColumnWidth: number;
  stemTop: number;
  stemIndent: number;
  continuationOf: string | null;
}

export interface bal_MatrixRowChunk extends bal_ChunkBase {
  kind: 'matrix-row';
  numberLabel: string;
  variableName: string | null;
  rowId: string;
  rowLabel: string;
  labelLines: string[];
  rowIndex: number;
  columnCount: number;
  labelColumnWidth: number;
  columnWidths: number[];
  rowTop: number;
  rowHeight: number;
}

export interface bal_ConsentParaChunk extends bal_ChunkBase {
  kind: 'consent-para';
  heading: string | null;
  headingLines: string[];
  bodyLines: string[];
  continuationOf: string | null;
}

export interface bal_ConsentAckChunk extends bal_ChunkBase {
  kind: 'consent-ack';
  labelLines: string[];
  markerX: number;
  markerCenterY: number;
  region: PhysicalRect;
}

export interface bal_SignatureChunk extends bal_ChunkBase {
  kind: 'signature';
  roleLabel: string;
  includePrintedName: boolean;
  includeDate: boolean;
  signerLabel: string;
}

export interface bal_PrintContext {
  settings: PrintSettings;
  contentWidth: number;
  numbering: DerivedNumbering;
  scales: ResponseScaleRecord[];
}

const BAL_STEM_INDENT = 9;
const BAL_OPTION_INDENT = 3;
const BAL_OPTION_TEXT_GAP = 3.2;
const BAL_LINE_GAP = 1.2;
const BAL_SMALL_BOX_WIDTH = 26;
const BAL_SMALL_BOX_HEIGHT = 7.5;
const BAL_WIDE_BOX_HEIGHT = 24;
const BAL_DATE_BOX_WIDTH = 24;
const BAL_LABEL_COLUMN_MM = 46;
const BAL_MIN_ROW_HEIGHT = 7.2;
const BAL_CONSENT_TICK = 4.2;

function bal_font(bal_settings: PrintSettings, bal_bold = false): PrintFontStyle {
  return {
    family: bal_settings.theme.fontFamily,
    bold: bal_bold,
  };
}

function bal_size(bal_settings: PrintSettings, bal_scale = 1): number {
  return bal_settings.theme.baseFontSize * bal_scale;
}

function bal_wrapped(
  bal_text: string,
  bal_settings: PrintSettings,
  bal_width: number,
  bal_bold = false,
  bal_scale = 1
): string[] {
  return bal_wrap_text(bal_text, bal_font(bal_settings, bal_bold), bal_size(bal_settings, bal_scale), bal_width);
}

function bal_required_suffix(bal_item: QuestionnaireItem): string {
  return bal_item.required ? ' *' : '';
}

function bal_marker_region(
  bal_center_x: number,
  bal_center_y: number,
  bal_settings: PrintSettings
): PhysicalRect {
  const bal_size_total = bal_settings.marker.diameterMm + bal_settings.marker.regionPaddingMm * 2;
  return {
    x: bal_center_x - bal_size_total / 2,
    y: bal_center_y - bal_size_total / 2,
    width: bal_size_total,
    height: bal_size_total
  };
}

function bal_measure_option_rows(
  bal_options: { id: string; label: string; coding: string | null }[],
  bal_ctx: bal_PrintContext,
  bal_top: number,
  bal_marker_x: number
): bal_OptionRowLayout[] {
  const bal_settings = bal_ctx.settings;
  const bal_lh = bal_line_height(bal_size(bal_settings));
  const bal_label_width =
    bal_ctx.contentWidth - BAL_STEM_INDENT - bal_marker_x + BAL_STEM_INDENT - BAL_OPTION_TEXT_GAP - 1;
  const bal_spacing = bal_row_spacing(bal_settings);
  const bal_marker_size = Math.max(
    bal_settings.marker.diameterMm + bal_settings.marker.regionPaddingMm * 2,
    bal_lh
  );
  const bal_rows: bal_OptionRowLayout[] = [];
  let bal_y = bal_top;
  for (const bal_option of bal_options) {
    const bal_lines = bal_wrapped(bal_option.label, bal_settings, bal_label_width);
    const bal_text_height = bal_lines.length * bal_lh + (bal_lines.length - 1) * BAL_LINE_GAP;
    const bal_row_height = Math.max(bal_text_height, bal_marker_size);
    const bal_center_y = bal_y + bal_row_height / 2;
    bal_rows.push({
      optionId: bal_option.id,
      optionCode: bal_option.coding,
      labelLines: bal_lines,
      markerCenterY: bal_center_y,
      markerX: bal_marker_x,
      region: bal_marker_region(bal_marker_x + bal_settings.marker.diameterMm / 2, bal_center_y, bal_settings),
      rowTop: bal_y,
      rowHeight: bal_row_height
    });
    bal_y += bal_row_height + bal_spacing * 0.55;
  }
  return bal_rows;
}

function bal_choice_marker_x(): number {
  return BAL_STEM_INDENT + BAL_OPTION_INDENT;
}

function bal_build_question_chunk(
  bal_item: QuestionnaireItem,
  bal_section_id: string,
  bal_ctx: bal_PrintContext,
  bal_continuation_of: string | null,
  bal_options_override?: { id: string; label: string; coding: string | null }[]
): bal_QuestionChunk {
  const bal_settings = bal_ctx.settings;
  const bal_lh = bal_line_height(bal_size(bal_settings));
  const bal_descriptor = item_descriptor(bal_item.type);
  const bal_number_label = bal_ctx.numbering.itemLabels[bal_item.id] ?? '';
  const bal_stem_text = `${bal_item.label}${bal_required_suffix(bal_item)}`;
  const bal_stem_indent = bal_measure_text(
    `${bal_number_label}.`,
    bal_font(bal_settings, true),
    bal_size(bal_settings)
  ) + 2.4;
  const bal_stem_lines = bal_wrapped(bal_stem_text, bal_settings, bal_ctx.contentWidth - bal_stem_indent);
  const bal_stem_height =
    bal_stem_lines.length * bal_lh + (bal_stem_lines.length - 1) * BAL_LINE_GAP * 0.5;

  let bal_y = bal_stem_height + 1.6;
  let bal_tail: bal_QuestionChunk['tail'] = 'none';
  let bal_tail_height = 0;
  let bal_tail_width = 0;
  let bal_option_rows: bal_OptionRowLayout[] = [];

  const bal_marker_x = bal_choice_marker_x();
  if (bal_descriptor.answerMarker === 'bubble' || bal_descriptor.answerMarker === 'checkbox') {
    const bal_options = bal_options_override ?? dhon_resolve_options(bal_item, bal_ctx.scales);
    bal_option_rows = bal_measure_option_rows(bal_options, bal_ctx, bal_y, bal_marker_x);
    bal_y = bal_option_rows.length > 0
      ? bal_option_rows[bal_option_rows.length - 1].rowTop + bal_option_rows[bal_option_rows.length - 1].rowHeight
      : bal_y;
  } else if (bal_item.type === 'short_text') {
    bal_tail = 'line';
    bal_tail_height = BAL_SMALL_BOX_HEIGHT;
    bal_tail_width = bal_ctx.contentWidth - BAL_STEM_INDENT;
  } else if (bal_item.type === 'number') {
    bal_tail = 'small-box';
    bal_tail_height = BAL_SMALL_BOX_HEIGHT;
    bal_tail_width = BAL_SMALL_BOX_WIDTH;
  } else if (bal_item.type === 'date') {
    bal_tail = 'date-box';
    bal_tail_height = BAL_SMALL_BOX_HEIGHT;
    bal_tail_width = BAL_DATE_BOX_WIDTH;
  } else if (bal_item.type === 'long_text') {
    bal_tail = 'wide-box';
    bal_tail_height = BAL_WIDE_BOX_HEIGHT;
    bal_tail_width = bal_ctx.contentWidth - BAL_STEM_INDENT;
  }

  if (bal_tail !== 'none') bal_y += 1.2 + bal_tail_height;

  return {
    kind: 'question',
    itemType: bal_item.type,
    itemId: bal_item.id,
    sectionId: bal_section_id,
    height: bal_y,
    keepWithNext: false,
    forcedBreakBefore: false,
    numberLabel: bal_number_label,
    variableName: bal_item.variableName,
    stemLines: bal_stem_lines,
    required: bal_item.required,
    stemIndent: bal_stem_indent,
    stemTop: 0,
    optionRows: bal_option_rows,
    tail: bal_tail,
    tailTop: bal_tail !== 'none' ? bal_y - bal_tail_height : 0,
    tailHeight: bal_tail_height,
    tailWidth: bal_tail_width,
    unitLabel: bal_item.unitLabel,
    continuationOf: bal_continuation_of
  };
}

function bal_split_question_options(
  bal_chunk: bal_QuestionChunk,
  bal_ctx: bal_PrintContext,
  bal_available_height: number
): [bal_QuestionChunk, bal_QuestionChunk] | null {
  if (bal_chunk.optionRows.length < 2) return null;
  const bal_keep = bal_chunk.optionRows.filter(
    (bal_row) => bal_row.rowTop + bal_row.rowHeight <= bal_available_height
  );
  if (bal_keep.length === 0 || bal_keep.length === bal_chunk.optionRows.length) return null;
  const bal_rest = bal_chunk.optionRows.slice(bal_keep.length);
  const bal_offset = bal_rest[0].rowTop;
  const bal_shifted = bal_rest.map((bal_row) => ({
    ...bal_row,
    rowTop: bal_row.rowTop - bal_offset,
    markerCenterY: bal_row.markerCenterY - bal_offset,
    region: {
      ...bal_row.region,
      y: bal_row.region.y - bal_offset
    }
  }));
  const bal_head: bal_QuestionChunk = {
    ...bal_chunk,
    height: bal_keep[bal_keep.length - 1].rowTop + bal_keep[bal_keep.length - 1].rowHeight,
    optionRows: bal_keep
  };
  const bal_tail_chunk: bal_QuestionChunk = {
    ...bal_chunk,
    height: bal_shifted[bal_shifted.length - 1].rowTop + bal_shifted[bal_shifted.length - 1].rowHeight + 1,
    stemLines: [`${bal_chunk.numberLabel}. ${bal_chunk.stemLines.join(' ').replace(/\s*\*\s*$/, '')}, continued`],
    optionRows: bal_shifted
  };
  void bal_ctx;
  return [bal_head, bal_tail_chunk];
}

export function bal_split_chunk(
  bal_chunk: bal_PrintChunk,
  bal_ctx: bal_PrintContext,
  bal_available_height: number
): [bal_PrintChunk, bal_PrintChunk] | null {
  if (bal_chunk.kind === 'question') {
    return bal_split_question_options(bal_chunk, bal_ctx, bal_available_height);
  }
  return null;
}

export function bal_chunk_may_split(bal_chunk: bal_PrintChunk): boolean {
  return bal_chunk.kind === 'question' && bal_chunk.optionRows.length >= 2;
}

function bal_build_matrix_chunks(
  bal_item: QuestionnaireItem,
  bal_section_id: string,
  bal_ctx: bal_PrintContext
): bal_PrintChunk[] {
  const bal_settings = bal_ctx.settings;
  const bal_lh = bal_line_height(bal_size(bal_settings));
  const bal_marker_size = bal_settings.marker.diameterMm + bal_settings.marker.regionPaddingMm * 2;
  const bal_number_label = bal_ctx.numbering.itemLabels[bal_item.id] ?? '';
  const bal_stem_text = `${bal_item.label}${bal_required_suffix(bal_item)}`;
  const bal_stem_lines = bal_wrapped(bal_stem_text, bal_settings, bal_ctx.contentWidth - 9);
  const bal_stem_height = bal_stem_lines.length * bal_lh + 1.4;
  const bal_label_col = Math.min(BAL_LABEL_COLUMN_MM, bal_ctx.contentWidth * 0.4);
  const bal_columns = dhon_matrix_columns(bal_item, bal_ctx.scales);
  const bal_cols_width = Math.max(10, bal_ctx.contentWidth - bal_label_col);
  const bal_col_width = bal_columns.length > 0 ? bal_cols_width / bal_columns.length : bal_cols_width;
  const bal_header_cells = bal_columns.map((bal_col) =>
    bal_wrapped(bal_col.label, bal_settings, bal_col_width - 2, true)
  );
  const bal_header_lines = Math.max(1, ...bal_header_cells.map((bal_cell) => bal_cell.length));
  const bal_header_height = bal_header_lines * bal_lh + 2;
  const bal_stem_indent = bal_measure_text(
    `${bal_number_label}.`,
    bal_font(bal_settings, true),
    bal_size(bal_settings)
  ) + 2.4;

  const bal_head: bal_MatrixHeadChunk = {
    kind: 'matrix-head',
    itemType: 'matrix',
    itemId: bal_item.id,
    sectionId: bal_section_id,
    height: bal_stem_height + bal_header_height,
    keepWithNext: true,
    forcedBreakBefore: false,
    numberLabel: bal_number_label,
    stemLines: bal_stem_lines,
    required: bal_item.required,
    columnLabels: bal_header_cells,
    columnWidths: bal_columns.map(() => bal_col_width),
    headerHeight: bal_header_height,
    labelColumnWidth: bal_label_col,
    stemTop: 0,
    stemIndent: bal_stem_indent,
    continuationOf: null
  };

  const bal_rows: bal_PrintChunk[] = bal_item.rows.map((bal_row, bal_index) => {
    const bal_lines = bal_wrapped(bal_row.label, bal_settings, bal_label_col - 3);
    const bal_text_height = bal_lines.length * bal_lh;
    const bal_row_height = Math.max(bal_text_height + 1.6, bal_marker_size + 1.6, BAL_MIN_ROW_HEIGHT);
    return {
      kind: 'matrix-row',
      itemType: 'matrix',
      itemId: bal_item.id,
      sectionId: bal_section_id,
      height: bal_row_height,
      keepWithNext: false,
      forcedBreakBefore: false,
      numberLabel: bal_number_label,
      variableName: bal_item.variableName,
      rowId: bal_row.id,
      rowLabel: bal_row.label,
      labelLines: bal_lines,
      rowIndex: bal_index,
      columnCount: bal_columns.length,
      labelColumnWidth: bal_label_col,
      columnWidths: bal_columns.map(() => bal_col_width),
      rowTop: 0,
      rowHeight: bal_row_height
    } satisfies bal_MatrixRowChunk;
  });

  return [bal_head, ...bal_rows];
}

function bal_build_consent_chunks(
  bal_item: QuestionnaireItem,
  bal_section_id: string,
  bal_ctx: bal_PrintContext
): bal_PrintChunk[] {
  const bal_settings = bal_ctx.settings;
  const bal_lh = bal_line_height(bal_size(bal_settings));
  const bal_heading_size = bal_size(bal_settings, bal_settings.theme.headingScale);
  const bal_heading_lh = bal_line_height(bal_heading_size);
  const bal_consent = bal_item.consent;
  const bal_chunks: bal_PrintChunk[] = [];
  if (!bal_consent) return bal_chunks;

  const bal_title_lines = bal_wrapped(
    bal_consent.title || bal_item.label,
    bal_settings,
    bal_ctx.contentWidth,
    true,
    bal_settings.theme.headingScale
  );
  const bal_title_height = bal_title_lines.length * bal_heading_lh + 1.8;
  bal_chunks.push({
    kind: 'consent-para',
    itemType: 'consent',
    itemId: bal_item.id,
    sectionId: bal_section_id,
    height: bal_title_height,
    keepWithNext: true,
    forcedBreakBefore: false,
    heading: null,
    headingLines: bal_title_lines,
    bodyLines: [],
    continuationOf: null
  });

  const bal_intro_lines = bal_consent.introduction.trim()
    ? bal_wrapped(bal_consent.introduction, bal_settings, bal_ctx.contentWidth)
    : [];
  if (bal_intro_lines.length > 0) {
    bal_chunks.push({
      kind: 'consent-para',
      itemType: 'consent',
      itemId: bal_item.id,
      sectionId: bal_section_id,
      height: bal_intro_lines.length * bal_lh + 2.2,
      keepWithNext: false,
      forcedBreakBefore: false,
      heading: null,
      headingLines: [],
      bodyLines: bal_intro_lines,
      continuationOf: null
    });
  }

  for (const bal_section of bal_consent.sections) {
    const bal_head_lines = bal_section.title.trim()
      ? bal_wrapped(bal_section.title, bal_settings, bal_ctx.contentWidth, true)
      : [];
    const bal_body_lines = bal_section.body.trim()
      ? bal_wrapped(bal_section.body, bal_settings, bal_ctx.contentWidth)
      : [];
    const bal_height =
      (bal_head_lines.length > 0 ? bal_head_lines.length * bal_lh + 0.8 : 0) +
      bal_body_lines.length * bal_lh + 2.2;
    bal_chunks.push({
      kind: 'consent-para',
      itemType: 'consent',
      itemId: bal_item.id,
      sectionId: bal_section_id,
      height: bal_height,
      keepWithNext: false,
      forcedBreakBefore: false,
      heading: bal_section.title.trim() || null,
      headingLines: bal_head_lines,
      bodyLines: bal_body_lines,
      continuationOf: null
    });
  }

  const bal_ack_lines = bal_wrapped(
    bal_consent.acknowledgementLabel || 'I agree to participate.',
    bal_settings,
    bal_ctx.contentWidth - 12
  );
  const bal_marker_size = Math.max(
    bal_settings.marker.diameterMm + bal_settings.marker.regionPaddingMm * 2,
    BAL_CONSENT_TICK
  );
  const bal_ack_height = Math.max(
    bal_ack_lines.length * bal_lh + 2,
    bal_marker_size + 2.4
  );
  bal_chunks.push({
    kind: 'consent-ack',
    itemType: 'consent',
    itemId: bal_item.id,
    sectionId: bal_section_id,
    height: bal_ack_height,
    keepWithNext: false,
    forcedBreakBefore: false,
    labelLines: bal_ack_lines,
    markerX: 2,
    markerCenterY: bal_ack_height / 2,
    region: bal_marker_region(
      2 + bal_settings.marker.diameterMm / 2,
      bal_ack_height / 2,
      bal_settings
    )
  });
  return bal_chunks;
}

function bal_build_signature_chunk(
  bal_item: QuestionnaireItem,
  bal_section_id: string,
  bal_ctx: bal_PrintContext
): bal_SignatureChunk {
  const bal_settings = bal_ctx.settings;
  const bal_lh = bal_line_height(bal_size(bal_settings));
  const bal_signature = bal_item.signature;
  const bal_role = bal_signature?.signerRole
    ? bal_signature.signerRole
    : item_descriptor(bal_item.type).label;
  const bal_role_lines = bal_wrapped(bal_role, bal_settings, bal_ctx.contentWidth, true);
  const bal_lines = bal_role_lines.length * bal_lh + 13.5;
  const bal_printed = bal_signature?.includePrintedName ? bal_lh + 2.4 : 0;
  const bal_date = bal_signature?.includeDate ? bal_lh + 2.4 : 0;
  return {
    kind: 'signature',
    itemType: bal_item.type,
    itemId: bal_item.id,
    sectionId: bal_section_id,
    height: bal_lines + bal_printed + bal_date + 1,
    keepWithNext: false,
    forcedBreakBefore: false,
    roleLabel: bal_role,
    includePrintedName: bal_signature?.includePrintedName ?? true,
    includeDate: bal_signature?.includeDate ?? true,
    signerLabel: item_descriptor(bal_item.type).label
  };
}

export function bal_build_chunks(
  bal_q: QuestionnaireRecord,
  bal_ctx: bal_PrintContext
): bal_PrintChunk[] {
  const bal_chunks: bal_PrintChunk[] = [];
  bal_q.sections.forEach((bal_section, bal_section_index) => {
    const bal_settings = bal_ctx.settings;
    const bal_heading_size = bal_size(bal_settings, bal_settings.theme.headingScale);
    const bal_heading_lh = bal_line_height(bal_heading_size);
    const bal_title_lines = bal_wrapped(
      bal_section.title || bal_ctx.numbering.sectionLabels[bal_section.id] || `Section ${bal_section_index + 1}`,
      bal_settings,
      bal_ctx.contentWidth,
      true,
      bal_settings.theme.headingScale
    );
    const bal_desc_lines = bal_section.description?.trim()
      ? bal_wrapped(bal_section.description, bal_settings, bal_ctx.contentWidth)
      : [];
    bal_chunks.push({
      kind: 'section-head',
      itemType: 'section',
      itemId: bal_section.id,
      sectionId: bal_section.id,
      height: bal_title_lines.length * bal_heading_lh + bal_desc_lines.length * bal_line_height(bal_size(bal_settings)) + 2.6,
      keepWithNext: true,
      forcedBreakBefore: bal_section.printConfig?.pageBreakBefore ?? false,
      sectionIndex: bal_section_index + 1,
      title: bal_section.title,
      descriptionLines: bal_desc_lines
    });

    for (const bal_item of bal_section.items) {
      if (bal_item.type === 'instruction') {
        const bal_lh = bal_line_height(bal_size(bal_settings));
        const bal_head_lines = bal_item.heading?.trim()
          ? bal_wrapped(bal_item.heading, bal_settings, bal_ctx.contentWidth - (bal_item.emphasis === 'callout' ? 5 : 0), true)
          : [];
        const bal_body_lines = bal_item.label.trim()
          ? bal_wrapped(bal_item.label, bal_settings, bal_ctx.contentWidth - (bal_item.emphasis === 'callout' ? 5 : 0))
          : [];
        const bal_height =
          (bal_head_lines.length > 0 ? bal_head_lines.length * bal_lh + 0.6 : 0) +
          bal_body_lines.length * bal_lh + 2.4;
        bal_chunks.push({
          kind: 'instruction',
          itemType: 'instruction',
          itemId: bal_item.id,
          sectionId: bal_section.id,
          height: bal_height,
          keepWithNext: false,
          forcedBreakBefore: false,
          heading: bal_item.heading?.trim() || null,
          headingLines: bal_head_lines,
          bodyLines: bal_body_lines,
          callout: bal_item.emphasis === 'callout'
        });
        continue;
      }
      if (bal_item.type === 'section') continue;

      const bal_descriptor = item_descriptor(bal_item.type);
      if (bal_item.type === 'matrix') {
        if (bal_item.rows.length > 0) {
          bal_chunks.push(...bal_build_matrix_chunks(bal_item, bal_section.id, bal_ctx));
        }
        continue;
      }
      if (bal_item.type === 'consent') {
        bal_chunks.push(...bal_build_consent_chunks(bal_item, bal_section.id, bal_ctx));
        continue;
      }
      if (bal_item.type === 'participant_signature' || bal_item.type === 'researcher_signature') {
        bal_chunks.push(bal_build_signature_chunk(bal_item, bal_section.id, bal_ctx));
        continue;
      }
      if (bal_item.type === 'yes_no') {
        bal_chunks.push(
          bal_build_question_chunk(bal_item, bal_section.id, bal_ctx, null, [
            {
              id: bal_item.options[0]?.id ?? `${bal_item.id}-yes`,
              label: bal_item.options[0]?.label ?? 'Yes',
              coding: bal_item.options[0]?.coding ?? '1'
            },
            {
              id: bal_item.options[1]?.id ?? `${bal_item.id}-no`,
              label: bal_item.options[1]?.label ?? 'No',
              coding: bal_item.options[1]?.coding ?? '0'
            }
          ])
        );
        continue;
      }
      if (bal_item.type === 'likert_scale' || bal_item.type === 'single_choice' || bal_item.type === 'multiple_choice') {
        bal_chunks.push(bal_build_question_chunk(bal_item, bal_section.id, bal_ctx, null));
        continue;
      }
      if (bal_descriptor.usesVariableName) {
        bal_chunks.push(bal_build_question_chunk(bal_item, bal_section.id, bal_ctx, null));
      }
    }
  });
  return bal_chunks;
}

