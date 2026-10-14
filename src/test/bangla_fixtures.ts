import {
  dhon_banaitesi_item,
  dhon_banaitesi_questionnaire,
  dhon_banaitesi_section,
  komola_option
} from '../models/factories';
import type {
  QuestionnaireItem,
  QuestionnaireRecord,
  ResponseScaleRecord
} from '../models/types';

export const BAL_BN_TITLE = 'গৃহস্থালির খাদ্য অপচয় সম্পর্কিত জরিপ';
export const BAL_BN_DESCRIPTION =
  'এই প্রশ্নপত্রের উদ্দেশ্য হলো গৃহস্থালি পর্যায়ে খাদ্য ক্রয়, ব্যবহার, সংরক্ষণ ও অপচয়ের ধরন সম্পর্কে তথ্য সংগ্রহ করা।';
export const BAL_BN_SECTION = 'সাধারণ তথ্য';
export const BAL_BN_INSTRUCTION =
  'অনুগ্রহ করে গত সাত দিনের অভিজ্ঞতার আলোকে প্রতিটি প্রশ্নের উত্তর দিন। নিজের মতো করে উত্তর দেওয়ার অধিকার আপনার আছে।';
export const BAL_BN_Q_AGE = 'আপনার বয়স কত?';
export const BAL_BN_Q_HOUSEHOLD = 'আপনার পরিবারের সদস্য সংখ্যা কত?';
export const BAL_BN_Q_SOURCE = 'আপনি সাধারণত কোথা থেকে খাদ্যসামগ্রী ক্রয় করেন?';
export const BAL_BN_Q_WASTE_FREQ = 'আপনার পরিবারে কত ঘন ঘন খাবার অপচয় হয়?';
export const BAL_BN_Q_FISH = 'গত সাত দিনে আপনি কতবার মাছ খেয়েছেন?';
export const BAL_BN_Q_STORAGE = 'অতিরিক্ত রান্না করা খাবার সাধারণত কীভাবে সংরক্ষণ করেন?';
export const BAL_BN_Q_IMPORTANCE = 'আপনি কি মনে করেন খাদ্য অপচয় কমানো গুরুত্বপূর্ণ?';
export const BAL_BN_Q_MATRIX = 'গত সাত দিনে নিম্নলিখিত খাবারগুলো কত ঘন ঘন গ্রহণ করেছেন?';
export const BAL_BN_YES = 'হ্যাঁ';
export const BAL_BN_NO = 'না';
export const BAL_BN_OPT_NEVER = 'কখনও না';
export const BAL_BN_OPT_SOMETIMES = 'মাঝে মাঝে';
export const BAL_BN_OPT_OFTEN = 'প্রায়ই';
export const BAL_BN_OPT_DAILY = 'প্রতিদিন';
export const BAL_BN_OPT_WEEKLY_ONCE = 'সপ্তাহে একবার';
export const BAL_BN_OPT_WEEKLY_2_4 = 'সপ্তাহে ২–৪ বার';
export const BAL_BN_OPT_MONTHLY_1_3 = 'মাসে ১–৩ বার';
export const BAL_BN_UNIT_YEARS = 'বছর';
export const BAL_BN_UNIT_PEOPLE = 'জন';
export const BAL_BN_SCALE_NAME = 'frequency_bn';
export const BAL_BN_MATRIX_ROWS = [
  'ভাত',
  'মাছ',
  'ডিম',
  'দুধ',
  'গরুর মাংস',
  'মুরগির মাংস',
  'শাকসবজি',
  'ফলমূল',
  'ডাল'
];
export const BAL_BN_MATRIX_COLUMNS = [
  BAL_BN_OPT_NEVER,
  BAL_BN_OPT_MONTHLY_1_3,
  BAL_BN_OPT_WEEKLY_ONCE,
  BAL_BN_OPT_WEEKLY_2_4,
  BAL_BN_OPT_DAILY
];
export const BAL_BN_PARTICIPANT_ID_LABEL = 'Participant ID / অংশগ্রহণকারী আইডি';
export const BAL_BN_BMI_LABEL = 'BMI সম্পর্কে আপনি জানেন কি?';
export const BAL_BN_FF_LABEL = 'Food frequency / খাদ্য গ্রহণের হার';
export const BAL_BN_SHORT_PLACEHOLDER = 'যেমন: এক কাপ ভাত';
export const BAL_BN_LONG_PLACEHOLDER = 'বিস্তারিত লিখুন…';
export const BAL_BN_CONSENT_TITLE = 'সুচেতন সম্মতি সনদ';
export const BAL_BN_CONSENT_INTRO =
  'আপনাকে গৃহস্থালি খাদ্য নিরাপত্তা সম্পর্কিত একটি গবেষণায় অংশ নেওয়ার আমন্ত্রণ জানানো হচ্ছে। এই সনদে গবেষণার উদ্দেশ্য, পদ্ধতি, ঝুঁকি ও উপকারিতা ব্যাখ্যা করা হয়েছে। সিদ্ধান্ত নেওয়ার আগে অনুগ্রহ করে এটি মনোযোগ দিয়ে পড়ুন। অংশগ্রহণ সম্পূর্ণ স্বেচ্ছায়।';
export const BAL_BN_CONSENT_PURPOSE_TITLE = 'গবেষণার উদ্দেশ্য';
export const BAL_BN_CONSENT_PURPOSE_BODY =
  'এই গবেষণার উদ্দেশ্য গ্রামীণ ও শহর উপকণ্ঠের পরিবারগুলোতে ঋতুভেদে খাদ্যগ্রহণ ও অপচয়ের ধরন পরিমাপ করা। ক্ষয়ক্ষতি কমানোর প্রয়োজনীয় পরিকল্পনা প্রস্তুতিতে ফলাফল ব্যবহার করা হবে। দৃষ্টিভঙ্গি ও অভ্যাস সম্পর্কিত তথ্য এমনভাবে একত্র করা হবে যাতে কোনো ব্যক্তিকে শনাক্ত করা না যায়।';
export const BAL_BN_CONSENT_CONFIDENTIAL_BODY =
  'সংগৃহীত সব তথ্য গোপন রাখা হবে। ফর্মগুলোতে শুধু একটি কোড নম্বর থাকবে এবং কোডের সঙ্গে নামের তালিকা পৃথকভাবে সংরক্ষিত থাকবে। স্বাস্থ্যসেবাকর্মী ও গবেষণা সহযোগীরা কেবল সমষ্টিগত ফলাফল দেখবেন।';
export const BAL_BN_CONSENT_ACK = 'আমি স্বেচ্ছায় অংশ নিতে সম্মতি দিচ্ছি';
export const BAL_BN_SIGNER_PARTICIPANT = 'অংশগ্রহণকারী';
export const BAL_BN_SIGNER_RESEARCHER = 'স্বাক্ষরকারী গবেষক';
export const BAL_BN_HEALTH_WORKER = 'স্বাস্থ্যসেবাকর্মী';
export const BAL_BN_SHAPING_WORDS = [
  'বাংলা',
  'প্রশ্নপত্র',
  'স্বাস্থ্যসেবা',
  'অংশগ্রহণকারী',
  'ক্ষয়ক্ষতি',
  'দৃষ্টিভঙ্গি',
  'স্বাক্ষর',
  'গৃহস্থালি',
  'খাদ্যগ্রহণ',
  'স্বাস্থ্যসেবাকর্মী',
  'ক্ষুদ্রঋণ',
  'দায়িত্ব',
  'প্রয়োজনীয়'
];

function bal_option(bal_label: string, bal_coding: string): ReturnType<typeof komola_option> {
  const bal_opt = komola_option(bal_label);
  bal_opt.coding = bal_coding;
  return bal_opt;
}

function bal_item(
  bal_type: Parameters<typeof dhon_banaitesi_item>[0],
  bal_label: string,
  bal_variable: string | null
): QuestionnaireItem {
  const bal_new = dhon_banaitesi_item(bal_type, bal_variable);
  bal_new.label = bal_label;
  return bal_new;
}

export function bal_frequency_scale_bn(): ResponseScaleRecord {
  return {
    id: 'scale-bn-frequency',
    name: BAL_BN_SCALE_NAME,
    options: [
      bal_option(BAL_BN_OPT_NEVER, '0'),
      bal_option(BAL_BN_OPT_MONTHLY_1_3, '1'),
      bal_option(BAL_BN_OPT_WEEKLY_ONCE, '2'),
      bal_option(BAL_BN_OPT_WEEKLY_2_4, '3'),
      bal_option(BAL_BN_OPT_DAILY, '4')
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000
  };
}

export function bal_bangla_survey(): QuestionnaireRecord {
  const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p-bn', title: BAL_BN_TITLE });
  bal_q.description = BAL_BN_DESCRIPTION;
  bal_q.language = 'bn';

  const bal_general = dhon_banaitesi_section(BAL_BN_SECTION);
  bal_general.description = 'খাদ্য ক্রয় ও ব্যবহার সম্পর্কিত মৌলিক তথ্য সংগ্রহ করা হচ্ছে।';

  const bal_source = bal_item('single_choice', BAL_BN_Q_SOURCE, 'food_purchase_source');
  bal_source.options = [
    bal_option('বাজার', '1'),
    bal_option('দোকান', '2'),
    bal_option('অনলাইন (Online)', '3'),
    bal_option('নিজস্ব উৎপাদন', '4')
  ];
  bal_source.required = true;

  const bal_waste = bal_item('yes_no', BAL_BN_Q_WASTE_FREQ, 'food_waste');
  bal_waste.options = [
    bal_option(BAL_BN_YES, '1'),
    bal_option(BAL_BN_NO, '0')
  ];
  bal_waste.required = true;

  const bal_storage = bal_item('multiple_choice', BAL_BN_Q_STORAGE, 'leftover_storage');
  bal_storage.options = [
    bal_option('ফ্রিজে রাখি', '1'),
    bal_option('পাত্রে ঢেকে রাখি', '2'),
    bal_option('প্রতিবেশীদের দিই', '3'),
    bal_option('ফেলে দিই', '4')
  ];
  bal_storage.validation = { minSelections: 1, maxSelections: 3 };

  const bal_age = bal_item('number', BAL_BN_Q_AGE, 'age');
  bal_age.validation = { min: 18, max: 100, step: 1, decimalAllowed: false };
  bal_age.unitLabel = BAL_BN_UNIT_YEARS;
  bal_age.required = true;

  const bal_household = bal_item('number', BAL_BN_Q_HOUSEHOLD, 'household_members');
  bal_household.validation = { min: 1, max: 30, step: 1, decimalAllowed: false };
  bal_household.unitLabel = BAL_BN_UNIT_PEOPLE;

  const bal_importance = bal_item('likert_scale', BAL_BN_Q_IMPORTANCE, 'waste_importance');
  bal_importance.options = [
    bal_option('একদম গুরুত্বপূর্ণ নয়', '1'),
    bal_option('তেমন গুরুত্বপূর্ণ নয়', '2'),
    bal_option('মাঝামাঝি', '3'),
    bal_option('গুরুত্বপূর্ণ', '4'),
    bal_option('অত্যন্ত গুরুত্বপূর্ণ', '5')
  ];

  const bal_instruction = bal_item('instruction', BAL_BN_INSTRUCTION, null);
  bal_instruction.emphasis = 'callout';

  const bal_matrix = bal_item('matrix', BAL_BN_Q_MATRIX, 'food_frequency_bn');
  bal_matrix.scaleId = null;
  bal_matrix.selectionMode = 'single';
  bal_matrix.rows = BAL_BN_MATRIX_ROWS.map((bal_label, bal_i) => ({
    id: `row-bn-${bal_i + 1}`,
    label: bal_label
  }));
  bal_matrix.columns = BAL_BN_MATRIX_COLUMNS.map((bal_label, bal_i) => ({
    id: `col-bn-${bal_i + 1}`,
    label: bal_label,
    coding: String(bal_i)
  }));

  const bal_participant = bal_item('short_text', BAL_BN_PARTICIPANT_ID_LABEL, 'participant_id');
  bal_participant.placeholder = BAL_BN_SHORT_PLACEHOLDER;
  bal_participant.validation = { maxLength: 24 };

  const bal_notes = bal_item('long_text', 'গত সাত দিনে বাড়ির বাইরে খাওয়া সম্পর্কে মন্তব্য লিখুন', 'outside_food_notes');
  bal_notes.placeholder = BAL_BN_LONG_PLACEHOLDER;
  bal_notes.validation = { maxLength: 600 };

  bal_general.items = [
    bal_instruction,
    bal_participant,
    bal_age,
    bal_household,
    bal_source,
    bal_waste,
    bal_storage,
    bal_importance,
    bal_matrix,
    bal_notes
  ];

  const bal_health = dhon_banaitesi_section('স্বাস্থ্য ও পুষ্টি');
  bal_health.printConfig = { pageBreakBefore: true };

  const bal_bmi = bal_item('yes_no', BAL_BN_BMI_LABEL, 'bmi_aware');
  bal_bmi.options = [
    bal_option(BAL_BN_YES, '1'),
    bal_option(BAL_BN_NO, '0')
  ];

  const bal_ff = bal_item('single_choice', BAL_BN_FF_LABEL, 'food_frequency_check');
  bal_ff.scaleId = 'scale-bn-frequency';

  const bal_consent = dhon_banaitesi_item('consent', null);
  bal_consent.consent = {
    title: BAL_BN_CONSENT_TITLE,
    introduction: BAL_BN_CONSENT_INTRO,
    sections: [
      {
        id: 'cs-bn-1',
        kind: 'purpose',
        title: BAL_BN_CONSENT_PURPOSE_TITLE,
        body: BAL_BN_CONSENT_PURPOSE_BODY
      },
      {
        id: 'cs-bn-2',
        kind: 'confidentiality',
        title: 'গোপনীয়তা',
        body: BAL_BN_CONSENT_CONFIDENTIAL_BODY
      }
    ],
    acknowledgementLabel: BAL_BN_CONSENT_ACK
  };
  bal_consent.required = true;

  const bal_participant_signature = dhon_banaitesi_item('participant_signature', null);
  bal_participant_signature.signature = {
    signerRole: BAL_BN_SIGNER_PARTICIPANT,
    includePrintedName: true,
    includeDate: true
  };

  const bal_researcher_signature = dhon_banaitesi_item('researcher_signature', null);
  bal_researcher_signature.signature = {
    signerRole: BAL_BN_SIGNER_RESEARCHER,
    includePrintedName: true,
    includeDate: true
  };

  const bal_worker = bal_item('single_choice', `${BAL_BN_HEALTH_WORKER} কি আপনার পরামর্শ দিয়েছেন?`, 'health_worker_advice');
  bal_worker.options = [
    bal_option(BAL_BN_YES, '1'),
    bal_option(BAL_BN_NO, '2')
  ];

  bal_health.items = [
    bal_bmi,
    bal_ff,
    bal_worker,
    bal_consent,
    bal_participant_signature,
    bal_researcher_signature
  ];

  bal_q.sections = [bal_general, bal_health];
  return bal_q;
}
