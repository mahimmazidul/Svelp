export type BinaryInput = Uint8Array | ArrayBuffer | Blob;
export interface ByteSource {
    readonly length: number;
    read(offset: number, length: number): Promise<Uint8Array>;
}
export declare class BytesSource implements ByteSource {
    #private;
    readonly length: number;
    constructor(bytes: Uint8Array);
    read(offset: number, length: number): Promise<Uint8Array>;
}
export declare class BlobSource implements ByteSource {
    #private;
    readonly length: number;
    constructor(blob: Blob);
    read(offset: number, length: number): Promise<Uint8Array>;
}
export declare function byteSourceFrom(input: BinaryInput): ByteSource;
