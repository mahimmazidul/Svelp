import type { SectionDescriptor } from "../format/section.js";
export interface FileLayout {
    readonly headerLength: number;
    readonly directoryOffset: number;
    readonly directoryLength: number;
    readonly fileLength: number;
    readonly digestSize: number;
}
export declare function validateSectionLayout(descriptors: readonly SectionDescriptor[], layout: FileLayout): void;
