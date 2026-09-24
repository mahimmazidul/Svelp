import { describe, expect, it } from 'vitest';
import {
  BAL_PAPER_PRESETS,
  BAL_MARKER_SIZE_MM,
  bal_alignment_marker_layouts,
  bal_normalized_rect,
  bal_page_regions,
  bal_paper_dimensions,
  bal_rect_contains,
  bal_rects_overlap
} from './print_paper';

describe('paper presets', () => {
  it('uses real A4 and Letter dimensions', () => {
    expect(BAL_PAPER_PRESETS.a4).toEqual({ size: 'a4', widthMm: 210, heightMm: 297 });
    expect(BAL_PAPER_PRESETS.letter.heightMm).toBeCloseTo(279.4, 1);
    expect(BAL_PAPER_PRESETS.letter.widthMm).toBeCloseTo(215.9, 1);
  });

  it('swaps dimensions for landscape', () => {
    expect(bal_paper_dimensions('a4', 'portrait')).toEqual({ width: 210, height: 297 });
    expect(bal_paper_dimensions('a4', 'landscape')).toEqual({ width: 297, height: 210 });
    expect(bal_paper_dimensions('letter', 'landscape').width).toBeCloseTo(279.4, 1);
  });
});

describe('page regions', () => {
  it('keeps content inside margins and below the header', () => {
    const bal_regions = bal_page_regions(210, 297, { top: 18, right: 16, bottom: 18, left: 16 }, 11, 10);
    expect(bal_regions.content.x).toBe(16);
    expect(bal_regions.content.y).toBe(29);
    expect(bal_regions.content.width).toBe(178);
    expect(bal_regions.content.height).toBe(297 - 29 - 18 - 10);
    expect(bal_rect_contains(bal_regions.content, bal_regions.safe)).toBe(true);
  });

  it('places the footer above the bottom margin', () => {
    const bal_regions = bal_page_regions(210, 297, { top: 18, right: 16, bottom: 18, left: 16 }, null, 10);
    const bal_footer = bal_regions.footer;
    if (!bal_footer) throw new Error('footer missing');
    expect(bal_footer.y).toBe(269);
    expect(bal_footer.y + bal_footer.height).toBe(279);
    expect(bal_regions.content.height).toBe(297 - 18 - 18 - 10);
  });

  it('returns null header and footer bands when heights are zero', () => {
    const bal_regions = bal_page_regions(210, 297, { top: 18, right: 16, bottom: 18, left: 16 }, 0, 0);
    expect(bal_regions.header).toBeNull();
    expect(bal_regions.footer).toBeNull();
  });
});

describe('normalized coordinates', () => {
  it('maps physical rects into the zero to one cube', () => {
    const bal_norm = bal_normalized_rect({ x: 105, y: 148.5, width: 21, height: 29.7 }, 210, 297);
    expect(bal_norm.x).toBeCloseTo(0.5, 5);
    expect(bal_norm.y).toBeCloseTo(0.5, 5);
    expect(bal_norm.width).toBeCloseTo(0.1, 5);
    expect(bal_norm.height).toBeCloseTo(0.1, 5);
  });
});

describe('alignment markers', () => {
  it('places one filled square marker in each corner inside the margins', () => {
    const bal_markers = bal_alignment_marker_layouts(210, 297, { top: 18, right: 16, bottom: 18, left: 16 });
    expect(bal_markers).toHaveLength(4);
    for (const bal_m of bal_markers) {
      expect(bal_m.rect.width).toBeCloseTo(BAL_MARKER_SIZE_MM, 5);
      expect(bal_m.rect.x).toBeGreaterThanOrEqual(5);
      expect(bal_m.rect.y).toBeGreaterThanOrEqual(5);
      expect(bal_m.rect.x + bal_m.rect.width).toBeLessThanOrEqual(210 - 5);
      expect(bal_m.rect.y + bal_m.rect.height).toBeLessThanOrEqual(297 - 5);
    }
    const bal_corners = bal_markers.map((bal_m) => bal_m.corner).sort();
    expect(bal_corners).toEqual(['bottomLeft', 'bottomRight', 'topLeft', 'topRight']);
  });

  it('keeps markers clear of the content area', () => {
    const bal_margins = { top: 18, right: 16, bottom: 18, left: 16 };
    const bal_regions = bal_page_regions(210, 297, bal_margins, 11, 10);
    for (const bal_m of bal_alignment_marker_layouts(210, 297, bal_margins)) {
      expect(bal_rects_overlap(bal_m.rect, bal_regions.content)).toBe(false);
      expect(bal_rects_overlap(bal_m.rect, bal_regions.footer as { x: number; y: number; width: number; height: number })).toBe(false);
    }
  });
});
