import { type ParserLimits } from "./constants.js";
export interface SectionDescriptor {
    readonly index: number;
    readonly type: number;
    readonly version: number;
    readonly payloadOffset: number;
    readonly storedLength: number;
    readonly uncompressedLength: number;
    readonly checksum: number;
    readonly encoding: number;
    readonly compression: number;
    readonly flags: number;
    readonly optional: boolean;
    readonly critical: boolean;
    readonly applicationDefinedId: number;
    readonly name: string;
}
export interface SectionDescriptorInput {
    readonly type: number;
    readonly version: number;
    readonly payloadOffset: number;
    readonly storedLength: number;
    readonly uncompressedLength: number;
    readonly checksum: number;
    readonly encoding: number;
    readonly compression: number;
    readonly flags: number;
    readonly applicationDefinedId: number;
    readonly name: string;
}
export declare function encodeSectionDescriptor(input: SectionDescriptorInput): Uint8Array;
export declare function decodeSectionDescriptor(bytes: Uint8Array, offset: number, index: number, limits: ParserLimits): SectionDescriptor;
export declare function isCoreSectionType(type: number): boolean;
export declare function isApplicationSectionType(type: number): boolean;
export declare function isKnownCoreSectionType(type: number): boolean;
