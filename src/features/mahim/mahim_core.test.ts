import { describe, expect, it } from 'vitest';
import {
  bal_cbor_pack,
  bal_cbor_unpack,
  BalPayloadSchemaError
} from './mahim_codec';
import {
  bal_backup_filename,
  bal_local_date_stamp,
  bal_print_batch_pdf_filename,
  bal_questionnaire_json_filename,
  bal_sanitize_filename,
  bal_transfer_filename
} from './mahim_filenames';
import { bal_build_transfer_package, bal_read_transfer_sections } from './mahim_transfer';
import { openMahim } from '../../../vendor/mahim/index.js';
import {
  bal_project,
  bal_questionnaire,
  bal_scale,
  bal_layout
} from './mahim_test_fixtures';

describe('mahim codec', () => {
  it('round trips fixed-point numbers through the marker form', () => {
    const bal_in = { a: 30.400000000000002, b: 3, c: [0.558, 'x', { d: -0.75 }], e: null };
    const bal_out = bal_cbor_unpack<typeof bal_in>(bal_cbor_pack(bal_in));
    expect(bal_out.a).toBeCloseTo(30.4, 9);
    expect(bal_out.b).toBe(3);
    expect(bal_out.c[0]).toBeCloseTo(0.558, 9);
    expect(bal_out.c[1]).toBe('x');
    expect((bal_out.c[2] as { d: number }).d).toBeCloseTo(-0.75, 9);
    expect(bal_out.e).toBeNull();
  });

  it('rejects non-finite numbers', () => {
    expect(() => bal_cbor_pack({ a: Number.NaN })).toThrow(BalPayloadSchemaError);
    expect(() => bal_cbor_pack({ a: Number.POSITIVE_INFINITY })).toThrow(BalPayloadSchemaError);
  });

  it('keeps integers exact and timestamps untouched', () => {
    const bal_in = { t: 1727600000000, n: 0, page: 12 };
    const bal_out = bal_cbor_unpack<typeof bal_in>(bal_cbor_pack(bal_in));
    expect(bal_out).toEqual(bal_in);
  });
});

describe('mahim filenames', () => {
  it('builds transfer names', () => {
    expect(bal_transfer_filename('Water Survey 2026', 3)).toBe('Water-Survey-2026-v3.mahim');
  });

  it('builds backup names with the local date', () => {
    expect(bal_backup_filename('Water Survey', new Date(2026, 8, 30, 10, 0, 0))).toBe(
      'Water-Survey-backup-2026-09-30.mahim'
    );
    expect(bal_local_date_stamp(new Date(2026, 0, 2))).toBe('2026-01-02');
  });

  it('sanitizes filesystem-invalid input while preserving safe Unicode', () => {
    expect(bal_sanitize_filename('  আমার   প্রকল্প? *bad/ | ', '.mahim')).toBe(
      'আমার-প্রকল্প-bad.mahim'
    );
    expect(bal_sanitize_filename('***', '.mahim')).toBe('svelp.mahim');
    expect(bal_sanitize_filename('name..../', '.mahim')).toBe('name.mahim');
    expect(bal_sanitize_filename('already.mahim', '.mahim')).toBe('already.mahim');
    expect(bal_sanitize_filename('ALREADY.MAHIM', '.mahim')).toBe('ALREADY.MAHIM.mahim');
  });

  it('caps length and builds json and pdf names', () => {
    const bal_long = bal_sanitize_filename('x'.repeat(200), '.mahim');
    expect(bal_long.length).toBeLessThanOrEqual(86);
    expect(bal_long.endsWith('.mahim')).toBe(true);
    expect(bal_questionnaire_json_filename('Water Survey', 2)).toBe(
      'Water-Survey-v2-questionnaire.json'
    );
    expect(bal_print_batch_pdf_filename('Water Survey', 2, 'R-001', 'R-010')).toBe(
      'Water-Survey-v2-R-001-R-010.pdf'
    );
  });
});

describe('mahim transfer package', () => {
  it('writes a valid svelp package that MAHIM can verify', async () => {
    const bal_result = await bal_build_transfer_package({
      project: bal_project(),
      questionnaire: bal_questionnaire(),
      scales: [bal_scale()],
      layouts: [bal_layout()],
      batches: []
    });
    if ('issues' in bal_result) throw new Error(JSON.stringify(bal_result.issues));
    expect(bal_result.build.summary.filename).toBe('Water-Survey-2026-v3.mahim');
    const bal_reader = await openMahim(new Blob([bal_result.build.bytes]));
    expect(bal_reader.applicationIdentifier).toBe('svelp');
    expect(bal_reader.header.applicationPayloadVersion).toBe(1);
    expect(bal_reader.listSections().map((bal_s) => bal_s.name)).toEqual([
      'manifest',
      'project',
      'questionnaires',
      'scales',
      'print'
    ]);
    const bal_report = await bal_reader.verify();
    expect(bal_report.valid).toBe(true);
    expect(bal_report.fileDigestValid).toBe(true);
    const bal_manifest = bal_cbor_unpack<Record<string, unknown>>(await bal_reader.getSection('manifest'));
    expect(bal_manifest['mode']).toBe('questionnaire-transfer');
    expect((bal_manifest['contents'] as Record<string, unknown>).printLayouts).toBe(1);
  });

  it('round trips through read validation with numbers intact', async () => {
    const bal_layout_row = bal_layout();
    const bal_result = await bal_build_transfer_package({
      project: bal_project(),
      questionnaire: bal_questionnaire(),
      scales: [bal_scale()],
      layouts: [bal_layout_row],
      batches: []
    });
    if ('issues' in bal_result) throw new Error('unexpected issues');
    const bal_reader = await openMahim(bal_result.build.bytes);
    const bal_sections = {
      manifest: bal_cbor_unpack(await bal_reader.getSection('manifest')),
      project: bal_cbor_unpack(await bal_reader.getSection('project')),
      questionnaires: bal_cbor_unpack(await bal_reader.getSection('questionnaires')),
      scales: bal_cbor_unpack(await bal_reader.getSection('scales')),
      print: bal_cbor_unpack(await bal_reader.getSection('print'))
    };
    const bal_check = bal_read_transfer_sections(bal_sections);
    expect(bal_check.issues).toEqual([]);
    expect(bal_check.ok).toBe(true);
  });

  it('rejects a questionnaire from another project', async () => {
    const bal_q = bal_questionnaire();
    bal_q.projectId = 'proj-other';
    const bal_result = await bal_build_transfer_package({
      project: bal_project(),
      questionnaire: bal_q,
      scales: [bal_scale()],
      layouts: [],
      batches: []
    });
    expect('issues' in bal_result).toBe(true);
  });

  it('filters layouts to the exported version', async () => {
    const bal_old = bal_layout();
    bal_old.questionnaireVersion = 2;
    bal_old.id = 'layout-old';
    const bal_result = await bal_build_transfer_package({
      project: bal_project(),
      questionnaire: bal_questionnaire(),
      scales: [bal_scale()],
      layouts: [bal_old, bal_layout()],
      batches: []
    });
    if ('issues' in bal_result) throw new Error('unexpected issues');
    expect(bal_result.build.summary.layoutCount).toBe(1);
    expect(bal_result.build.summary.pageCount).toBe(1);
  });
});
