import type { QualityResult, ScanBatchRecord, ScanBatchSummary, ScanIssueCategory, ScanPageRecord, ScanTransformRecord } from '../models/scan_models';
import { bal_parse_page_payload, type ScanPageIdentifier } from '../features/scan/scan_payload';
import { bal_resolve_layouts_for_payload, type ResolvedLayoutMatch } from '../features/scan/scan_resolve';
import type { PrintLayoutRecord } from '../models/print_models';
import { bal_save_audit_event, bal_save_scan_batch, bal_save_scan_page, dhon_scan_page, ken_pori_scan_pages } from '../db/scan_repo';
function bal_plain<T>(bal_value: T): T {
  return JSON.parse(JSON.stringify(bal_value)) as T;
}

export interface bal_ProcessorInput {
  imageData: { data: Uint8ClampedArray; width: number; height: number };
  spec: {
    centersMm: { x: number; y: number }[];
    widthMm: number;
    heightMm: number;
    qrCenterMm?: { x: number; y: number };
  };
  outWidthPx: number;
  outHeightPx: number;
  pxPerMm: number;
  manualCorners?: { x: number; y: number }[] | null;
  keyRegions?: { rect: { x: number; y: number; width: number; height: number }; kind: 'marker' | 'qr' }[];
}

export interface bal_ProcessorResult {
  found: boolean;
  confidence: 'high' | 'inferred' | 'manual' | 'failed';
  markersFound: number;
  rotationApplied: 0 | 90 | 180 | 270;
  homography: number[] | null;
  normalized: { data: Uint8ClampedArray; width: number; height: number } | null;
  payloads: string[];
  orientationConfirmed: boolean;
  inferenceNote: string | null;
  residualPx: number;
  quality: QualityResult;
}

export type bal_ScanProcessor = (bal_input: bal_ProcessorInput) => Promise<bal_ProcessorResult>;

export const BAL_CANONICAL_PX_PER_MM = 5.9;

export function bal_canonical_dimensions(
  bal_paper: 'a4' | 'letter',
  bal_orientation: 'portrait' | 'landscape'
): { width: number; height: number } {
  const bal_portrait = bal_paper === 'a4' ? { width: 1240, height: 1754 } : { width: 1275, height: 1650 };
  if (bal_orientation === 'landscape') {
    return { width: bal_portrait.height, height: bal_portrait.width };
  }
  return bal_portrait;
}

export function bal_new_id(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function bal_hash_bytes(bal_bytes: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bal_digest = await crypto.subtle.digest('SHA-256', bal_bytes);
    return [...new Uint8Array(bal_digest)]
      .map((bal_byte) => bal_byte.toString(16).padStart(2, '0'))
      .join('');
  }
  let bal_h1 = 0x811c9dc5;
  let bal_h2 = 0x01000193;
  const bal_view = new Uint8Array(bal_bytes);
  for (let bal_i = 0; bal_i < bal_view.length; bal_i++) {
    bal_h1 = ((bal_h1 ^ bal_view[bal_i]) * 0x01000193) >>> 0;
    bal_h2 = ((bal_h2 + bal_view[bal_i] * (bal_i + 1)) * 0x85ebca6b) >>> 0;
  }
  return `fnv-${bal_h1.toString(16)}${bal_h2.toString(16)}`;
}

export function bal_empty_summary(): ScanBatchSummary {
  return {
    totalPages: 0,
    ready: 0,
    needsReview: 0,
    duplicates: 0,
    failed: 0,
    unsupported: 0,
    queued: 0,
    respondents: 0,
    complete: 0,
    incomplete: 0
  };
}

export interface bal_GroupedRespondent {
  questionnaireId: string;
  questionnaireVersion: number;
  respondentId: string;
  pages: ScanPageRecord[];
  missingPages: number[];
  duplicatePages: number[];
  versionConflicts: boolean;
}

export function bal_group_pages(
  bal_pages: ScanPageRecord[],
  bal_expected_counts: Map<string, number>
): bal_GroupedRespondent[] {
  const bal_groups = new Map<string, bal_GroupedRespondent>();
  for (const bal_page of bal_pages) {
    if (!bal_page.questionnaireId || bal_page.respondentId === null || !bal_page.pageNumber) continue;
    const bal_key = `${bal_page.questionnaireId}|${bal_page.questionnaireVersion}|${bal_page.respondentId}`;
    let bal_group = bal_groups.get(bal_key);
    if (!bal_group) {
      bal_group = {
        questionnaireId: bal_page.questionnaireId,
        questionnaireVersion: bal_page.questionnaireVersion as number,
        respondentId: bal_page.respondentId,
        pages: [],
        missingPages: [],
        duplicatePages: [],
        versionConflicts: false
      };
      bal_groups.set(bal_key, bal_group);
    }
    bal_group.pages.push(bal_page);
  }
  const bal_out = [...bal_groups.values()];
  for (const bal_group of bal_out) {
    bal_group.pages.sort((bal_a, bal_b) => (bal_a.pageNumber as number) - (bal_b.pageNumber as number));
    const bal_counts = new Map<number, number>();
    for (const bal_page of bal_group.pages) {
      bal_counts.set(bal_page.pageNumber as number, (bal_counts.get(bal_page.pageNumber as number) ?? 0) + 1);
    }
    const bal_expected =
      bal_expected_counts.get(`${bal_group.questionnaireId}|${bal_group.questionnaireVersion}`) ?? null;
    if (bal_expected !== null) {
      for (let bal_p = 1; bal_p <= bal_expected; bal_p++) {
        if (!bal_counts.has(bal_p)) bal_group.missingPages.push(bal_p);
      }
    }
    bal_group.duplicatePages = [...bal_counts.entries()].filter(([_bal_p, bal_c]) => bal_c > 1).map(([bal_p]) => bal_p);
    const bal_versions = new Set(
      bal_pages
        .filter((bal_p) => bal_p.respondentId === bal_group.respondentId && bal_p.questionnaireId === bal_group.questionnaireId)
        .map((bal_p) => bal_p.questionnaireVersion)
    );
    bal_group.versionConflicts = bal_versions.size > 1;
  }
  return bal_out.sort(
    (bal_a, bal_b) =>
      bal_a.questionnaireId.localeCompare(bal_b.questionnaireId) ||
      bal_a.respondentId.localeCompare(bal_b.respondentId)
  );
}

export function bal_compute_summary(bal_pages: ScanPageRecord[]): ScanBatchSummary {
  const bal_summary = bal_empty_summary();
  bal_summary.totalPages = bal_pages.length;
  for (const bal_page of bal_pages) {
    switch (bal_page.status) {
      case 'ready':
        bal_summary.ready += 1;
        break;
      case 'needs-review':
        bal_summary.needsReview += 1;
        break;
      case 'duplicate':
        bal_summary.duplicates += 1;
        break;
      case 'failed':
        bal_summary.failed += 1;
        break;
      case 'unsupported':
        bal_summary.unsupported += 1;
        break;
      default:
        bal_summary.queued += 1;
        break;
    }
  }
  const bal_respondents = new Set(
    bal_pages
      .filter((bal_p) => bal_p.respondentId !== null && bal_p.status === 'ready')
      .map((bal_p) => `${bal_p.questionnaireId}|${bal_p.questionnaireVersion}|${bal_p.respondentId}`)
  );
  bal_summary.respondents = bal_respondents.size;
  return bal_summary;
}

export interface bal_IdentityOutcome {
  questionnaireId: string | null;
  questionnaireVersion: number | null;
  respondentId: string | null;
  pageNumber: number | null;
  layout: ResolvedLayoutMatch | null;
  issues: ScanIssueCategory[];
  reviewReason: string | null;
}

export function bal_resolve_identity(
  bal_payloads: string[],
  bal_layouts: PrintLayoutRecord[]
): bal_IdentityOutcome {
  const bal_outcome: bal_IdentityOutcome = {
    questionnaireId: null,
    questionnaireVersion: null,
    respondentId: null,
    pageNumber: null,
    layout: null,
    issues: [],
    reviewReason: null
  };
  const bal_parsed: { payload: string; identifier: ScanPageIdentifier }[] = [];
  for (const bal_payload of bal_payloads) {
    const bal_result = bal_parse_page_payload(bal_payload);
    if (bal_result.ok) bal_parsed.push({ payload: bal_payload, identifier: bal_result.identifier });
  }
  if (bal_parsed.length === 0) {
    bal_outcome.issues.push('unidentified');
    bal_outcome.reviewReason =
      bal_payloads.length > 0
        ? 'The scanned code is not a readable Svelp page identifier.'
        : 'No page identifier code was found on this page.';
    return bal_outcome;
  }
  const bal_matches_per_payload = bal_parsed.map((bal_item) => ({
    ...bal_item,
    matches: bal_resolve_layouts_for_payload(
      {
        studyCode: bal_item.identifier.studyCode,
        version: bal_item.identifier.version,
        pageNumber: bal_item.identifier.pageNumber
      },
      bal_layouts
    )
  }));
  const bal_valid = bal_matches_per_payload.filter((bal_item) => bal_item.matches.matches.length > 0);
  if (bal_parsed.length > 1 && bal_valid.length > 1) {
    bal_outcome.issues.push('possible-multiple-sheets');
    bal_outcome.reviewReason =
      'More than one page identifier was detected; this may be a photo of two sheets.';
    return bal_outcome;
  }
  const bal_chosen = bal_valid[0] ?? bal_matches_per_payload[0];
  if (bal_chosen.matches.pageCountMismatch) {
    bal_outcome.issues.push('unidentified');
    bal_outcome.reviewReason =
      'The code references a page number this questionnaire does not have.';
    return bal_outcome;
  }
  if (bal_chosen.matches.matches.length === 0) {
    bal_outcome.issues.push('unidentified');
    bal_outcome.reviewReason = 'No printed questionnaire in this project matches this code.';
    return bal_outcome;
  }
  if (bal_chosen.matches.matches.length > 1) {
    bal_outcome.issues.push('multiple-identifiers');
    bal_outcome.reviewReason =
      'Several questionnaires in this project produce the same page code.';
    return bal_outcome;
  }
  const bal_match = bal_chosen.matches.matches[0];
  bal_outcome.questionnaireId = bal_match.layout.questionnaireId;
  bal_outcome.questionnaireVersion = bal_match.layout.questionnaireVersion;
  bal_outcome.respondentId = bal_chosen.identifier.respondentId;
  bal_outcome.pageNumber = bal_chosen.identifier.pageNumber;
  bal_outcome.layout = bal_match;
  return bal_outcome;
}

export interface bal_AssignValidation {
  ok: boolean;
  warning: string | null;
  error: string | null;
  layout: ResolvedLayoutMatch | null;
}

export function bal_validate_manual_assignment(
  bal_target: { questionnaireId: string; version: number; respondentId: string; pageNumber: number },
  bal_layouts: PrintLayoutRecord[],
  bal_existing: ScanPageRecord[],
  bal_current_page_id: string
): bal_AssignValidation {
  const bal_candidates = bal_layouts.filter(
    (bal_layout) =>
      bal_layout.questionnaireId === bal_target.questionnaireId &&
      bal_layout.questionnaireVersion === bal_target.version
  );
  if (bal_candidates.length === 0) {
    return {
      ok: false,
      warning: null,
      error: 'No printed layout exists for that questionnaire version. Print a batch first.',
      layout: null
    };
  }
  const bal_layout = bal_candidates[0];
  const bal_page_count = bal_layout.geometry.pageCount || bal_layout.geometry.pages.length;
  if (bal_target.pageNumber < 1 || bal_target.pageNumber > bal_page_count) {
    return {
      ok: false,
      warning: null,
      error: `Page must be between 1 and ${bal_page_count} for this version.`,
      layout: null
    };
  }
  if (bal_target.respondentId.trim().length === 0) {
    return {
      ok: false,
      warning: null,
      error: 'Enter a respondent identifier.',
      layout: null
    };
  }
  const bal_conflict = bal_existing.find(
    (bal_page) =>
      bal_page.id !== bal_current_page_id &&
      bal_page.questionnaireId === bal_target.questionnaireId &&
      bal_page.questionnaireVersion === bal_target.version &&
      bal_page.respondentId === bal_target.respondentId &&
      bal_page.pageNumber === bal_target.pageNumber &&
      (bal_page.status === 'ready' || bal_page.status === 'needs-review')
  );
  return {
    ok: true,
    warning: bal_conflict
      ? `Respondent ${bal_target.respondentId} already has page ${bal_target.pageNumber}; saving will flag a duplicate.`
      : null,
    error: null,
    layout: {
      layout: bal_layout,
      pageCount: bal_page_count,
      studyCode: '',
      version: bal_target.version,
      orientation: bal_layout.orientation,
      paperSize: bal_layout.paperSize
    }
  };
}

export function bal_page_transform_from_result(
  bal_result: bal_ProcessorResult,
  bal_source_width: number,
  bal_source_height: number,
  bal_out_width: number,
  bal_out_height: number,
  bal_px_per_mm: number
): ScanTransformRecord {
  return {
    markerPoints: null,
    manualPoints: null,
    homography: bal_result.homography,
    sourceWidth: bal_source_width,
    sourceHeight: bal_source_height,
    outWidth: bal_out_width,
    outHeight: bal_out_height,
    rotationApplied: bal_result.rotationApplied,
    pixelsPerMm: bal_px_per_mm
  };
}

export async function bal_touch_batch(
  bal_batch: ScanBatchRecord,
  bal_pages?: ScanPageRecord[]
): Promise<void> {
  const bal_rows = bal_pages ?? (await ken_pori_scan_pages(bal_batch.id));
  const bal_updated: ScanBatchRecord = {
    ...bal_plain(bal_batch),
    summary: bal_compute_summary(bal_rows),
    updatedAt: Date.now()
  };
  await bal_save_scan_batch(bal_updated);
}

export async function bal_log_scan_action(
  bal_batch_id: string,
  bal_page_id: string | null,
  bal_kind: import('../models/scan_models').ScanAuditKind,
  bal_detail: string
): Promise<void> {
  await bal_save_audit_event({
    id: bal_new_id(),
    batchId: bal_batch_id,
    pageId: bal_page_id,
    kind: bal_kind,
    detail: bal_detail,
    createdAt: Date.now()
  });
}

export async function bal_flag_identity_duplicate(
  bal_page: ScanPageRecord,
  bal_existing_pages: ScanPageRecord[]
): Promise<ScanPageRecord[]> {
  const bal_conflicts = bal_existing_pages.filter(
    (bal_other) =>
      bal_other.id !== bal_page.id &&
      bal_other.batchId === bal_page.batchId &&
      bal_other.questionnaireId === bal_page.questionnaireId &&
      bal_other.questionnaireVersion === bal_page.questionnaireVersion &&
      bal_other.respondentId === bal_page.respondentId &&
      bal_other.pageNumber === bal_page.pageNumber &&
      (bal_other.status === 'ready' || bal_other.status === 'needs-review' || bal_other.status === 'duplicate')
  );
  if (bal_conflicts.length === 0) return [];
  const bal_updates: ScanPageRecord[] = [];
  const bal_marked = {
    ...bal_plain(bal_page),
    status: 'duplicate' as const,
    issues: [...new Set([...bal_page.issues, 'duplicate' as ScanIssueCategory])],
    updatedAt: Date.now()
  };
  bal_updates.push(bal_marked);
  for (const bal_conflict of bal_conflicts) {
    if (bal_conflict.status === 'duplicate') continue;
    bal_updates.push({
      ...bal_plain(bal_conflict),
      status: 'duplicate',
      issues: [...new Set([...bal_conflict.issues, 'duplicate' as ScanIssueCategory])],
      updatedAt: Date.now()
    });
  }
  for (const bal_row of bal_updates) await bal_save_scan_page(bal_row);
  return bal_updates;
}

export async function bal_mark_exact_file_duplicate(
  bal_page: ScanPageRecord,
  bal_existing_pages: ScanPageRecord[]
): Promise<ScanPageRecord | null> {
  const bal_twin = bal_existing_pages.find(
    (bal_other) =>
      bal_other.id !== bal_page.id &&
      bal_other.sourceHash === bal_page.sourceHash &&
      bal_other.batchId === bal_page.batchId
  );
  if (!bal_twin) return null;
  const bal_marked = {
    ...bal_plain(bal_page),
    status: 'duplicate' as const,
    issues: [...new Set([...bal_page.issues, 'duplicate' as ScanIssueCategory])],
    errorMessage: `Identical file already imported as ${bal_twin.sourceName}.`,
    updatedAt: Date.now()
  };
  await bal_save_scan_page(bal_marked);
  return bal_marked;
}

export async function bal_load_batch_context(bal_batch_id: string) {
  const bal_pages = await ken_pori_scan_pages(bal_batch_id);
  const bal_page = bal_pages.length > 0 ? await dhon_scan_page(bal_pages[0].id) : undefined;
  return { pages: bal_pages, first: bal_page };
}
