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
import type {
  ProjectRecord,
  QuestionnaireRecord,
  ResponseScaleRecord
} from '../../models/types';
import type { PrintLayoutRecord } from '../../models/print_models';

function bal_project(): ProjectRecord {
  return {
    id: 'proj-1',
    title: 'Water Survey 2026',
    description: 'Community water access survey',
    status: 'active',
    createdAt: 1727600000000,
    updatedAt: 1727700000000
  };
}

function bal_scale(): ResponseScaleRecord {
  return {
    id: 'scale-agree',
    name: 'Agreement',
    options: [
      { id: 'o1', label: 'Strongly agree', coding: '5' },
      { id: 'o2', label: 'Agree', coding: '4' },
      { id: 'o3', label: 'Neutral', coding: '3' },
      { id: 'o4', label: 'Disagree', coding: '2' },
      { id: 'o5', label: 'Strongly disagree', coding: '1' }
    ],
    createdAt: 1727600000000,
    updatedAt: 1727600000000
  };
}

function bal_questionnaire(): QuestionnaireRecord {
  return {
    id: 'q-1',
    projectId: 'proj-1',
    title: 'Water Survey',
    description: null,
    version: 3,
    language: 'en',
    paperSize: 'a4',
    orientation: 'portrait',
    theme: null,
    status: 'published',
    metadata: null,
    printSettings: null,
    sections: [
      {
        id: 's1',
        type: 'section',
        title: 'Background',
        description: null,
        printConfig: null,
        metadata: null,
        items: [
          {
            id: 'i1',
            type: 'single_choice',
            variableName: 'water_source',
            label: 'Main water source',
            required: true,
            options: [
              { id: 'o1', label: 'Piped', coding: '1' },
              { id: 'o2', label: 'Well', coding: '2' }
            ],
            coding: null,
            validation: null,
            scannerConfig: null,
            printConfig: null,
            metadata: null,
            scaleId: 'scale-agree',
            placeholder: null,
            heading: null,
            emphasis: 'normal',
            rows: [],
            columns: [],
            selectionMode: 'single',
            consent: null,
            signature: null,
            unitLabel: null
          }
        ]
      }
    ],
    createdAt: 1727600000000,
    updatedAt: 1727700000000
  };
}

function bal_layout(): PrintLayoutRecord {
  return {
    id: 'layout-1',
    questionnaireId: 'q-1',
    projectId: 'proj-1',
    questionnaireVersion: 3,
    fingerprint: 'fp-a37792f7',
    paperSize: 'a4',
    orientation: 'portrait',
    settingsSnapshot: {
      margins: { top: 12, right: 10.5, bottom: 12, left: 10.5 },
      theme: { name: 'academic', fontFamily: 'helvetica', baseFontSize: 10.5, headingScale: 1.2, lineWeight: 0.5 },
      density: 'standard',
      questionSpacing: 6,
      header: {
        showTitle: true,
        showInstitution: false,
        institution: '',
        showStudyCode: true,
        studyCode: 'WS2026',
        showVersion: true,
        showRespondentId: true,
        respondentIdLabel: 'Respondent ID'
      },
      footer: {
        showPageNumbers: true,
        showStudyCode: true,
        confidentialityNote: '',
        showHumanIdentifier: false
      },
      showMachineIdentifier: true,
      scannerMode: true,
      marker: { diameterMm: 3.2, regionPaddingMm: 1.4 },
      identifier: { sizeMm: 16, errorCorrection: 'M' },
      respondentArea: { enabled: true, label: 'Respondent ID' },
      logo: null
    },
    geometry: {
      questionnaireId: 'q-1',
      questionnaireVersion: 3,
      fingerprint: 'fp-a37792f7',
      paperSize: 'a4',
      orientation: 'portrait',
      scannerMode: true,
      pageCount: 1,
      pages: [
        {
          pageNumber: 1,
          width: 210,
          height: 297,
          margins: { top: 12, right: 10.5, bottom: 12, left: 10.5 },
          contentBounds: { x: 10.5, y: 12, width: 189, height: 273 },
          safeBounds: { x: 10.5, y: 12, width: 189, height: 273 },
          headerBounds: { x: 10.5, y: 12, width: 189, height: 20 },
          footerBounds: null,
          respondentIdBounds: { x: 150, y: 20, width: 40, height: 11 },
          identifier: {
            payload: 'S1|WS2026|3||1',
            humanReadable: 'WS-2026- P1/1',
            qrBounds: { x: 12, y: 266, width: 16, height: 16 },
            normalized: { x: 0.0571, y: 0.8956, width: 0.0762, height: 0.0539 },
            moduleCount: 29,
            quietZoneModules: 4,
            textBounds: null
          },
          alignmentMarkers: [
            {
              corner: 'topLeft',
              rect: { x: 7, y: 7, width: 3.2, height: 3.2 },
              normalized: { x: 0.0333, y: 0.0236, width: 0.0152, height: 0.0108 }
            },
            {
              corner: 'topRight',
              rect: { x: 199.8, y: 7, width: 3.2, height: 3.2 },
              normalized: { x: 0.9514, y: 0.0236, width: 0.0152, height: 0.0108 }
            },
            {
              corner: 'bottomLeft',
              rect: { x: 7, y: 286.8, width: 3.2, height: 3.2 },
              normalized: { x: 0.0333, y: 0.9657, width: 0.0152, height: 0.0108 }
            },
            {
              corner: 'bottomRight',
              rect: { x: 199.8, y: 286.8, width: 3.2, height: 3.2 },
              normalized: { x: 0.9514, y: 0.9657, width: 0.0152, height: 0.0108 }
            }
          ],
          itemBounds: [
            {
              itemId: 'i1',
              sectionId: 's1',
              itemType: 'single_choice',
              chunkKind: 'question',
              pageNumber: 1,
              rect: { x: 14, y: 50, width: 120, height: 8 },
              normalized: { x: 0.0667, y: 0.1684, width: 0.5714, height: 0.0269 }
            }
          ],
          answerRegions: [
            {
              itemId: 'i1',
              variableName: 'water_source',
              itemType: 'single_choice',
              kind: 'choice',
              optionId: 'o1',
              optionCode: '1',
              rowId: null,
              columnId: null,
              markerType: 'bubble',
              selection: 'single',
              pageNumber: 1,
              rect: { x: 30.4, y: 56.5, width: 3.2, height: 3.2 },
              normalized: { x: 0.1448, y: 0.1902, width: 0.0152, height: 0.0108 }
            }
          ]
        }
      ]
    },
    createdAt: 1727600000000,
    updatedAt: 1727700000000
  };
}

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
