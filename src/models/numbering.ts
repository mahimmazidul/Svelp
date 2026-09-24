import type { QuestionnaireRecord } from './types';

export interface DerivedNumbering {
  sectionLabels: Record<string, string>;
  itemLabels: Record<string, string>;
  questionCount: number;
}

export function derive_numbering(bal_q: QuestionnaireRecord): DerivedNumbering {
  const bal_section_labels: Record<string, string> = {};
  const bal_item_labels: Record<string, string> = {};
  let bal_question_number = 0;
  bal_q.sections.forEach((bal_section, bal_si) => {
    bal_section_labels[bal_section.id] = `Section ${bal_si + 1}`;
    for (const bal_item of bal_section.items) {
      if (bal_item.type === 'instruction') continue;
      bal_question_number += 1;
      bal_item_labels[bal_item.id] = `Q${bal_question_number}`;
    }
  });
  return {
    sectionLabels: bal_section_labels,
    itemLabels: bal_item_labels,
    questionCount: bal_question_number
  };
}
