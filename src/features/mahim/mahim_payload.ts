import type {
  PaperSize,
  Orientation,
  ProjectRecord,
  QuestionnaireRecord,
  ResponseScaleRecord
} from '../../models/types';
import type { DatasetSnapshotRecord } from '../../models/response_models';
import type {
  PrintBatchRecord,
  PrintLayoutRecord
} from '../../models/print_models';
import type {
  ScanAuditEventRecord,
  ScanBatchRecord,
  ScanPageRecord
} from '../../models/scan_models';
import type {
  RecognitionRunRecord,
  ResponseAuditEventRecord,
  ResponseRecord
} from '../../models/response_models';
import type { AnswerMarkerType } from '../../models/item_catalog';

export interface BalMahimManifest {
  payloadVersion: number;
  mode: 'questionnaire-transfer' | 'project-backup';
  generator: string;
  exportedAt: string;
  projectIds: string[];
  questionnaireIds: string[];
  includesResponses: boolean;
  includesScanImages: boolean;
  contents: {
    projects: number;
    questionnaires: number;
    scales: number;
    printLayouts: number;
    printBatches: number;
    scanBatches: number;
    scanPages: number;
    assets: number;
    responses: number;
  };
}

export interface BalPayloadIssue {
  path: string;
  message: string;
}

export interface BalPrintPackage {
  layouts: PrintLayoutRecord[];
  batches: PrintBatchRecord[];
}

export interface BalScanMetadataPackage {
  batches: ScanBatchRecord[];
  pages: ScanPageRecord[];
  auditEvents: ScanAuditEventRecord[];
}

export interface BalResponsePackage {
  responses: ResponseRecord[];
  recognitionRuns: RecognitionRunRecord[];
  auditEvents: ResponseAuditEventRecord[];
  blankReferences: BlankReferenceMetadata[];
  datasetSnapshots?: DatasetSnapshotRecord[];
}

export interface BlankReferenceMetadata {
  id: string;
  fingerprint: string;
  pageNumber: number;
  questionnaireVersion: number;
  widthPx: number;
  heightPx: number;
  createdAt: number;
}

export interface BalProjectBackupPackage {
  project: ProjectRecord;
  questionnaire: QuestionnaireRecord;
  scales: ResponseScaleRecord[];
  print: BalPrintPackage;
  scan: BalScanMetadataPackage;
  responses: BalResponsePackage | null;
  assetCount: number;
}

const BAL_PAPER_MM: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 }
};

const BAL_BOUNDS_TOLERANCE = 0.000002;

const BAL_ITEM_TYPES = new Set([
  'section',
  'instruction',
  'single_choice',
  'multiple_choice',
  'yes_no',
  'short_text',
  'long_text',
  'number',
  'date',
  'time',
  'likert_scale',
  'matrix',
  'ranking',
  'consent',
  'participant_signature',
  'researcher_signature'
]);

const BAL_MARKER_TYPES = new Set<AnswerMarkerType>([
  'bubble',
  'checkbox',
  'box',
  'line',
  'none'
]);

const BAL_REGION_KINDS = new Set([
  'choice',
  'matrix',
  'consent',
  'text',
  'number',
  'date',
  'respondent'
]);

const BAL_SCAN_PAGE_STATUSES = new Set([
  'queued',
  'decoding',
  'identifying',
  'aligning',
  'normalizing',
  'ready',
  'needs-review',
  'duplicate',
  'unsupported',
  'failed'
]);

const BAL_SCAN_ISSUES = new Set([
  'unidentified',
  'multiple-identifiers',
  'alignment-failed',
  'corner-correction-required',
  'duplicate',
  'poor-quality',
  'version-mismatch',
  'unsupported-file',
  'failed-decode',
  'possible-multiple-sheets',
  'template-missing'
]);

const BAL_RESPONSE_STATUSES = new Set([
  'accepted',
  'blank',
  'needs-review',
  'ambiguous',
  'multiple-marks',
  'manual-only',
  'unreadable'
]);

export function bal_payload_issue(
  bal_issues: BalPayloadIssue[],
  bal_path: string,
  bal_message: string
): void {
  bal_issues.push({ path: bal_path, message: bal_message });
}

function bal_is_int(bal_value: unknown): bal_value is number {
  return typeof bal_value === 'number' && Number.isInteger(bal_value);
}

function bal_is_str(bal_value: unknown): bal_value is string {
  return typeof bal_value === 'string';
}

function bal_is_num(bal_value: unknown): bal_value is number {
  return typeof bal_value === 'number' && Number.isFinite(bal_value);
}

function bal_is_bool(bal_value: unknown): bal_value is boolean {
  return typeof bal_value === 'boolean';
}

function bal_is_arr(bal_value: unknown): bal_value is unknown[] {
  return Array.isArray(bal_value);
}

function bal_is_obj(bal_value: unknown): bal_value is Record<string, unknown> {
  return (
    typeof bal_value === 'object' &&
    bal_value !== null &&
    !Array.isArray(bal_value) &&
    !(bal_value instanceof Uint8Array)
  );
}

export function bal_validate_manifest(
  bal_value: unknown,
  bal_issues: BalPayloadIssue[]
): BalMahimManifest | null {
  const bal_path = 'manifest';
  if (!bal_is_obj(bal_value)) {
    bal_payload_issue(bal_issues, bal_path, 'Manifest section is missing or malformed.');
    return null;
  }
  if (bal_value.payloadVersion !== 1) {
    bal_payload_issue(
      bal_issues,
      `${bal_path}.payloadVersion`,
      'This file was created by a newer Svelp data format and cannot be imported by this version.'
    );
    return null;
  }
  if (
    bal_value.mode !== 'questionnaire-transfer' &&
    bal_value.mode !== 'project-backup'
  ) {
    bal_payload_issue(bal_issues, `${bal_path}.mode`, 'Unknown package mode.');
    return null;
  }
  for (const bal_key of ['generator', 'exportedAt'] as const) {
    if (!bal_is_str(bal_value[bal_key])) {
      bal_payload_issue(bal_issues, `${bal_path}.${bal_key}`, 'Manifest field missing.');
      return null;
    }
  }
  for (const bal_key of ['projectIds', 'questionnaireIds'] as const) {
    if (
      !bal_is_arr(bal_value[bal_key]) ||
      !(bal_value[bal_key] as unknown[]).every(bal_is_str)
    ) {
      bal_payload_issue(bal_issues, `${bal_path}.${bal_key}`, 'Manifest id list invalid.');
      return null;
    }
  }
  for (const bal_key of ['includesResponses', 'includesScanImages'] as const) {
    if (!bal_is_bool(bal_value[bal_key])) {
      bal_payload_issue(bal_issues, `${bal_path}.${bal_key}`, 'Manifest flag invalid.');
      return null;
    }
  }
  if (!bal_is_obj(bal_value.contents)) {
    bal_payload_issue(bal_issues, `${bal_path}.contents`, 'Manifest contents invalid.');
    return null;
  }
  return bal_value as unknown as BalMahimManifest;
}

export function bal_validate_project(
  bal_value: unknown,
  bal_issues: BalPayloadIssue[]
): ProjectRecord | null {
  const bal_path = 'project';
  if (!bal_is_obj(bal_value)) {
    bal_payload_issue(bal_issues, bal_path, 'Project section is missing or malformed.');
    return null;
  }
  if (!bal_is_str(bal_value.id) || bal_value.id.length === 0) {
    bal_payload_issue(bal_issues, `${bal_path}.id`, 'Project id invalid.');
    return null;
  }
  if (!bal_is_str(bal_value.title)) {
    bal_payload_issue(bal_issues, `${bal_path}.title`, 'Project title invalid.');
    return null;
  }
  if (bal_value.status !== 'active' && bal_value.status !== 'archived') {
    bal_payload_issue(bal_issues, `${bal_path}.status`, 'Project status invalid.');
    return null;
  }
  if (!bal_is_str(bal_value.description)) {
    bal_payload_issue(bal_issues, `${bal_path}.description`, 'Project description invalid.');
    return null;
  }
  for (const bal_key of ['createdAt', 'updatedAt'] as const) {
    if (!bal_is_int(bal_value[bal_key])) {
      bal_payload_issue(bal_issues, `${bal_path}.${bal_key}`, 'Project timestamp invalid.');
      return null;
    }
  }
  return bal_value as unknown as ProjectRecord;
}

export function bal_validate_questionnaire(
  bal_value: unknown,
  bal_issues: BalPayloadIssue[],
  bal_expected_project_id: string
): QuestionnaireRecord | null {
  const bal_path = 'questionnaires';
  if (!bal_is_obj(bal_value)) {
    bal_payload_issue(bal_issues, bal_path, 'Questionnaire section is missing or malformed.');
    return null;
  }
  if (!bal_is_str(bal_value.id) || bal_value.id.length === 0) {
    bal_payload_issue(bal_issues, `${bal_path}.id`, 'Questionnaire id invalid.');
    return null;
  }
  if (bal_value.projectId !== bal_expected_project_id) {
    bal_payload_issue(
      bal_issues,
      `${bal_path}.projectId`,
      'Questionnaire does not reference the packaged project.'
    );
    return null;
  }
  if (!bal_is_str(bal_value.title)) {
    bal_payload_issue(bal_issues, `${bal_path}.title`, 'Questionnaire title invalid.');
    return null;
  }
  if (!bal_is_int(bal_value.version) || bal_value.version < 1) {
    bal_payload_issue(bal_issues, `${bal_path}.version`, 'Questionnaire version invalid.');
    return null;
  }
  if (bal_value.status !== 'draft' && bal_value.status !== 'published') {
    bal_payload_issue(bal_issues, `${bal_path}.status`, 'Questionnaire status invalid.');
    return null;
  }
  if (bal_value.paperSize !== 'a4' && bal_value.paperSize !== 'letter') {
    bal_payload_issue(bal_issues, `${bal_path}.paperSize`, 'Paper size invalid.');
    return null;
  }
  if (bal_value.orientation !== 'portrait' && bal_value.orientation !== 'landscape') {
    bal_payload_issue(bal_issues, `${bal_path}.orientation`, 'Orientation invalid.');
    return null;
  }
  if (!bal_is_str(bal_value.language)) {
    bal_payload_issue(bal_issues, `${bal_path}.language`, 'Questionnaire language invalid.');
    return null;
  }
  if (!bal_is_arr(bal_value.sections)) {
    bal_payload_issue(bal_issues, `${bal_path}.sections`, 'Questionnaire sections invalid.');
    return null;
  }
  const bal_item_ids = new Set<string>();
  for (const [bal_s, bal_section] of (bal_value.sections as unknown[]).entries()) {
    if (!bal_is_obj(bal_section)) {
      bal_payload_issue(bal_issues, `${bal_path}.sections[${bal_s}]`, 'Section invalid.');
      return null;
    }
    if (!bal_is_str(bal_section.id) || !bal_is_str(bal_section.title)) {
      bal_payload_issue(
        bal_issues,
        `${bal_path}.sections[${bal_s}].id`,
        'Section id or title invalid.'
      );
      return null;
    }
    if (!bal_is_arr(bal_section.items)) {
      bal_payload_issue(
        bal_issues,
        `${bal_path}.sections[${bal_s}].items`,
        'Section items invalid.'
      );
      return null;
    }
    for (const [bal_i, bal_item] of (bal_section.items as unknown[]).entries()) {
      if (!bal_is_obj(bal_item)) {
        bal_payload_issue(
          bal_issues,
          `${bal_path}.sections[${bal_s}].items[${bal_i}]`,
          'Item invalid.'
        );
        return null;
      }
      if (!bal_is_str(bal_item.id) || bal_item_ids.has(bal_item.id)) {
        bal_payload_issue(
          bal_issues,
          `${bal_path}.sections[${bal_s}].items[${bal_i}].id`,
          'Item id missing or duplicated.'
        );
        return null;
      }
      bal_item_ids.add(bal_item.id);
      if (!bal_is_str(bal_item.type) || !BAL_ITEM_TYPES.has(bal_item.type as never)) {
        bal_payload_issue(
          bal_issues,
          `${bal_path}.sections[${bal_s}].items[${bal_i}].type`,
          'Item type unknown to this Svelp version.'
        );
        return null;
      }
    }
  }
  for (const bal_key of ['createdAt', 'updatedAt'] as const) {
    if (!bal_is_int(bal_value[bal_key])) {
      bal_payload_issue(bal_issues, `${bal_path}.${bal_key}`, 'Questionnaire timestamp invalid.');
      return null;
    }
  }
  return bal_value as unknown as QuestionnaireRecord;
}

export function bal_validate_scales(
  bal_value: unknown,
  bal_issues: BalPayloadIssue[]
): ResponseScaleRecord[] {
  const bal_path = 'scales';
  if (!bal_is_arr(bal_value)) {
    bal_payload_issue(bal_issues, bal_path, 'Scales section is missing or malformed.');
    return [];
  }
  for (const [bal_i, bal_scale] of bal_value.entries()) {
    if (!bal_is_obj(bal_scale)) {
      bal_payload_issue(bal_issues, `${bal_path}[${bal_i}]`, 'Scale invalid.');
      return [];
    }
    if (!bal_is_str(bal_scale.id) || !bal_is_str(bal_scale.name)) {
      bal_payload_issue(bal_issues, `${bal_path}[${bal_i}].id`, 'Scale id or name invalid.');
      return [];
    }
    if (!bal_is_arr(bal_scale.options)) {
      bal_payload_issue(bal_issues, `${bal_path}[${bal_i}].options`, 'Scale options invalid.');
      return [];
    }
    const bal_codes = new Set<string>();
    for (const [bal_o, bal_option] of (bal_scale.options as unknown[]).entries()) {
      if (!bal_is_obj(bal_option) || !bal_is_str(bal_option.id) || !bal_is_str(bal_option.label)) {
        bal_payload_issue(
          bal_issues,
          `${bal_path}[${bal_i}].options[${bal_o}]`,
          'Scale option invalid.'
        );
        return [];
      }
      if (bal_is_str(bal_option.coding) && bal_option.coding.length > 0) {
        if (bal_codes.has(bal_option.coding)) {
          bal_payload_issue(
            bal_issues,
            `${bal_path}[${bal_i}].options[${bal_o}].coding`,
            'Duplicate option code within one option set.'
          );
          return [];
        }
        bal_codes.add(bal_option.coding);
      }
    }
    for (const bal_key of ['createdAt', 'updatedAt'] as const) {
      if (!bal_is_int(bal_scale[bal_key])) {
        bal_payload_issue(bal_issues, `${bal_path}[${bal_i}].${bal_key}`, 'Scale timestamp invalid.');
        return [];
      }
    }
  }
  return bal_value as unknown as ResponseScaleRecord[];
}

function bal_validate_rect_mm(
  bal_rect: unknown,
  bal_page: { width: number; height: number },
  bal_issues: BalPayloadIssue[],
  bal_path: string
): boolean {
  if (
    !bal_is_obj(bal_rect) ||
    !bal_is_num(bal_rect.x) ||
    !bal_is_num(bal_rect.y) ||
    !bal_is_num(bal_rect.width) ||
    !bal_is_num(bal_rect.height)
  ) {
    bal_payload_issue(bal_issues, bal_path, 'Geometry rectangle invalid.');
    return false;
  }
  if (bal_rect.width <= 0 || bal_rect.height <= 0) {
    bal_payload_issue(bal_issues, bal_path, 'Geometry rectangle has non-positive size.');
    return false;
  }
  if (
    bal_rect.x < -1 ||
    bal_rect.y < -1 ||
    bal_rect.x + bal_rect.width > bal_page.width + 1 ||
    bal_rect.y + bal_rect.height > bal_page.height + 1
  ) {
    bal_payload_issue(bal_issues, bal_path, 'Geometry rectangle outside the paper bounds.');
    return false;
  }
  return true;
}

function bal_validate_normalized_rect(
  bal_rect: unknown,
  bal_issues: BalPayloadIssue[],
  bal_path: string
): boolean {
  if (
    !bal_is_obj(bal_rect) ||
    !bal_is_num(bal_rect.x) ||
    !bal_is_num(bal_rect.y) ||
    !bal_is_num(bal_rect.width) ||
    !bal_is_num(bal_rect.height)
  ) {
    bal_payload_issue(bal_issues, bal_path, 'Normalized rectangle invalid.');
    return false;
  }
  const bal_t = BAL_BOUNDS_TOLERANCE;
  if (
    bal_rect.x < -bal_t ||
    bal_rect.y < -bal_t ||
    bal_rect.width < 0 ||
    bal_rect.height < 0 ||
    bal_rect.x + bal_rect.width > 1 + bal_t ||
    bal_rect.y + bal_rect.height > 1 + bal_t
  ) {
    bal_payload_issue(bal_issues, bal_path, 'Normalized rectangle outside 0 to 1 range.');
    return false;
  }
  return true;
}

function bal_validate_page_geometry(
  bal_page: unknown,
  bal_paper: PaperSize,
  bal_orientation: Orientation,
  bal_issues: BalPayloadIssue[],
  bal_path: string,
  bal_item_ids: Set<string>,
  bal_section_ids: Set<string>
): boolean {
  if (!bal_is_obj(bal_page)) {
    bal_payload_issue(bal_issues, bal_path, 'Page geometry invalid.');
    return false;
  }
  if (!bal_is_int(bal_page.pageNumber) || bal_page.pageNumber < 1) {
    bal_payload_issue(bal_issues, `${bal_path}.pageNumber`, 'Page number invalid.');
    return false;
  }
  const bal_size = BAL_PAPER_MM[bal_paper];
  const bal_width = bal_orientation === 'portrait' ? bal_size.width : bal_size.height;
  const bal_height = bal_orientation === 'portrait' ? bal_size.height : bal_size.width;
  if (
    !bal_is_num(bal_page.width) ||
    !bal_is_num(bal_page.height) ||
    Math.abs(bal_page.width - bal_width) > 1 ||
    Math.abs(bal_page.height - bal_height) > 1
  ) {
    bal_payload_issue(bal_issues, `${bal_path}.width`, 'Page size does not match the paper size.');
    return false;
  }
  if (!bal_is_arr(bal_page.alignmentMarkers)) {
    bal_payload_issue(bal_issues, `${bal_path}.alignmentMarkers`, 'Alignment markers invalid.');
    return false;
  }
  for (const [bal_m, bal_marker] of (bal_page.alignmentMarkers as unknown[]).entries()) {
    if (!bal_is_obj(bal_marker)) {
      bal_payload_issue(
        bal_issues,
        `${bal_path}.alignmentMarkers[${bal_m}]`,
        'Alignment marker invalid.'
      );
      return false;
    }
    if (
      !bal_validate_rect_mm(bal_marker.rect, { width: bal_width, height: bal_height }, bal_issues, `${bal_path}.alignmentMarkers[${bal_m}].rect`) ||
      !bal_validate_normalized_rect(bal_marker.normalized, bal_issues, `${bal_path}.alignmentMarkers[${bal_m}].normalized`)
    ) {
      return false;
    }
  }
  if (!bal_is_arr(bal_page.answerRegions)) {
    bal_payload_issue(bal_issues, `${bal_path}.answerRegions`, 'Answer regions invalid.');
    return false;
  }
  for (const [bal_r, bal_region] of (bal_page.answerRegions as unknown[]).entries()) {
    if (!bal_is_obj(bal_region)) {
      bal_payload_issue(bal_issues, `${bal_path}.answerRegions[${bal_r}]`, 'Answer region invalid.');
      return false;
    }
    const bal_region_path = `${bal_path}.answerRegions[${bal_r}]`;
    if (!bal_is_str(bal_region.itemId)) {
      bal_payload_issue(bal_issues, `${bal_region_path}.itemId`, 'Answer region references an unknown item.');
      return false;
    }
    if (!bal_is_str(bal_region.kind) || !BAL_REGION_KINDS.has(bal_region.kind as never)) {
      bal_payload_issue(bal_issues, `${bal_region_path}.kind`, 'Answer region kind unknown.');
      return false;
    }
    if (bal_region.kind !== 'respondent' && !bal_item_ids.has(bal_region.itemId)) {
      bal_payload_issue(bal_issues, `${bal_region_path}.itemId`, 'Answer region references an unknown item.');
      return false;
    }
    if (!bal_is_str(bal_region.markerType) || !BAL_MARKER_TYPES.has(bal_region.markerType as AnswerMarkerType)) {
      bal_payload_issue(bal_issues, `${bal_region_path}.markerType`, 'Answer region marker type unknown.');
      return false;
    }
    if (bal_region.selection !== 'single' && bal_region.selection !== 'multiple' && bal_region.selection !== 'written') {
      bal_payload_issue(bal_issues, `${bal_region_path}.selection`, 'Answer region selection invalid.');
      return false;
    }
    if (
      !bal_validate_rect_mm(bal_region.rect, { width: bal_width, height: bal_height }, bal_issues, `${bal_region_path}.rect`) ||
      !bal_validate_normalized_rect(bal_region.normalized, bal_issues, `${bal_region_path}.normalized`)
    ) {
      return false;
    }
  }
  if (!bal_is_arr(bal_page.itemBounds)) {
    bal_payload_issue(bal_issues, `${bal_path}.itemBounds`, 'Item bounds invalid.');
    return false;
  }
  for (const [bal_b, bal_bound] of (bal_page.itemBounds as unknown[]).entries()) {
    if (
      !bal_is_obj(bal_bound) ||
      !bal_is_str(bal_bound.itemId) ||
      (!bal_item_ids.has(bal_bound.itemId) && !bal_section_ids.has(bal_bound.itemId))
    ) {
      bal_payload_issue(bal_issues, `${bal_path}.itemBounds[${bal_b}]`, 'Item bound references an unknown item.');
      return false;
    }
  }
  if (bal_page.identifier !== null) {
    if (!bal_is_obj(bal_page.identifier)) {
      bal_payload_issue(bal_issues, `${bal_path}.identifier`, 'Page identifier invalid.');
      return false;
    }
    if (!bal_is_str(bal_page.identifier.payload)) {
      bal_payload_issue(bal_issues, `${bal_path}.identifier.payload`, 'Page identifier payload invalid.');
      return false;
    }
    if (!bal_validate_layout_payload(bal_page.identifier.payload)) {
      bal_payload_issue(bal_issues, `${bal_path}.identifier.payload`, 'Page identifier is not a valid Svelp page template.');
      return false;
    }
  }
  return true;
}

function bal_validate_layout_payload(bal_payload: string): boolean {
  const bal_parts = bal_payload.split('|');
  if (bal_parts.length !== 5) return false;
  if (bal_parts[0] !== 'S1') return false;
  if (!/^[A-Z0-9]{1,8}$/.test(bal_parts[1])) return false;
  if (!/^[0-9]{1,4}$/.test(bal_parts[2]) || Number(bal_parts[2]) < 1) return false;
  if (bal_parts[3].length > 32 || bal_parts[3].includes('|')) return false;
  if (!/^[0-9]{1,3}$/.test(bal_parts[4]) || Number(bal_parts[4]) < 1) return false;
  return true;
}

export function bal_validate_print_package(
  bal_value: unknown,
  bal_issues: BalPayloadIssue[],
  bal_project_id: string,
  bal_questionnaires: QuestionnaireRecord[]
): BalPrintPackage | null {
  const bal_path = 'print';
  if (!bal_is_obj(bal_value)) {
    bal_payload_issue(bal_issues, bal_path, 'Print section is missing or malformed.');
    return null;
  }
  if (!bal_is_arr(bal_value.layouts) || !bal_is_arr(bal_value.batches)) {
    bal_payload_issue(bal_issues, `${bal_path}.layouts`, 'Print layouts or batches invalid.');
    return null;
  }
  const bal_by_id = new Map(bal_questionnaires.map((bal_q) => [bal_q.id, bal_q]));
  for (const [bal_i, bal_layout] of (bal_value.layouts as unknown[]).entries()) {
    const bal_layout_path = `${bal_path}.layouts[${bal_i}]`;
    if (!bal_is_obj(bal_layout)) {
      bal_payload_issue(bal_issues, bal_layout_path, 'Print layout invalid.');
      return null;
    }
    if (!bal_is_str(bal_layout.id) || !bal_is_str(bal_layout.fingerprint)) {
      bal_payload_issue(bal_issues, `${bal_layout_path}.id`, 'Print layout id or fingerprint invalid.');
      return null;
    }
    if (bal_layout.projectId !== bal_project_id || !bal_by_id.has(bal_layout.questionnaireId as string)) {
      bal_payload_issue(bal_issues, `${bal_layout_path}.questionnaireId`, 'Print layout references an unknown questionnaire.');
      return null;
    }
    const bal_q = bal_by_id.get(bal_layout.questionnaireId as string);
    if (!bal_is_int(bal_layout.questionnaireVersion) || bal_layout.questionnaireVersion !== bal_q?.version) {
      bal_payload_issue(
        bal_issues,
        `${bal_layout_path}.questionnaireVersion`,
        'Print layout version does not match the packaged questionnaire.'
      );
      return null;
    }
    if (!bal_is_obj(bal_layout.settingsSnapshot)) {
      bal_payload_issue(bal_issues, `${bal_layout_path}.settingsSnapshot`, 'Print settings snapshot invalid.');
      return null;
    }
    if (!bal_is_obj(bal_layout.geometry)) {
      bal_payload_issue(bal_issues, `${bal_layout_path}.geometry`, 'Print geometry invalid.');
      return null;
    }
    const bal_geometry = bal_layout.geometry;
    if (bal_geometry.fingerprint !== bal_layout.fingerprint) {
      bal_payload_issue(bal_issues, `${bal_layout_path}.geometry.fingerprint`, 'Geometry fingerprint mismatch.');
      return null;
    }
    if (!bal_is_int(bal_geometry.pageCount) || bal_geometry.pageCount < 1) {
      bal_payload_issue(bal_issues, `${bal_layout_path}.geometry.pageCount`, 'Page count invalid.');
      return null;
    }
    if (!bal_is_arr(bal_geometry.pages) || bal_geometry.pages.length !== bal_geometry.pageCount) {
      bal_payload_issue(bal_issues, `${bal_layout_path}.geometry.pages`, 'Page geometry count mismatch.');
      return null;
    }
    const bal_item_ids = new Set<string>();
    const bal_section_ids = new Set<string>();
    for (const bal_section of bal_q.sections) {
      bal_section_ids.add(bal_section.id);
      for (const bal_item of bal_section.items) bal_item_ids.add(bal_item.id);
    }
    for (const [bal_p, bal_page] of (bal_geometry.pages as unknown[]).entries()) {
      if (
        !bal_validate_page_geometry(
          bal_page,
          bal_layout.paperSize as PaperSize,
          bal_layout.orientation as Orientation,
          bal_issues,
          `${bal_layout_path}.geometry.pages[${bal_p}]`,
          bal_item_ids,
          bal_section_ids
        )
      ) {
        return null;
      }
    }
    for (const bal_key of ['createdAt', 'updatedAt'] as const) {
      if (!bal_is_int(bal_layout[bal_key])) {
        bal_payload_issue(bal_issues, `${bal_layout_path}.${bal_key}`, 'Print layout timestamp invalid.');
        return null;
      }
    }
  }
  for (const [bal_i, bal_batch] of (bal_value.batches as unknown[]).entries()) {
    const bal_batch_path = `${bal_path}.batches[${bal_i}]`;
    if (!bal_is_obj(bal_batch)) {
      bal_payload_issue(bal_issues, bal_batch_path, 'Print batch invalid.');
      return null;
    }
    if (!bal_is_str(bal_batch.id) || !bal_is_str(bal_batch.layoutId)) {
      bal_payload_issue(bal_issues, `${bal_batch_path}.id`, 'Print batch id invalid.');
      return null;
    }
    if (bal_batch.projectId !== bal_project_id || !bal_by_id.has(bal_batch.questionnaireId as string)) {
      bal_payload_issue(bal_issues, `${bal_batch_path}.questionnaireId`, 'Print batch references an unknown questionnaire.');
      return null;
    }
    if (!bal_is_arr(bal_batch.respondentIds) || !(bal_batch.respondentIds as unknown[]).every(bal_is_str)) {
      bal_payload_issue(bal_issues, `${bal_batch_path}.respondentIds`, 'Print batch respondent ids invalid.');
      return null;
    }
    if (!bal_is_int(bal_batch.pageCount) || bal_batch.pageCount < 1) {
      bal_payload_issue(bal_issues, `${bal_batch_path}.pageCount`, 'Print batch page count invalid.');
      return null;
    }
    if (!bal_is_int(bal_batch.createdAt)) {
      bal_payload_issue(bal_issues, `${bal_batch_path}.createdAt`, 'Print batch timestamp invalid.');
      return null;
    }
  }
  return bal_value as unknown as BalPrintPackage;
}

export function bal_validate_scan_metadata(
  bal_value: unknown,
  bal_issues: BalPayloadIssue[],
  bal_project_id: string
): BalScanMetadataPackage | null {
  const bal_path = 'scan';
  if (!bal_is_obj(bal_value)) {
    bal_payload_issue(bal_issues, bal_path, 'Scan metadata section is missing or malformed.');
    return null;
  }
  for (const bal_key of ['batches', 'pages', 'auditEvents'] as const) {
    if (!bal_is_arr(bal_value[bal_key])) {
      bal_payload_issue(bal_issues, `${bal_path}.${bal_key}`, 'Scan metadata lists invalid.');
      return null;
    }
  }
  const bal_batch_ids = new Set<string>();
  for (const [bal_i, bal_batch] of (bal_value.batches as unknown[]).entries()) {
    if (!bal_is_obj(bal_batch) || !bal_is_str(bal_batch.id)) {
      bal_payload_issue(bal_issues, `${bal_path}.batches[${bal_i}]`, 'Scan batch invalid.');
      return null;
    }
    bal_batch_ids.add(bal_batch.id);
    if (bal_batch.projectId !== bal_project_id) {
      bal_payload_issue(bal_issues, `${bal_path}.batches[${bal_i}].projectId`, 'Scan batch references a different project.');
      return null;
    }
  }
  for (const [bal_i, bal_page] of (bal_value.pages as unknown[]).entries()) {
    const bal_page_path = `${bal_path}.pages[${bal_i}]`;
    if (!bal_is_obj(bal_page) || !bal_is_str(bal_page.id)) {
      bal_payload_issue(bal_issues, bal_page_path, 'Scan page invalid.');
      return null;
    }
    if (!bal_batch_ids.has(bal_page.batchId as string)) {
      bal_payload_issue(bal_issues, `${bal_page_path}.batchId`, 'Scan page references an unknown batch.');
      return null;
    }
    if (!bal_is_str(bal_page.status) || !BAL_SCAN_PAGE_STATUSES.has(bal_page.status as never)) {
      bal_payload_issue(bal_issues, `${bal_page_path}.status`, 'Scan page status unknown.');
      return null;
    }
    if (!bal_is_arr(bal_page.issues) || !(bal_page.issues as unknown[]).every((bal_issue) => bal_is_str(bal_issue) && BAL_SCAN_ISSUES.has(bal_issue as never))) {
      bal_payload_issue(bal_issues, `${bal_page_path}.issues`, 'Scan page issues invalid.');
      return null;
    }
  }
  for (const [bal_i, bal_event] of (bal_value.auditEvents as unknown[]).entries()) {
    if (!bal_is_obj(bal_event) || !bal_is_str(bal_event.id) || !bal_is_str(bal_event.kind)) {
      bal_payload_issue(bal_issues, `${bal_path}.auditEvents[${bal_i}]`, 'Scan audit event invalid.');
      return null;
    }
  }
  return bal_value as unknown as BalScanMetadataPackage;
}

export function bal_validate_response_package(
  bal_value: unknown,
  bal_issues: BalPayloadIssue[],
  bal_project_id: string,
  bal_questionnaires: QuestionnaireRecord[]
): BalResponsePackage | null {
  const bal_path = 'responses';
  if (!bal_is_obj(bal_value)) {
    bal_payload_issue(bal_issues, bal_path, 'Responses section is missing or malformed.');
    return null;
  }
  if (!bal_is_arr(bal_value.responses)) {
    bal_payload_issue(bal_issues, `${bal_path}.responses`, 'Response list invalid.');
    return null;
  }
  const bal_item_ids = new Set<string>();
  for (const bal_q of bal_questionnaires) {
    for (const bal_section of bal_q.sections) {
      for (const bal_item of bal_section.items) bal_item_ids.add(bal_item.id);
    }
  }
  for (const [bal_i, bal_response] of (bal_value.responses as unknown[]).entries()) {
    const bal_response_path = `${bal_path}.responses[${bal_i}]`;
    if (!bal_is_obj(bal_response) || !bal_is_str(bal_response.id)) {
      bal_payload_issue(bal_issues, bal_response_path, 'Response invalid.');
      return null;
    }
    if (bal_response.projectId !== bal_project_id) {
      bal_payload_issue(bal_issues, `${bal_response_path}.projectId`, 'Response references a different project.');
      return null;
    }
    if (!bal_is_str(bal_response.respondentId) || bal_response.respondentId.length === 0) {
      bal_payload_issue(bal_issues, `${bal_response_path}.respondentId`, 'Response respondent id invalid.');
      return null;
    }
    if (!bal_is_str(bal_response.itemId) || !bal_item_ids.has(bal_response.itemId)) {
      bal_payload_issue(bal_issues, `${bal_response_path}.itemId`, 'Response references an unknown item.');
      return null;
    }
    if (!bal_is_arr(bal_response.value) || !(bal_response.value as unknown[]).every(bal_is_str)) {
      bal_payload_issue(bal_issues, `${bal_response_path}.value`, 'Response value invalid.');
      return null;
    }
    if (!bal_is_str(bal_response.status) || !BAL_RESPONSE_STATUSES.has(bal_response.status as never)) {
      bal_payload_issue(bal_issues, `${bal_response_path}.status`, 'Response status unknown.');
      return null;
    }
    if (
      bal_response.confidence !== null &&
      bal_response.confidence !== undefined &&
      !bal_is_num(bal_response.confidence)
    ) {
      bal_payload_issue(bal_issues, `${bal_response_path}.confidence`, 'Response confidence invalid.');
      return null;
    }
  }
  for (const bal_key of ['recognitionRuns', 'auditEvents', 'blankReferences'] as const) {
    if (!bal_is_arr(bal_value[bal_key])) {
      bal_payload_issue(bal_issues, `${bal_path}.${bal_key}`, 'Response metadata lists invalid.');
      return null;
    }
  }
  if (bal_value.datasetSnapshots !== undefined && !bal_is_arr(bal_value.datasetSnapshots)) {
    bal_payload_issue(bal_issues, `${bal_path}.datasetSnapshots`, 'Dataset snapshot list invalid.');
    return null;
  }
  return bal_value as unknown as BalResponsePackage;
}

export function bal_payload_equal(bal_a: unknown, bal_b: unknown): boolean {
  if (bal_a === bal_b) return true;
  if (
    typeof bal_a === 'number' &&
    typeof bal_b === 'number'
  ) {
    return Object.is(bal_a, bal_b);
  }
  if (Array.isArray(bal_a) && Array.isArray(bal_b)) {
    if (bal_a.length !== bal_b.length) return false;
    return bal_a.every((bal_item, bal_i) => bal_payload_equal(bal_item, bal_b[bal_i]));
  }
  if (bal_is_plain(bal_a) && bal_is_plain(bal_b)) {
    const bal_ka = Object.keys(bal_a).sort();
    const bal_kb = Object.keys(bal_b).sort();
    if (!bal_payload_equal(bal_ka, bal_kb)) return false;
    return bal_ka.every((bal_key) => bal_payload_equal(bal_a[bal_key], bal_b[bal_key]));
  }
  return false;
}

function bal_is_plain(bal_value: unknown): bal_value is Record<string, unknown> {
  return typeof bal_value === 'object' && bal_value !== null && !Array.isArray(bal_value);
}
