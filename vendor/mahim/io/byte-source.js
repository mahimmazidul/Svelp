import { SectionBoundsError, TruncatedFileError } from "../errors/index.js";
export class BytesSource {
    length;
    #bytes;
    constructor(bytes) {
        this.#bytes = bytes;
        this.length = bytes.length;
    }
    async read(offset, length) {
        validateRange(offset, length, this.length);
        return this.#bytes.slice(offset, offset + length);
    }
}
export class BlobSource {
    length;
    #blob;
    constructor(blob) {
        this.#blob = blob;
        this.length = blob.size;
    }
    async read(offset, length) {
        validateRange(offset, length, this.length);
        const slice = this.#blob.slice(offset, offset + length);
        return new Uint8Array(await slice.arrayBuffer());
    }
}
export function byteSourceFrom(input) {
    if (input instanceof Uint8Array) {
        return new BytesSource(input);
    }
    if (input instanceof ArrayBuffer) {
        return new BytesSource(new Uint8Array(input));
    }
    return new BlobSource(input);
}
function validateRange(offset, length, total) {
    if (!Number.isSafeInteger(offset) ||
        !Number.isSafeInteger(length) ||
        offset < 0 ||
        length < 0) {
        throw new SectionBoundsError(`invalid read range offset=${offset} length=${length}`);
    }
    if (offset > total) {
        throw new SectionBoundsError(`read offset ${offset} exceeds source length ${total}`);
    }
    if (offset + length > total) {
        throw new TruncatedFileError(`read of ${length} bytes at offset ${offset} exceeds source length ${total}`);
    }
}
