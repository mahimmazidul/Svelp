import { encodeCbor, decodeCbor, type CborValue } from '../../../vendor/mahim/index.js';

const BAL_FIXED_MARKER = 'svelp-fixed';
const BAL_FIXED_SCALE = 1000000;

export class BalPayloadSchemaError extends Error {
  readonly path: string;
  constructor(bal_message: string, bal_path: string) {
    super(`${bal_message} (at ${bal_path})`);
    this.path = bal_path;
  }
}

function bal_is_plain_object(bal_value: unknown): bal_value is Record<string, unknown> {
  return (
    typeof bal_value === 'object' &&
    bal_value !== null &&
    !Array.isArray(bal_value) &&
    !(bal_value instanceof Uint8Array) &&
    !(bal_value instanceof Blob)
  );
}

function bal_pack_number(bal_value: number): number | [string, number] {
  if (Number.isInteger(bal_value)) return bal_value;
  if (!Number.isFinite(bal_value)) {
    throw new BalPayloadSchemaError(
      'Values must be finite numbers',
      'number'
    );
  }
  return [BAL_FIXED_MARKER, Math.round(bal_value * BAL_FIXED_SCALE)];
}

function bal_pack_node(bal_value: unknown, bal_path: string): CborValue {
  if (
    bal_value === null ||
    bal_value === undefined ||
    typeof bal_value === 'boolean' ||
    typeof bal_value === 'string'
  ) {
    if (bal_value === undefined) return null;
    return bal_value;
  }
  if (typeof bal_value === 'number') {
    return bal_pack_number(bal_value);
  }
  if (bal_value instanceof Uint8Array) {
    return bal_value;
  }
  if (bal_value instanceof Blob) {
    throw new BalPayloadSchemaError('Binary values must be packed as Uint8Array', bal_path);
  }
  if (Array.isArray(bal_value)) {
    return bal_value.map((bal_item, bal_index) =>
      bal_pack_node(bal_item, `${bal_path}[${bal_index}]`)
    );
  }
  if (bal_is_plain_object(bal_value)) {
    const bal_out: Record<string, CborValue> = {};
    for (const bal_key of Object.keys(bal_value)) {
      bal_out[bal_key] = bal_pack_node(bal_value[bal_key], `${bal_path}.${bal_key}`);
    }
    return bal_out;
  }
  throw new BalPayloadSchemaError('Unsupported value type in payload', bal_path);
}

function bal_unpack_node(bal_value: unknown, bal_path: string): unknown {
  if (
    bal_value === null ||
    typeof bal_value === 'boolean' ||
    typeof bal_value === 'string' ||
    typeof bal_value === 'number'
  ) {
    return bal_value;
  }
  if (bal_value instanceof Uint8Array) {
    return bal_value;
  }
  if (Array.isArray(bal_value)) {
    if (
      bal_value.length === 2 &&
      bal_value[0] === BAL_FIXED_MARKER &&
      typeof bal_value[1] === 'number'
    ) {
      return bal_value[1] / BAL_FIXED_SCALE;
    }
    return bal_value.map((bal_item, bal_index) =>
      bal_unpack_node(bal_item, `${bal_path}[${bal_index}]`)
    );
  }
  if (bal_is_plain_object(bal_value)) {
    const bal_out: Record<string, unknown> = {};
    for (const bal_key of Object.keys(bal_value)) {
      bal_out[bal_key] = bal_unpack_node(bal_value[bal_key], `${bal_path}.${bal_key}`);
    }
    return bal_out;
  }
  throw new BalPayloadSchemaError('Unsupported value in decoded payload', bal_path);
}

export function bal_cbor_pack(bal_value: unknown): Uint8Array {
  return encodeCbor(bal_pack_node(bal_value, '$'));
}

export function bal_cbor_unpack<T>(bal_bytes: Uint8Array): T {
  return bal_unpack_node(decodeCbor(bal_bytes), '$') as T;
}

export function bal_cbor_pack_text(bal_value: unknown): Uint8Array {
  return new TextEncoder().encode(String(bal_value));
}
