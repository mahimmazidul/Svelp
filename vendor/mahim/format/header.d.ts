import { MAHIM_MAGIC_TEXT, type ApplicationIdentifier, type FormatVersion, type ParserLimits } from "./constants.js";
export interface MahimHeader {
    readonly magic: typeof MAHIM_MAGIC_TEXT;
    readonly formatVersion: FormatVersion;
    readonly headerFlags: number;
    readonly headerLength: number;
    readonly applicationIdentifier: ApplicationIdentifier;
    readonly applicationPayloadVersion: number;
    readonly sectionCount: number;
    readonly sectionDirectoryOffset: number;
    readonly sectionDirectoryLength: number;
    readonly fileLength: number;
    readonly headerChecksum: number;
    readonly fileDigestSha256: boolean;
}
export interface EncodeHeaderInput {
    readonly applicationIdentifier: ApplicationIdentifier;
    readonly applicationPayloadVersion: number;
    readonly sectionCount: number;
    readonly sectionDirectoryOffset: number;
    readonly sectionDirectoryLength: number;
    readonly fileLength: number;
    readonly fileDigestSha256: boolean;
}
export declare function encodeHeader(input: EncodeHeaderInput): Uint8Array;
export declare function decodeHeader(fileBytes: Uint8Array, actualFileLength: number, limits: ParserLimits): MahimHeader;
