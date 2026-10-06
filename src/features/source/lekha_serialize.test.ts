import { describe, expect, it } from 'vitest';
import { bal_slex } from './shobdo_lexer';
import { bal_sparse } from './naksha_parser';
import { bal_plan_apply } from './bani_compile';
import { bal_source_serialize, bal_questionnaire_source_diff } from './lekha_serialize';
import { bal_source_format } from './bal_source_pipeline';
import type { QuestionnaireRecord, ResponseScaleRecord } from '../../models/types';

function bal_cycle(bal_source: string, bal_scales: ResponseScaleRecord[] = []) {
  const bal_parsed = bal_sparse(bal_slex(bal_source).tokens, []);
  const bal_plan = bal_plan_apply(bal_parsed.doc, null, bal_scales);
  if (!bal_plan.ok) throw new Error(JSON.stringify(bal_plan.errors));
  return bal_plan;
}


describe('source serializer', () => {
  it('emits canonical text for every construct', () => {
    const bal_plan = bal_cycle(`svelp 1
title "Food Study"
description "Diet"

scale frequency
option never "Never" code 0
option daily "Daily" code 6

section "Diet"

single fish "Fish frequency"
use frequency
required

multiple symptoms "Symptoms"
option pain "Pain" code 1
option swelling "Swelling" code 2
max 3

yesno smoking "Smokes?"
yes 2
no 0

shorttext job "Occupation"
maxlen 100

number acres "Land"
min 0
max 50
step 1
unit "acres"

date visit "Visit date"

likert happy "I am happy"
1 "Never"
2 "Often"

matrix meals "Meals"
scale frequency
rows {
rice "Rice"
fish "Fish"
}

consent "Consent"
introduction """
Intro text.
"""
purpose """
Purpose text.
"""
acknowledgement "I agree."

participant_signature sig "Signature"
no_date
`);
    const bal_source = bal_source_serialize(bal_plan.questionnaire, bal_plan.scales);
    expect(bal_source.skipped).toEqual([]);
    expect(bal_source.text).toContain('svelp 1');
    expect(bal_source.text).toContain('scale frequency');
    expect(bal_source.text).toContain('single fish "Fish frequency"\n  required\n  use frequency');
    expect(bal_source.text).toContain('max 3');
    expect(bal_source.text).toContain('yes 2');
    expect(bal_source.text).not.toContain('yes 1');
    expect(bal_source.text).toContain('maxlen 100');
    expect(bal_source.text).toContain('unit "acres"');
    expect(bal_source.text).toContain('  1 "Never"\n  2 "Often"');
    expect(bal_source.text).toContain('scale frequency');
    expect(bal_source.text).toContain('  rows {\n    rice "Rice"\n    fish "Fish"\n  }');
    expect(bal_source.text).toContain('  introduction\n"Intro text."');
    expect(bal_source.text).toContain('acknowledgement "I agree."');
    expect(bal_source.text).toContain('no_date');
  });

  it('round trips schema to source to schema with identical semantics', () => {
    const bal_first = bal_cycle(`svelp 1
title "Round Trip"

section "Household"

single water "Water source"
option tap "Tap water" code 1
option well "Well" code 2
required

matrix meals "Meals"
scale frequency
multiple_per_row
rows """
rice,Rice
fish,Fish
egg,Egg
""");

consent "Consent"
introduction """
Line one.
Line two.
"""
voluntary "Voluntary section" """
Participation is voluntary.
"""
acknowledgement "I agree."
`);
    const bal_serialized = bal_source_serialize(bal_first.questionnaire, bal_first.scales);
    const bal_second = bal_cycle(bal_serialized.text);
    expect(bal_questionnaire_source_diff(bal_first.questionnaire, bal_second.questionnaire)).toBe(true);
    const bal_third = bal_source_serialize(bal_second.questionnaire, bal_second.scales);
    expect(bal_third.text).toBe(bal_serialized.text);
  });

  it('keeps multiline consent content exact across a round trip', () => {
    const bal_body = 'Line "quoted" and backslash.\n\nThird paragraph after blank line.';
    const bal_source = `svelp 1
title "Consent"
consent "Consent"
introduction
"""
${bal_body}
"""
`;
    const bal_plan = bal_cycle(bal_source);
    const bal_item = bal_plan.questionnaire.sections[0].items[0];
    expect(bal_item.consent?.introduction).toBe(bal_body);
    const bal_serialized = bal_source_serialize(bal_plan.questionnaire, bal_plan.scales);
    const bal_again = bal_cycle(bal_serialized.text);
    expect(bal_again.questionnaire.sections[0].items[0].consent?.introduction).toBe(bal_body);
  });

  it('reports ranking items as skipped instead of dropping them silently', () => {
    const bal_questionnaire: QuestionnaireRecord = {
      id: 'q',
      projectId: 'p',
      title: 'Rank study',
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
          id: 's',
          type: 'section',
          title: 'S',
          description: null,
          metadata: null,
          printConfig: null,
          items: [
            {
              id: 'i',
              type: 'ranking',
              variableName: 'rank',
              label: 'Rank options',
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
      createdAt: 1,
      updatedAt: 1
    };
    const bal_result = bal_source_serialize(bal_questionnaire, []);
    expect(bal_result.skipped).toEqual([{ label: 'Rank options', type: 'ranking' }]);
    expect(bal_result.text).not.toContain('rank');
  });
});

describe('source pipeline', () => {
  it('formats unformatted source into canonical text', () => {
    const bal_formatted = bal_source_format('svelp 1\ntitle   "Messy"\n\n\nsingle water "Water"\noption a "A" code 1\nrequired\n');
    expect(bal_formatted).toContain('title "Messy"');
    expect(bal_formatted).toContain('single water "Water"\n  required\n  option a "A" code 1');
  });

  it('returns null when formatting invalid source', () => {
    expect(bal_source_format('svelp 1\ntitle "X"\nsingle broken\n')).toBeNull();
  });
});
