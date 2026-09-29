import { ChecksumMismatchError, InvalidMagicError, MalformedSectionError, SectionNotFoundError, UnsupportedFeatureError, } from "../errors/index.js";
import { crc32c } from "../checksum/crc32c.js";
import { bytesEqual, writeUint32LE, readUint32LE } from "../format/primitives.js";
import { sha256 } from "../checksum/sha256.js";
import { decompressPayload } from "../compression/index.js";
import { DEFAULT_LIMITS, HEADER_FIXED_LENGTH, FILE_DIGEST_LENGTH, SECTION_TYPE_APPLICATION_MIN, SectionType, } from "../format/constants.js";
import { decodeHeader } from "../format/header.js";
import { decodeSectionDirectory } from "../format/directory.js";
import { byteSourceFrom, } from "../io/byte-source.js";
import { validateSectionLayout } from "../validation/layout.js";
class MahimReaderImpl {
    header;
    #source;
    #descriptors;
    #limits;
    constructor(source, header, descriptors, limits) {
        this.#source = source;
        this.header = header;
        this.#descriptors = descriptors;
        this.#limits = limits;
    }
    get applicationIdentifier() {
        return this.header.applicationIdentifier;
    }
    get formatVersion() {
        return this.header.formatVersion;
    }
    listSections() {
        return this.#descriptors;
    }
    findSection(query) {
        return resolveSection(this.#descriptors, query);
    }
    async getStoredSection(query) {
        return this.#readStored(this.#require(query));
    }
    async getSection(query) {
        const descriptor = this.#require(query);
        const stored = await this.#readStored(descriptor);
        return decompressPayload(stored, descriptor.compression, descriptor.uncompressedLength, {
            maxUncompressedLength: this.#limits.maxSectionUncompressedLength,
            maxRatio: this.#limits.maxDecompressionRatio,
        });
    }
    async verify(options) {
        const decompress = options?.decompress ?? true;
        const headerBytes = await this.#source.read(0, this.header.headerLength);
        const headerChecksumValid = computeHeaderChecksum(headerBytes) === readUint32LE(headerBytes, 46);
        let fileDigestValid = null;
        if (this.header.fileDigestSha256) {
            const digestOffset = this.header.fileLength - FILE_DIGEST_LENGTH;
            const body = await this.#source.read(0, digestOffset);
            const expected = await this.#source.read(digestOffset, FILE_DIGEST_LENGTH);
            fileDigestValid = bytesEqual(sha256(body), expected);
        }
        const sections = [];
        for (const descriptor of this.#descriptors) {
            let checksumValid = false;
            let decompressedSizeValid = null;
            try {
                const stored = await this.#readStored(descriptor);
                checksumValid = true;
                if (decompress) {
                    await decompressPayload(stored, descriptor.compression, descriptor.uncompressedLength, {
                        maxUncompressedLength: this.#limits.maxSectionUncompressedLength,
                        maxRatio: this.#limits.maxDecompressionRatio,
                    });
                    decompressedSizeValid = true;
                }
            }
            catch (error) {
                if (error instanceof ChecksumMismatchError) {
                    checksumValid = false;
                }
                else if (error instanceof MalformedSectionError) {
                    decompressedSizeValid = false;
                }
                else {
                    throw error;
                }
            }
            sections.push({
                index: descriptor.index,
                name: descriptor.name,
                type: descriptor.type,
                checksumValid,
                decompressedSizeValid,
            });
        }
        const valid = headerChecksumValid &&
            (fileDigestValid === null || fileDigestValid) &&
            sections.every((section) => section.checksumValid &&
                (section.decompressedSizeValid === null || section.decompressedSizeValid));
        return {
            valid,
            headerChecksumValid,
            fileDigestPresent: this.header.fileDigestSha256,
            fileDigestValid,
            sections,
        };
    }
    #require(query) {
        const descriptor = resolveSection(this.#descriptors, query);
        if (descriptor === undefined) {
            throw new SectionNotFoundError(`section ${describeQuery(query)} not found`);
        }
        return descriptor;
    }
    async #readStored(descriptor) {
        const stored = await this.#source.read(descriptor.payloadOffset, descriptor.storedLength);
        const computed = crc32c(stored);
        if (computed !== descriptor.checksum) {
            throw new ChecksumMismatchError(`section ${descriptor.index} (${descriptor.name === "" ? "unnamed" : descriptor.name}) checksum mismatch`);
        }
        return stored;
    }
}
export async function parseMahimHeader(input) {
    return readHeader(byteSourceFrom(input), resolveLimits());
}
export async function openMahim(input, options) {
    const limits = resolveLimits(options?.limits);
    const source = byteSourceFrom(input);
    const header = await readHeader(source, limits);
    const directoryBytes = await source.read(header.sectionDirectoryOffset, header.sectionDirectoryLength);
    const descriptors = decodeSectionDirectory(directoryBytes, header, limits);
    validateSectionLayout(descriptors, {
        headerLength: header.headerLength,
        directoryOffset: header.sectionDirectoryOffset,
        directoryLength: header.sectionDirectoryLength,
        fileLength: header.fileLength,
        digestSize: header.fileDigestSha256 ? FILE_DIGEST_LENGTH : 0,
    });
    if (options?.rejectUnknownCritical ?? true) {
        for (const descriptor of descriptors) {
            if (descriptor.critical && !isSectionUnderstood(descriptor, options)) {
                throw new UnsupportedFeatureError(`critical section ${descriptor.index} (${descriptor.name === "" ? "unnamed" : descriptor.name}) is not understood (type ${descriptor.type})`);
            }
        }
    }
    return new MahimReaderImpl(source, header, descriptors, limits);
}
function isSectionUnderstood(descriptor, options) {
    if (descriptor.type >= SectionType.Metadata && descriptor.type <= SectionType.Index) {
        return true;
    }
    if (descriptor.type === SectionType.Extension) {
        return options?.understoodExtensions?.includes(descriptor.name) ?? false;
    }
    if (descriptor.type >= SECTION_TYPE_APPLICATION_MIN) {
        return options?.understoodSectionTypes?.includes(descriptor.type) ?? false;
    }
    return false;
}
async function readHeader(source, limits) {
    const probeLength = Math.min(HEADER_FIXED_LENGTH, source.length);
    const probe = await source.read(0, probeLength);
    if (probe.length >= 5) {
        if (probe[0] !== 0x4d ||
            probe[1] !== 0x41 ||
            probe[2] !== 0x48 ||
            probe[3] !== 0x49 ||
            probe[4] !== 0x4d) {
            throw new InvalidMagicError();
        }
    }
    if (probe.length < HEADER_FIXED_LENGTH) {
        return decodeHeader(probe, source.length, limits);
    }
    const declaredHeaderLength = readUint32LE(probe, 8);
    if (declaredHeaderLength < HEADER_FIXED_LENGTH ||
        declaredHeaderLength > limits.maxHeaderLength ||
        declaredHeaderLength > source.length) {
        return decodeHeader(probe, source.length, limits);
    }
    const headerBytes = declaredHeaderLength === probeLength
        ? probe
        : await source.read(0, declaredHeaderLength);
    return decodeHeader(headerBytes, source.length, limits);
}
function computeHeaderChecksum(headerBytes) {
    const copy = headerBytes.slice();
    writeUint32LE(copy, 46, 0);
    return crc32c(copy);
}
function resolveLimits(overrides) {
    return { ...DEFAULT_LIMITS, ...overrides };
}
function resolveSection(descriptors, query) {
    if (typeof query === "number") {
        return descriptors.find((descriptor) => descriptor.index === query);
    }
    if (typeof query === "string") {
        return descriptors.find((descriptor) => descriptor.name === query);
    }
    return descriptors.find((descriptor) => {
        if (query.index !== undefined && descriptor.index !== query.index) {
            return false;
        }
        if (query.name !== undefined && descriptor.name !== query.name) {
            return false;
        }
        if (query.applicationDefinedId !== undefined &&
            descriptor.applicationDefinedId !== query.applicationDefinedId) {
            return false;
        }
        if (query.type !== undefined && descriptor.type !== query.type) {
            return false;
        }
        return true;
    });
}
function describeQuery(query) {
    if (typeof query === "number") {
        return `index ${query}`;
    }
    if (typeof query === "string") {
        return `name ${JSON.stringify(query)}`;
    }
    return JSON.stringify(query);
}
