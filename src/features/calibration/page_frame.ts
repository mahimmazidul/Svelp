import { bal_qr_matrix } from '../print/print_qr';
import type { bal_PrintDocument } from '../print/print_layout';
import {
  bal_render_blank_instrument,
  bal_render_marked_scan,
  type bal_MarkSpec,
  type bal_ReadingRegion,
  type bal_SyntheticPage
} from '../reading/reading_fixtures';
import { bal_reading_regions_for_page } from '../reading/reading_geometry';

export interface bal_CanonicalPhoto {
  blank: bal_SyntheticPage;
  regions: bal_ReadingRegion[];
  markerCentersMm: { x: number; y: number }[];
  qrCenterMm: { x: number; y: number } | undefined;
  widthMm: number;
  heightMm: number;
}

function bal_lcg(bal_seed: number): () => number {
  let bal_state = bal_seed >>> 0;
  return () => {
    bal_state = (bal_state * 1664525 + 1013904223) >>> 0;
    return bal_state / 4294967296;
  };
}

function bal_draw_content_lines(
  bal_page: bal_SyntheticPage,
  bal_regions: bal_ReadingRegion[],
  bal_width_mm: number,
  bal_height_mm: number,
  bal_ppm: number,
  bal_page_number: number
): void {
  const bal_random = bal_lcg(bal_page_number * 7919 + 13);
  const bal_margin = 16;
  const bal_top = 26;
  const bal_bottom = bal_height_mm - 24;
  const bal_line_step = 5.2;
  const bal_line_height = 1.3;
  let bal_y = bal_top;
  while (bal_y < bal_bottom) {
    const bal_indent = bal_random() < 0.25 ? bal_margin + 8 + bal_random() * 10 : bal_margin;
    const bal_width = (bal_width_mm - bal_margin - 6 - bal_indent) * (0.55 + bal_random() * 0.45);
    const bal_segments: [number, number][] = [[bal_indent, bal_indent + bal_width]];
    for (const bal_region of bal_regions) {
      const bal_r = bal_region.rectMm;
      const bal_next: [number, number][] = [];
      for (const [bal_s0, bal_s1] of bal_segments) {
        if (bal_r.y - 1.5 > bal_y + bal_line_height || bal_r.y + bal_r.height + 1.5 < bal_y) {
          bal_next.push([bal_s0, bal_s1]);
          continue;
        }
        const bal_cut0 = bal_r.x - 1.5;
        const bal_cut1 = bal_r.x + bal_r.width + 1.5;
        if (bal_cut1 <= bal_s0 || bal_cut0 >= bal_s1) {
          bal_next.push([bal_s0, bal_s1]);
          continue;
        }
        if (bal_cut0 > bal_s0) bal_next.push([bal_s0, bal_cut0]);
        if (bal_cut1 < bal_s1) bal_next.push([bal_cut1, bal_s1]);
      }
      bal_segments.length = 0;
      bal_segments.push(...bal_next);
    }
    for (const [bal_s0, bal_s1] of bal_segments) {
      bal_fill_rect_px(
        bal_page,
        bal_s0 * bal_ppm,
        bal_y * bal_ppm,
        bal_s1 * bal_ppm,
        (bal_y + bal_line_height) * bal_ppm,
        165
      );
    }
    bal_y += bal_line_step;
  }
}

function bal_fill_rect_px(
  bal_page: bal_SyntheticPage,
  bal_x0: number,
  bal_y0: number,
  bal_x1: number,
  bal_y1: number,
  bal_value: number
): void {
  for (let bal_y = Math.max(0, Math.round(bal_y0)); bal_y < Math.min(bal_page.height, bal_y1); bal_y++) {
    for (let bal_x = Math.max(0, Math.round(bal_x0)); bal_x < Math.min(bal_page.width, bal_x1); bal_x++) {
      const bal_index = (bal_y * bal_page.width + bal_x) * 4;
      bal_page.data[bal_index] = bal_value;
      bal_page.data[bal_index + 1] = bal_value;
      bal_page.data[bal_index + 2] = bal_value;
    }
  }
}

export function bal_compose_blank_photo(
  bal_doc: bal_PrintDocument,
  bal_page_number: number,
  bal_ppm: number
): bal_CanonicalPhoto | null {
  const bal_page = bal_doc.pages.find((bal_p) => bal_p.pageNumber === bal_page_number);
  if (!bal_page) return null;
  const bal_regions = bal_reading_regions_for_page(bal_doc, bal_page_number);
  const bal_width_mm = bal_page.regions.width;
  const bal_height_mm = bal_page.regions.height;
  const bal_blank = bal_render_blank_instrument(bal_regions, bal_ppm, bal_width_mm, bal_height_mm);
  bal_draw_content_lines(bal_blank, bal_regions, bal_width_mm, bal_height_mm, bal_ppm, bal_page_number);
  for (const bal_marker of bal_page.alignmentMarkers) {
    bal_fill_rect_px(
      bal_blank,
      bal_marker.rect.x * bal_ppm,
      bal_marker.rect.y * bal_ppm,
      (bal_marker.rect.x + bal_marker.rect.width) * bal_ppm,
      (bal_marker.rect.y + bal_marker.rect.height) * bal_ppm,
      0
    );
  }
  let bal_qr_center: { x: number; y: number } | undefined;
  const bal_identifier = bal_page.identifier;
  const bal_bounds = bal_identifier?.qrBounds ?? null;
  if (bal_bounds && bal_page.qrModules) {
    const bal_quiet = 4;
    const bal_total = bal_page.qrModules.length + bal_quiet * 2;
    const bal_module = bal_bounds.width / bal_total;
    for (let bal_row = 0; bal_row < bal_page.qrModules.length; bal_row++) {
      for (let bal_col = 0; bal_col < bal_page.qrModules.length; bal_col++) {
        if (!bal_page.qrModules[bal_row][bal_col]) continue;
        bal_fill_rect_px(
          bal_blank,
          (bal_bounds.x + (bal_col + bal_quiet) * bal_module) * bal_ppm,
          (bal_bounds.y + (bal_row + bal_quiet) * bal_module) * bal_ppm,
          (bal_bounds.x + (bal_col + bal_quiet + 1) * bal_module) * bal_ppm,
          (bal_bounds.y + (bal_row + bal_quiet + 1) * bal_module) * bal_ppm,
          0
        );
      }
    }
    bal_qr_center = { x: bal_bounds.x + bal_bounds.width / 2, y: bal_bounds.y + bal_bounds.height / 2 };
  }
  const bal_centers = [...bal_page.alignmentMarkers]
    .sort((bal_a, bal_b) => bal_a.rect.y - bal_b.rect.y || bal_a.rect.x - bal_b.rect.x)
    .map((bal_m) => ({
      x: bal_m.rect.x + bal_m.rect.width / 2,
      y: bal_m.rect.y + bal_m.rect.height / 2
    }));
  return {
    blank: bal_blank,
    regions: bal_regions,
    markerCentersMm: [bal_centers[0], bal_centers[1], bal_centers[3], bal_centers[2]],
    qrCenterMm: bal_qr_center,
    widthMm: bal_width_mm,
    heightMm: bal_height_mm
  };
}

export function bal_paint_marks(
  bal_blank: bal_SyntheticPage,
  bal_regions: bal_ReadingRegion[],
  bal_marks: bal_MarkSpec[],
  bal_ppm: number,
  bal_noise_seed = 7
): bal_SyntheticPage {
  return bal_render_marked_scan(bal_blank, bal_regions, bal_marks, bal_ppm, {
    noiseSeed: bal_noise_seed
  });
}

export { bal_qr_matrix };
