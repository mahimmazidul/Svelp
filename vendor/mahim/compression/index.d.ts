export interface DecompressionLimits {
    readonly maxUncompressedLength: number;
    readonly maxRatio: number;
}
export declare function compressPayload(data: Uint8Array, method: number): Promise<Uint8Array>;
export declare function decompressPayload(stored: Uint8Array, method: number, uncompressedLength: number, limits: DecompressionLimits): Promise<Uint8Array>;
