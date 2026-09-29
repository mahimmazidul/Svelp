import { type ParserLimits } from "./constants.js";
import { type SectionDescriptor, type SectionDescriptorInput } from "./section.js";
import type { MahimHeader } from "./header.js";
export interface SectionDirectory {
    readonly descriptors: readonly SectionDescriptor[];
    readonly nameTable: Uint8Array;
    readonly length: number;
}
export declare function encodeSectionDirectory(inputs: readonly SectionDescriptorInput[]): {
    directory: Uint8Array;
    nameTableOffsets: number[];
};
export declare function decodeSectionDirectory(directoryBytes: Uint8Array, header: MahimHeader, limits: ParserLimits): SectionDescriptor[];
export declare function directoryLengthFor(descriptors: readonly Pick<SectionDescriptorInput, "name">[]): number;
export declare function assertDirectoryWithinLimits(length: number, limits: ParserLimits): void;
