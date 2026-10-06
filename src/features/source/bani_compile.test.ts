import { describe, expect, it } from 'vitest';
import { bal_slex } from './shobdo_lexer';
import { bal_sparse } from './naksha_parser';
import { bal_svalidate } from './bhul_validate';
import { bal_plan_apply } from './bani_compile';
import type { QuestionnaireRecord, ResponseScaleRecord } from '../../models/types';

function bal_doc(bal_source: string) {
  const bal_lexed = bal_slex(bal_source);
  return bal_sparse(bal_lexed.tokens, bal_lexed.errors).doc;
}

function bal_scale(bal_overrides: Partial<ResponseScaleRecord>): ResponseScaleRecord {
  return {
    id: 'scale-1',
    name: 'frequency',
    options: [
      { id: 'o1', label: 'Never', coding: '0' },
      { id: 'o2', label: 'Daily', coding: '6' }
    ],
    createdAt: 1,
    updatedAt: 1,
    ...bal_overrides
  };
}

function bal_questionnaire(): QuestionnaireRecord {
  return {
    id: 'q-1',
    projectId: 'p-1',
    title: 'Water Study',
    description: null,
    version: 1,
    language: 'en',
    paperSize: 'a4',
    orientation: 'portrait',
    theme: null,
    status: 'draft',
    metadata: null,
    printSettings: null,
    sections: [
      {
        id: 'sec-1',
        type: 'section',
        title: 'Household',
        description: null,
        metadata: { sourceKey: 'household' },
        printConfig: null,
        items: [
          {
            id: 'item-1',
            type: 'single_choice',
            variableName: 'water_source',
            label: 'Main water source',
            required: true,
            options: [
              { id: 'opt-1', label: 'Tap water', coding: '1' },
              { id: 'opt-2', label: 'Well', coding: '2' }
            ],
            coding: null,
            validation: { minSelections: null, maxSelections: null },
            scannerConfig: null,
            printConfig: null,
            metadata: { sourceKey: 'water_source' },
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
    createdAt: 1,
    updatedAt: 1
  };
}

describe('source semantic validation', () => {
  it('detects duplicate variables unknown scales and bad ranges with lines', () => {
    const bal_result = bal_svalidate(
      bal_doc(`svelp 1
title "T"

single age "Age"
option a "A" code 1
option b "B" code 1

number years "Years"
min 50
max 10

single food "Food"
use weekly_missing
`)
    );
    expect(bal_result.map((bal_i) => bal_i.severity)).toContain('error');
    expect(bal_result.some((bal_i) => bal_i.message.includes('Duplicate variable "age"'))).toBe(false);
    expect(bal_result.some((bal_i) => bal_i.message.includes('Duplicate code "1"'))).toBe(true);
    expect(bal_result.some((bal_i) => bal_i.message.includes('greater than maximum'))).toBe(true);
    expect(bal_result.some((bal_i) => bal_i.message.includes('Unknown scale "weekly_missing"'))).toBe(true);
  });

  it('reports matrix problems and suggests variables for keyless questions', () => {
    const bal_result = bal_svalidate(
      bal_doc(`svelp 1
title "T"

matrix empty_matrix "Empty"
scale nothing
rows {
}

single "Primary water source"
`)
    );
    expect(bal_result.some((bal_i) => bal_i.message.includes('Unknown scale "nothing"'))).toBe(true);
    expect(bal_result.some((bal_i) => bal_i.message.includes('no rows'))).toBe(true);
    const bal_suggestion = bal_result.find((bal_i) => bal_i.severity === 'info');
    expect(bal_suggestion?.message).toContain('primary_water_source');
  });

  it('warns on incomplete consent and duplicate scale definitions', () => {
    const bal_result = bal_svalidate(
      bal_doc(`svelp 1
title "T"

scale freq
option a "A" code 1

scale freq
option b "B" code 2

consent "Consent"
`)
    );
    expect(bal_result.some((bal_i) => bal_i.message.includes('Duplicate scale "freq"'))).toBe(true);
    expect(bal_result.some((bal_i) => bal_i.severity === 'warning' && bal_i.message.includes('acknowledgement'))).toBe(true);
  });
});

describe('source apply planning', () => {
  it('preserves item option and scale identity across label and required edits', () => {
    const bal_previous = bal_questionnaire();
    const bal_plan = bal_plan_apply(
      bal_doc(`svelp 1
title "Water Study"

section household "Household"

single water_source "Primary drinking water source"
option tap "Tap water" code 1
option well "Tube well" code 2
`),
      bal_previous,
      []
    );
    if (!bal_plan.ok) throw new Error(JSON.stringify(bal_plan.errors));
    const bal_section = bal_plan.questionnaire.sections[0];
    expect(bal_section.id).toBe('sec-1');
    const bal_item = bal_section.items[0];
    expect(bal_item.id).toBe('item-1');
    expect(bal_item.metadata?.sourceKey).toBe('water_source');
    expect(bal_item.options.map((bal_o) => bal_o.id)).toEqual(['opt-1', 'opt-2']);
    expect(bal_item.label).toBe('Primary drinking water source');
    expect(bal_plan.changes.itemsAdded).toBe(0);
    expect(bal_plan.changes.itemsRemoved).toBe(0);
    expect(bal_plan.changes.itemsModified).toBe(1);
  });

  it('keeps the item id when a variable is renamed in source', () => {
    const bal_previous = bal_questionnaire();
    const bal_plan = bal_plan_apply(
      bal_doc(`svelp 1
title "Water Study"

section household "Household"

single drinking_water "Primary water source"
option tap "Tap water" code 1
option well "Well" code 2
`),
      bal_previous,
      []
    );
    if (!bal_plan.ok) throw new Error(JSON.stringify(bal_plan.errors));
    const bal_item = bal_plan.questionnaire.sections[0].items[0];
    expect(bal_item.id).toBe('item-1');
    expect(bal_item.variableName).toBe('drinking_water');
    expect(bal_plan.changes.variablesRenamed).toEqual([{ from: 'water_source', to: 'drinking_water' }]);
  });

  it('reports removals with data and additions in the change summary', () => {
    const bal_previous = bal_questionnaire();
    const bal_plan = bal_plan_apply(
      bal_doc(`svelp 1
title "Water Study"

section household "Household"

number acres "Land size"
min 0
`),
      bal_previous,
      [],
      new Set(['water_source'])
    );
    if (!bal_plan.ok) throw new Error(JSON.stringify(bal_plan.errors));
    expect(bal_plan.changes.itemsAdded).toBe(1);
    expect(bal_plan.changes.itemsRemoved).toBe(1);
    expect(bal_plan.changes.variablesRemovedWithData).toEqual(['water_source']);
    expect(bal_plan.questionnaire.sections[0].items[0].id).not.toBe('item-1');
  });

  it('upserts reusable scales keeping option ids for stable codes', () => {
    const bal_previous = bal_questionnaire();
    const bal_existing = bal_scale({});
    const bal_plan = bal_plan_apply(
      bal_doc(`svelp 1
title "T"

scale frequency
option never "Never" code 0
option often "Often" code 4
option daily "Daily" code 6

single fish_frequency "Fish frequency"
use frequency
`),
      bal_previous,
      [bal_existing]
    );
    if (!bal_plan.ok) throw new Error(JSON.stringify(bal_plan.errors));
    expect(bal_plan.scales[0].id).toBe('scale-1');
    expect(bal_plan.scales[0].options.map((bal_o) => bal_o.id)).toEqual(['o1', bal_plan.scales[0].options[1].id, 'o2']);
    expect(bal_plan.questionnaire.sections[0].items[0].scaleId).toBe('scale-1');
  });

  it('expands bulk questions into ordinary items and blocks ranking removal', () => {
    const bal_plan = bal_plan_apply(
      bal_doc(`svelp 1
title "T"

scale freq
option a "A" code 1

section "Diet"

questions using freq {
rice_frequency "Rice"
egg_frequency "Egg"
}
`),
      null,
      []
    );
    if (!bal_plan.ok) throw new Error(JSON.stringify(bal_plan.errors));
    expect(bal_plan.questionnaire.sections[0].items.map((bal_i) => bal_i.variableName)).toEqual([
      'rice_frequency',
      'egg_frequency'
    ]);
    expect(bal_plan.questionnaire.sections[0].items.every((bal_i) => bal_i.scaleId !== null)).toBe(true);

    const bal_with_ranking = bal_questionnaire();
    bal_with_ranking.sections[0].items.push({
      id: 'item-rank',
      type: 'ranking',
      variableName: 'rank_things',
      label: 'Rank these',
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
    });
    const bal_blocked = bal_plan_apply(bal_doc('svelp 1\ntitle "Water Study"\n'), bal_with_ranking, []);
    expect(bal_blocked.ok).toBe(false);
    if (!bal_blocked.ok) expect(bal_blocked.errors[0]).toContain('ranking');
  });
});
