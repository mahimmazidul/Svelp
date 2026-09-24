import { describe, expect, it } from 'vitest';
import {
  bal_parse_page_payload,
  bal_payload_matches_expected
} from './scan_payload';
import { bal_resolve_layouts_for_payload } from './scan_resolve';
import type { PrintLayoutRecord } from '../../models/print_models';

function bal_payload_result(bal_raw: string) {
  return bal_parse_page_payload(bal_raw);
}

describe('page payload decoding', () => {
  it('decodes a valid phase 3 payload', () => {
    const bal_result = bal_payload_result('S1|FFQ|2|037|1');
    expect(bal_result.ok).toBe(true);
    if (!bal_result.ok) return;
    expect(bal_result.identifier).toEqual({
      format: 'S1',
      studyCode: 'FFQ',
      version: 2,
      respondentId: '037',
      pageNumber: 1
    });
  });

  it('tolerates surrounding whitespace', () => {
    expect(bal_payload_result('  S1|A1|1|X9|12\n').ok).toBe(true);
  });

  it('rejects non-svelp text', () => {
    const bal_result = bal_payload_result('see other document 42');
    expect(bal_result.ok).toBe(false);
    if (bal_result.ok) return;
    expect(bal_result.rejection.code).toBe('not-svelp-format');
  });

  it('rejects wrong field counts', () => {
    for (const bal_bad of ['S1|FFQ|2|037', 'S1|FFQ|2|037|1|9', '|||']) {
      const bal_result = bal_payload_result(bal_bad);
      expect(bal_result.ok).toBe(false);
      if (!bal_result.ok) expect(bal_result.rejection.code).toBe('field-count');
    }
  });

  it('rejects unsupported format versions', () => {
    const bal_result = bal_payload_result('S2|FFQ|2|037|1');
    expect(bal_result.ok).toBe(false);
    if (bal_result.ok) return;
    expect(bal_result.rejection.code).toBe('bad-format-version');
  });

  it('rejects malformed study codes, versions, respondents, and pages', () => {
    const bal_cases: [string, string][] = [
      ['S1|ffq!|2|037|1', 'bad-study-code'],
      ['S1|TOOLONGCODE|2|037|1', 'bad-study-code'],
      ['S1|FFQ|x|037|1', 'bad-version'],
      ['S1|FFQ|0|037|1', 'bad-version'],
      ['S1|FFQ|2||1', 'bad-respondent'],
      ['S1|FFQ|2|037|0', 'bad-page-number'],
      ['S1|FFQ|2|037|999', 'bad-page-number'],
      ['S1|FFQ|2|037|x', 'bad-page-number']
    ];
    for (const [bal_bad, bal_code] of bal_cases) {
      const bal_result = bal_payload_result(bad_bad_guard(bal_bad));
      expect(bal_result.ok).toBe(false);
      if (!bal_result.ok) expect(bal_result.rejection.code).toBe(bal_code);
    }
  });

  function bad_bad_guard(bal_value: string): string {
    return bal_value;
  }

  it('validates an identifier against expected layout facts', () => {
    expect(
      bal_payload_matches_expected(
        { format: 'S1', studyCode: 'FFQ', version: 2, respondentId: '037', pageNumber: 3 },
        { studyCode: 'FFQ', version: 2, pageCount: 4 }
      )
    ).toBeNull();
    const bal_wrong_code = bal_payload_matches_expected(
      { format: 'S1', studyCode: 'KAP', version: 2, respondentId: '037', pageNumber: 1 },
      { studyCode: 'FFQ', version: 2, pageCount: 4 }
    );
    expect(bal_wrong_code?.code).toBe('bad-study-code');
    const bal_wrong_page = bal_payload_matches_expected(
      { format: 'S1', studyCode: 'FFQ', version: 2, respondentId: '037', pageNumber: 9 },
      { studyCode: 'FFQ', version: 2, pageCount: 4 }
    );
    expect(bal_wrong_page?.code).toBe('bad-page-number');
  });
});

function bal_layout_row(
  bal_id: string,
  bal_payload: string
): PrintLayoutRecord {
  return {
    id: bal_id,
    questionnaireId: `q-${bal_id}`,
    projectId: 'p-1',
    questionnaireVersion: 1,
    fingerprint: `fp-${bal_id}`,
    paperSize: 'a4',
    orientation: 'portrait',
    settingsSnapshot: {} as PrintLayoutRecord['settingsSnapshot'],
    geometry: {
      questionnaireId: `q-${bal_id}`,
      questionnaireVersion: 1,
      fingerprint: `fp-${bal_id}`,
      paperSize: 'a4',
      orientation: 'portrait',
      scannerMode: true,
      pageCount: 2,
      pages: [
        {
          pageNumber: 1,
          width: 210,
          height: 297,
          margins: { top: 18, right: 16, bottom: 18, left: 16 },
          contentBounds: { x: 16, y: 30, width: 178, height: 239 },
          safeBounds: { x: 19, y: 33, width: 172, height: 233 },
          headerBounds: null,
          footerBounds: null,
          respondentIdBounds: null,
          identifier: { payload: bal_payload, humanReadable: null, qrBounds: null, normalized: null, moduleCount: 21, quietZoneModules: 4, textBounds: null },
          alignmentMarkers: [],
          itemBounds: [],
          answerRegions: []
        },
        {
          pageNumber: 2,
          width: 210,
          height: 297,
          margins: { top: 18, right: 16, bottom: 18, left: 16 },
          contentBounds: { x: 16, y: 30, width: 178, height: 239 },
          safeBounds: { x: 19, y: 33, width: 172, height: 233 },
          headerBounds: null,
          footerBounds: null,
          respondentIdBounds: null,
          identifier: { payload: bal_payload.replace(/\|(\d+)$/, (_bal_m, bal_p) => `|${Number(bal_p) + 1}`), humanReadable: null, qrBounds: null, normalized: null, moduleCount: 21, quietZoneModules: 4, textBounds: null },
          alignmentMarkers: [],
          itemBounds: [],
          answerRegions: []
        }
      ]
    } as unknown as PrintLayoutRecord['geometry'],
    createdAt: 1,
    updatedAt: 2
  };
}

describe('layout resolution', () => {
  it('resolves a payload to the matching questionnaire layout and page count', () => {
    const bal_layouts = [
      bal_layout_row('one', 'S1|FFQ|1||1'),
      bal_layout_row('two', 'S1|KAP|1||1')
    ];
    const bal_result = bal_resolve_layouts_for_payload(
      { studyCode: 'KAP', version: 1, pageNumber: 2 },
      bal_layouts
    );
    expect(bal_result.matches).toHaveLength(1);
    expect(bal_result.matches[0].layout.questionnaireId).toBe('q-two');
    expect(bal_result.matches[0].pageCount).toBe(2);
    expect(bal_result.pageCountMismatch).toBe(false);
  });

  it('flags impossible page numbers and does not match', () => {
    const bal_layouts = [bal_layout_row('one', 'S1|FFQ|1||1')];
    const bal_result = bal_resolve_layouts_for_payload(
      { studyCode: 'FFQ', version: 1, pageNumber: 7 },
      bal_layouts
    );
    expect(bal_result.matches).toHaveLength(0);
    expect(bal_result.pageCountMismatch).toBe(true);
  });

  it('returns multiple matches when study codes collide across questionnaires', () => {
    const bal_layouts = [
      bal_layout_row('one', 'S1|FFQ|1||1'),
      bal_layout_row('two', 'S1|FFQ|1||1')
    ];
    const bal_result = bal_resolve_layouts_for_payload(
      { studyCode: 'FFQ', version: 1, pageNumber: 1 },
      bal_layouts
    );
    expect(bal_result.matches).toHaveLength(2);
  });
});
