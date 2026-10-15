import { dhon_banaitesi_item, dhon_banaitesi_questionnaire, dhon_banaitesi_section } from '../models/factories';
import type { QuestionnaireRecord, ResponseScaleRecord, PrintSettings } from '../models/types';
import { bal_build_print_document, type bal_PrintDocument } from '../features/print/print_layout';
import { bal_food_wastage_benchmark, bal_benchmark_scales } from './print_benchmark_fixtures';
import { bal_bangla_survey, bal_frequency_scale_bn } from './bangla_fixtures';
import { bal_ffq } from '../features/print/print_fixtures';
import type { PrintDensity } from '../models/types';

export type bal_CalibrationDensity = PrintDensity;

export interface bal_CalibrationSet {
  banglaDemographic: bal_PrintDocument;
  knowledgeMatrix: bal_PrintDocument;
  likertMatrix: bal_PrintDocument;
  frequency25: bal_PrintDocument;
  ffq60: bal_PrintDocument;
  consentSignatures: bal_PrintDocument;
}

function bal_kap_sections(): QuestionnaireRecord {
  const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p-kap', title: 'KAP food waste survey' });
  const bal_knowledge = dhon_banaitesi_section('Knowledge');
  bal_knowledge.items = Array.from({ length: 20 }, (_bal_n, bal_i) => {
    const bal_item = dhon_banaitesi_item('single_choice', `k${bal_i + 1}`);
    bal_item.label = `Knowledge statement ${bal_i + 1} about household food practices.`;
    bal_item.scaleId = 'scale-kap-know';
    return bal_item;
  });
  const bal_attitude = dhon_banaitesi_section('Attitudes');
  bal_attitude.items = Array.from({ length: 20 }, (_bal_n, bal_i) => {
    const bal_item = dhon_banaitesi_item('likert_scale', `a${bal_i + 1}`);
    bal_item.label = `Attitude statement ${bal_i + 1} about wasting food.`;
    bal_item.scaleId = 'scale-kap-agree';
    return bal_item;
  });
  const bal_practice = dhon_banaitesi_section('Practices');
  bal_practice.items = Array.from({ length: 20 }, (_bal_n, bal_i) => {
    const bal_item = dhon_banaitesi_item('single_choice', `p${bal_i + 1}`);
    bal_item.label = `Practice item ${bal_i + 1} in the past seven days.`;
    bal_item.scaleId = 'scale-kap-freq';
    return bal_item;
  });
  bal_q.sections = [bal_knowledge, bal_attitude, bal_practice];
  return bal_q;
}

function bal_frequency25(): QuestionnaireRecord {
  const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p-f25', title: 'Food waste frequency' });
  const bal_section = dhon_banaitesi_section('Waste frequency');
  const bal_matrix = dhon_banaitesi_item('matrix', 'waste_freq');
  bal_matrix.label = 'Mark how often each food was wasted in the past seven days.';
  bal_matrix.scaleId = null;
  bal_matrix.rows = Array.from({ length: 25 }, (_bal_n, bal_i) => ({
    id: `row-f25-${bal_i + 1}`,
    label: `Food ${bal_i + 1}`
  }));
  bal_matrix.columns = [
    { id: 'col-f25-1', label: 'Never', coding: '0' },
    { id: 'col-f25-2', label: 'Rarely', coding: '1' },
    { id: 'col-f25-3', label: 'Sometimes', coding: '2' },
    { id: 'col-f25-4', label: 'Often', coding: '3' },
    { id: 'col-f25-5', label: 'Always', coding: '4' }
  ];
  bal_section.items = [bal_matrix];
  bal_q.sections = [bal_section];
  return bal_q;
}

function bal_consent_page(): QuestionnaireRecord {
  const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p-consent', title: 'Consent and signatures' });
  const bal_section = dhon_banaitesi_section('Consent');
  const bal_consent = dhon_banaitesi_item('consent', null);
  bal_consent.consent = {
    title: 'Informed consent',
    introduction:
      'Taking part is voluntary. You may stop at any time. Answers are confidential and used only for this research.',
    sections: [
      { id: 'cal-cs-1', kind: 'purpose', title: 'Purpose', body: 'The study measures household food buying, use, and waste.' },
      { id: 'cal-cs-2', kind: 'confidentiality', title: 'Confidentiality', body: 'Forms carry a code number only; the key list is stored separately.' }
    ],
    acknowledgementLabel: 'I agree to participate'
  };
  const bal_sig1 = dhon_banaitesi_item('participant_signature', null);
  const bal_sig2 = dhon_banaitesi_item('researcher_signature', null);
  bal_section.items = [bal_consent, bal_sig1, bal_sig2];
  bal_q.sections = [bal_section];
  return bal_q;
}

function bal_with_density(bal_q: QuestionnaireRecord, bal_density: bal_CalibrationDensity): QuestionnaireRecord {
  return { ...bal_q, printSettings: { ...bal_q.printSettings, density: bal_density } as PrintSettings };
}

export function bal_calibration_set(bal_density: bal_CalibrationDensity): bal_CalibrationSet {
  const bal_bench = bal_with_density(bal_food_wastage_benchmark(), bal_density);
  const bal_bench_scales = bal_benchmark_scales();
  const bal_kap = bal_with_density(bal_kap_sections(), bal_density);
  const bal_kap_scales: ResponseScaleRecord[] = [
    {
      id: 'scale-kap-know',
      name: 'kap-know',
      options: [
        { id: 'kak-1', label: 'Yes', coding: '1' },
        { id: 'kak-2', label: 'No', coding: '0' },
        { id: 'kak-3', label: "Don't know", coding: '9' }
      ],
      createdAt: 1700000000000,
      updatedAt: 1700000000000
    },
    {
      id: 'scale-kap-agree',
      name: 'kap-agree',
      options: [
        { id: 'kaa-1', label: 'Strongly disagree', coding: '1' },
        { id: 'kaa-2', label: 'Disagree', coding: '2' },
        { id: 'kaa-3', label: 'Neutral', coding: '3' },
        { id: 'kaa-4', label: 'Agree', coding: '4' },
        { id: 'kaa-5', label: 'Strongly agree', coding: '5' }
      ],
      createdAt: 1700000000000,
      updatedAt: 1700000000000
    },
    {
      id: 'scale-kap-freq',
      name: 'kap-freq',
      options: [
        { id: 'kaf-1', label: 'Never', coding: '0' },
        { id: 'kaf-2', label: 'Rarely', coding: '1' },
        { id: 'kaf-3', label: 'Sometimes', coding: '2' },
        { id: 'kaf-4', label: 'Often', coding: '3' },
        { id: 'kaf-5', label: 'Always', coding: '4' }
      ],
      createdAt: 1700000000000,
      updatedAt: 1700000000000
    }
  ];
  return {
    banglaDemographic: bal_build_print_document({
      questionnaire: bal_with_density(bal_bangla_survey(), bal_density),
      scales: [bal_frequency_scale_bn()],
      respondentId: 'CAL-001'
    }),
    knowledgeMatrix: bal_build_print_document({
      questionnaire: bal_kap,
      scales: bal_kap_scales,
      respondentId: 'CAL-002'
    }),
    likertMatrix: bal_build_print_document({
      questionnaire: bal_bench,
      scales: bal_bench_scales,
      respondentId: 'CAL-003'
    }),
    frequency25: bal_build_print_document({
      questionnaire: bal_with_density(bal_frequency25(), bal_density),
      scales: [],
      respondentId: 'CAL-004'
    }),
    ffq60: bal_build_print_document({
      questionnaire: bal_with_density(bal_ffq(60), bal_density),
      scales: [
        {
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
        }
      ],
      respondentId: 'CAL-005'
    }),
    consentSignatures: bal_build_print_document({
      questionnaire: bal_with_density(bal_consent_page(), bal_density),
      scales: [],
      respondentId: 'CAL-006'
    })
  };
}
