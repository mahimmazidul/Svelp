import {
  dhon_banaitesi_item,
  dhon_banaitesi_questionnaire,
  dhon_banaitesi_section,
  komola_option
} from '../models/factories';
import type { QuestionnaireItem, QuestionnaireRecord, ResponseScaleRecord } from '../models/types';

export const BAL_BENCHMARK_FREQUENCY_SCALE = 'benchmark-frequency';

export function bal_benchmark_scales(): ResponseScaleRecord[] {
  return [
    {
      id: 'scale-bench-agree',
      name: 'agree5',
      options: [
        { id: 'ag1', label: 'Strongly disagree', coding: '1' },
        { id: 'ag2', label: 'Disagree', coding: '2' },
        { id: 'ag3', label: 'Neutral', coding: '3' },
        { id: 'ag4', label: 'Agree', coding: '4' },
        { id: 'ag5', label: 'Strongly agree', coding: '5' }
      ],
      createdAt: 1700000000000,
      updatedAt: 1700000000000
    },
    {
      id: `scale-${BAL_BENCHMARK_FREQUENCY_SCALE}`,
      name: BAL_BENCHMARK_FREQUENCY_SCALE,
      options: [
        { id: 'fq1', label: 'Never', coding: '0' },
        { id: 'fq2', label: 'Rarely', coding: '1' },
        { id: 'fq3', label: 'Sometimes', coding: '2' },
        { id: 'fq4', label: 'Often', coding: '3' },
        { id: 'fq5', label: 'Always', coding: '4' }
      ],
      createdAt: 1700000000000,
      updatedAt: 1700000000000
    },
    {
      id: 'scale-bench-know',
      name: 'know3',
      options: [
        { id: 'kn1', label: 'Yes', coding: '1' },
        { id: 'kn2', label: 'No', coding: '0' },
        { id: 'kn3', label: "Don't know", coding: '9' }
      ],
      createdAt: 1700000000000,
      updatedAt: 1700000000000
    }
  ];
}

function bal_choice(bal_label: string, bal_variable: string | null, bal_options: [string, string][]): QuestionnaireItem {
  const bal_item = dhon_banaitesi_item('single_choice', bal_variable);
  bal_item.label = bal_label;
  bal_item.options = bal_options.map(([bal_text, bal_code]) => {
    const bal_opt = komola_option(bal_text);
    bal_opt.coding = bal_code;
    return bal_opt;
  });
  return bal_item;
}

function bal_yesno_knowledge(bal_index: number, bal_label: string): QuestionnaireItem {
  const bal_item = dhon_banaitesi_item('single_choice', `k${bal_index}`);
  bal_item.label = bal_label;
  bal_item.scaleId = 'scale-bench-know';
  return bal_item;
}

function bal_likert(bal_index: number, bal_label: string): QuestionnaireItem {
  const bal_item = dhon_banaitesi_item('likert_scale', `a${bal_index}`);
  bal_item.label = bal_label;
  bal_item.scaleId = 'scale-bench-agree';
  return bal_item;
}

function bal_frequency(bal_index: number, bal_label: string): QuestionnaireItem {
  const bal_item = dhon_banaitesi_item('single_choice', `p${bal_index}`);
  bal_item.label = bal_label;
  bal_item.scaleId = `scale-${BAL_BENCHMARK_FREQUENCY_SCALE}`;
  return bal_item;
}

const BAL_KNOWLEDGE_STATEMENTS = [
  'Food waste contributes to greenhouse gas emissions.',
  'Leftover rice can be safely reheated only once.',
  'Refrigeration slows down food spoilage.',
  '"Best before" dates indicate food safety deadlines.',
  'Washing rice removes part of its surface starch.',
  'Composting reduces household waste volume.',
  'Cooking extra food in advance saves fuel.',
  'Fruits ripen faster at room temperature.',
  'Frozen vegetables keep most of their vitamins.',
  'Oil reused many times becomes harmful.',
  'Food stored in airtight containers lasts longer.',
  'Milk boils over because of starch content.',
  'Bread stales faster in the refrigerator.',
  'Food waste can be converted into biogas.',
  'Households discard more food than restaurants.',
  'Seasonal vegetables are usually cheaper.',
  'Raw and cooked food should be stored together.',
  'Planning meals reduces food waste.',
  'Expiry dates differ between dry and fresh foods.'
];

const BAL_ATTITUDE_STATEMENTS = [
  'I feel guilty when I throw away food.',
  'Reducing food waste is important for my family.',
  'I would eat leftovers the next day.',
  'Buying only what I need is difficult.',
  'Checking the refrigerator before shopping helps.',
  'I plan meals before shopping.',
  'Food waste is a problem in my community.',
  'I would compost if I had the space.',
  'Serving smaller portions reduces waste.',
  'Date labels confuse me.',
  'I use leftovers to prepare new dishes.',
  'Saving food saves money.',
  'Restaurants should offer smaller portions.',
  'Schools should teach about food waste.',
  'I would buy "ugly" vegetables at a discount.',
  'My family complains when food repeats.',
  'Storing food correctly is easy.',
  'I know how much food my household wastes.',
  'Reducing waste helps the environment.',
  'I encourage others to waste less food.'
];

const BAL_PRACTICE_ITEMS = [
  'How often do you plan meals before shopping?',
  'How often do you check expiry dates while shopping?',
  'How often do you store leftovers in the refrigerator?',
  'How often do you reuse leftovers?',
  'How often do you compost kitchen waste?',
  'How often do you compare prices before buying?',
  'How often do you cook exact portions?',
  'How often do you share extra food with neighbours?',
  'How often do you keep a shopping list?'
];

const BAL_FOOD_ROWS = [
  'Rice', 'Flat rice', 'Puffed rice', 'Wheat flour', 'Bread', 'Fish', 'Chicken', 'Beef', 'Eggs',
  'Milk', 'Yogurt', 'Paneer', 'Lentils', 'Beans', 'Potatoes', 'Onions', 'Tomatoes', 'Leafy vegetables',
  'Cabbage', 'Cauliflower', 'Brinjal', 'Okra', 'Pumpkin', 'Bananas', 'Mangoes', 'Citrus fruits', 'Papaya'
];

export function bal_food_wastage_benchmark(): QuestionnaireRecord {
  const bal_q = dhon_banaitesi_questionnaire({
    projectId: 'p-bench',
    title: 'Household Food Wastage Survey'
  });
  bal_q.description =
    'This questionnaire collects information about food purchase, use, storage, and wastage in your household over the past seven days.';

  const bal_demo = dhon_banaitesi_section('Section A: Household information');
  bal_demo.items = [
    bal_choice('What is your age group?', 'age_group', [
      ['18–25 years', '1'],
      ['26–35 years', '2'],
      ['36–45 years', '3'],
      ['46–60 years', '4'],
      ['Above 60 years', '5']
    ]),
    bal_choice('Respondent sex', 'sex', [
      ['Male', '1'],
      ['Female', '2'],
      ['Other', '3']
    ]),
    bal_choice('Highest education completed', 'education', [
      ['Primary or below', '1'],
      ['Secondary', '2'],
      ['Higher secondary', '3'],
      ['Bachelor or above', '4']
    ]),
    bal_choice('Main occupation of the household head', 'occupation', [
      ['Agriculture', '1'],
      ['Day labour', '2'],
      ['Business', '3'],
      ['Service', '4'],
      ['Homemaker', '5'],
      ['Retired', '6'],
      ['Other', '7']
    ]),
    bal_choice('Household monthly food expenditure group', 'food_expense', [
      ['Below 5,000 taka', '1'],
      ['5,000–10,000 taka', '2'],
      ['10,001–20,000 taka', '3'],
      ['Above 20,000 taka', '4']
    ]),
    bal_choice('Residence type', 'residence', [
      ['Urban', '1'],
      ['Semi-urban', '2'],
      ['Rural', '3']
    ]),
    bal_choice('Family type', 'family_type', [
      ['Nuclear', '1'],
      ['Extended', '2'],
      ['Joint', '3']
    ]),
    bal_choice('Main cooking fuel', 'cooking_fuel', [
      ['Wood or biomass', '1'],
      ['LPG', '2'],
      ['Natural gas', '3'],
      ['Electric', '4']
    ]),
    bal_choice('Household owns a refrigerator?', 'has_fridge', [
      ['Yes', '1'],
      ['No', '0']
    ])
  ];

  const bal_knowledge = dhon_banaitesi_section('Section B: Food knowledge');
  bal_knowledge.description =
    'Please answer yes or no for each statement. If you are unsure, choose "Don\'t know".';
  bal_knowledge.items = BAL_KNOWLEDGE_STATEMENTS.map((bal_label, bal_i) => bal_yesno_knowledge(bal_i + 1, bal_label));

  const bal_attitude = dhon_banaitesi_section('Section C: Attitudes about food waste');
  bal_attitude.description =
    'For each statement, mark one circle from 1 (strongly disagree) to 5 (strongly agree).';
  bal_attitude.items = BAL_ATTITUDE_STATEMENTS.map((bal_label, bal_i) => bal_likert(bal_i + 1, bal_label));

  const bal_practice = dhon_banaitesi_section('Section D: Food practices');
  bal_practice.description =
    'Think about the past seven days and mark how often each practice happens in your household.';
  bal_practice.items = BAL_PRACTICE_ITEMS.map((bal_label, bal_i) => bal_frequency(bal_i + 1, bal_label));

  const bal_waste = dhon_banaitesi_section('Section E: Food waste frequency');
  const bal_matrix = dhon_banaitesi_item('matrix', 'food_waste_freq');
  bal_matrix.label =
    'For each food below, mark how often it was wasted in your household during the past seven days.';
  bal_matrix.rows = BAL_FOOD_ROWS.map((bal_label, bal_i) => ({ id: `row-bench-${bal_i + 1}`, label: bal_label }));
  bal_matrix.columns = [
    { id: 'col-bench-1', label: 'Never', coding: '0' },
    { id: 'col-bench-2', label: 'Rarely', coding: '1' },
    { id: 'col-bench-3', label: 'Sometimes', coding: '2' },
    { id: 'col-bench-4', label: 'Often', coding: '3' },
    { id: 'col-bench-5', label: 'Always', coding: '4' }
  ];
  bal_waste.items = [bal_matrix];

  const bal_leftover = dhon_banaitesi_section('Section F: Leftover management and habits');
  bal_leftover.items = [
    bal_choice('Who usually decides how much food to cook?', 'portion_decider', [
      ['Person who cooks', '1'],
      ['Head of household', '2'],
      ['Decided together', '3'],
      ['Varies day to day', '4']
    ]),
    bal_choice('What usually happens to cooked leftovers?', 'leftover_fate', [
      ['Eaten at the next meal', '1'],
      ['Refrigerated for later', '2'],
      ['Fed to animals', '3'],
      ['Thrown away', '4'],
      ['Shared with neighbours', '5']
    ]),
    bal_choice('How much rice is usually cooked extra as a safety margin?', 'extra_cooking', [
      ['None', '1'],
      ['A little', '2'],
      ['A moderate amount', '3'],
      ['A lot', '4']
    ]),
    bal_choice('How often is food left over after meals?', 'leftover_freq', [
      ['Never', '0'],
      ['Rarely', '1'],
      ['Sometimes', '2'],
      ['Often', '3'],
      ['Always', '4']
    ]),
    bal_choice('Where do you usually shop for food?', 'shopping_place', [
      ['Local wet market', '1'],
      ['Corner shop', '2'],
      ['Supermarket', '3'],
      ['Online delivery', '4'],
      ['Home grown only', '5']
    ]),
    bal_choice('Do you check the refrigerator before shopping?', 'check_fridge', [
      ['Yes', '1'],
      ['No', '0']
    ])
  ];

  const bal_consent_section = dhon_banaitesi_section('Section G: Consent');
  const bal_consent = dhon_banaitesi_item('consent', null);
  bal_consent.consent = {
    title: 'Informed consent',
    introduction:
      'You are invited to take part in a study of household food wastage. Taking part is voluntary and you may stop at any time. Your answers will be kept confidential and used only for this research.',
    sections: [
      {
        id: 'bench-cs-1',
        kind: 'purpose',
        title: 'Purpose',
        body:
          'The study measures how much food households buy, use, and discard, and what happens to leftovers. The findings will help design programmes that reduce food waste in communities like yours.'
      },
      {
        id: 'bench-cs-2',
        kind: 'confidentiality',
        title: 'Confidentiality',
        body:
          'Your form is identified only by a code number. The list linking codes to names is stored separately and will be destroyed after the study. Only the research team will see your individual answers.'
      }
    ],
    acknowledgementLabel: 'I agree to participate'
  };
  const bal_participant = dhon_banaitesi_item('participant_signature', null);
  bal_participant.signature = { signerRole: 'Participant', includePrintedName: true, includeDate: true };
  const bal_researcher = dhon_banaitesi_item('researcher_signature', null);
  bal_researcher.signature = { signerRole: 'Researcher', includePrintedName: true, includeDate: true };
  bal_consent_section.items = [bal_consent, bal_participant, bal_researcher];

  bal_q.sections = [bal_demo, bal_knowledge, bal_attitude, bal_practice, bal_waste, bal_leftover, bal_consent_section];
  return bal_q;
}
