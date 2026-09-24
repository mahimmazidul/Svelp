export function new_id(): string {
  const bal_crypto = globalThis.crypto;
  if (bal_crypto && typeof bal_crypto.randomUUID === 'function') {
    return bal_crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}
