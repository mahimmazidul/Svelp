import { describe, expect, it } from 'vitest';
import { bal_blank_reference_id, bal_ensure_blank_references, type bal_BlankRenderer } from './reading_blank';
import type { BlankReferenceRecord } from '../../models/response_models';
import { bal_build_print_document } from '../print/print_layout';
import { bal_frequency_scale, bal_mixed_survey } from '../print/print_fixtures';

function bal_fake_renderer(bal_log: string[]): bal_BlankRenderer {
  return async (bal_page) => {
    bal_log.push(`render:${bal_page.pageNumber}`);
    return new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
  };
}

describe('blank references', () => {
  it('builds reference ids from fingerprint and page number', () => {
    expect(bal_blank_reference_id('fp-123', 2)).toBe('fp-123:2');
  });

  it('renders one blank per page through the injected renderer', async () => {
    const bal_q = bal_mixed_survey();
    const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: [bal_frequency_scale()] });
    const bal_log: string[] = [];
    const bal_records = await bal_ensure_blank_references(bal_q, [bal_frequency_scale()], '037', [], bal_fake_renderer(bal_log));
    expect(bal_records).toHaveLength(bal_doc.pages.length);
    expect(bal_log).toEqual(bal_doc.pages.map((bal_p) => `render:${bal_p.pageNumber}`));
    for (let bal_i = 0; bal_i < bal_records.length; bal_i++) {
      expect(bal_records[bal_i].id).toBe(`${bal_doc.fingerprint}:${bal_doc.pages[bal_i].pageNumber}`);
      expect(bal_records[bal_i].fingerprint).toBe(bal_doc.fingerprint);
      expect(bal_records[bal_i].widthPx).toBeGreaterThan(0);
      expect(bal_records[bal_i].bytes.size).toBe(3);
    }
  });

  it('reuses cached references and never re-renders matching pages', async () => {
    const bal_q = bal_mixed_survey();
    const bal_log: string[] = [];
    const bal_first = await bal_ensure_blank_references(bal_q, [bal_frequency_scale()], '037', [], bal_fake_renderer(bal_log));
    const bal_log_second: string[] = [];
    const bal_second = await bal_ensure_blank_references(
      bal_q,
      [bal_frequency_scale()],
      '037',
      bal_first,
      bal_fake_renderer(bal_log_second)
    );
    expect(bal_log_second).toEqual([]);
    expect(bal_second.map((bal_r) => bal_r.id)).toEqual(bal_first.map((bal_r) => bal_r.id));
  });

  it('re-renders when the cached record belongs to another questionnaire version', async () => {
    const bal_q = bal_mixed_survey();
    const bal_log: string[] = [];
    const bal_render = bal_fake_renderer(bal_log);
    const bal_stale: BlankReferenceRecord[] = [
      {
        id: 'old-fingerprint:1',
        fingerprint: 'old-fingerprint',
        pageNumber: 1,
        questionnaireVersion: 1,
        mime: 'image/png',
        bytes: new Blob([new Uint8Array([9])]),
        widthPx: 1000,
        heightPx: 1400,
        createdAt: 1
      }
    ];
    const bal_records = await bal_ensure_blank_references(bal_q, [bal_frequency_scale()], '037', bal_stale, bal_render);
    expect(bal_records[0].id).not.toBe('old-fingerprint:1');
    expect(bal_log.length).toBeGreaterThan(0);
  });
});
