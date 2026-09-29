import { type ApplicationIdentifier, type FormatVersion, type ParserLimits } from "../format/constants.js";
import { type MahimHeader } from "../format/header.js";
import type { SectionDescriptor } from "../format/section.js";
import { type BinaryInput } from "../io/byte-source.js";
export type SectionQuery = number | string | {
    readonly index?: number;
    readonly name?: string;
    readonly applicationDefinedId?: number;
    readonly type?: number;
};
export interface SectionVerification {
    readonly index: number;
    readonly name: string;
    readonly type: number;
    readonly checksumValid: boolean;
    readonly decompressedSizeValid: boolean | null;
}
export interface VerificationReport {
    readonly valid: boolean;
    readonly headerChecksumValid: boolean;
    readonly fileDigestPresent: boolean;
    readonly fileDigestValid: boolean | null;
    readonly sections: readonly SectionVerification[];
}
export interface VerifyOptions {
    readonly decompress?: boolean;
}
export interface OpenOptions {
    readonly limits?: Partial<ParserLimits>;
    readonly understoodSectionTypes?: readonly number[];
    readonly understoodExtensions?: readonly string[];
    readonly rejectUnknownCritical?: boolean;
}
export interface MahimReader {
    readonly header: MahimHeader;
    readonly applicationIdentifier: ApplicationIdentifier;
    readonly formatVersion: FormatVersion;
    listSections(): readonly SectionDescriptor[];
    findSection(query: SectionQuery): SectionDescriptor | undefined;
    getSection(query: SectionQuery): Promise<Uint8Array>;
    getStoredSection(query: SectionQuery): Promise<Uint8Array>;
    verify(options?: VerifyOptions): Promise<VerificationReport>;
}
export declare function parseMahimHeader(input: BinaryInput): Promise<MahimHeader>;
export declare function openMahim(input: BinaryInput, options?: OpenOptions): Promise<MahimReader>;
