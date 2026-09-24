import type { IconName } from '../icons/icon_defs';
import type { ItemTypeName } from './types';

export interface ItemDescriptor {
  type: ItemTypeName;
  label: string;
  description: string;
  icon: IconName;
  available: boolean;
  usesVariableName: boolean;
  supportsRequired: boolean;
  usesOptions: boolean;
}

export const BAL_ITEM_CATALOG: ItemDescriptor[] = [
  {
    type: 'section',
    label: 'Section',
    description: 'Groups questions under a heading.',
    icon: 'layers',
    available: true,
    usesVariableName: false,
    supportsRequired: false,
    usesOptions: false
  },
  {
    type: 'instruction',
    label: 'Instructional text',
    description: 'Explanatory text shown between questions.',
    icon: 'align-left',
    available: true,
    usesVariableName: false,
    supportsRequired: false,
    usesOptions: false
  },
  {
    type: 'single_choice',
    label: 'Single choice',
    description: 'One answer selected from a list of options.',
    icon: 'circle-check',
    available: true,
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: true
  },
  {
    type: 'multiple_choice',
    label: 'Multiple choice',
    description: 'Several answers selected from a list.',
    icon: 'circle-check',
    available: false,
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: true
  },
  {
    type: 'yes_no',
    label: 'Yes / No',
    description: 'A binary choice between two values.',
    icon: 'check',
    available: false,
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: false
  },
  {
    type: 'short_text',
    label: 'Short text',
    description: 'A short free-text answer.',
    icon: 'align-left',
    available: false,
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: false
  },
  {
    type: 'long_text',
    label: 'Long text',
    description: 'A longer free-text answer.',
    icon: 'file-text',
    available: false,
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: false
  },
  {
    type: 'number',
    label: 'Number',
    description: 'A numeric answer with optional range validation.',
    icon: 'hash',
    available: false,
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: false
  },
  {
    type: 'date',
    label: 'Date',
    description: 'A calendar date answer.',
    icon: 'calendar',
    available: false,
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: false
  },
  {
    type: 'time',
    label: 'Time',
    description: 'A time-of-day answer.',
    icon: 'clock',
    available: false,
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: false
  },
  {
    type: 'likert_scale',
    label: 'Likert scale',
    description: 'An agreement or frequency scale.',
    icon: 'sliders',
    available: false,
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: true
  },
  {
    type: 'matrix',
    label: 'Matrix / grid',
    description: 'Rows of sub-questions sharing one answer scale.',
    icon: 'table',
    available: false,
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: true
  },
  {
    type: 'ranking',
    label: 'Ranking',
    description: 'Options ordered by the participant.',
    icon: 'sort',
    available: false,
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: true
  },
  {
    type: 'consent',
    label: 'Consent',
    description: 'A consent statement with an agreement action.',
    icon: 'check',
    available: false,
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: false
  },
  {
    type: 'participant_signature',
    label: 'Participant signature',
    description: 'A captured signature from the participant.',
    icon: 'pencil',
    available: false,
    usesVariableName: true,
    supportsRequired: false,
    usesOptions: false
  },
  {
    type: 'researcher_signature',
    label: 'Researcher signature',
    description: 'A captured signature from the researcher.',
    icon: 'pencil',
    available: false,
    usesVariableName: true,
    supportsRequired: false,
    usesOptions: false
  }
];

export function item_descriptor(bal_type: ItemTypeName): ItemDescriptor {
  const bal_found = BAL_ITEM_CATALOG.find((bal_entry) => bal_entry.type === bal_type);
  if (!bal_found) throw new Error(`Unknown item type: ${bal_type}`);
  return bal_found;
}

export function bal_addable_catalog(): ItemDescriptor[] {
  return BAL_ITEM_CATALOG.filter((bal_entry) => bal_entry.type !== 'section');
}
