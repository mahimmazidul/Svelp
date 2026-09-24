import type { bal_PrintDocument } from './print_layout';
import { bal_rects_overlap } from './print_paper';

export type PrintIssueSeverity = 'error' | 'warning' | 'info';

export type PrintIssueCategory =
  | 'layout'
  | 'scanner'
  | 'identifier'
  | 'margins'
  | 'spacing';

export interface PrintIssue {
  code: string;
  severity: PrintIssueSeverity;
  category: PrintIssueCategory;
  message: string;
  pageNumber: number | null;
  itemId: string | null;
}

export interface PrintReadinessGroup {
  category: PrintIssueCategory;
  label: string;
  errors: number;
  warnings: number;
}

export interface PrintReadinessReport {
  status: 'ready' | 'warnings' | 'errors';
  issues: PrintIssue[];
  groups: PrintReadinessGroup[];
}

const BAL_CATEGORY_LABELS: Record<PrintIssueCategory, string> = {
  layout: 'Layout',
  scanner: 'Scanner geometry',
  identifier: 'Identifiers',
  margins: 'Margins',
  spacing: 'Answer spacing'
};

export function bal_validate_print(bal_doc: bal_PrintDocument): PrintReadinessReport {
  const bal_issues: PrintIssue[] = [];
  const bal_settings = bal_doc.settings;

  const bal_has_content = bal_doc.pages.some((bal_p) => bal_p.chunks.length > 0);
  if (!bal_has_content) {
    bal_issues.push({
      code: 'empty-document',
      severity: 'error',
      category: 'layout',
      message: 'The questionnaire has nothing to print. Add questions in the builder first.',
      pageNumber: null,
      itemId: null
    });
  }

  for (const bal_page of bal_doc.pages) {
    for (const bal_bound of bal_page.geometry.itemBounds) {
      const bal_overflow_bottom =
        bal_bound.rect.y + bal_bound.rect.height >
        bal_page.geometry.contentBounds.y + bal_page.geometry.contentBounds.height + 0.01;
      const bal_overflow_right =
        bal_bound.rect.x + bal_bound.rect.width >
        bal_page.geometry.contentBounds.x + bal_page.geometry.contentBounds.width + 0.01;
      if (bal_overflow_bottom || bal_overflow_right) {
        bal_issues.push({
          code: 'item-overflow',
          severity: 'error',
          category: 'layout',
          message: `A block on page ${bal_page.pageNumber} is larger than the printable area and may be clipped.`,
          pageNumber: bal_page.pageNumber,
          itemId: bal_bound.itemId
        });
      }
    }

    if (bal_settings.scannerMode && bal_page.geometry.alignmentMarkers.length !== 4) {
      bal_issues.push({
        code: 'missing-alignment-markers',
        severity: 'error',
        category: 'scanner',
        message: `Page ${bal_page.pageNumber} has no alignment markers while scanner-readable mode is on.`,
        pageNumber: bal_page.pageNumber,
        itemId: null
      });
    }

    if (bal_settings.showMachineIdentifier && !bal_page.geometry.identifier?.qrBounds) {
      bal_issues.push({
        code: 'missing-identifier',
        severity: 'error',
        category: 'identifier',
        message: `Page ${bal_page.pageNumber} has no machine-readable identifier.`,
        pageNumber: bal_page.pageNumber,
        itemId: null
      });
    }
  }

  if (bal_settings.scannerMode) {
    const bal_min_margin = Math.min(
      bal_settings.margins.top,
      bal_settings.margins.right,
      bal_settings.margins.bottom,
      bal_settings.margins.left
    );
    if (bal_min_margin < 15) {
      bal_issues.push({
        code: 'tight-margin',
        severity: 'warning',
        category: 'margins',
        message: `Margins of ${bal_min_margin} mm are below the recommended 15 mm for scanner-readable forms.`,
        pageNumber: null,
        itemId: null
      });
    }
    if (bal_settings.marker.diameterMm < 4) {
      bal_issues.push({
        code: 'small-marker',
        severity: 'warning',
        category: 'scanner',
        message: `Answer marks of ${bal_settings.marker.diameterMm} mm may be too small for reliable detection. Use at least 4 mm.`,
        pageNumber: null,
        itemId: null
      });
    }
    if (bal_settings.identifier.sizeMm < 18) {
      bal_issues.push({
        code: 'small-identifier',
        severity: 'warning',
        category: 'identifier',
        message: `The page code is ${bal_settings.identifier.sizeMm} mm. Sizes below 18 mm may be hard to read from phone photos.`,
        pageNumber: null,
        itemId: null
      });
    }
  }

  for (const bal_page of bal_doc.pages) {
    const bal_regions = bal_page.geometry.answerRegions;
    for (let bal_i = 0; bal_i < bal_regions.length; bal_i++) {
      for (let bal_j = bal_i + 1; bal_j < bal_regions.length; bal_j++) {
        const bal_a = bal_regions[bal_i];
        const bal_b = bal_regions[bal_j];
        const bal_a_x = bal_a.rect.x;
        const bal_b_x = bal_b.rect.x;
        const bal_adjacent =
          Math.abs(bal_a_x + bal_a.rect.width - bal_b_x) < 0.01 ||
          Math.abs(bal_b_x + bal_b.rect.width - bal_a_x) < 0.01;
        const bal_different_columns =
          bal_a.rowId !== null && bal_b.rowId !== null && bal_a.rowId === bal_b.rowId;
        const bal_tolerance = bal_different_columns && bal_adjacent ? 0.02 : 0.01;
        if (bal_rects_overlap_tolerant(bal_a.rect, bal_b.rect, bal_tolerance)) {
          bal_issues.push({
            code: 'overlapping-regions',
            severity: 'error',
            category: 'scanner',
            message: `Answer areas overlap on page ${bal_page.pageNumber}. Increase spacing or reduce column count.`,
            pageNumber: bal_page.pageNumber,
            itemId: bal_a.itemId
          });
          bal_i = bal_regions.length;
          break;
        }
      }
    }

    for (const bal_region of bal_regions) {
      if (bal_region.markerType === 'bubble' || bal_region.markerType === 'checkbox') {
        if (bal_region.rect.width < bal_settings.marker.diameterMm + bal_settings.marker.regionPaddingMm * 2 - 0.01) {
          bal_issues.push({
            code: 'invalid-region-size',
            severity: 'warning',
            category: 'scanner',
            message: `An answer area on page ${bal_page.pageNumber} is smaller than the configured marker size.`,
            pageNumber: bal_page.pageNumber,
            itemId: bal_region.itemId
          });
          break;
        }
      }
    }

    for (const bal_bound of bal_page.geometry.itemBounds) {
      if (bal_bound.chunkKind === 'signature' && bal_bound.rect.height < 18) {
        bal_issues.push({
          code: 'small-signature',
          severity: 'warning',
          category: 'layout',
          message: `A signature area on page ${bal_page.pageNumber} is under 18 mm tall.`,
          pageNumber: bal_page.pageNumber,
          itemId: bal_bound.itemId
        });
      }
    }

    if (bal_page.header?.logo && bal_settings.scannerMode) {
      for (const bal_marker of bal_page.geometry.alignmentMarkers) {
        if (bal_rects_overlap(bal_page.header.logo.rect, bal_marker.rect)) {
          bal_issues.push({
            code: 'logo-marker-collision',
            severity: 'error',
            category: 'identifier',
            message: `The logo overlaps an alignment marker on page ${bal_page.pageNumber}. Reduce the logo width.`,
            pageNumber: bal_page.pageNumber,
            itemId: null
          });
        }
      }
      if (
        bal_page.geometry.respondentIdBounds &&
        bal_rects_overlap(bal_page.header.logo.rect, bal_page.geometry.respondentIdBounds)
      ) {
        bal_issues.push({
          code: 'logo-respondent-collision',
          severity: 'error',
          category: 'identifier',
          message: `The logo overlaps the respondent ID box on page ${bal_page.pageNumber}. Reduce the logo width.`,
          pageNumber: bal_page.pageNumber,
          itemId: null
        });
      }
    }

    const bal_qr = bal_page.geometry.identifier?.qrBounds;
    if (bal_qr && bal_settings.scannerMode) {
      for (const bal_marker of bal_page.geometry.alignmentMarkers) {
        if (bal_rects_overlap(bal_qr, bal_marker.rect)) {
          bal_issues.push({
            code: 'identifier-marker-collision',
            severity: 'error',
            category: 'identifier',
            message: `The page code overlaps an alignment marker on page ${bal_page.pageNumber}.`,
            pageNumber: bal_page.pageNumber,
            itemId: null
          });
        }
      }
      if (bal_page.geometry.respondentIdBounds && bal_rects_overlap(bal_qr, bal_page.geometry.respondentIdBounds)) {
        bal_issues.push({
          code: 'identifier-respondent-collision',
          severity: 'error',
          category: 'identifier',
          message: `The page code overlaps the respondent ID box on page ${bal_page.pageNumber}.`,
          pageNumber: bal_page.pageNumber,
          itemId: null
        });
      }
    }
  }

  const bal_groups: PrintReadinessGroup[] = (
    ['layout', 'scanner', 'identifier', 'margins', 'spacing'] as PrintIssueCategory[]
  ).map((bal_category) => ({
    category: bal_category,
    label: BAL_CATEGORY_LABELS[bal_category],
    errors: bal_issues.filter((bal_i) => bal_i.category === bal_category && bal_i.severity === 'error').length,
    warnings: bal_issues.filter((bal_i) => bal_i.category === bal_category && bal_i.severity === 'warning').length
  }));

  const bal_has_errors = bal_issues.some((bal_i) => bal_i.severity === 'error');
  const bal_has_warnings = bal_issues.some((bal_i) => bal_i.severity === 'warning');
  return {
    status: bal_has_errors ? 'errors' : bal_has_warnings ? 'warnings' : 'ready',
    issues: bal_issues,
    groups: bal_groups
  };
}

function bal_rects_overlap_tolerant(
  bal_a: { x: number; y: number; width: number; height: number },
  bal_b: { x: number; y: number; width: number; height: number },
  bal_tolerance: number
): boolean {
  return (
    bal_a.x < bal_b.x + bal_b.width - bal_tolerance &&
    bal_a.x + bal_a.width > bal_b.x + bal_tolerance &&
    bal_a.y < bal_b.y + bal_b.height - bal_tolerance &&
    bal_a.y + bal_a.height > bal_b.y + bal_tolerance
  );
}
