import type { PrintLayoutRecord } from '../../models/print_models';

export interface ResolvedLayoutMatch {
  layout: PrintLayoutRecord;
  pageCount: number;
  studyCode: string;
  version: number;
  orientation: 'portrait' | 'landscape';
  paperSize: 'a4' | 'letter';
}

export function bal_layout_study_code(bal_layout: PrintLayoutRecord): string {
  return bal_layout.geometry.pages[0]?.identifier?.payload.split('|')[1] ?? '';
}

export function bal_layout_page_count(bal_layout: PrintLayoutRecord): number {
  return bal_layout.geometry.pageCount > 0
    ? bal_layout.geometry.pageCount
    : bal_layout.geometry.pages.length;
}

export function bal_resolve_layouts_for_payload(
  bal_identifier: { studyCode: string; version: number; pageNumber: number },
  bal_layouts: PrintLayoutRecord[]
): { matches: ResolvedLayoutMatch[]; pageCountMismatch: boolean } {
  const bal_matches: ResolvedLayoutMatch[] = [];
  let bal_page_count_mismatch = false;
  for (const bal_layout of bal_layouts) {
    if (bal_layout.paperSize !== bal_layout.paperSize) continue;
    const bal_count = bal_layout_page_count(bal_layout);
    const bal_page = bal_layout.geometry.pages[Math.min(bal_identifier.pageNumber, bal_count) - 1];
    if (!bal_page?.identifier?.payload) continue;
    const bal_parts = bal_page.identifier.payload.split('|');
    if (bal_parts.length < 3) continue;
    if (bal_parts[1] !== bal_identifier.studyCode) continue;
    if (Number(bal_parts[2]) !== bal_identifier.version) continue;
    if (bal_identifier.pageNumber > bal_count) {
      bal_page_count_mismatch = true;
      continue;
    }
    bal_matches.push({
      layout: bal_layout,
      pageCount: bal_count,
      studyCode: bal_identifier.studyCode,
      version: bal_identifier.version,
      orientation: bal_layout.orientation,
      paperSize: bal_layout.paperSize
    });
  }
  return { matches: bal_matches, pageCountMismatch: bal_page_count_mismatch };
}

export function bal_layout_marker_centers(
  bal_layout: PrintLayoutRecord,
  bal_page_number: number
): { x: number; y: number }[] {
  const bal_page =
    bal_layout.geometry.pages[Math.max(0, Math.min(bal_page_number, bal_layout.geometry.pages.length) - 1)];
  if (!bal_page) return [];
  return bal_page.alignmentMarkers.map((bal_m) => ({
    x: bal_m.rect.x + bal_m.rect.width / 2,
    y: bal_m.rect.y + bal_m.rect.height / 2
  }));
}

export function bal_layout_qr_bounds(bal_layout: PrintLayoutRecord, bal_page_number: number) {
  return (
    bal_layout.geometry.pages[
      Math.max(0, Math.min(bal_page_number, bal_layout.geometry.pages.length) - 1)
    ]?.identifier?.qrBounds ?? null
  );
}
