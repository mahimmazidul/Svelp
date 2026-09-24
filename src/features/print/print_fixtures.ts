import {
  dhon_banaitesi_item,
  dhon_banaitesi_questionnaire,
  dhon_banaitesi_section,
  komola_option
} from '../../models/factories';
import type { QuestionnaireItem, QuestionnaireRecord, ResponseScaleRecord } from '../../models/types';

export function bal_short_survey(): QuestionnaireRecord {
  const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p1', title: 'Short survey' });
  const bal_items = [
    dhon_banaitesi_item('yes_no', 'Do you eat rice daily?'),
    dhon_banaitesi_item('short_text', 'What is your household code?'),
    dhon_banaitesi_item('number', 'How many people live in the household?')
  ];
  bal_items.forEach((bal_item, bal_i) => {
    bal_item.label = bal_item.label ?? '';
    bal_item.variableName = `v${bal_i + 1}`;
  });
  bal_q.sections[0].items = bal_items;
  return bal_q;
}

export function bal_choice_item(bal_label: string, bal_option_count: number): QuestionnaireItem {
  const bal_item = dhon_banaitesi_item('single_choice', bal_label);
  bal_item.options = Array.from({ length: bal_option_count }, (bal_x, bal_i) =>
    komola_option(`Option ${bal_i + 1}`)
  );
  return bal_item;
}

export function bal_mixed_survey(): QuestionnaireRecord {
  const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p1', title: 'Mixed survey' });
  const bal_first = dhon_banaitesi_section('Background');
  bal_first.items = [
    bal_choice_item('What is your age group?', 6),
    dhon_banaitesi_item('long_text', 'Describe your household food source.'),
    bal_choice_item('Which cooking fuel do you use most?', 5),
    dhon_banaitesi_item('date', 'When was the survey conducted?')
  ];
  const bal_second = dhon_banaitesi_section('Consumption');
  bal_second.printConfig = { pageBreakBefore: true };
  const bal_likert = dhon_banaitesi_item('likert_scale', 'How satisfied are you with food variety?');
  bal_likert.options = Array.from({ length: 5 }, (bal_x, bal_i) => {
    const bal_option = komola_option(`Level ${bal_i + 1}`);
    bal_option.coding = String(bal_i + 1);
    return bal_option;
  });
  bal_second.items = [
    dhon_banaitesi_item('instruction', 'Please answer the following questions about the last seven days.'),
    bal_likert,
    dhon_banaitesi_item('multiple_choice', 'Which meals do you eat outside the home?'),
    bal_choice_item('Who usually cooks in the household?', 4),
    dhon_banaitesi_item('participant_signature', null)
  ];
  bal_q.sections = [bal_first, bal_second];
  return bal_q;
}

export function bal_consent_heavy(): QuestionnaireRecord {
  const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p1', title: 'Consent study' });
  const bal_consent = dhon_banaitesi_item('consent', null);
  bal_consent.consent = {
    title: 'Informed consent for participation',
    introduction:
      'You are being invited to take part in a research study on household food security. This document explains the purpose, procedures, risks, and benefits of the study. Please read it carefully before deciding whether to participate. Taking part is entirely voluntary.',
    sections: [
      {
        id: 'cs1',
        kind: 'purpose',
        title: 'Purpose of the study',
        body:
          'The purpose of this study is to measure seasonal changes in household food consumption across rural districts. The findings will be used to design better nutrition programmes and will be shared with local health authorities in an aggregated form that cannot identify any individual participant.'
      },
      {
        id: 'cs2',
        kind: 'procedures',
        title: 'Procedures',
        body:
          'If you agree to participate, a trained enumerator will visit your household four times over the next year. Each visit takes about forty minutes. During the visit the enumerator will ask you questions about the food your household consumed during the previous seven days and will record the answers on a paper form.'
      },
      {
        id: 'cs3',
        kind: 'risks',
        title: 'Risks and discomforts',
        body:
          'The study involves minimal risk. Some questions may feel personal, and you may skip any question you prefer not to answer. There are no other foreseeable physical, social, or legal risks from taking part in this study.'
      },
      {
        id: 'cs4',
        kind: 'benefits',
        title: 'Benefits',
        body:
          'There is no direct benefit to you from taking part. The information collected may help improve future nutrition programmes in your district.'
      },
      {
        id: 'cs5',
        kind: 'confidentiality',
        title: 'Confidentiality',
        body:
          'All information collected will be kept confidential. Forms are identified only by a code number, and the list linking code numbers to names will be stored separately and destroyed after the study. Research records will be available only to the study team.'
      },
      {
        id: 'cs6',
        kind: 'withdrawal',
        title: 'Withdrawal',
        body:
          'You may withdraw from the study at any time without penalty or loss of benefits to which you are otherwise entitled.'
      },
      {
        id: 'cs7',
        kind: 'contacts',
        title: 'Contacts',
        body:
          'Questions about the study may be directed to the study coordinator. If you have concerns about your rights as a participant you may contact the regional research ethics committee.'
      }
    ],
    acknowledgementLabel: 'I have read this form and I agree to participate in this study.'
  };
  if (bal_consent.consent) {
    const bal_repeat = [...bal_consent.consent.sections, ...bal_consent.consent.sections];
    bal_repeat.forEach((bal_section, bal_i) => {
      bal_consent.consent?.sections.push({
        ...bal_section,
        id: `${bal_section.id}-r${bal_i}`
      });
    });
  }
  const bal_signature = dhon_banaitesi_item('participant_signature', null);
  bal_signature.signature = { signerRole: 'Participant', includePrintedName: true, includeDate: true };
  const bal_researcher = dhon_banaitesi_item('researcher_signature', null);
  bal_researcher.signature = { signerRole: 'Enumerator', includePrintedName: true, includeDate: true };
  bal_q.sections[0].items = [bal_consent, bal_signature, bal_researcher];
  return bal_q;
}

export function bal_frequency_scale(): ResponseScaleRecord {
  return {
    id: 'scale-freq',
    name: 'Consumption frequency',
    options: [
      { id: 'f1', label: 'Never', coding: '0' },
      { id: 'f2', label: 'Rarely', coding: '1' },
      { id: 'f3', label: 'Weekly', coding: '2' },
      { id: 'f4', label: 'Daily', coding: '4' }
    ],
    createdAt: 0,
    updatedAt: 0
  };
}

export function bal_ffq(bal_rows = 60, bal_linked_scale = true): QuestionnaireRecord {
  const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p1', title: 'Food frequency questionnaire' });
  const bal_matrix = dhon_banaitesi_item('matrix', 'How often did the household eat each food in the last month?');
  bal_matrix.scaleId = bal_linked_scale ? 'scale-freq' : null;
  bal_matrix.options = [];
  bal_matrix.rows = Array.from({ length: bal_rows }, (bal_x, bal_i) => ({
    id: `row-${bal_i + 1}`,
    label: `Food item ${bal_i + 1}`
  }));
  bal_q.sections[0].items = [
    bal_choice_item('How many meals does the household eat per day?', 3),
    bal_matrix
  ];
  return bal_q;
}

export function bal_custom_matrix(bal_rows: number, bal_columns: string[]): QuestionnaireRecord {
  const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p1', title: 'Custom matrix' });
  const bal_matrix = dhon_banaitesi_item('matrix', 'Rate each item.');
  bal_matrix.scaleId = null;
  bal_matrix.columns = bal_columns.map((bal_label, bal_i) => ({
    id: `col-${bal_i + 1}`,
    label: bal_label,
    coding: String(bal_i)
  }));
  bal_matrix.rows = Array.from({ length: bal_rows }, (bal_x, bal_i) => ({
    id: `row-${bal_i + 1}`,
    label: `Item ${bal_i + 1}`
  }));
  bal_q.sections[0].items = [bal_matrix];
  return bal_q;
}
