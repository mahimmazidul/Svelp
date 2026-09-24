import type { Orientation, PaperSize } from '../../models/types';

export interface PhysicalRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PrintMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PaperPreset {
  size: PaperSize;
  widthMm: number;
  heightMm: number;
}

export interface PageRegions {
  width: number;
  height: number;
  margins: PrintMargins;
  content: PhysicalRect;
  header: PhysicalRect | null;
  footer: PhysicalRect | null;
  safe: PhysicalRect;
}

export interface AlignmentMarkerLayout {
  corner: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  rect: PhysicalRect;
}

export const BAL_PAPER_PRESETS: Record<PaperSize, PaperPreset> = {
  a4: { size: 'a4', widthMm: 210, heightMm: 297 },
  letter: { size: 'letter', widthMm: 215.9, heightMm: 279.4 }
};

export const BAL_MM_PER_INCH = 25.4;
export const BAL_PT_TO_MM = BAL_MM_PER_INCH / 72;

export const BAL_DEFAULT_MARGINS: PrintMargins = {
  top: 18,
  right: 16,
  bottom: 18,
  left: 16
};

export const BAL_MIN_MARGIN_MM = 10;
export const BAL_SCANNER_MIN_MARGIN_MM = 15;
export const BAL_SAFE_PADDING_MM = 3;
export const BAL_MARKER_SIZE_MM = 7;
export const BAL_MARKER_MIN_INSET_MM = 5;
export const BAL_HEADER_HEIGHT_MM = 11;
export const BAL_FOOTER_HEIGHT_MM = 10;

export function bal_paper_dimensions(
  bal_size: PaperSize,
  bal_orientation: Orientation
): { width: number; height: number } {
  const bal_preset = BAL_PAPER_PRESETS[bal_size];
  if (bal_orientation === 'landscape') {
    return { width: bal_preset.heightMm, height: bal_preset.widthMm };
  }
  return { width: bal_preset.widthMm, height: bal_preset.heightMm };
}

export function bal_page_regions(
  bal_width: number,
  bal_height: number,
  bal_margins: PrintMargins,
  bal_header_height: number | null,
  bal_footer_height: number | null
): PageRegions {
  const bal_header = bal_header_height && bal_header_height > 0
    ? { x: bal_margins.left, y: bal_margins.top, width: bal_width - bal_margins.left - bal_margins.right, height: bal_header_height }
    : null;
  const bal_footer = bal_footer_height && bal_footer_height > 0
    ? { x: bal_margins.left, y: bal_height - bal_margins.bottom - bal_footer_height, width: bal_width - bal_margins.left - bal_margins.right, height: bal_footer_height }
    : null;
  const bal_content_top = bal_margins.top + (bal_header ? bal_header_height as number : 0);
  const bal_content_height = bal_height - bal_content_top - bal_margins.bottom - (bal_footer ? bal_footer_height as number : 0);
  const bal_content: PhysicalRect = {
    x: bal_margins.left,
    y: bal_content_top,
    width: bal_width - bal_margins.left - bal_margins.right,
    height: bal_content_height
  };
  return {
    width: bal_width,
    height: bal_height,
    margins: bal_margins,
    content: bal_content,
    header: bal_header,
    footer: bal_footer,
    safe: {
      x: bal_content.x + BAL_SAFE_PADDING_MM,
      y: bal_content.y + BAL_SAFE_PADDING_MM,
      width: Math.max(0, bal_content.width - BAL_SAFE_PADDING_MM * 2),
      height: Math.max(0, bal_content.height - BAL_SAFE_PADDING_MM * 2)
    }
  };
}

export function bal_normalized_rect(
  bal_rect: PhysicalRect,
  bal_page_width: number,
  bal_page_height: number
): NormalizedRect {
  return {
    x: bal_rect.x / bal_page_width,
    y: bal_rect.y / bal_page_height,
    width: bal_rect.width / bal_page_width,
    height: bal_rect.height / bal_page_height
  };
}

function bal_marker_offset(bal_margin: number): number {
  return Math.max(BAL_MARKER_MIN_INSET_MM, bal_margin / 2 - BAL_MARKER_SIZE_MM / 2);
}

export function bal_alignment_marker_layouts(
  bal_width: number,
  bal_height: number,
  bal_margins: PrintMargins
): AlignmentMarkerLayout[] {
  const bal_left = bal_marker_offset(bal_margins.left);
  const bal_top = bal_marker_offset(bal_margins.top);
  const bal_right = bal_width - bal_marker_offset(bal_margins.right) - BAL_MARKER_SIZE_MM;
  const bal_bottom = bal_height - bal_marker_offset(bal_margins.bottom) - BAL_MARKER_SIZE_MM;
  return [
    { corner: 'topLeft', rect: { x: bal_left, y: bal_top, width: BAL_MARKER_SIZE_MM, height: BAL_MARKER_SIZE_MM } },
    { corner: 'topRight', rect: { x: bal_right, y: bal_top, width: BAL_MARKER_SIZE_MM, height: BAL_MARKER_SIZE_MM } },
    { corner: 'bottomLeft', rect: { x: bal_left, y: bal_bottom, width: BAL_MARKER_SIZE_MM, height: BAL_MARKER_SIZE_MM } },
    { corner: 'bottomRight', rect: { x: bal_right, y: bal_bottom, width: BAL_MARKER_SIZE_MM, height: BAL_MARKER_SIZE_MM } }
  ];
}

export function bal_rects_overlap(bal_a: PhysicalRect, bal_b: PhysicalRect): boolean {
  return (
    bal_a.x < bal_b.x + bal_b.width &&
    bal_a.x + bal_a.width > bal_b.x &&
    bal_a.y < bal_b.y + bal_b.height &&
    bal_a.y + bal_a.height > bal_b.y
  );
}

export function bal_rect_contains(bal_outer: PhysicalRect, bal_inner: PhysicalRect): boolean {
  return (
    bal_inner.x >= bal_outer.x &&
    bal_inner.y >= bal_outer.y &&
    bal_inner.x + bal_inner.width <= bal_outer.x + bal_outer.width &&
    bal_inner.y + bal_inner.height <= bal_outer.y + bal_outer.height
  );
}
