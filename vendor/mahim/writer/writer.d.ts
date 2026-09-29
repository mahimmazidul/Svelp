import { type ApplicationIdentifier } from "../format/constants.js";
export interface ApplicationSpec {
    readonly identifier: ApplicationIdentifier;
    readonly payloadVersion: number;
}
export interface SectionInput {
    readonly type: number;
    readonly data: Uint8Array;
    readonly version?: number;
    readonly encoding?: number;
    readonly compression?: number;
    readonly critical?: boolean;
    readonly applicationDefinedId?: number;
    readonly name?: string;
}
export interface MahimWriterOptions {
    readonly fileDigest?: boolean;
}
export interface MahimWriter {
    setApplication(spec: ApplicationSpec): MahimWriter;
    addSection(input: SectionInput): MahimWriter;
    finalize(): Promise<Uint8Array>;
}
export declare function createMahimWriter(options?: MahimWriterOptions): MahimWriter;
