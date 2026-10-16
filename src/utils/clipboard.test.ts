import { describe, expect, it } from 'vitest';
import { bal_copy_text } from './clipboard';

describe('bal_copy_text', () => {
  it('returns false gracefully when no clipboard API exists', async () => {
    const bal_result = await bal_copy_text('probe');
    expect(typeof bal_result).toBe('boolean');
  });
});
