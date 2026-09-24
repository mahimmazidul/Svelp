import { describe, expect, it } from 'vitest';
import {
  dhon_banaitesi_item,
  dhon_banaitesi_questionnaire,
  dhon_banaitesi_section
} from './factories';
import { derive_numbering } from './numbering';

function bal_fixture() {
  const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p1', title: 'Test' });
  const bal_second = dhon_banaitesi_section('Second');
  bal_q.sections[0].items = [
    dhon_banaitesi_item('instruction', null),
    dhon_banaitesi_item('single_choice', 'q1'),
    dhon_banaitesi_item('single_choice', 'q2')
  ];
  bal_second.items = [dhon_banaitesi_item('single_choice', 'q3')];
  bal_q.sections = [...bal_q.sections, bal_second];
  return bal_q;
}

describe('derive_numbering', () => {
  it('numbers sections and questions in order', () => {
    const bal_result = derive_numbering(bal_fixture());
    expect(Object.values(bal_result.sectionLabels)).toEqual(['Section 1', 'Section 2']);
    expect(Object.values(bal_result.itemLabels)).toEqual(['Q1', 'Q2', 'Q3']);
    expect(bal_result.questionCount).toBe(3);
  });

  it('skips instructions in question numbering', () => {
    const bal_q = bal_fixture();
    const bal_result = derive_numbering(bal_q);
    const bal_instruction = bal_q.sections[0].items[0];
    expect(bal_result.itemLabels[bal_instruction.id]).toBeUndefined();
  });
});
