import type { bal_PrintDocument, bal_PrintRenderPage } from './print_layout';
import type {
  bal_ConsentAckChunk,
  bal_ConsentParaChunk,
  bal_InstructionChunk,
  bal_MatrixHeadChunk,
  bal_MatrixRowChunk,
  bal_PrintChunk,
  bal_QuestionChunk,
  bal_SectionHeadChunk,
  bal_SignatureChunk
} from './print_blocks';
import type { PrintSettings } from '../../models/types';
import {
  BAL_BENGALI_UNITS_PER_EM,
  bal_command_to_cubic,
  bal_has_bengali,
  bal_shape_text
} from './print_bengali';
import { bal_measure_units } from './print_fonts';
import { bal_load_bengali_shaper } from './print_bengali';

interface bal_PdfWriter {
  setFont(family: string, style: string): void;
  setFontSize(size: number): void;
  setTextColor(r: number, g?: number, b?: number): void;
  setDrawColor(r: number, g?: number, b?: number): void;
  setFillColor(r: number, g?: number, b?: number): void;
  setLineWidth(width: number): void;
  text(text: string, x: number, y: number, options?: { align?: 'left' | 'center' | 'right'; baseline?: 'top' | 'middle'; maxWidth?: number }): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  rect(x: number, y: number, w: number, h: number, style?: 'S' | 'F' | 'FD'): void;
  circle(x: number, y: number, r: number, style?: 'S' | 'F' | 'FD'): void;
}

interface bal_PathPen {
  move(bal_x: number, bal_y: number): void;
  line(bal_x: number, bal_y: number): void;
  cubic(bal_x1: number, bal_y1: number, bal_x2: number, bal_y2: number, bal_x3: number, bal_y3: number): void;
  close(): void;
  fill(): void;
  fillStroke(bal_stroke_mm: number): void;
}

interface bal_PdfDoc extends bal_PdfWriter {
  bal_pen?: bal_PathPen;
  addPage(format: [number, number], orientation: 'portrait' | 'landscape'): void;
  addImage(
    data: string,
    format: 'PNG' | 'JPEG',
    x: number,
    y: number,
    width: number,
    height: number
  ): void;
  output(encoding: 'arraybuffer'): ArrayBuffer;
  internal: { scaleFactor: number };
}

const BAL_INK = 25;
const BAL_SOFT_INK = 120;
const BAL_RULE_INK = 150;

function bal_font_style(bal_settings: PrintSettings, bal_bold: boolean): string {
  if (bal_settings.theme.fontFamily === 'courier') return bal_bold ? 'bold' : 'normal';
  return bal_bold ? 'bold' : 'normal';
}

interface bal_TextRun {
  bal_text: string;
  bal_bengali: boolean;
  bal_width_mm: number;
}

const BAL_PT_TO_MM = 0.35277778;
const BAL_BENGALI_ASCENDER_EM = 1.06;

function bal_make_pen(bal_jsdoc: {
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): unknown;
  close(): unknown;
  fill(): unknown;
  fillStroke(): unknown;
  setLineWidth(width: number): unknown;
}): bal_PathPen {
  return {
    move(bal_x, bal_y) {
      bal_jsdoc.moveTo(bal_x, bal_y);
    },
    line(bal_x, bal_y) {
      bal_jsdoc.lineTo(bal_x, bal_y);
    },
    cubic(bal_x1, bal_y1, bal_x2, bal_y2, bal_x3, bal_y3) {
      bal_jsdoc.curveTo(bal_x1, bal_y1, bal_x2, bal_y2, bal_x3, bal_y3);
    },
    close() {
      bal_jsdoc.close();
    },
    fill() {
      bal_jsdoc.fill();
    },
    fillStroke(bal_stroke_mm) {
      bal_jsdoc.setLineWidth(bal_stroke_mm);
      bal_jsdoc.fillStroke();
    }
  };
}

function bal_split_runs(bal_text: string): string[] {
  const bal_runs: string[] = [];
  let bal_current = '';
  let bal_current_bengali: boolean | null = null;
  for (const bal_char of bal_text) {
    const bal_code = bal_char.codePointAt(0) ?? 32;
    const bal_is_bengali = (bal_code >= 0x0980 && bal_code <= 0x09ff) || bal_code === 0x200c || bal_code === 0x200d;
    if (bal_current_bengali === null || bal_is_bengali === bal_current_bengali) {
      bal_current += bal_char;
      bal_current_bengali = bal_is_bengali;
      continue;
    }
    bal_runs.push(bal_current);
    bal_current = bal_char;
    bal_current_bengali = bal_is_bengali;
  }
  if (bal_current.length > 0) bal_runs.push(bal_current);
  return bal_runs;
}

function bal_draw_shaped_runs(
  bal_doc: bal_PdfDoc,
  bal_settings: PrintSettings,
  bal_runs: bal_TextRun[],
  bal_text_x: number,
  bal_text_y: number,
  bal_size_pt: number,
  bal_bold: boolean
): void {
  const bal_pen = bal_doc.bal_pen;
  if (!bal_pen) return;
  const bal_scale = (bal_size_pt * BAL_PT_TO_MM) / BAL_BENGALI_UNITS_PER_EM;
  const bal_baseline_y = bal_text_y + bal_size_pt * BAL_BENGALI_ASCENDER_EM * BAL_PT_TO_MM;
  bal_doc.setDrawColor(BAL_INK, BAL_INK, BAL_INK);
  bal_doc.setFillColor(BAL_INK, BAL_INK, BAL_INK);
  let bal_cursor = bal_text_x;
  for (const bal_run of bal_runs) {
    if (!bal_run.bal_bengali) {
      bal_doc.setFont(bal_settings.theme.fontFamily, bal_font_style(bal_settings, bal_bold));
      bal_doc.setFontSize(bal_size_pt);
      bal_doc.setTextColor(BAL_INK, BAL_INK, BAL_INK);
      bal_doc.text(bal_run.bal_text, bal_cursor, bal_text_y, {
        align: 'left',
        baseline: 'top'
      });
      bal_cursor += bal_run.bal_width_mm;
      continue;
    }
    const bal_shaped = bal_shape_text(bal_run.bal_text);
    if (!bal_shaped) {
      bal_cursor += bal_run.bal_width_mm;
      continue;
    }
    for (const bal_glyph of bal_shaped.glyphs) {
      let bal_prev_x = 0;
      let bal_prev_y = 0;
      for (const bal_cmd of bal_glyph.commands) {
        if (bal_cmd.command === 'moveTo') {
          bal_pen.move(
            bal_cursor + (bal_cmd.args[0] + bal_glyph.xOffset) * bal_scale,
            bal_baseline_y - (bal_cmd.args[1] + bal_glyph.yOffset) * bal_scale
          );
        } else if (bal_cmd.command === 'lineTo') {
          bal_pen.line(
            bal_cursor + (bal_cmd.args[0] + bal_glyph.xOffset) * bal_scale,
            bal_baseline_y - (bal_cmd.args[1] + bal_glyph.yOffset) * bal_scale
          );
        } else if (bal_cmd.command === 'quadraticCurveTo') {
          const bal_cubic = bal_command_to_cubic(bal_cmd, bal_prev_x, bal_prev_y);
          if (bal_cubic) {
            bal_pen.cubic(
              bal_cursor + (bal_cubic.c[0] + bal_glyph.xOffset) * bal_scale,
              bal_baseline_y - (bal_cubic.c[1] + bal_glyph.yOffset) * bal_scale,
              bal_cursor + (bal_cubic.c[2] + bal_glyph.xOffset) * bal_scale,
              bal_baseline_y - (bal_cubic.c[3] + bal_glyph.yOffset) * bal_scale,
              bal_cursor + (bal_cubic.c[4] + bal_glyph.xOffset) * bal_scale,
              bal_baseline_y - (bal_cubic.c[5] + bal_glyph.yOffset) * bal_scale
            );
          }
          bal_prev_x = bal_cmd.args[2];
          bal_prev_y = bal_cmd.args[3];
        } else if (bal_cmd.command === 'bezierCurveTo') {
          bal_pen.cubic(
            bal_cursor + (bal_cmd.args[0] + bal_glyph.xOffset) * bal_scale,
            bal_baseline_y - (bal_cmd.args[1] + bal_glyph.yOffset) * bal_scale,
            bal_cursor + (bal_cmd.args[2] + bal_glyph.xOffset) * bal_scale,
            bal_baseline_y - (bal_cmd.args[3] + bal_glyph.yOffset) * bal_scale,
            bal_cursor + (bal_cmd.args[4] + bal_glyph.xOffset) * bal_scale,
            bal_baseline_y - (bal_cmd.args[5] + bal_glyph.yOffset) * bal_scale
          );
        } else {
          bal_pen.close();
        }
      }
      bal_cursor += bal_glyph.advance * bal_scale;
    }
    if (bal_bold) {
      bal_pen.fillStroke(Math.max(0.06, bal_size_pt * BAL_PT_TO_MM * 0.028));
    } else {
      bal_pen.fill();
    }
  }
}

function bal_draw_text(
  bal_doc: bal_PdfDoc,
  bal_settings: PrintSettings,
  bal_text: string,
  bal_x: number,
  bal_y: number,
  bal_options: { size?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; color?: number } = {}
): void {
  const bal_size = bal_options.size ?? bal_settings.theme.baseFontSize;
  const bal_bold = bal_options.bold ?? false;
  bal_doc.setFont(bal_settings.theme.fontFamily, bal_font_style(bal_settings, bal_bold));
  bal_doc.setFontSize(bal_size);
  const bal_ink = bal_options.color ?? BAL_INK;
  bal_doc.setTextColor(bal_ink, bal_ink, bal_ink);
  if (bal_has_bengali(bal_text) && bal_doc.bal_pen) {
    const bal_runs: bal_TextRun[] = bal_split_runs(bal_text).map((bal_run_text) => ({
      bal_text: bal_run_text,
      bal_bengali: bal_has_bengali(bal_run_text),
      bal_width_mm: (bal_measure_units(bal_run_text, { family: bal_settings.theme.fontFamily, bold: bal_bold }) / 1000) * bal_size * BAL_PT_TO_MM
    }));
    const bal_total = bal_runs.reduce((bal_sum, bal_run) => bal_sum + bal_run.bal_width_mm, 0);
    let bal_start_x = bal_x;
    if (bal_options.align === 'center') bal_start_x = bal_x - bal_total / 2;
    else if (bal_options.align === 'right') bal_start_x = bal_x - bal_total;
    bal_draw_shaped_runs(bal_doc, bal_settings, bal_runs, bal_start_x, bal_y, bal_size, bal_bold);
    return;
  }
  bal_doc.text(bal_text, bal_x, bal_y, {
    align: bal_options.align ?? 'left',
    baseline: 'top'
  });
}

function bal_draw_rule(
  bal_doc: bal_PdfDoc,
  bal_settings: PrintSettings,
  bal_x1: number,
  bal_y1: number,
  bal_x2: number,
  bal_y2: number,
  bal_weight_factor = 1,
  bal_color = BAL_INK
): void {
  bal_doc.setDrawColor(bal_color, bal_color, bal_color);
  bal_doc.setLineWidth(Math.max(0.08, bal_settings.theme.lineWeight * bal_weight_factor));
  bal_doc.line(bal_x1, bal_y1, bal_x2, bal_y2);
}

function bal_draw_marker(
  bal_doc: bal_PdfDoc,
  bal_settings: PrintSettings,
  bal_type: 'bubble' | 'checkbox',
  bal_center_x: number,
  bal_center_y: number
): void {
  bal_doc.setDrawColor(BAL_INK, BAL_INK, BAL_INK);
  bal_doc.setLineWidth(Math.max(0.15, bal_settings.theme.lineWeight));
  if (bal_type === 'bubble') {
    bal_doc.circle(bal_center_x, bal_center_y, bal_settings.marker.diameterMm / 2, 'S');
  } else {
    const bal_side = bal_settings.marker.diameterMm;
    bal_doc.rect(bal_center_x - bal_side / 2, bal_center_y - bal_side / 2, bal_side, bal_side, 'S');
  }
}

function bal_draw_qr(
  bal_doc: bal_PdfDoc,
  bal_modules: boolean[][],
  bal_bounds: { x: number; y: number; width: number; height: number },
  bal_quiet_modules: number
): void {
  const bal_total = bal_modules.length + bal_quiet_modules * 2;
  const bal_module_size = bal_bounds.width / bal_total;
  bal_doc.setFillColor(0, 0, 0);
  for (let bal_row = 0; bal_row < bal_modules.length; bal_row++) {
    for (let bal_col = 0; bal_col < bal_modules.length; bal_col++) {
      if (!bal_modules[bal_row][bal_col]) continue;
      bal_doc.rect(
        bal_bounds.x + (bal_col + bal_quiet_modules) * bal_module_size,
        bal_bounds.y + (bal_row + bal_quiet_modules) * bal_module_size,
        bal_module_size + 0.01,
        bal_module_size + 0.01,
        'F'
      );
    }
  }
}

function bal_draw_question(
  bal_doc: bal_PdfDoc,
  bal_settings: PrintSettings,
  bal_chunk: bal_QuestionChunk,
  bal_origin_x: number,
  bal_origin_y: number
): void {
  const bal_lh = bal_settings.theme.baseFontSize * 1.38 * 0.35277778;
  bal_draw_text(bal_doc, bal_settings, `${bal_chunk.numberLabel}.`, bal_origin_x, bal_origin_y, { bold: true });
  bal_chunk.stemLines.forEach((bal_line, bal_i) => {
    bal_draw_text(
      bal_doc,
      bal_settings,
      bal_line,
      bal_origin_x + bal_chunk.stemIndent,
      bal_origin_y + bal_i * (bal_lh + 0.6),
      {}
    );
  });
  for (const bal_row of bal_chunk.optionRows) {
    bal_draw_marker(
      bal_doc,
      bal_settings,
      bal_chunk.itemType === 'multiple_choice' ? 'checkbox' : 'bubble',
      bal_origin_x + bal_row.markerX + bal_settings.marker.diameterMm / 2,
      bal_origin_y + bal_row.markerCenterY
    );
    bal_row.labelLines.forEach((bal_line, bal_i) => {
      bal_draw_text(
        bal_doc,
        bal_settings,
        bal_line,
        bal_origin_x + bal_row.markerX + bal_settings.marker.diameterMm + 3.2,
        bal_origin_y + bal_row.rowTop + (bal_row.rowHeight - bal_row.labelLines.length * bal_lh) / 2 + bal_i * bal_lh
      );
    });
  }
  if (bal_chunk.tail === 'line') {
    bal_draw_rule(
      bal_doc,
      bal_settings,
      bal_origin_x + bal_chunk.stemIndent,
      bal_origin_y + bal_chunk.tailTop + bal_chunk.tailHeight,
      bal_origin_x + bal_chunk.stemIndent + bal_chunk.tailWidth,
      bal_origin_y + bal_chunk.tailTop + bal_chunk.tailHeight,
      0.8,
      BAL_SOFT_INK
    );
  } else if (bal_chunk.tail === 'small-box' || bal_chunk.tail === 'date-box') {
    bal_doc.setDrawColor(BAL_SOFT_INK, BAL_SOFT_INK, BAL_SOFT_INK);
    bal_doc.setLineWidth(Math.max(0.12, bal_settings.theme.lineWeight * 0.7));
    bal_doc.rect(
      bal_origin_x + bal_chunk.stemIndent,
      bal_origin_y + bal_chunk.tailTop,
      bal_chunk.tailWidth,
      bal_chunk.tailHeight,
      'S'
    );
    if (bal_chunk.itemType === 'number' && bal_chunk.unitLabel) {
      bal_draw_text(
        bal_doc,
        bal_settings,
        bal_chunk.unitLabel,
        bal_origin_x + bal_chunk.stemIndent + bal_chunk.tailWidth + 2,
        bal_origin_y + bal_chunk.tailTop + (bal_chunk.tailHeight - bal_lh) / 2,
        { color: BAL_SOFT_INK }
      );
    }
    if (bal_chunk.itemType === 'date') {
      bal_draw_text(
        bal_doc,
        bal_settings,
        'YYYY-MM-DD',
        bal_origin_x + bal_chunk.stemIndent + 2,
        bal_origin_y + bal_chunk.tailTop + (bal_chunk.tailHeight - bal_lh) / 2,
        { size: bal_settings.theme.baseFontSize * 0.8, color: BAL_RULE_INK }
      );
    }
  } else if (bal_chunk.tail === 'wide-box') {
    bal_doc.setDrawColor(BAL_SOFT_INK, BAL_SOFT_INK, BAL_SOFT_INK);
    bal_doc.setLineWidth(Math.max(0.12, bal_settings.theme.lineWeight * 0.7));
    bal_doc.rect(
      bal_origin_x + bal_chunk.stemIndent,
      bal_origin_y + bal_chunk.tailTop,
      bal_chunk.tailWidth,
      bal_chunk.tailHeight,
      'S'
    );
  }
}

function bal_draw_matrix_head(
  bal_doc: bal_PdfDoc,
  bal_settings: PrintSettings,
  bal_chunk: bal_MatrixHeadChunk,
  bal_origin_x: number,
  bal_origin_y: number,
  bal_content_width: number
): void {
  const bal_lh = bal_settings.theme.baseFontSize * 1.38 * 0.35277778;
  const bal_heading_size = bal_settings.theme.baseFontSize * 1.05;
  bal_draw_text(bal_doc, bal_settings, `${bal_chunk.numberLabel}.`, bal_origin_x, bal_origin_y, { bold: true, size: bal_heading_size });
  bal_chunk.stemLines.forEach((bal_line, bal_i) => {
    bal_draw_text(
      bal_doc,
      bal_settings,
      bal_line,
      bal_origin_x + bal_chunk.stemIndent,
      bal_origin_y + bal_i * (bal_lh + 0.6),
      { bold: true, size: bal_heading_size }
    );
  });
  const bal_header_top = bal_origin_y + bal_chunk.height - bal_chunk.headerHeight;
  bal_chunk.columnLabels.forEach((bal_lines, bal_col_index) => {
    const bal_col_x =
      bal_origin_x + bal_chunk.labelColumnWidth + bal_chunk.columnWidths.slice(0, bal_col_index).reduce((bal_a, bal_b) => bal_a + bal_b, 0);
    bal_lines.forEach((bal_line, bal_line_index) => {
      bal_draw_text(bal_doc, bal_settings, bal_line, bal_col_x + bal_chunk.columnWidths[0] / 2, bal_header_top + bal_line_index * bal_lh, {
        bold: true,
        size: bal_settings.theme.baseFontSize * 0.85,
        align: 'center'
      });
    });
  });
  bal_draw_rule(
    bal_doc,
    bal_settings,
    bal_origin_x,
    bal_origin_y + bal_chunk.height - 0.4,
    bal_origin_x + bal_content_width,
    bal_origin_y + bal_chunk.height - 0.4,
    1
  );
}

function bal_draw_matrix_row(
  bal_doc: bal_PdfDoc,
  bal_settings: PrintSettings,
  bal_chunk: bal_MatrixRowChunk,
  bal_origin_x: bal_PdfDoc extends never ? never : number,
  bal_origin_y: number,
  bal_content_width: number,
  bal_multiple: boolean
): void {
  const bal_lh = bal_settings.theme.baseFontSize * 1.38 * 0.35277778;
  void bal_multiple;
  bal_chunk.labelLines.forEach((bal_line, bal_i) => {
    bal_draw_text(
      bal_doc,
      bal_settings,
      bal_line,
      bal_origin_x + 2,
      bal_origin_y + (bal_chunk.rowHeight - bal_chunk.labelLines.length * bal_lh) / 2 + bal_i * bal_lh
    );
  });
  for (let bal_col = 0; bal_col < bal_chunk.columnCount; bal_col++) {
    const bal_col_width = bal_chunk.columnWidths[bal_col] ?? bal_chunk.columnWidths[0];
    bal_draw_marker(
      bal_doc,
      bal_settings,
      bal_multiple ? 'checkbox' : 'bubble',
      bal_origin_x + bal_chunk.labelColumnWidth + bal_col * bal_col_width + bal_col_width / 2,
      bal_origin_y + bal_chunk.rowHeight / 2
    );
  }
  bal_doc.setDrawColor(BAL_RULE_INK, BAL_RULE_INK, BAL_RULE_INK);
  bal_doc.setLineWidth(0.08);
  bal_doc.line(bal_origin_x, bal_origin_y + bal_chunk.rowHeight, bal_origin_x + bal_content_width, bal_origin_y + bal_chunk.rowHeight);
}

function bal_draw_instruction(
  bal_doc: bal_PdfDoc,
  bal_settings: PrintSettings,
  bal_chunk: bal_InstructionChunk,
  bal_origin_x: number,
  bal_origin_y: number,
  bal_content_width: number
): void {
  void bal_content_width;
  const bal_lh = bal_settings.theme.baseFontSize * 1.38 * 0.35277778;
  const bal_indent = bal_chunk.callout ? 5 : 0;
  let bal_y = bal_origin_y;
  if (bal_chunk.headingLines.length > 0) {
    bal_chunk.headingLines.forEach((bal_line) => {
      bal_draw_text(bal_doc, bal_settings, bal_line, bal_origin_x + bal_indent, bal_y, { bold: true });
      bal_y += bal_lh + 0.6;
    });
  }
  bal_chunk.bodyLines.forEach((bal_line) => {
    bal_draw_text(bal_doc, bal_settings, bal_line, bal_origin_x + bal_indent, bal_y, { color: BAL_SOFT_INK });
    bal_y += bal_lh;
  });
  if (bal_chunk.callout) {
    bal_doc.setDrawColor(BAL_RULE_INK, BAL_RULE_INK, BAL_RULE_INK);
    bal_doc.setLineWidth(0.6);
    bal_doc.line(bal_origin_x + 1.2, bal_origin_y, bal_origin_x + 1.2, bal_origin_y + bal_chunk.height - 1);
  }
}

function bal_draw_consent_para(
  bal_doc: bal_PdfDoc,
  bal_settings: PrintSettings,
  bal_chunk: bal_ConsentParaChunk,
  bal_origin_x: number,
  bal_origin_y: number
): void {
  const bal_lh = bal_settings.theme.baseFontSize * 1.38 * 0.35277778;
  let bal_y = bal_origin_y;
  if (bal_chunk.headingLines.length > 0 && bal_chunk.bodyLines.length === 0) {
    bal_chunk.headingLines.forEach((bal_line) => {
      bal_draw_text(
        bal_doc,
        bal_settings,
        bal_line,
        bal_origin_x,
        bal_y,
        { bold: true, size: bal_settings.theme.baseFontSize * bal_settings.theme.headingScale }
      );
      bal_y += bal_lh * bal_settings.theme.headingScale;
    });
    return;
  }
  if (bal_chunk.headingLines.length > 0) {
    bal_chunk.headingLines.forEach((bal_line) => {
      bal_draw_text(bal_doc, bal_settings, bal_line, bal_origin_x, bal_y, { bold: true });
      bal_y += bal_lh + 0.8;
    });
  }
  bal_chunk.bodyLines.forEach((bal_line) => {
    bal_draw_text(bal_doc, bal_settings, bal_line, bal_origin_x, bal_y, {});
    bal_y += bal_lh;
  });
}

function bal_draw_consent_ack(
  bal_doc: bal_PdfDoc,
  bal_settings: PrintSettings,
  bal_chunk: bal_ConsentAckChunk,
  bal_origin_x: number,
  bal_origin_y: number
): void {
  const bal_lh = bal_settings.theme.baseFontSize * 1.38 * 0.35277778;
  const bal_side = Math.max(bal_settings.marker.diameterMm, 4.2);
  bal_doc.setDrawColor(BAL_INK, BAL_INK, BAL_INK);
  bal_doc.setLineWidth(Math.max(0.2, bal_settings.theme.lineWeight));
  bal_doc.rect(
    bal_origin_x + bal_chunk.markerX,
    bal_origin_y + bal_chunk.markerCenterY - bal_side / 2,
    bal_side,
    bal_side,
    'S'
  );
  bal_chunk.labelLines.forEach((bal_line, bal_i) => {
    bal_draw_text(
      bal_doc,
      bal_settings,
      bal_line,
      bal_origin_x + bal_chunk.markerX + bal_side + 3,
      bal_origin_y + (bal_chunk.height - bal_chunk.labelLines.length * bal_lh) / 2 + bal_i * bal_lh,
      { bold: true }
    );
  });
}

function bal_draw_signature(
  bal_doc: bal_PdfDoc,
  bal_settings: PrintSettings,
  bal_chunk: bal_SignatureChunk,
  bal_origin_x: number,
  bal_origin_y: number,
  bal_content_width: number
): void {
  const bal_lh = bal_settings.theme.baseFontSize * 1.38 * 0.35277778;
  let bal_y = bal_origin_y;
  bal_draw_text(bal_doc, bal_settings, bal_chunk.roleLabel, bal_origin_x, bal_y, { bold: true });
  bal_y += bal_lh + 4.5;
  const bal_line_width = 60;
  bal_draw_rule(bal_doc, bal_settings, bal_origin_x + 2, bal_y, bal_origin_x + 2 + bal_line_width, bal_y, 0.9);
  bal_draw_text(bal_doc, bal_settings, 'Signature', bal_origin_x + 2, bal_y + 1, { size: bal_settings.theme.baseFontSize * 0.8, color: BAL_SOFT_INK });
  if (bal_chunk.includeDate) {
    const bal_date_x = bal_origin_x + bal_content_width - 34;
    bal_draw_rule(bal_doc, bal_settings, bal_date_x, bal_y, bal_date_x + 34, bal_y, 0.9);
    bal_draw_text(bal_doc, bal_settings, 'Date', bal_date_x, bal_y + 1, { size: bal_settings.theme.baseFontSize * 0.8, color: BAL_SOFT_INK });
  }
  bal_y += bal_lh + 4.2;
  if (bal_chunk.includePrintedName) {
    bal_draw_rule(bal_doc, bal_settings, bal_origin_x + 2, bal_y, bal_origin_x + 2 + bal_line_width, bal_y, 0.7, BAL_SOFT_INK);
    bal_draw_text(bal_doc, bal_settings, 'Printed name', bal_origin_x + 2, bal_y + 1, { size: bal_settings.theme.baseFontSize * 0.8, color: BAL_SOFT_INK });
    bal_y += bal_lh + 2.4;
  }
  void bal_y;
}

function bal_draw_chunk(
  bal_doc: bal_PdfDoc,
  bal_settings: PrintSettings,
  bal_placed: { chunk: bal_PrintChunk; y: number },
  bal_origin_x: number,
  bal_content_width: number,
  bal_multiple_matrices: Set<string>
): void {
  const bal_chunk = bal_placed.chunk;
  const bal_y = bal_placed.y;
  switch (bal_chunk.kind) {
    case 'section-head': {
      const bal_section = bal_chunk as bal_SectionHeadChunk;
      const bal_lh = bal_settings.theme.baseFontSize * bal_settings.theme.headingScale * 1.38 * 0.35277778;
      let bal_y2 = bal_y;
      const bal_title =
        bal_section.title.trim().length > 0
          ? bal_section.title
          : `Section ${bal_section.sectionIndex}`;
      bal_draw_text(bal_doc, bal_settings, bal_title.toUpperCase(), bal_origin_x, bal_y2, {
        bold: true,
        size: bal_settings.theme.baseFontSize * bal_settings.theme.headingScale
      });
      bal_y2 += bal_lh;
      bal_section.descriptionLines.forEach((bal_line) => {
        bal_draw_text(bal_doc, bal_settings, bal_line, bal_origin_x, bal_y2, { color: BAL_SOFT_INK });
        bal_y2 += bal_settings.theme.baseFontSize * 1.38 * 0.35277778;
      });
      bal_draw_rule(bal_doc, bal_settings, bal_origin_x, bal_y + bal_chunk.height - 0.8, bal_origin_x + bal_content_width, bal_y + bal_chunk.height - 0.8, 1.2);
      break;
    }
    case 'instruction':
      bal_draw_instruction(bal_doc, bal_settings, bal_chunk as bal_InstructionChunk, bal_origin_x, bal_y, bal_content_width);
      break;
    case 'question':
      bal_draw_question(bal_doc, bal_settings, bal_chunk as bal_QuestionChunk, bal_origin_x, bal_y);
      break;
    case 'matrix-head':
      bal_draw_matrix_head(bal_doc, bal_settings, bal_chunk as bal_MatrixHeadChunk, bal_origin_x, bal_y, bal_content_width);
      break;
    case 'matrix-row':
      bal_draw_matrix_row(
        bal_doc,
        bal_settings,
        bal_chunk as bal_MatrixRowChunk,
        bal_origin_x,
        bal_y,
        bal_content_width,
        bal_multiple_matrices.has((bal_chunk as bal_MatrixRowChunk).itemId as string)
      );
      break;
    case 'consent-para':
      bal_draw_consent_para(bal_doc, bal_settings, bal_chunk as bal_ConsentParaChunk, bal_origin_x, bal_y);
      break;
    case 'consent-ack':
      bal_draw_consent_ack(bal_doc, bal_settings, bal_chunk as bal_ConsentAckChunk, bal_origin_x, bal_y);
      break;
    case 'signature':
      bal_draw_signature(bal_doc, bal_settings, bal_chunk as bal_SignatureChunk, bal_origin_x, bal_y, bal_content_width);
      break;
  }
}

function bal_draw_furniture(
  bal_doc: bal_PdfDoc,
  bal_settings: PrintSettings,
  bal_page: bal_PrintRenderPage
): void {
  const bal_regions = bal_page.regions;
  if (bal_page.header && bal_regions.header) {
    const bal_header = bal_page.header;
    const bal_y = bal_regions.header.y;
    if (bal_header.titleText) {
      bal_draw_text(bal_doc, bal_settings, bal_header.titleText, bal_regions.header.x, bal_y, {
        bold: true,
        size: bal_settings.theme.baseFontSize * bal_settings.theme.headingScale
      });
    }
    if (bal_header.institutionText) {
      bal_draw_text(
        bal_doc,
        bal_settings,
        bal_header.institutionText,
        bal_regions.header.x,
        bal_y + bal_settings.theme.baseFontSize * bal_settings.theme.headingScale * 1.38 * 0.35277778,
        { color: BAL_SOFT_INK }
      );
    }
    const bal_meta_x = bal_header.respondentBox
      ? bal_header.respondentBox.x - 4
      : bal_regions.header.x + bal_regions.header.width;
    const bal_meta: string[] = [];
    if (bal_header.versionText) bal_meta.push(bal_header.versionText);
    if (bal_header.studyCodeText) bal_meta.push(bal_header.studyCodeText);
    bal_meta.forEach((bal_line, bal_i) => {
      bal_draw_text(bal_doc, bal_settings, bal_line, bal_meta_x, bal_y + bal_i * 4, {
        size: bal_settings.theme.baseFontSize * 0.8,
        align: 'right',
        color: BAL_SOFT_INK
      });
    });
    if (bal_header.respondentBox && bal_header.respondentLabel) {
      bal_doc.setDrawColor(BAL_SOFT_INK, BAL_SOFT_INK, BAL_SOFT_INK);
      bal_doc.setLineWidth(Math.max(0.12, bal_settings.theme.lineWeight * 0.7));
      bal_doc.rect(bal_header.respondentBox.x, bal_header.respondentBox.y, bal_header.respondentBox.width, bal_header.respondentBox.height, 'S');
      bal_draw_text(
        bal_doc,
        bal_settings,
        bal_header.respondentLabel,
        bal_header.respondentBox.x + 1.5,
        bal_header.respondentBox.y + 0.8,
        { size: bal_settings.theme.baseFontSize * 0.68, color: BAL_SOFT_INK }
      );
    }
  }

  if (bal_page.footer && bal_regions.footer) {
    const bal_footer = bal_page.footer;
    let bal_left_x = bal_regions.footer.x;
    if (bal_footer.humanReadable) {
      bal_draw_text(bal_doc, bal_settings, bal_footer.humanReadable, bal_left_x, bal_regions.footer.y + 1, {
        size: bal_settings.theme.baseFontSize * 0.8
      });
      bal_left_x += 34;
    }
    if (bal_footer.studyCodeText) {
      const bal_qr_left = bal_page.identifier?.qrBounds?.x ?? bal_regions.footer.x + bal_regions.footer.width;
      bal_draw_text(bal_doc, bal_settings, bal_footer.studyCodeText, bal_qr_left - 2, bal_regions.footer.y + 1, {
        size: bal_settings.theme.baseFontSize * 0.8,
        align: 'right',
        color: BAL_SOFT_INK
      });
    }
    if (bal_footer.pageText) {
      bal_draw_text(
        bal_doc,
        bal_settings,
        bal_footer.pageText,
        bal_regions.footer.x + (bal_regions.footer.width - (bal_page.identifier?.qrBounds?.width ?? 0)) / 2,
        bal_regions.footer.y + 1,
        { size: bal_settings.theme.baseFontSize * 0.8, align: 'center', color: BAL_SOFT_INK }
      );
    }
    if (bal_footer.confidentialityLines.length > 0) {
      const bal_conf_y = bal_regions.footer.y;
      bal_footer.confidentialityLines.forEach((bal_line, bal_i) => {
        bal_draw_text(
          bal_doc,
          bal_settings,
          bal_line,
          bal_left_x,
          bal_conf_y + 1 + 4.4 + bal_i * 3.6,
          { size: bal_settings.theme.baseFontSize * 0.7, color: BAL_RULE_INK }
        );
      });
    }
  }

  if (bal_page.identifier?.qrBounds && bal_page.qrModules) {
    bal_draw_qr(
      bal_doc,
      bal_page.qrModules,
      bal_page.identifier.qrBounds,
      bal_page.identifier.quietZoneModules
    );
  }

  for (const bal_marker of bal_page.alignmentMarkers) {
    bal_doc.setFillColor(0, 0, 0);
    bal_doc.rect(bal_marker.rect.x, bal_marker.rect.y, bal_marker.rect.width, bal_marker.rect.height, 'F');
  }
}

async function bal_create_doc(bal_document: bal_PrintDocument): Promise<bal_PdfDoc> {
  const { jsPDF } = await import('jspdf');
  const bal_first = bal_document.pages[0];
  const bal_instance = new jsPDF({
    unit: 'mm',
    format: [bal_first.regions.width, bal_first.regions.height],
    orientation: bal_first.regions.width > bal_first.regions.height ? 'landscape' : 'portrait',
    compress: true,
    precision: 2
  }) as unknown as bal_PdfDoc;
  bal_instance.bal_pen = bal_make_pen(bal_instance as unknown as Parameters<typeof bal_make_pen>[0]);
  return bal_instance;
}

function bal_draw_pages(
  bal_doc: bal_PdfDoc,
  bal_document: bal_PrintDocument,
  bal_skip_first_page: boolean
): void {
  const bal_multiple_matrices = new Set(bal_document.matrixMultipleItemIds);
  bal_document.pages.forEach((bal_page, bal_index) => {
    if (bal_skip_first_page || bal_index > 0) {
      bal_doc.addPage(
        [bal_page.regions.width, bal_page.regions.height],
        bal_page.regions.width > bal_page.regions.height ? 'landscape' : 'portrait'
      );
    }
    bal_draw_furniture(bal_doc, bal_document.settings, bal_page);
    for (const bal_placed of bal_page.chunks) {
      bal_draw_chunk(
        bal_doc,
        bal_document.settings,
        bal_placed,
        bal_page.regions.content.x,
        bal_page.regions.content.width,
        bal_multiple_matrices
      );
    }
  });
}

export async function hati_pdf_bytes_many(bal_documents: bal_PrintDocument[]): Promise<Uint8Array> {
  if (bal_documents.length === 0) throw new Error('No pages to write.');
  await bal_load_bengali_shaper();
  const bal_doc = await bal_create_doc(bal_documents[0]);
  bal_draw_pages(bal_doc, bal_documents[0], false);
  for (let bal_i = 1; bal_i < bal_documents.length; bal_i++) {
    bal_draw_pages(bal_doc, bal_documents[bal_i], true);
  }
  return new Uint8Array(bal_doc.output('arraybuffer'));
}

export async function hati_pdf_bytes(bal_document: bal_PrintDocument): Promise<Uint8Array> {
  await bal_load_bengali_shaper();
  const { jsPDF } = await import('jspdf');
  const bal_first = bal_document.pages[0];
  const bal_doc: bal_PdfDoc = new jsPDF({
    unit: 'mm',
    format: [bal_first.regions.width, bal_first.regions.height],
    orientation: bal_first.regions.width > bal_first.regions.height ? 'landscape' : 'portrait',
    compress: true,
    precision: 2
  }) as unknown as bal_PdfDoc;
  bal_doc.bal_pen = bal_make_pen(bal_doc as unknown as Parameters<typeof bal_make_pen>[0]);

  const bal_multiple_matrices = new Set(bal_document.matrixMultipleItemIds);

  bal_document.pages.forEach((bal_page, bal_index) => {
    if (bal_index > 0) {
      bal_doc.addPage(
        [bal_page.regions.width, bal_page.regions.height],
        bal_page.regions.width > bal_page.regions.height ? 'landscape' : 'portrait'
      );
    }
    bal_draw_furniture(bal_doc, bal_document.settings, bal_page);
    for (const bal_placed of bal_page.chunks) {
      bal_draw_chunk(
        bal_doc,
        bal_document.settings,
        bal_placed,
        bal_page.regions.content.x,
        bal_page.regions.content.width,
        bal_multiple_matrices
      );
    }
  });

  return new Uint8Array(bal_doc.output('arraybuffer'));
}
