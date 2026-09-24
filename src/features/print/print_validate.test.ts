import { describe, expect, it } from 'vitest';
import { bal_validate_print, type PrintIssue } from './print_validate';
import { bal_build_print_document } from './print_layout';
import { bal_consent_heavy, bal_ffq, bal_frequency_scale, bal_mixed_survey, bal_short_survey } from './print_fixtures';
import type { PrintSettings } from '../../models/types';

function bal_scanner_settings(bal_overrides: Partial<PrintSettings>): Partial<PrintSettings> {
  return {
    showMachineIdentifier: true,
    scannerMode: true,
    header: {
      showTitle: true,
      showInstitution: false,
      institution: '',
      showStudyCode: true,
      studyCode: 'FFQ',
      showVersion: true,
      showRespondentId: true,
      respondentIdLabel: 'Respondent ID'
    },
    footer: {
      showPageNumbers: true,
      showStudyCode: true,
      confidentialityNote: '',
      showHumanIdentifier: true
    },
    ...bal_overrides
  };
}

function bal_codes(bal_issues: PrintIssue[]): string[] {
  return bal_issues.map((bal_issue) => bal_issue.code);
}

describe('print readiness report', () => {
  it('reports ready status with no issues for a clean small form', () => {
    const bal_doc = bal_build_print_document({ questionnaire: bal_short_survey(), scales: [] });
    const bal_report = bal_validate_print(bal_doc);
    expect(bal_report.status).toBe('ready');
    expect(bal_report.issues).toEqual([]);
    expect(bal_report.groups.every((bal_g) => bal_g.errors === 0 && bal_g.warnings === 0)).toBe(true);
  });

  it('reports warnings for tight margins and small codes in scanner mode', () => {
    const bal_q = bal_short_survey();
    bal_q.printSettings = bal_scanner_settings({
      margins: { top: 12, right: 12, bottom: 12, left: 12 },
      identifier: { sizeMm: 14, errorCorrection: 'M' },
      marker: { diameterMm: 3.6, regionPaddingMm: 1 }
    }) as PrintSettings;
    const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: [] });
    const bal_report = bal_validate_print(bal_doc);
    const bal_found = bal_codes(bal_report.issues);
    expect(bal_found).toContain('tight-margin');
    expect(bal_found).toContain('small-identifier');
    expect(bal_found).toContain('small-marker');
    expect(bal_report.status).toBe('warnings');
  });

  it('passes a full FFQ in scanner mode without geometry errors', () => {
    const bal_q = bal_ffq(60);
    bal_q.printSettings = bal_scanner_settings({}) as PrintSettings;
    const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: [bal_frequency_scale()] });
    const bal_report = bal_validate_print(bal_doc);
    const bal_errors = bal_report.issues.filter((bal_i) => bal_i.severity === 'error');
    expect(bal_errors).toEqual([]);
    expect(bal_report.status).toBe('ready');
  });

  it('flags no alignment markers as errors when scanner mode is on', () => {
    const bal_q = bal_short_survey();
    bal_q.printSettings = bal_scanner_settings({}) as PrintSettings;
    const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: [] });
    for (const bal_page of bal_doc.pages) {
      bal_page.geometry.alignmentMarkers = [];
    }
    const bal_report = bal_validate_print(bal_doc);
    expect(bal_codes(bal_report.issues)).toContain('missing-alignment-markers');
    expect(bal_report.status).toBe('errors');
  });

  it('flags a missing machine identifier when it is required', () => {
    const bal_q = bal_short_survey();
    bal_q.printSettings = bal_scanner_settings({}) as PrintSettings;
    const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: [] });
    for (const bal_page of bal_doc.pages) {
      bal_page.geometry.identifier = null;
    }
    const bal_report = bal_validate_print(bal_doc);
    expect(bal_codes(bal_report.issues)).toContain('missing-identifier');
  });

  it('reports an empty questionnaire as an error', () => {
    const bal_q = bal_short_survey();
    bal_q.sections[0].items = [];
    bal_q.sections = [];
    const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: [] });
    const bal_report = bal_validate_print(bal_doc);
    expect(bal_codes(bal_report.issues)).toContain('empty-document');
  });

  it('groups issues by category with correct counts', () => {
    const bal_q = bal_short_survey();
    bal_q.printSettings = bal_scanner_settings({
      margins: { top: 11, right: 16, bottom: 18, left: 16 }
    }) as PrintSettings;
    const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: [] });
    const bal_report = bal_validate_print(bal_doc);
    const bal_margins_group = bal_report.groups.find((bal_g) => bal_g.category === 'margins');
    expect(bal_margins_group?.warnings).toBe(1);
  });

  it('keeps mixed survey and consent forms ready by default', () => {
    for (const bal_q of [bal_mixed_survey(), bal_consent_heavy()]) {
      const bal_doc = bal_build_print_document({ questionnaire: bal_q, scales: [] });
      expect(bal_validate_print(bal_doc).status).toBe('ready');
    }
  });
});
