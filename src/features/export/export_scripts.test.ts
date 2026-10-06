import { describe, expect, it } from 'vitest';
import type { ResponseAuditEventRecord } from '../../models/response_models';
import {
  bal_audit_rows,
  bal_diagnostics_to_csv,
  bal_audit_to_csv,
  bal_r_helper,
  bal_research_summary,
  bal_spss_syntax
} from './export_scripts';
import { bal_build_codebook, bal_export_columns } from './export_dataset';
import { bal_questionnaire } from './export_dataset.test';

function bal_event(bal_overrides: Partial<ResponseAuditEventRecord>): ResponseAuditEventRecord {
  return {
    id: 'evt-1',
    projectId: 'p1',
    responseId: 'r1',
    respondentId: 'R-001',
    itemId: 'i1',
    rowId: null,
    previousValue: ['piped'],
    previousStatus: 'accepted',
    finalValue: ['well'],
    finalStatus: 'accepted',
    action: 'manual-correction',
    createdAt: 1759700000000,
    ...bal_overrides
  };
}

function bal_text(bal_event: ResponseAuditEventRecord, bal_key: 'previousValue' | 'finalValue'): string {
  return (bal_event[bal_key] ?? []).join('; ');
}

describe('spss syntax', () => {
  it('declares variables, labels, value labels, and missing values over the csv', () => {
    const bal_q = bal_questionnaire();
    const bal_columns = bal_export_columns(bal_q, { optionColumns: true });
    const bal_syntax = bal_spss_syntax(bal_columns, bal_build_codebook(bal_columns, bal_q, []), 'Water-Study-v2-responses.csv');
    expect(bal_syntax).toContain('/FILE=\'Water-Study-v2-responses.csv\'');
    expect(bal_syntax).toContain('/DELIMITERS=","');
    expect(bal_syntax).toContain('/FIRSTCASE=2');
    expect(bal_syntax).toContain('    water_source A255');
    expect(bal_syntax).toContain('    crops_rice F1.0');
    expect(bal_syntax).toContain('VARIABLE LABELS');
    expect(bal_syntax).toContain("    water_source 'Main water source'");
    expect(bal_syntax).toContain('VALUE LABELS');
    expect(bal_syntax).toContain("    /water_source '1' 'Piped water' '2' 'Deep well' 'Other' 'Other'");
    expect(bal_syntax).toContain("    /crops_rice 1 'Rice'");
    expect(bal_syntax).toContain("    /food_frequency_rice 'D' 'Daily' 'W' 'Weekly' 'N' 'Never'");
    expect(bal_syntax).toContain('MISSING VALUES');
    expect(bal_syntax).toContain('crops_rice crops_jute crops_wheat (\'\')');
    expect(bal_syntax.endsWith('EXECUTE.\n')).toBe(true);
  });

  it('escapes single quotes in labels', () => {
    const bal_q = bal_questionnaire();
    const bal_columns = bal_export_columns(bal_q);
    const bal_codebook = bal_build_codebook(bal_export_columns(bal_q), bal_q, []).map((bal_row) =>
      bal_row.variableName === 'village_name' ? { ...bal_row, questionLabel: "Mother's village" } : bal_row
    );
    const bal_syntax = bal_spss_syntax(bal_columns, bal_codebook, 'x.csv');
    expect(bal_syntax).toContain("'Mother''s village'");
  });
});

describe('r helper', () => {
  it('reads the csv as characters and maps coded labels to factors', () => {
    const bal_q = bal_questionnaire();
    const bal_columns = bal_export_columns(bal_q, { optionColumns: true });
    const bal_helper = bal_r_helper('Water-Study-v2-responses.csv', bal_columns, bal_build_codebook(bal_columns, bal_q, []));
    expect(bal_helper).toContain('read.csv("Water-Study-v2-responses.csv", colClasses = "character"');
    expect(bal_helper).toContain('water_source_labels <- c("1" = "Piped water", "2" = "Deep well", "Other" = "Other")');
    expect(bal_helper).toContain('crops_rice_labels <- c("1" = "Rice")');
    expect(bal_helper).toContain('responses$water_source <- factor(responses$water_source');
  });
});

describe('audit export', () => {
  it('builds sorted audit rows with iso timestamps and response metadata', () => {
    const bal_rows = bal_audit_rows(
      [
        bal_event({ id: 'evt-2', createdAt: 1759700060000 }),
        bal_event({ id: 'evt-1', createdAt: 1759700000000 })
      ],
      new Map([
        ['r1', { id: 'r1', variableName: 'water_source', algorithmVersion: 'R1' } as never]
      ]),
      bal_text
    );
    expect(bal_rows).toHaveLength(2);
    expect(bal_rows[0].action).toBe('manual-correction');
    expect(bal_rows[0].previousValue).toBe('piped');
    expect(bal_rows[0].variableName).toBe('water_source');
    expect(bal_rows[0].algorithmVersion).toBe('R1');
    expect(bal_rows[0].timestamp).toContain('T');
  });

  it('serializes the audit csv with stable headers and empty nullable cells', () => {
    const bal_csv = bal_audit_to_csv(
      bal_audit_rows(
        [bal_event({ rowId: 'row-daily', previousValue: null, previousStatus: null })],
        new Map([['r1', { id: 'r1', variableName: 'water_source', algorithmVersion: 'R1' } as never]]),
        bal_text
      )
    );
    expect(bal_csv.split('\r\n')[0]).toBe(
      'timestamp,respondent_id,variable_name,item_id,matrix_row_id,action,previous_value,previous_status,final_value,final_status,algorithm_version,response_id'
    );
    expect(bal_csv.split('\r\n')[1]).toContain(',R-001,water_source,i1,row-daily,manual-correction,,');
  });
});

describe('research summary', () => {
  it('serializes counts and provenance without fake percentages', () => {
    const bal_json = bal_research_summary({
      questionnaireTitle: 'Water Study',
      questionnaireVersion: 2,
      respondentCount: 12,
      algorithmVersion: 'R1',
      profileName: 'balanced',
      autoAccepted: 30,
      reviewedCorrected: 4,
      blanks: 2,
      unresolved: 3,
      missingPageRespondents: 1,
      transcriptionPending: 2,
      versionConflicts: 0,
      svelpVersion: '0.1.0'
    });
    const bal_parsed = JSON.parse(bal_json) as { counts: Record<string, number>; recognitionAlgorithmVersion: string };
    expect(bal_parsed.counts.autoAccepted).toBe(30);
    expect(bal_parsed.counts.unresolved).toBe(3);
    expect(bal_parsed.recognitionAlgorithmVersion).toBe('R1');
    expect(bal_json).toContain('evidence scores, not probabilities');
    expect(bal_json).not.toContain('%');
  });
});

describe('diagnostics export', () => {
  it('exposes machine values and evidence scores without touching the clean dataset', () => {
    const bal_csv = bal_diagnostics_to_csv(
      [
        {
          id: 'r1',
          respondentId: 'R-001',
          variableName: 'water_source',
          value: ['well'],
          machineValue: ['piped'],
          status: 'corrected' as never,
          confidence: 0.42,
          manuallyReviewed: true,
          algorithmVersion: 'R1',
          sourcePageId: null
        } as never
      ],
      ['R-001']
    );
    expect(bal_csv.split('\r\n')[0]).toBe(
      'respondent_id,variable_name,final_value,machine_detected_value,recognition_status,evidence_score,manually_reviewed,algorithm_version,source_page_id'
    );
    expect(bal_csv.split('\r\n')[1]).toBe('R-001,water_source,well,piped,corrected,0.42,true,R1,');
  });
});
