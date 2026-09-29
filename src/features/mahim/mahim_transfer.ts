import type {
  ProjectRecord,
  QuestionnaireRecord,
  ResponseScaleRecord
} from '../../models/types';
import type {
  PrintBatchRecord,
  PrintLayoutRecord
} from '../../models/print_models';
import {
  BAL_MAHIM_SECTION,
  SectionType,
  bal_mahim_write,
  BAL_MAHIM_PAYLOAD_VERSION,
  type BalMahimPackageMode
} from './mahim_container';
import { bal_cbor_pack } from './mahim_codec';
import {
  bal_payload_issue,
  type BalMahimManifest,
  type BalPayloadIssue,
  type BalPrintPackage
} from './mahim_payload';
import { bal_validate_manifest, bal_validate_project, bal_validate_questionnaire, bal_validate_print_package, bal_validate_scales } from './mahim_payload';
import { bal_transfer_filename } from './mahim_filenames';

export interface BalTransferInput {
  project: ProjectRecord;
  questionnaire: QuestionnaireRecord;
  scales: ResponseScaleRecord[];
  layouts: PrintLayoutRecord[];
  batches: PrintBatchRecord[];
}

export interface BalTransferSummary {
  filename: string;
  byteLength: number;
  itemCount: number;
  pageCount: number;
  scaleCount: number;
  layoutCount: number;
  batchCount: number;
  includesPrint: boolean;
}

export interface BalTransferBuild {
  bytes: Uint8Array;
  summary: BalTransferSummary;
  manifest: BalMahimManifest;
}

export function bal_scale_ids_of_questionnaire(
  bal_questionnaire: QuestionnaireRecord
): string[] {
  const bal_ids = new Set<string>();
  for (const bal_section of bal_questionnaire.sections) {
    for (const bal_item of bal_section.items) {
      if (bal_item.scaleId) bal_ids.add(bal_item.scaleId);
    }
  }
  return Array.from(bal_ids);
}

export function bal_collect_scales(
  bal_questionnaire: QuestionnaireRecord,
  bal_all: ResponseScaleRecord[]
): ResponseScaleRecord[] {
  const bal_ids = bal_scale_ids_of_questionnaire(bal_questionnaire);
  return bal_all.filter((bal_scale) => bal_ids.includes(bal_scale.id));
}

function bal_manifest(
  bal_mode: BalMahimPackageMode,
  bal_project: ProjectRecord,
  bal_questionnaires: QuestionnaireRecord[],
  bal_scale_count: number,
  bal_print: BalPrintPackage,
  bal_contents_extra: Partial<BalMahimManifest['contents']>,
  bal_includes_responses: boolean,
  bal_includes_scan_images: boolean
): BalMahimManifest {
  return {
    payloadVersion: BAL_MAHIM_PAYLOAD_VERSION,
    mode: bal_mode,
    generator: 'svelp',
    exportedAt: new Date().toISOString(),
    projectIds: [bal_project.id],
    questionnaireIds: bal_questionnaires.map((bal_q) => bal_q.id),
    includesResponses: bal_includes_responses,
    includesScanImages: bal_includes_scan_images,
    contents: {
      projects: 1,
      questionnaires: bal_questionnaires.length,
      scales: bal_scale_count,
      printLayouts: bal_print.layouts.length,
      printBatches: bal_print.batches.length,
      scanBatches: bal_contents_extra.scanBatches ?? 0,
      scanPages: bal_contents_extra.scanPages ?? 0,
      assets: bal_contents_extra.assets ?? 0,
      responses: bal_contents_extra.responses ?? 0
    }
  };
}

export function bal_build_transfer_sections(
  bal_input: BalTransferInput,
  bal_issues: BalPayloadIssue[]
): {
  project: ProjectRecord;
  questionnaire: QuestionnaireRecord;
  scales: ResponseScaleRecord[];
  print: BalPrintPackage;
} | null {
  if (bal_input.questionnaire.projectId !== bal_input.project.id) {
    bal_payload_issue(bal_issues, 'questionnaire.projectId', 'The questionnaire does not belong to the selected project.');
    return null;
  }
  const bal_scale_ids = bal_scale_ids_of_questionnaire(bal_input.questionnaire);
  const bal_scales = bal_input.scales.filter((bal_scale) => bal_scale_ids.includes(bal_scale.id));
  const bal_missing = bal_scale_ids.filter(
    (bal_id) => !bal_scales.some((bal_scale) => bal_scale.id === bal_id)
  );
  if (bal_missing.length > 0) {
    bal_payload_issue(bal_issues, 'scales', 'One or more referenced scales are missing.');
    return null;
  }
  const bal_layouts = bal_input.layouts.filter(
    (bal_layout) =>
      bal_layout.questionnaireId === bal_input.questionnaire.id &&
      bal_layout.questionnaireVersion === bal_input.questionnaire.version
  );
  const bal_batches = bal_input.batches.filter(
    (bal_batch) =>
      bal_batch.questionnaireId === bal_input.questionnaire.id &&
      bal_batch.questionnaireVersion === bal_input.questionnaire.version
  );
  const bal_print: BalPrintPackage = { layouts: bal_layouts, batches: bal_batches };
  return {
    project: bal_input.project,
    questionnaire: bal_input.questionnaire,
    scales: bal_scales,
    print: bal_print
  };
}

export async function bal_build_transfer_package(
  bal_input: BalTransferInput
): Promise<{ build: BalTransferBuild } | { issues: BalPayloadIssue[] }> {
  const bal_issues: BalPayloadIssue[] = [];
  const bal_parts = bal_build_transfer_sections(bal_input, bal_issues);
  if (!bal_parts) return { issues: bal_issues };
  const bal_print = bal_parts.print;
  const bal_manifest_data = bal_manifest(
    'questionnaire-transfer',
    bal_parts.project,
    [bal_parts.questionnaire],
    bal_parts.scales.length,
    bal_print,
    {},
    false,
    false
  );
  const bal_bytes = await bal_mahim_write([
    {
      name: BAL_MAHIM_SECTION.manifest,
      type: SectionType.Metadata,
      data: bal_cbor_pack(bal_manifest_data)
    },
    {
      name: BAL_MAHIM_SECTION.project,
      type: SectionType.ApplicationPayload,
      data: bal_cbor_pack(bal_parts.project)
    },
    {
      name: BAL_MAHIM_SECTION.questionnaires,
      type: SectionType.ApplicationPayload,
      data: bal_cbor_pack([bal_parts.questionnaire])
    },
    {
      name: BAL_MAHIM_SECTION.scales,
      type: SectionType.ApplicationPayload,
      data: bal_cbor_pack(bal_parts.scales)
    },
    {
      name: BAL_MAHIM_SECTION.print,
      type: SectionType.ApplicationPayload,
      data: bal_cbor_pack(bal_print)
    }
  ]);
  const bal_page_count = bal_print.layouts[0]?.geometry.pageCount ?? 0;
  return {
    build: {
      bytes: bal_bytes,
      manifest: bal_manifest_data,
      summary: {
        filename: bal_transfer_filename(bal_parts.project.title, bal_parts.questionnaire.version),
        byteLength: bal_bytes.length,
        itemCount: bal_parts.questionnaire.sections.reduce(
          (bal_total, bal_section) => bal_total + bal_section.items.length,
          0
        ),
        pageCount: bal_page_count,
        scaleCount: bal_parts.scales.length,
        layoutCount: bal_print.layouts.length,
        batchCount: bal_print.batches.length,
        includesPrint: bal_print.layouts.length > 0
      }
    }
  };
}

export function bal_read_transfer_sections(bal_sections: {
  manifest?: unknown;
  project?: unknown;
  questionnaires?: unknown;
  scales?: unknown;
  print?: unknown;
}): { issues: BalPayloadIssue[]; ok: boolean } {
  const bal_issues: BalPayloadIssue[] = [];
  const bal_manifest = bal_validate_manifest(bal_sections.manifest, bal_issues);
  if (!bal_manifest) return { ok: false, issues: bal_issues };
  const bal_project = bal_validate_project(bal_sections.project, bal_issues);
  if (!bal_project) return { ok: false, issues: bal_issues };
  const bal_questionnaires_raw = bal_sections.questionnaires;
  if (!Array.isArray(bal_questionnaires_raw) || bal_questionnaires_raw.length !== 1) {
    bal_payload_issue(bal_issues, 'questionnaires', 'A transfer package must contain exactly one questionnaire.');
    return { ok: false, issues: bal_issues };
  }
  const bal_questionnaire = bal_validate_questionnaire(
    bal_questionnaires_raw[0],
    bal_issues,
    bal_project.id
  );
  if (!bal_questionnaire) return { ok: false, issues: bal_issues };
  const bal_scales = bal_validate_scales(bal_sections.scales, bal_issues);
  const bal_print = bal_validate_print_package(
    bal_sections.print,
    bal_issues,
    bal_project.id,
    [bal_questionnaire]
  );
  if (!bal_print) return { ok: false, issues: bal_issues };
  const bal_referenced = bal_scale_ids_of_questionnaire(bal_questionnaire);
  const bal_missing = bal_referenced.filter(
    (bal_id) => !bal_scales.some((bal_scale) => bal_scale.id === bal_id)
  );
  if (bal_missing.length > 0) {
    bal_payload_issue(bal_issues, 'scales', 'The package is missing a scale referenced by the questionnaire.');
    return { ok: false, issues: bal_issues };
  }
  if (bal_manifest.mode !== 'questionnaire-transfer') {
    bal_payload_issue(bal_issues, 'manifest.mode', 'This file is not a questionnaire transfer package.');
    return { ok: false, issues: bal_issues };
  }
  return { ok: bal_issues.length === 0, issues: bal_issues };
}
