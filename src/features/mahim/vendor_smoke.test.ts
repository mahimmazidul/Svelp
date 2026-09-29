import { describe, expect, it } from 'vitest';
import { createMahimWriter, openMahim, encodeCbor, decodeCbor, SectionType } from '/home/user/svelp-repo/vendor/mahim/index.js';

describe('vendored mahim', () => {
  it('round trips through a Blob', async () => {
    const bytes = await createMahimWriter()
      .setApplication({ identifier: 'svelp', payloadVersion: 1 })
      .addSection({ type: SectionType.Metadata, name: 'probe', data: encodeCbor({ ok: true }) })
      .finalize();
    const reader = await openMahim(new Blob([bytes]));
    expect(reader.applicationIdentifier).toBe('svelp');
    expect(decodeCbor(await reader.getSection('probe'))).toEqual({ ok: true });
  });
});
