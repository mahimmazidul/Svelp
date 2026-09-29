export declare class MahimError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare class FormatError extends MahimError {
    constructor(code: string, message: string);
}
export declare class IntegrityError extends MahimError {
    constructor(code: string, message: string);
}
export declare class InvalidMagicError extends FormatError {
    constructor(message?: string);
}
export declare class UnsupportedFormatVersionError extends FormatError {
    readonly major: number;
    readonly minor: number;
    constructor(major: number, minor: number);
}
export declare class MalformedHeaderError extends FormatError {
    constructor(message?: string);
}
export declare class InvalidApplicationIdentifierError extends FormatError {
    constructor(message?: string);
}
export declare class MalformedUtf8Error extends FormatError {
    constructor(message?: string);
}
export declare class FileLengthMismatchError extends FormatError {
    readonly declaredLength: number;
    readonly actualLength: number;
    constructor(declaredLength: number, actualLength: number);
}
export declare class TruncatedFileError extends FormatError {
    constructor(message?: string);
}
export declare class InvalidSectionDirectoryError extends FormatError {
    constructor(message?: string);
}
export declare class SectionBoundsError extends FormatError {
    constructor(message?: string);
}
export declare class SectionOverlapError extends FormatError {
    constructor(message?: string);
}
export declare class MalformedSectionError extends FormatError {
    constructor(message?: string);
}
export declare class CborDecodeError extends FormatError {
    constructor(message?: string);
}
export declare class UnsupportedFeatureError extends FormatError {
    constructor(message?: string);
}
export declare class SectionNotFoundError extends MahimError {
    constructor(message?: string);
}
export declare class HeaderChecksumError extends IntegrityError {
    constructor(message?: string);
}
export declare class ChecksumMismatchError extends IntegrityError {
    constructor(message?: string);
}
export declare class FileDigestMismatchError extends IntegrityError {
    constructor(message?: string);
}
export declare class UnsupportedEncodingError extends MahimError {
    readonly encoding: number;
    constructor(encoding: number);
}
export declare class UnsupportedCompressionError extends MahimError {
    readonly compression: number;
    constructor(compression: number);
}
export declare class ResourceLimitError extends MahimError {
    constructor(message?: string);
}
