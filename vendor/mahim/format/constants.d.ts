export declare const MAHIM_MAGIC_TEXT = "MAHIM";
export declare const MAHIM_MAGIC: Readonly<Uint8Array>;
export declare const FORMAT_MAJOR = 1;
export declare const FORMAT_MINOR = 0;
export interface FormatVersion {
    readonly major: number;
    readonly minor: number;
}
export declare const FORMAT_VERSION: FormatVersion;
export declare const HEADER_FIXED_LENGTH = 56;
export declare const SECTION_DESCRIPTOR_LENGTH = 48;
export declare const FILE_DIGEST_LENGTH = 32;
export declare const MAX_APPLICATION_IDENTIFIER_LENGTH = 255;
export declare const MAX_SECTION_NAME_LENGTH = 255;
export declare const HEADER_FLAG_FILE_DIGEST_SHA256 = 1;
export declare const HEADER_FLAG_RESERVED_MASK = 254;
export declare const SECTION_FLAG_OPTIONAL = 1;
export declare const SECTION_FLAG_CRITICAL = 2;
export declare const SECTION_FLAG_RESERVED_MASK = 65532;
export declare const SectionType: Readonly<{
    Invalid: 0;
    Metadata: 1;
    ApplicationPayload: 2;
    Asset: 3;
    Index: 4;
    Extension: 5;
}>;
export declare const SECTION_TYPE_APPLICATION_MIN = 65536;
export declare const SECTION_TYPE_CORE_RESERVED_MAX = 65535;
export declare const PayloadEncoding: Readonly<{
    Raw: 0;
    Cbor: 1;
    Utf8: 2;
}>;
export declare const CompressionMethod: Readonly<{
    None: 0;
    DeflateRaw: 1;
}>;
export declare const ChecksumMethod: Readonly<{
    Crc32c: 0;
    Sha256: 1;
}>;
export type ApplicationIdentifier = string;
export interface ParserLimits {
    readonly maxHeaderLength: number;
    readonly maxApplicationIdentifierLength: number;
    readonly maxSectionCount: number;
    readonly maxSectionNameLength: number;
    readonly maxSectionDirectoryLength: number;
    readonly maxSectionStoredLength: number;
    readonly maxSectionUncompressedLength: number;
    readonly maxDecompressionRatio: number;
}
export declare const DEFAULT_LIMITS: ParserLimits;
export declare const APPLICATION_IDENTIFIER_PATTERN: RegExp;
export declare function isValidApplicationIdentifier(value: string): boolean;
export declare function isValidSectionName(value: string): boolean;
