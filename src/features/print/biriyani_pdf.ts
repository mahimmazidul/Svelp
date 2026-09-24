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

interface bal_PdfDoc extends bal_PdfWriter {
  addPage(format: [number, number], orientation: 'portrait' | 'landscape'): void;
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

function bal_draw_text(
  bal_doc: bal_PdfDoc,
  bal_settings: PrintSettings,
  bal_text: string,
  bal_x: number,
  bal_y: number,
  bal_options: { size?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; color?: number } = {}
): void {
  bal_doc.setFont(bal_settings.theme.fontFamily, bal_font_style(bal_settings, bal_options.bold ?? false));
  bal_doc.setFontSize(bal_options.size ?? bal_settings.theme.baseFontSize);
  const bal_ink = bal_options.color ?? BAL_INK;
  bal_doc.setTextColor(bal_ink, bal_ink, bal_ink);
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
    let bal_y = bal_regions.header.y;
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
  return new jsPDF({
    unit: 'mm',
    format: [bal_first.regions.width, bal_first.regions.height],
    orientation: bal_first.regions.width > bal_first.regions.height ? 'landscape' : 'portrait',
    compress: true
  }) as unknown as bal_PdfDoc;
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
  const bal_doc = await bal_create_doc(bal_documents[0]);
  bal_draw_pages(bal_doc, bal_documents[0], false);
  for (let bal_i = 1; bal_i < bal_documents.length; bal_i++) {
    bal_draw_pages(bal_doc, bal_documents[bal_i], true);
  }
  return new Uint8Array(bal_doc.output('arraybuffer'));
}

export async function hati_pdf_bytes(bal_document: bal_PrintDocument): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf');
  const bal_first = bal_document.pages[0];
  const bal_doc: bal_PdfDoc = new jsPDF({
    unit: 'mm',
    format: [bal_first.regions.width, bal_first.regions.height],
    orientation: bal_first.regions.width > bal_first.regions.height ? 'landscape' : 'portrait',
    compress: true
  }) as unknown as bal_PdfDoc;

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
