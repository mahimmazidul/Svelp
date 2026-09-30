import { describe, expect, it } from 'vitest';
import type { QuestionnaireRecord, ResponseScaleRecord } from '../../models/types';
import type { ResponseRecord } from '../../models/response_models';
import {
  bal_build_codebook,
  bal_build_export_rows,
  bal_cell_value,
  bal_codebook_to_csv,
  bal_export_columns,
  bal_export_filenames,
  bal_slug_variable_part,
  bal_to_csv
} from './export_dataset';

function bal_questionnaire(): QuestionnaireRecord {
  return {
    id: 'q1',
    projectId: 'p1',
    title: 'Water Study',
    description: null,
    version: 3,
    language: 'en',
    paperSize: 'a4',
    orientation: 'portrait',
    theme: null,
    status: 'draft',
    metadata: null,
    printSettings: null,
    sections: [
      {
        id: 's1',
        type: 'section',
        title: 'Section 1',
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
              { id: 'o1', label: 'Piped water', coding: '1' },
              { id: 'o2', label: 'Deep well', coding: '2' },
              { id: 'o3', label: 'Other', coding: null }
            ],
            coding: null,
            validation: null,
            scannerConfig: null,
            printConfig: null,
            metadata: null,
            scaleId: null,
            placeholder: null,
            heading: null,
            emphasis: 'normal',
            rows: [],
            columns: [],
            selectionMode: 'single',
            consent: null,
            signature: null,
            unitLabel: null
          },
          {
            id: 'i2',
            type: 'matrix',
            variableName: 'food_frequency',
            label: 'How often is food eaten',
            required: false,
            options: [],
            coding: null,
            validation: null,
            scannerConfig: null,
            printConfig: null,
            metadata: null,
            scaleId: null,
            placeholder: null,
            heading: null,
            emphasis: 'normal',
            rows: [
              { id: 'r1', label: 'Rice' },
              { id: 'r2', label: 'Fish curry' },
              { id: 'r3', label: 'RICE!' }
            ],
            columns: [
              { id: 'c1', label: 'Daily', coding: 'D' },
              { id: 'c2', label: 'Weekly', coding: 'W' },
              { id: 'c3', label: 'Never', coding: 'N' }
            ],
            selectionMode: 'single',
            consent: null,
            signature: null,
            unitLabel: null
          },
          {
            id: 'i3',
            type: 'short_text',
            variableName: 'village_name',
            label: 'Village name',
            required: false,
            options: [],
            coding: null,
            validation: null,
            scannerConfig: null,
            printConfig: null,
            metadata: null,
            scaleId: null,
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
    createdAt: 0,
    updatedAt: 0
  };
}

function bal_response(bal_over: Partial<ResponseRecord>): ResponseRecord {
  return {
    id: 'resp::i1',
    projectId: 'p1',
    batchId: null,
    questionnaireId: 'q1',
    questionnaireVersion: 3,
    respondentId: 'R-001',
    itemId: 'i1',
    variableName: 'water_source',
    itemType: 'single_choice',
    rowId: null,
    columnId: null,
    value: ['o1'],
    codedValue: ['1'],
    status: 'accepted',
    confidence: 0.9,
    machineValue: ['o1'],
    machineStatus: 'accepted',
    machineConfidence: 0.9,
    manuallyReviewed: false,
    validationIssues: [],
    sourcePageId: null,
    sourceRegionRect: null,
    algorithmVersion: 'R1',
    thresholdProfileName: 'default-v1',
    recognitionRunId: null,
    createdAt: 0,
    updatedAt: 0,
    ...bal_over
  };
}

describe('export dataset', () => {
  it('slugifies matrix row labels into stable variable names', () => {
    expect(bal_slug_variable_part('Rice')).toBe('rice');
    expect(bal_slug_variable_part('Fish curry (fresh)')).toBe('fish_curry_fresh');
    expect(bal_slug_variable_part('!!!')).toBe('row');
  });

  it('disambiguates matrix rows whose labels slugify identically', () => {
    const bal_columns = bal_export_columns(bal_questionnaire());
    const bal_matrix = bal_columns.filter((bal_c) => bal_c.itemId === 'i2');
    expect(bal_matrix.map((bal_c) => bal_c.header)).toEqual([
      'food_frequency_rice',
      'food_frequency_fish_curry',
      'food_frequency_rice_2'
    ]);
  });

  it('exports coded values for accepted answers and blanks for unconfirmed ones', () => {
    const bal_q = bal_questionnaire();
    const bal_columns = bal_export_columns(bal_q);
    const bal_responses = [
      bal_response({}),
      bal_response({
        id: 'resp::i2::r1',
        itemId: 'i2',
        variableName: 'food_frequency',
        itemType: 'matrix',
        rowId: 'r1',
        value: ['c2'],
        codedValue: ['W']
      }),
      bal_response({
        id: 'resp::i2::r2',
        itemId: 'i2',
        variableName: 'food_frequency',
        itemType: 'matrix',
        rowId: 'r2',
        value: ['c1', 'c3'],
        status: 'ambiguous',
        manuallyReviewed: false
      }),
      bal_response({
        id: 'resp::i3',
        itemId: 'i3',
        variableName: 'village_name',
        itemType: 'short_text',
        value: ['Keraniganj'],
        status: 'accepted',
        manuallyReviewed: true
      })
    ];
    const bal_rows = bal_build_export_rows(bal_columns, bal_q, [], bal_responses, ['R-001']);
    expect(bal_rows[0]['respondent_id']).toBe('R-001');
    expect(bal_rows[0]['water_source']).toBe('1');
    expect(bal_rows[0]['food_frequency_rice']).toBe('W');
    expect(bal_rows[0]['food_frequency_fish_curry']).toBe('');
    expect(bal_rows[0]['village_name']).toBe('Keraniganj');
  });

  it('keeps manually corrected accepted values and drops unreviewed suggestions', () => {
    const bal_q = bal_questionnaire();
    const bal_value = bal_cell_value(
      bal_response({ value: ['o2'], codedValue: null, manuallyReviewed: true, confidence: null }),
      bal_q.sections[0].items[0],
      [],
      []
    );
    expect(bal_value).toBe('2');
    const bal_pending = bal_cell_value(
      bal_response({ status: 'needs-review', manuallyReviewed: false }),
      bal_q.sections[0].items[0],
      [],
      []
    );
    expect(bal_pending).toBe('');
    const bal_manual_blank = bal_cell_value(
      bal_response({ value: [], status: 'blank', manuallyReviewed: true }),
      bal_q.sections[0].items[0],
      [],
      []
    );
    expect(bal_manual_blank).toBe('');
  });

  it('falls back to option labels when no coding exists', () => {
    const bal_q = bal_questionnaire();
    const bal_value = bal_cell_value(
      bal_response({ value: ['o3'] }),
      bal_q.sections[0].items[0],
      [],
      []
    );
    expect(bal_value).toBe('Other');
  });

  it('escapes csv cells and terminates rows consistently', () => {
    const bal_csv = bal_to_csv([{ respondent_id: 'R,1', water_source: 'say "hi"' }], [
      'respondent_id',
      'water_source'
    ]);
    expect(bal_csv).toBe('respondent_id,water_source\r\n"R,1","say ""hi"""\r\n');
  });

  it('builds a codebook with one row per option and matrix column definitions', () => {
    const bal_q = bal_questionnaire();
    const bal_columns = bal_export_columns(bal_q);
    const bal_rows = bal_build_codebook(bal_columns, bal_q, []);
    const bal_water = bal_rows.filter((bal_r) => bal_r.variableName === 'water_source');
    expect(bal_water.map((bal_r) => bal_r.optionCode)).toEqual(['1', '2', 'Other']);
    const bal_rice = bal_rows.filter((bal_r) => bal_r.variableName === 'food_frequency_rice');
    expect(bal_rice.map((bal_r) => bal_r.optionCode)).toEqual(['D', 'W', 'N']);
    expect(bal_rice[0].matrixRowLabel).toBe('Rice');
    const bal_village = bal_rows.filter((bal_r) => bal_r.variableName === 'village_name');
    expect(bal_village).toHaveLength(1);
    expect(bal_village[0].optionLabel).toBeNull();
    const bal_csv = bal_codebook_to_csv(bal_rows);
    expect(bal_csv.startsWith('variable_name,question_number,question_label,item_type,required,matrix_row_label,option_label,option_code\r\n')).toBe(
      true
    );
  });

  it('honours scale-defined options for likert items', () => {
    const bal_q = bal_questionnaire();
    const bal_likert: QuestionnaireRecord = {
      ...bal_q,
      sections: [
        {
          ...bal_q.sections[0],
          items: [
            {
              ...bal_q.sections[0].items[0],
              id: 'i4',
              type: 'likert_scale',
              variableName: 'agreement',
              label: 'Agreement',
              options: [],
              scaleId: 'sc1'
            }
          ]
        }
      ]
    };
    const bal_scales: ResponseScaleRecord[] = [
      {
        id: 'sc1',
        name: 'Agreement',
        options: [
          { id: 'a1', label: 'Agree', coding: 'A' },
          { id: 'a2', label: 'Disagree', coding: 'B' }
        ],
        createdAt: 0,
        updatedAt: 0
      }
    ];
    const bal_columns = bal_export_columns(bal_likert);
    const bal_rows = bal_build_codebook(bal_columns, bal_likert, bal_scales);
    expect(bal_rows.map((bal_r) => bal_r.optionCode)).toEqual(['A', 'B']);
    const bal_value = bal_cell_value(
      bal_response({ id: 'resp::i4', itemId: 'i4', variableName: 'agreement', itemType: 'likert_scale', value: ['a2'] }),
      bal_likert.sections[0].items[0],
      bal_scales,
      []
    );
    expect(bal_value).toBe('B');
  });

  it('sanitizes export filenames through the shared sanitizer', () => {
    const bal_names = bal_export_filenames('Water Study: Phase 2', 3);
    expect(bal_names.responsesCsv).toBe('Water-Study-Phase-2-v3-responses.csv');
    expect(bal_names.responsesJson).toBe('Water-Study-Phase-2-v3-responses.json');
    expect(bal_names.codebookCsv).toBe('Water-Study-Phase-2-v3-codebook.csv');
  });
});
