import {
  CompressionMethod,
  InvalidMagicError,
  MahimError,
  SectionType,
  createMahimWriter,
  openMahim,
  parseMahimHeader,
  type MahimReader,
  type MahimHeader,
  type VerificationReport
} from '../../../vendor/mahim/index.js';

export const BAL_MAHIM_APPLICATION = 'svelp';
export const BAL_MAHIM_PAYLOAD_VERSION = 1;

export const BAL_MAHIM_SECTION = {
  manifest: 'manifest',
  project: 'project',
  questionnaires: 'questionnaires',
  scales: 'scales',
  print: 'print',
  scanMetadata: 'scan-metadata',
  responses: 'responses',
  responseMetadata: 'response-metadata',
  settings: 'settings',
  assetIndex: 'asset-index'
} as const;

export type BalMahimSectionName =
  (typeof BAL_MAHIM_SECTION)[keyof typeof BAL_MAHIM_SECTION];

export const BAL_MAHIM_ASSET_SECTION_PREFIX = 'asset-';

export type BalMahimPackageMode = 'questionnaire-transfer' | 'project-backup';

export interface BalMahimSectionInput {
  name: BalMahimSectionName | string;
  type: number;
  data: Uint8Array;
  compression?: number;
  critical?: boolean;
}

export interface BalMahimAssetSection {
  name: string;
  data: Uint8Array;
}

export async function bal_mahim_write(
  bal_sections: BalMahimSectionInput[],
  bal_assets: BalMahimAssetSection[] = []
): Promise<Uint8Array> {
  const bal_writer = createMahimWriter({ fileDigest: true }).setApplication({
    identifier: BAL_MAHIM_APPLICATION,
    payloadVersion: BAL_MAHIM_PAYLOAD_VERSION
  });
  for (const bal_section of bal_sections) {
    bal_writer.addSection({
      type: bal_section.type,
      name: bal_section.name,
      data: bal_section.data,
      compression: bal_section.compression ?? CompressionMethod.DeflateRaw,
      critical: bal_section.critical ?? false
    });
  }
  for (const bal_asset of bal_assets) {
    bal_writer.addSection({
      type: SectionType.Asset,
      name: bal_asset.name,
      data: bal_asset.data,
      compression: CompressionMethod.None
    });
  }
  return bal_writer.finalize();
}

export async function bal_mahim_open(
  bal_input: Blob | Uint8Array | ArrayBuffer
): Promise<MahimReader> {
  return openMahim(bal_input);
}

export async function bal_mahim_header(
  bal_input: Blob | Uint8Array | ArrayBuffer
): Promise<MahimHeader> {
  return parseMahimHeader(bal_input);
}

export async function bal_mahim_verify(
  bal_reader: MahimReader
): Promise<VerificationReport> {
  return bal_reader.verify();
}

export type BalMahimFailureKind =
  | 'not-mahim'
  | 'unsupported-version'
  | 'corrupt'
  | 'resource-limit'
  | 'unknown';

export interface BalMahimFailure {
  kind: BalMahimFailureKind;
  title: string;
  detail: string;
}

const BAL_FAILURE_TITLES: Record<BalMahimFailureKind, string> = {
  'not-mahim': 'This is not a MAHIM file.',
  'unsupported-version': 'This MAHIM file uses an unsupported format version.',
  corrupt: 'This MAHIM file is corrupt.',
  'resource-limit': 'This MAHIM file exceeds safe parsing limits.',
  unknown: 'This MAHIM file could not be read.'
};

export function bal_classify_mahim_error(bal_error: unknown): BalMahimFailure {
  if (bal_error instanceof InvalidMagicError) {
    return {
      kind: 'not-mahim',
      title: BAL_FAILURE_TITLES['not-mahim'],
      detail: 'The file does not start with the MAHIM signature. Svelp imports .mahim files and the legacy JSON bundle.'
    };
  }
  if (bal_error instanceof MahimError) {
    const bal_name = bal_error.name;
    if (bal_name === 'UnsupportedFormatVersionError') {
      return {
        kind: 'unsupported-version',
        title: BAL_FAILURE_TITLES['unsupported-version'],
        detail: bal_error.message
      };
    }
    if (bal_name === 'ResourceLimitError') {
      return {
        kind: 'resource-limit',
        title: BAL_FAILURE_TITLES['resource-limit'],
        detail: bal_error.message
      };
    }
    return {
      kind: 'corrupt',
      title: BAL_FAILURE_TITLES.corrupt,
      detail: bal_error.message
    };
  }
  return {
    kind: 'unknown',
    title: BAL_FAILURE_TITLES.unknown,
    detail: bal_error instanceof Error ? bal_error.message : String(bal_error)
  };
}

export function bal_mahim_asset_section_name(bal_index: number): string {
  return `${BAL_MAHIM_ASSET_SECTION_PREFIX}${bal_index}`;
}

export function bal_mahim_is_asset_section(bal_name: string): boolean {
  return bal_name.startsWith(BAL_MAHIM_ASSET_SECTION_PREFIX);
}

export { SectionType, CompressionMethod };
