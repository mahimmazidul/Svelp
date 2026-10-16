export function bal_plain_clone<T>(bal_value: T): T {
  if (Array.isArray(bal_value)) {
    const bal_copy: unknown[] = [];
    for (const bal_item of bal_value) bal_copy.push(bal_plain_clone(bal_item));
    return bal_copy as unknown as T;
  }
  if (bal_value !== null && typeof bal_value === 'object') {
    const bal_proto = Object.getPrototypeOf(bal_value);
    if (bal_proto !== Object.prototype && bal_proto !== null) return bal_value;
    const bal_copy: Record<string, unknown> = {};
    for (const bal_key of Object.keys(bal_value as Record<string, unknown>)) {
      bal_copy[bal_key] = bal_plain_clone((bal_value as Record<string, unknown>)[bal_key]);
    }
    return bal_copy as unknown as T;
  }
  return bal_value;
}
