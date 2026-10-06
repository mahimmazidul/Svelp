import { describe, expect, it } from 'vitest';
import { bal_slex } from './shobdo_lexer';
import { bal_sparse, bal_consent_default_title } from './naksha_parser';

function bal_parse(bal_source: string) {
  const bal_lexed = bal_slex(bal_source);
  return bal_sparse(bal_lexed.tokens, bal_lexed.errors);
}

describe('source parser', () => {
  it('parses a full questionnaire with meta sections and questions', () => {
    const bal_result = bal_parse(`svelp 1
title "Food Frequency Study"
description "Dietary frequency questionnaire"
paper a4

section "Demographics"

number age "Age"
min 18
max 100
unit "years"
required

single sex "Sex"
option male "Male" code "M"
option female "Female" code "F"
required

yesno smoking "Do you currently smoke?"
yes 1
no 0
`);
    expect(bal_result.errors).toEqual([]);
    expect(bal_result.doc.version).toBe(1);
    expect(bal_result.doc.meta.title).toBe('Food Frequency Study');
    expect(bal_result.doc.meta.paper).toBe('a4');
    expect(bal_result.doc.sections).toHaveLength(1);
    const bal_items = bal_result.doc.sections[0].items;
    expect(bal_items.map((bal_i) => bal_i.head)).toEqual(['number', 'single', 'yesno']);
    expect(bal_items[0]).toMatchObject({ min: 18, max: 100, unit: 'years', required: true });
    expect(bal_items[1].options[0]).toMatchObject({ key: 'male', label: 'Male', code: 'M' });
    expect(bal_items[2]).toMatchObject({ yesCode: '1', noCode: '0' });
  });

  it('parses reusable scales, likert inline points, and bulk questions', () => {
    const bal_result = bal_parse(`svelp 1
title "T"

scale frequency
option never "Never" code 0
option daily "Daily" code 6

single fish_frequency "Fish consumption"
use frequency
required

likert satisfaction "I am satisfied"
1 "Strongly disagree"
5 "Strongly agree"

section "Diet"

questions using frequency {
rice_frequency "Rice"
egg_frequency "Egg"
}
`);
    expect(bal_result.errors).toEqual([]);
    expect(bal_result.doc.scales[0].options).toHaveLength(2);
    expect(bal_result.doc.looseItems[0]).toMatchObject({ head: 'single', useScale: 'frequency', required: true });
    expect(bal_result.doc.looseItems[1].likertPoints[1]).toMatchObject({ code: '5', label: 'Strongly agree' });
    const bal_bulk = bal_result.doc.sections[0].items[0];
    expect(bal_bulk.head).toBe('single');
    expect(bal_bulk.useScale).toBe('frequency');
    expect(bal_bulk.bulkItems).toEqual([
      { variableName: 'rice_frequency', label: 'Rice', line: 19 },
      { variableName: 'egg_frequency', label: 'Egg', line: 20 }
    ]);
  });

  it('parses matrices with braced rows and csv text block rows', () => {
    const bal_result = bal_parse(`svelp 1
title "T"

section "Food"

matrix food_frequency "Food frequency"
scale frequency
single_per_row
rows {
rice "Rice"
fish "Fish"
}

matrix quick_matrix "Quick"
columns severity
rows """
mild,Mild
severe,Severe
Sudden onset
"""

matrix label_rows "Labels only"
column mild "Mild" code 1
rows """
Rice
Fish
"""
`);
    expect(bal_result.errors).toEqual([]);
    const bal_items = bal_result.doc.sections[0].items;
    expect(bal_items).toHaveLength(3);
    expect(bal_items[0].matrixScale).toBe('frequency');
    expect(bal_items[0].rows).toEqual([
      { key: 'rice', label: 'Rice', line: 10 },
      { key: 'fish', label: 'Fish', line: 11 }
    ]);
    expect(bal_items[1].matrixScale).toBe('severity');
    expect(bal_items[1].rows[0]).toMatchObject({ key: 'mild', label: 'Mild' });
    expect(bal_items[1].rows[2]).toMatchObject({ key: null, label: 'Sudden onset' });
    expect(bal_items[2].matrixColumns[0]).toMatchObject({ key: 'mild', code: '1' });
    expect(bal_items[2].rows.map((bal_r) => bal_r.label)).toEqual(['Rice', 'Fish']);
  });

  it('parses consent blocks and signatures with multiline text', () => {
    const bal_result = bal_parse(`svelp 1
title "T"

consent consent_block "Participant Consent"
introduction """
This study examines dietary habits.
"""
purpose """
You will be asked about food intake.
"""
acknowledgement "I have read and understood the information above."

participant_signature participant_sig "Participant signature"
printed_name
date

researcher_signature researcher_sig "Researcher signature"
no_date
`);
    expect(bal_result.errors).toEqual([]);
    const bal_consent = bal_result.doc.looseItems[0];
    expect(bal_consent.head).toBe('consent');
    expect(bal_consent.consentIntroduction).toBe('This study examines dietary habits.');
    expect(bal_consent.consentSections[0]).toMatchObject({ kind: 'purpose', title: null });
    expect(bal_consent.acknowledgement).toContain('read and understood');
    const bal_participant = bal_result.doc.looseItems[1];
    expect(bal_participant).toMatchObject({ printedName: true, date: true });
    const bal_researcher = bal_result.doc.looseItems[2];
    expect(bal_researcher).toMatchObject({ printedName: null, date: false });
    expect(bal_consent_default_title('voluntary')).toBe('Voluntary participation');
  });

  it('recovers after errors and reports several problems in one pass', () => {
    const bal_result = bal_parse(`svelp 1
title "T"

single water "Water source"
option tap
option well "Well" code 2

number age "Age"
min abc

longtext notes "Notes"
maxlen 500
`);
    expect(bal_result.errors.length).toBeGreaterThanOrEqual(2);
    expect(bal_result.errors[0]).toMatchObject({ line: 5 });
    expect(bal_result.errors[0].message).toContain('option label');
    expect(bal_result.errors[1]).toMatchObject({ line: 9 });
    expect(bal_result.errors[1].message).toContain('integer');
    expect(bal_result.doc.sections).toHaveLength(0);
    expect(bal_result.doc.looseItems.map((bal_i) => bal_i.head)).toEqual(['single', 'number', 'longtext']);
    expect(bal_result.doc.looseItems[2].maxlen).toBe(500);
  });

  it('requires the version header and rejects unknown language versions', () => {
    const bal_missing = bal_parse('title "No header"\n');
    expect(bal_missing.errors[0].message).toContain('must start with');
    const bal_future = bal_parse('svelp 2\ntitle "Future"\n');
    expect(bal_future.errors[0].message).toContain('version 2');
    expect(bal_future.errors[0].message).toContain('reads version 1');
  });

  it('keeps section directives and instructions with callout', () => {
    const bal_result = bal_parse(`svelp 1
title "T"

section consent_section "Consent"
new_page
description "Signature page"

instruction """
Please answer based on your usual dietary intake.
"""
callout
`);
    expect(bal_result.errors).toEqual([]);
    const bal_section = bal_result.doc.sections[0];
    expect(bal_section).toMatchObject({ key: 'consent_section', newPage: true, description: 'Signature page' });
    const bal_instruction = bal_section.items[0];
    expect(bal_instruction.head).toBe('instruction');
    expect(bal_instruction.callout).toBe(true);
    expect(bal_instruction.label).toBe('Please answer based on your usual dietary intake.');
  });

  it('flags a missing question label with the offending line', () => {
    const bal_result = bal_parse('svelp 1\ntitle "T"\nsingle water_source\n');
    expect(bal_result.errors[0]).toMatchObject({ line: 3 });
    expect(bal_result.errors[0].message).toContain('question label after "single"');
  });
});
