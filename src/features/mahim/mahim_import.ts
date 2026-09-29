import type { MahimHeader, SectionDescriptor, VerificationReport } from '../../../vendor/mahim/index.js';
import {
  BAL_MAHIM_APPLICATION,
  BAL_MAHIM_SECTION,
  bal_classify_mahim_error,
  bal_mahim_header,
  bal_mahim_open,
  bal_mahim_verify
} from './mahim_container';
import { bal_cbor_unpack } from './mahim_codec';
import type {
  BalMahimManifest,
  BalPayloadIssue,
  BalPrintPackage,
  BalScanMetadataPackage
} from './mahim_payload';
import {
  bal_validate_manifest,
  bal_validate_print_package,
  bal_validate_project,
  bal_validate_questionnaire,
  bal_validate_response_package,
  bal_validate_scales,
  bal_validate_scan_metadata
} from './mahim_payload';
import type {
  ProjectRecord,
  QuestionnaireRecord,
  ResponseScaleRecord
} from '../../models/types';
import type { SettingRow } from '../../db/settings_repo';

export interface BalAssetIndexEntry {
  section: string;
  kind: 'scan-asset' | 'blank-reference';
  mime: string;
  assetId: string;
  pageId: string | null;
  scanAsset: {
    batchId: string;
    assetKind: 'source' | 'normalized';
    width: number;
    height: number;
    size: number;
    createdAt: number;
  } | null;
}

export interface BalBackupSections {
  manifest: BalMahimManifest;
  project: ProjectRecord;
  questionnaires: QuestionnaireRecord[];
  scales: ResponseScaleRecord[];
  print: BalPrintPackage;
  scan: BalScanMetadataPackage;
  responses: {
    responses: import('../../models/response_models').ResponseRecord[];
    recognitionRuns: import('../../models/response_models').RecognitionRunRecord[];
    auditEvents: import('../../models/response_models').ResponseAuditEventRecord[];
    blankReferences: {
      id: string;
      fingerprint: string;
      pageNumber: number;
      questionnaireVersion: number;
      widthPx: number;
      heightPx: number;
      createdAt: number;
    }[];
  };
  settings: SettingRow<unknown>[];
  assetIndex: BalAssetIndexEntry[];
}

export interface BalSectionInfo {
  name: string;
  type: number;
  storedLength: number;
  uncompressedLength: number;
  encoding: number;
  compression: number;
}

export interface BalInspectedPackage {
  source: Blob;
  header: MahimHeader;
  manifest: BalMahimManifest;
  sections: BalSectionInfo[];
  dataSections: BalSectionInfo[];
  assetSections: BalSectionInfo[];
  assetIndex: BalAssetIndexEntry[];
  project: ProjectRecord;
  questionnaires: QuestionnaireRecord[];
  scales: ResponseScaleRecord[];
  print: BalPrintPackage;
  scan: BalScanMetadataPackage | null;
  responses: BalBackupSections['responses'] | null;
  settings: SettingRow<unknown>[];
  totalAssetBytes: number;
  dataBytes: number;
}

export type BalInspectionOutcome =
  | { ok: true; report: VerificationReport; inspected: BalInspectedPackage }
  | { ok: false; failure: { kind: string; title: string; detail: string } }
  | { ok: false; issues: BalPayloadIssue[] };

const BAL_DATA_SECTION_NAMES: Set<string> = new Set(Object.values(BAL_MAHIM_SECTION));

export async function bal_inspect_mahim_package(
  bal_file: Blob
): Promise<BalInspectionOutcome> {
  let bal_header: MahimHeader;
  try {
    bal_header = await bal_mahim_header(bal_file);
  } catch (bal_error) {
    return { ok: false, failure: bal_classify_mahim_error(bal_error) };
  }
  if (bal_header.applicationIdentifier !== BAL_MAHIM_APPLICATION) {
    return {
      ok: false,
      failure: {
        kind: 'other-application',
        title: 'This is a valid MAHIM file, but it belongs to another application and cannot be imported into Svelp.',
        detail: `The file identifies itself as application "${bal_header.applicationIdentifier}".`
      }
    };
  }
  let bal_reader;
  try {
    bal_reader = await bal_mahim_open(bal_file);
  } catch (bal_error) {
    return { ok: false, failure: bal_classify_mahim_error(bal_error) };
  }
  let bal_report: VerificationReport;
  try {
    bal_report = await bal_mahim_verify(bal_reader);
  } catch (bal_error) {
    return { ok: false, failure: bal_classify_mahim_error(bal_error) };
  }
  const bal_all = bal_reader.listSections();
  const bal_descriptors: BalSectionInfo[] = bal_all.map((bal_d: SectionDescriptor) => ({
    name: bal_d.name,
    type: bal_d.type,
    storedLength: bal_d.storedLength,
    uncompressedLength: bal_d.uncompressedLength,
    encoding: bal_d.encoding,
    compression: bal_d.compression
  }));
  const bal_data_sections = bal_descriptors.filter((bal_d) =>
    BAL_DATA_SECTION_NAMES.has(bal_d.name)
  );
  const bal_asset_sections = bal_descriptors.filter(
    (bal_d) => !BAL_DATA_SECTION_NAMES.has(bal_d.name)
  );
  const bal_section_bytes = async (bal_name: string): Promise<unknown> => {
    const bal_bytes = await bal_reader.getSection(bal_name);
    return bal_cbor_unpack(bal_bytes);
  };
  const bal_issues: BalPayloadIssue[] = [];
  let bal_manifest: BalMahimManifest | null = null;
  try {
    bal_manifest = bal_validate_manifest(
      await bal_section_bytes(BAL_MAHIM_SECTION.manifest),
      bal_issues
    );
  } catch (bal_error) {
    return { ok: false, issues: [{ path: 'manifest', message: String(bal_error) }] };
  }
  if (!bal_manifest) return { ok: false, issues: bal_issues };
  if (bal_manifest.payloadVersion !== 1) {
    return { ok: false, issues: bal_issues };
  }
  let bal_project: ProjectRecord | null = null;
  let bal_questionnaires: QuestionnaireRecord[] = [];
  let bal_scales: ResponseScaleRecord[] = [];
  let bal_print: BalPrintPackage | null = null;
  let bal_scan: BalScanMetadataPackage | null = null;
  let bal_responses: BalBackupSections['responses'] | null = null;
  let bal_settings: SettingRow<unknown>[] = [];
  let bal_asset_index: BalAssetIndexEntry[] = [];
  try {
    bal_project = bal_validate_project(
      await bal_section_bytes(BAL_MAHIM_SECTION.project),
      bal_issues
    );
    if (bal_project !== null) {
      const bal_q_raw = await bal_section_bytes(BAL_MAHIM_SECTION.questionnaires);
      if (Array.isArray(bal_q_raw)) {
        for (const bal_q of bal_q_raw) {
          const bal_validated = bal_validate_questionnaire(bal_q, bal_issues, bal_project.id);
          if (!bal_validated) break;
          bal_questionnaires.push(bal_validated);
        }
        if (bal_questionnaires.length !== bal_q_raw.length) {
          bal_questionnaires = [];
        }
      } else {
        bal_issues.push({ path: 'questionnaires', message: 'Questionnaire section invalid.' });
      }
    }
    if (bal_project !== null && bal_questionnaires.length > 0) {
      const bal_project_id = bal_project.id;
      bal_scales = bal_validate_scales(
        await bal_section_bytes(BAL_MAHIM_SECTION.scales),
        bal_issues
      );
      bal_print = bal_validate_print_package(
        await bal_section_bytes(BAL_MAHIM_SECTION.print),
        bal_issues,
        bal_project_id,
        bal_questionnaires
      );
      if (bal_descriptors.some((bal_d) => bal_d.name === BAL_MAHIM_SECTION.scanMetadata)) {
        bal_scan = bal_validate_scan_metadata(
          await bal_section_bytes(BAL_MAHIM_SECTION.scanMetadata),
          bal_issues,
          bal_project_id
        );
      }
      if (bal_descriptors.some((bal_d) => bal_d.name === BAL_MAHIM_SECTION.responses)) {
        const bal_raw = await bal_section_bytes(BAL_MAHIM_SECTION.responses);
        bal_responses = bal_validate_response_package(
          bal_raw,
          bal_issues,
          bal_project_id,
          bal_questionnaires
        );
      }
      if (bal_descriptors.some((bal_d) => bal_d.name === BAL_MAHIM_SECTION.settings)) {
        const bal_raw_settings = await bal_section_bytes(BAL_MAHIM_SECTION.settings);
        if (Array.isArray(bal_raw_settings)) {
          bal_settings = bal_raw_settings as SettingRow<unknown>[];
        } else {
          bal_issues.push({ path: 'settings', message: 'Settings section invalid.' });
        }
      }
      if (bal_descriptors.some((bal_d) => bal_d.name === BAL_MAHIM_SECTION.assetIndex)) {
        const bal_raw_index = await bal_section_bytes(BAL_MAHIM_SECTION.assetIndex);
        if (Array.isArray(bal_raw_index)) {
          bal_asset_index = bal_raw_index as BalAssetIndexEntry[];
        }
      }
    }
  } catch (bal_error) {
    bal_issues.push({
      path: 'payload',
      message:
        bal_error instanceof Error
          ? bal_error.message
          : 'The Svelp payload could not be decoded.'
    });
  }
  if (bal_issues.length > 0 || !bal_project || !bal_print) {
    return { ok: false, issues: bal_issues };
  }
  return {
    ok: true,
    report: bal_report,
    inspected: {
      source: bal_file,
      header: bal_header,
      manifest: bal_manifest,
      sections: bal_descriptors,
      dataSections: bal_data_sections,
      assetSections: bal_asset_sections,
      assetIndex: bal_asset_index,
      project: bal_project,
      questionnaires: bal_questionnaires,
      scales: bal_scales,
      print: bal_print,
      scan: bal_scan,
      responses: bal_responses,
      settings: bal_settings,
      totalAssetBytes: bal_asset_sections.reduce(
        (bal_total, bal_d) => bal_total + bal_d.storedLength,
        0
      ),
      dataBytes: bal_data_sections.reduce(
        (bal_total, bal_d) => bal_total + bal_d.uncompressedLength,
        0
      )
    }
  };
}
