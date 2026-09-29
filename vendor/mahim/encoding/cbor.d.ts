export type CborValue = number | string | boolean | null | Uint8Array | readonly CborValue[] | {
    readonly [key: string]: CborValue;
};
export declare function encodeCbor(value: CborValue): Uint8Array;
export interface DecodeCborOptions {
    readonly canonical?: boolean;
}
export declare function decodeCbor(bytes: Uint8Array, options?: DecodeCborOptions): CborValue;
