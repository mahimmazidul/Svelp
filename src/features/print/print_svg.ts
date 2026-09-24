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

const BAL_MM_TO_PX = 96 / 25.4;
const BAL_INK = '#191919';
const BAL_SOFT_INK = '#5f5f5f';
const BAL_RULE_INK = '#9a9a9a';
const BAL_PAPER = '#ffffff';

function bal_px(bal_mm: number): number {
  return bal_mm * BAL_MM_TO_PX;
}

function bal_esc(bal_text: string): string {
  return bal_text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bal_font_stack(bal_settings: PrintSettings): string {
  if (bal_settings.theme.fontFamily === 'times') return 'Georgia, Times New Roman, serif';
  if (bal_settings.theme.fontFamily === 'courier') return 'Courier New, monospace';
  return 'Helvetica, Arial, sans-serif';
}

function bal_px_size(bal_settings: PrintSettings, bal_scale = 1): number {
  return bal_settings.theme.baseFontSize * bal_scale * (96 / 72) * 1.18;
}

export interface bal_OverlayFlags {
  contentBounds: boolean;
  safeBounds: boolean;
  answerRegions: boolean;
  itemBounds: boolean;
  quietZone: boolean;
  alignmentMarkers: boolean;
}

function bal_text(
  bal_x: number,
  bal_y: number,
  bal_content: string,
  bal_settings: PrintSettings,
  bal_options: { size?: number; bold?: boolean; color?: string; anchor?: 'start' | 'middle' | 'end'; letter?: number } = {}
): string {
  const bal_attrs = [
    `x="${bal_px(bal_x).toFixed(2)}"`,
    `y="${bal_px(bal_y).toFixed(2)}"`,
    `font-family="${bal_font_stack(bal_settings)}"`,
    `font-size="${bal_px_size(bal_settings, bal_options.size ?? 1).toFixed(1)}"`,
    `fill="${bal_options.color ?? BAL_INK}"`,
    `text-anchor="${bal_options.anchor ?? 'start'}"`,
    'dominant-baseline="text-before-edge"',
    'xml:space="preserve"'
  ];
  if (bal_options.bold) bal_attrs.push('font-weight="600"');
  if (bal_options.letter) bal_attrs.push(`letter-spacing="${bal_options.letter}"`);
  return `<text ${bal_attrs.join(' ')}>${bal_esc(bal_content)}</text>`;
}

function bal_draw_chunk(
  bal_chunk: bal_PrintChunk,
  bal_y: number,
  bal_origin_x: number,
  bal_content_width: number,
  bal_settings: PrintSettings,
  bal_multiple: boolean
): string {
  const bal_x = bal_origin_x;
  switch (bal_chunk.kind) {
    case 'section-head': {
      const bal_head = bal_chunk as bal_SectionHeadChunk;
      const bal_title = bal_head.title.trim().length > 0 ? bal_head.title : `Section ${bal_head.sectionIndex}`;
      const bal_parts: string[] = [];
      bal_parts.push(
        bal_text(bal_x, bal_y, bal_title.toUpperCase(), bal_settings, {
          bold: true,
          size: bal_settings.theme.headingScale,
          letter: 0.4
        })
      );
      let bal_cursor = bal_y + bal_settings.theme.baseFontSize * bal_settings.theme.headingScale * 1.38 * 0.352778;
      for (const bal_line of bal_head.descriptionLines) {
        bal_parts.push(bal_text(bal_x, bal_cursor, bal_line, bal_settings, { color: BAL_SOFT_INK }));
        bal_cursor += bal_settings.theme.baseFontSize * 1.38 * 0.352778;
      }
      bal_parts.push(
        `<line x1="${bal_px(bal_x)}" y1="${bal_px(bal_y + bal_chunk.height - 0.8)}" x2="${bal_px(bal_x + bal_content_width)}" y2="${bal_px(bal_y + bal_chunk.height - 0.8)}" stroke="${BAL_INK}" stroke-width="${Math.max(0.75, bal_settings.theme.lineWeight * 3)}" />`
      );
      return bal_parts.join('');
    }
    case 'instruction': {
      const bal_inst = bal_chunk as bal_InstructionChunk;
      const bal_indent = bal_inst.callout ? 5 : 0;
      const bal_lh = bal_settings.theme.baseFontSize * 1.38 * 0.352778;
      const bal_parts: string[] = [];
      let bal_cursor = bal_y;
      for (const bal_line of bal_inst.headingLines) {
        bal_parts.push(bal_text(bal_x + bal_indent, bal_cursor, bal_line, bal_settings, { bold: true }));
        bal_cursor += bal_lh + 0.6;
      }
      for (const bal_line of bal_inst.bodyLines) {
        bal_parts.push(bal_text(bal_x + bal_indent, bal_cursor, bal_line, bal_settings, { color: BAL_SOFT_INK }));
        bal_cursor += bal_lh;
      }
      if (bal_inst.callout) {
        bal_parts.push(
          `<line x1="${bal_px(bal_x + 1.2)}" y1="${bal_px(bal_y)}" x2="${bal_px(bal_x + 1.2)}" y2="${bal_px(bal_y + bal_chunk.height - 1)}" stroke="${BAL_RULE_INK}" stroke-width="1.6" />`
        );
      }
      return bal_parts.join('');
    }
    case 'question': {
      const bal_q = bal_chunk as bal_QuestionChunk;
      const bal_lh = bal_settings.theme.baseFontSize * 1.38 * 0.352778;
      const bal_parts: string[] = [];
      bal_parts.push(bal_text(bal_x, bal_y, `${bal_q.numberLabel}.`, bal_settings, { bold: true }));
      bal_q.stemLines.forEach((bal_line, bal_i) => {
        bal_parts.push(
          bal_text(bal_x + bal_q.stemIndent, bal_y + bal_i * (bal_lh + 0.6), bal_line, bal_settings, {})
        );
      });
      for (const bal_row of bal_q.optionRows) {
        const bal_cx = bal_x + bal_row.markerX + bal_settings.marker.diameterMm / 2;
        const bal_cy = bal_y + bal_row.markerCenterY;
        const bal_r = bal_settings.marker.diameterMm / 2;
        if (bal_q.itemType === 'multiple_choice') {
          bal_parts.push(
            `<rect x="${bal_px(bal_cx - bal_r)}" y="${bal_px(bal_cy - bal_r)}" width="${bal_px(bal_r * 2)}" height="${bal_px(bal_r * 2)}" fill="none" stroke="${BAL_INK}" stroke-width="${Math.max(0.8, bal_settings.theme.lineWeight * 3)}" />`
          );
        } else {
          bal_parts.push(
            `<circle cx="${bal_px(bal_cx)}" cy="${bal_px(bal_cy)}" r="${bal_px(bal_r)}" fill="none" stroke="${BAL_INK}" stroke-width="${Math.max(0.8, bal_settings.theme.lineWeight * 3)}" />`
          );
        }
        bal_row.labelLines.forEach((bal_line, bal_i) => {
          bal_parts.push(
            bal_text(
              bal_x + bal_row.markerX + bal_settings.marker.diameterMm + 3.2,
              bal_y + bal_row.rowTop + (bal_row.rowHeight - bal_row.labelLines.length * bal_lh) / 2 + bal_i * bal_lh,
              bal_line,
              bal_settings,
              {}
            )
          );
        });
      }
      if (bal_q.tail === 'line') {
        bal_parts.push(
          `<line x1="${bal_px(bal_x + bal_q.stemIndent)}" y1="${bal_px(bal_y + bal_q.tailTop + bal_q.tailHeight)}" x2="${bal_px(bal_x + bal_q.stemIndent + bal_q.tailWidth)}" y2="${bal_px(bal_y + bal_q.tailTop + bal_q.tailHeight)}" stroke="${BAL_SOFT_INK}" stroke-width="1" />`
        );
      } else if (bal_q.tail === 'small-box' || bal_q.tail === 'date-box' || bal_q.tail === 'wide-box') {
        bal_parts.push(
          `<rect x="${bal_px(bal_x + bal_q.stemIndent)}" y="${bal_px(bal_y + bal_q.tailTop)}" width="${bal_px(bal_q.tailWidth)}" height="${bal_px(bal_q.tailHeight)}" fill="none" stroke="${BAL_SOFT_INK}" stroke-width="0.9" />`
        );
        if (bal_q.itemType === 'date') {
          bal_parts.push(
            bal_text(bal_x + bal_q.stemIndent + 2, bal_y + bal_q.tailTop + (bal_q.tailHeight - bal_lh) / 2, 'YYYY-MM-DD', bal_settings, { size: 0.8, color: BAL_RULE_INK })
          );
        }
        if (bal_q.itemType === 'number' && bal_q.unitLabel) {
          bal_parts.push(
            bal_text(bal_x + bal_q.stemIndent + bal_q.tailWidth + 2, bal_y + bal_q.tailTop + (bal_q.tailHeight - bal_lh) / 2, bal_q.unitLabel, bal_settings, { color: BAL_SOFT_INK })
          );
        }
      }
      return bal_parts.join('');
    }
    case 'matrix-head': {
      const bal_head = bal_chunk as bal_MatrixHeadChunk;
      const bal_lh = bal_settings.theme.baseFontSize * 1.38 * 0.352778;
      const bal_parts: string[] = [];
      const bal_heading_size = 1.05;
      bal_parts.push(bal_text(bal_x, bal_y, `${bal_head.numberLabel}.`, bal_settings, { bold: true, size: bal_heading_size }));
      bal_head.stemLines.forEach((bal_line, bal_i) => {
        bal_parts.push(
          bal_text(bal_x + bal_head.stemIndent, bal_y + bal_i * (bal_lh + 0.6), bal_line, bal_settings, { bold: true, size: bal_heading_size })
        );
      });
      const bal_header_top = bal_y + bal_head.height - bal_head.headerHeight;
      bal_head.columnLabels.forEach((bal_lines, bal_col_index) => {
        const bal_col_left =
          bal_x + bal_head.labelColumnWidth + bal_head.columnWidths.slice(0, bal_col_index).reduce((bal_a, bal_b) => bal_a + bal_b, 0);
        bal_lines.forEach((bal_line, bal_line_index) => {
          bal_parts.push(
            bal_text(bal_col_left + bal_head.columnWidths[0] / 2, bal_header_top + bal_line_index * bal_lh, bal_line, bal_settings, {
              bold: true,
              size: 0.85,
              anchor: 'middle'
            })
          );
        });
      });
      bal_parts.push(
        `<line x1="${bal_px(bal_x)}" y1="${bal_px(bal_y + bal_head.height - 0.4)}" x2="${bal_px(bal_x + bal_content_width)}" y2="${bal_px(bal_y + bal_head.height - 0.4)}" stroke="${BAL_INK}" stroke-width="1.1" />`
      );
      return bal_parts.join('');
    }
    case 'matrix-row': {
      const bal_row = bal_chunk as bal_MatrixRowChunk;
      const bal_lh = bal_settings.theme.baseFontSize * 1.38 * 0.352778;
      const bal_parts: string[] = [];
      bal_row.labelLines.forEach((bal_line, bal_i) => {
        bal_parts.push(
          bal_text(bal_x + 2, bal_y + (bal_row.rowHeight - bal_row.labelLines.length * bal_lh) / 2 + bal_i * bal_lh, bal_line, bal_settings, {})
        );
      });
      const bal_r = bal_settings.marker.diameterMm / 2;
      for (let bal_col = 0; bal_col < bal_row.columnCount; bal_col++) {
        const bal_col_width = bal_row.columnWidths[bal_col] ?? bal_row.columnWidths[0];
        const bal_cx = bal_x + bal_row.labelColumnWidth + bal_col * bal_col_width + bal_col_width / 2;
        const bal_cy = bal_y + bal_row.rowHeight / 2;
        if (bal_multiple) {
          bal_parts.push(
            `<rect x="${bal_px(bal_cx - bal_r)}" y="${bal_px(bal_cy - bal_r)}" width="${bal_px(bal_r * 2)}" height="${bal_px(bal_r * 2)}" fill="none" stroke="${BAL_INK}" stroke-width="0.9" />`
          );
        } else {
          bal_parts.push(
            `<circle cx="${bal_px(bal_cx)}" cy="${bal_px(bal_cy)}" r="${bal_px(bal_r)}" fill="none" stroke="${BAL_INK}" stroke-width="0.9" />`
          );
        }
      }
      bal_parts.push(
        `<line x1="${bal_px(bal_x)}" y1="${bal_px(bal_y + bal_row.rowHeight)}" x2="${bal_px(bal_x + bal_content_width)}" y2="${bal_px(bal_y + bal_row.rowHeight)}" stroke="${BAL_RULE_INK}" stroke-width="0.5" />`
      );
      return bal_parts.join('');
    }
    case 'consent-para': {
      const bal_para = bal_chunk as bal_ConsentParaChunk;
      const bal_lh = bal_settings.theme.baseFontSize * 1.38 * 0.352778;
      const bal_parts: string[] = [];
      let bal_cursor = bal_y;
      const bal_is_title = bal_para.bodyLines.length === 0 && bal_para.headingLines.length > 0;
      for (const bal_line of bal_para.headingLines) {
        bal_parts.push(
          bal_text(bal_x, bal_cursor, bal_line, bal_settings, {
            bold: true,
            size: bal_is_title ? bal_settings.theme.headingScale : 1
          })
        );
        bal_cursor += bal_lh * (bal_is_title ? bal_settings.theme.headingScale : 1) + 0.8;
      }
      for (const bal_line of bal_para.bodyLines) {
        bal_parts.push(bal_text(bal_x, bal_cursor, bal_line, bal_settings, {}));
        bal_cursor += bal_lh;
      }
      return bal_parts.join('');
    }
    case 'consent-ack': {
      const bal_ack = bal_chunk as bal_ConsentAckChunk;
      const bal_lh = bal_settings.theme.baseFontSize * 1.38 * 0.352778;
      const bal_side = Math.max(bal_settings.marker.diameterMm, 4.2);
      const bal_parts: string[] = [];
      bal_parts.push(
        `<rect x="${bal_px(bal_x + bal_ack.markerX)}" y="${bal_px(bal_y + bal_ack.markerCenterY - bal_side / 2)}" width="${bal_px(bal_side)}" height="${bal_px(bal_side)}" fill="none" stroke="${BAL_INK}" stroke-width="1.1" />`
      );
      bal_ack.labelLines.forEach((bal_line, bal_i) => {
        bal_parts.push(
          bal_text(
            bal_x + bal_ack.markerX + bal_side + 3,
            bal_y + (bal_ack.height - bal_ack.labelLines.length * bal_lh) / 2 + bal_i * bal_lh,
            bal_line,
            bal_settings,
            { bold: true }
          )
        );
      });
      return bal_parts.join('');
    }
    case 'signature': {
      const bal_sig = bal_chunk as bal_SignatureChunk;
      const bal_lh = bal_settings.theme.baseFontSize * 1.38 * 0.352778;
      const bal_parts: string[] = [];
      let bal_cursor = bal_y;
      bal_parts.push(bal_text(bal_x, bal_cursor, bal_sig.roleLabel, bal_settings, { bold: true }));
      bal_cursor += bal_lh + 4.5;
      const bal_line_width = 60;
      bal_parts.push(
        `<line x1="${bal_px(bal_x + 2)}" y1="${bal_px(bal_cursor)}" x2="${bal_px(bal_x + 2 + bal_line_width)}" y2="${bal_px(bal_cursor)}" stroke="${BAL_INK}" stroke-width="1" />`
      );
      bal_parts.push(bal_text(bal_x + 2, bal_cursor + 1, 'Signature', bal_settings, { size: 0.8, color: BAL_SOFT_INK }));
      if (bal_sig.includeDate) {
        const bal_date_x = bal_x + bal_content_width - 34;
        bal_parts.push(
          `<line x1="${bal_px(bal_date_x)}" y1="${bal_px(bal_cursor)}" x2="${bal_px(bal_date_x + 34)}" y2="${bal_px(bal_cursor)}" stroke="${BAL_INK}" stroke-width="1" />`
        );
        bal_parts.push(bal_text(bal_date_x, bal_cursor + 1, 'Date', bal_settings, { size: 0.8, color: BAL_SOFT_INK }));
      }
      bal_cursor += bal_lh + 4.2;
      if (bal_sig.includePrintedName) {
        bal_parts.push(
          `<line x1="${bal_px(bal_x + 2)}" y1="${bal_px(bal_cursor)}" x2="${bal_px(bal_x + 2 + bal_line_width)}" y2="${bal_px(bal_cursor)}" stroke="${BAL_SOFT_INK}" stroke-width="0.8" />`
        );
        bal_parts.push(bal_text(bal_x + 2, bal_cursor + 1, 'Printed name', bal_settings, { size: 0.8, color: BAL_SOFT_INK }));
      }
      return bal_parts.join('');
    }
  }
  return '';
}

function bal_draw_furniture(bal_page: bal_PrintRenderPage, bal_settings: PrintSettings): string {
  const bal_parts: string[] = [];
  const bal_regions = bal_page.regions;
  if (bal_page.header && bal_regions.header) {
    const bal_header = bal_page.header;
    let bal_cursor = bal_regions.header.y;
    if (bal_header.titleText) {
      bal_parts.push(
        bal_text(bal_regions.header.x, bal_cursor, bal_header.titleText, bal_settings, {
          bold: true,
          size: bal_settings.theme.headingScale
        })
      );
      bal_cursor += bal_settings.theme.baseFontSize * bal_settings.theme.headingScale * 1.38 * 0.352778;
    }
    if (bal_header.institutionText) {
      bal_parts.push(bal_text(bal_regions.header.x, bal_cursor, bal_header.institutionText, bal_settings, { color: BAL_SOFT_INK }));
    }
    const bal_meta: string[] = [];
    if (bal_header.versionText) bal_meta.push(bal_header.versionText);
    if (bal_header.studyCodeText) bal_meta.push(bal_header.studyCodeText);
    const bal_meta_x = bal_header.respondentBox
      ? bal_header.respondentBox.x - 4
      : bal_regions.header.x + bal_regions.header.width;
    const bal_meta_y = bal_regions.header?.y ?? 0;
    bal_meta.forEach((bal_line, bal_i) => {
      bal_parts.push(
        bal_text(bal_meta_x, bal_meta_y + bal_i * 4, bal_line, bal_settings, {
          size: 0.8,
          anchor: 'end',
          color: BAL_SOFT_INK
        })
      );
    });
    if (bal_header.respondentBox && bal_header.respondentLabel) {
      bal_parts.push(
        `<rect x="${bal_px(bal_header.respondentBox.x)}" y="${bal_px(bal_header.respondentBox.y)}" width="${bal_px(bal_header.respondentBox.width)}" height="${bal_px(bal_header.respondentBox.height)}" fill="none" stroke="${BAL_SOFT_INK}" stroke-width="0.9" />`
      );
      bal_parts.push(
        bal_text(bal_header.respondentBox.x + 1.5, bal_header.respondentBox.y + 0.8, bal_header.respondentLabel, bal_settings, {
          size: 0.68,
          color: BAL_SOFT_INK
        })
      );
    }
  }

  if (bal_page.footer && bal_regions.footer) {
    const bal_footer = bal_page.footer;
    let bal_left_x = bal_regions.footer.x;
    if (bal_footer.humanReadable) {
      bal_parts.push(bal_text(bal_left_x, bal_regions.footer.y + 1, bal_footer.humanReadable, bal_settings, { size: 0.8 }));
      bal_left_x += 34;
    }
    if (bal_footer.studyCodeText) {
      const bal_qr_left = bal_page.identifier?.qrBounds?.x ?? bal_regions.footer.x + bal_regions.footer.width;
      bal_parts.push(
        bal_text(bal_qr_left - 2, bal_regions.footer.y + 1, bal_footer.studyCodeText, bal_settings, { size: 0.8, anchor: 'end', color: BAL_SOFT_INK })
      );
    }
    if (bal_footer.pageText) {
      const bal_qr_width = bal_page.identifier?.qrBounds?.width ?? 0;
      bal_parts.push(
        bal_text(
          bal_regions.footer.x + (bal_regions.footer.width - bal_qr_width) / 2,
          bal_regions.footer.y + 1,
          bal_footer.pageText,
          bal_settings,
          { size: 0.8, anchor: 'middle', color: BAL_SOFT_INK }
        )
      );
    }
    if (bal_footer.confidentialityLines.length > 0) {
      const bal_conf_y = bal_regions.footer?.y ?? 0;
      bal_footer.confidentialityLines.forEach((bal_line, bal_i) => {
        bal_parts.push(
          bal_text(bal_left_x, bal_conf_y + 1 + 4.4 + bal_i * 3.6, bal_line, bal_settings, { size: 0.7, color: BAL_RULE_INK })
        );
      });
    }
  }

  if (bal_page.identifier?.qrBounds && bal_page.qrModules) {
    const bal_bounds = bal_page.identifier.qrBounds;
    const bal_total = bal_page.qrModules.length + bal_page.identifier.quietZoneModules * 2;
    const bal_module = bal_bounds.width / bal_total;
    const bal_rects: string[] = [];
    for (let bal_row = 0; bal_row < bal_page.qrModules.length; bal_row++) {
      for (let bal_col = 0; bal_col < bal_page.qrModules.length; bal_col++) {
        if (!bal_page.qrModules[bal_row][bal_col]) continue;
        bal_rects.push(
          `M${bal_px(bal_bounds.x + (bal_col + bal_page.identifier.quietZoneModules) * bal_module).toFixed(2)} ${bal_px(bal_bounds.y + (bal_row + bal_page.identifier.quietZoneModules) * bal_module).toFixed(2)}h${(bal_px(bal_module) + 0.01).toFixed(2)}v${(bal_px(bal_module) + 0.01).toFixed(2)}h-${(bal_px(bal_module) + 0.01).toFixed(2)}z`
        );
      }
    }
    bal_parts.push(`<path d="${bal_rects.join('')}" fill="#000000" />`);
  }

  for (const bal_marker of bal_page.alignmentMarkers) {
    bal_parts.push(
      `<rect x="${bal_px(bal_marker.rect.x)}" y="${bal_px(bal_marker.rect.y)}" width="${bal_px(bal_marker.rect.width)}" height="${bal_px(bal_marker.rect.height)}" fill="#000000" />`
    );
  }
  return bal_parts.join('');
}

function bal_draw_overlays(
  bal_page: bal_PrintRenderPage,
  bal_flags: bal_OverlayFlags
): string {
  const bal_parts: string[] = [];
  const bal_regions = bal_page.regions;
  const bal_box = (bal_rect: { x: number; y: number; width: number; height: number }, bal_color: string, bal_dash = '4 3'): string =>
    `<rect x="${bal_px(bal_rect.x)}" y="${bal_px(bal_rect.y)}" width="${bal_px(bal_rect.width)}" height="${bal_px(bal_rect.height)}" fill="none" stroke="${bal_color}" stroke-width="0.8" stroke-dasharray="${bal_dash}" />`;
  if (bal_flags.contentBounds) {
    bal_parts.push(bal_box(bal_regions.content, '#2563eb'));
  }
  if (bal_flags.safeBounds) {
    bal_parts.push(bal_box(bal_regions.safe, '#16a34a'));
  }
  if (bal_flags.answerRegions) {
    for (const bal_region of bal_page.geometry.answerRegions) {
      bal_parts.push(bal_box(bal_region.rect, '#dc2626', '2 2'));
    }
  }
  if (bal_flags.itemBounds) {
    for (const bal_bound of bal_page.geometry.itemBounds) {
      bal_parts.push(bal_box(bal_bound.rect, '#9333ea', '6 3'));
    }
  }
  if (bal_flags.quietZone && bal_page.identifier?.qrBounds) {
    const bal_qr = bal_page.identifier.qrBounds;
    const bal_total = (bal_page.qrModules?.length ?? 0) + bal_page.identifier.quietZoneModules * 2;
    const bal_module = bal_qr.width / bal_total;
    const bal_quiet_mm = bal_module * bal_page.identifier.quietZoneModules;
    bal_parts.push(
      bal_box(
        { x: bal_qr.x - bal_quiet_mm, y: bal_qr.y - bal_quiet_mm, width: bal_qr.width + bal_quiet_mm * 2, height: bal_qr.height + bal_quiet_mm * 2 },
        '#ea580c'
      )
    );
  }
  return bal_parts.join('');
}

export function bal_page_svg(
  bal_page: bal_PrintRenderPage,
  bal_doc: bal_PrintDocument,
  bal_overlays: bal_OverlayFlags | null
): string {
  const bal_settings = bal_doc.settings;
  const bal_multiple = new Set(bal_doc.matrixMultipleItemIds);
  const bal_parts: string[] = [];
  bal_parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bal_px(bal_page.regions.width).toFixed(2)} ${bal_px(bal_page.regions.height).toFixed(2)}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`
  );
  bal_parts.push(`<rect x="0" y="0" width="100%" height="100%" fill="${BAL_PAPER}" />`);
  for (const bal_placed of bal_page.chunks) {
    bal_parts.push(
      bal_draw_chunk(bal_placed.chunk, bal_placed.y, bal_page.regions.content.x, bal_page.regions.content.width, bal_settings, bal_multiple.has(bal_placed.chunk.itemId as string))
    );
  }
  bal_parts.push(bal_draw_furniture(bal_page, bal_settings));
  if (bal_overlays) {
    bal_parts.push(bal_draw_overlays(bal_page, bal_overlays));
  }
  bal_parts.push('</svg>');
  return bal_parts.join('');
}
