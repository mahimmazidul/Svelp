import type { IconName } from '../icons/icon_defs';
import type { ItemTypeName } from './types';

export type ItemGroup = 'basic' | 'structured' | 'research';

export type AnswerMarkerType = 'bubble' | 'checkbox' | 'box' | 'line' | 'none';

export type ScannerCapability = 'automatic' | 'manual-review' | 'unsupported';

export interface ItemDescriptor {
  type: ItemTypeName;
  label: string;
  description: string;
  icon: IconName;
  available: boolean;
  group: ItemGroup;
  usesVariableName: boolean;
  supportsRequired: boolean;
  usesOptions: boolean;
  fixedOptionCount: number | null;
  acceptsScale: boolean;
  canSplitAcrossPages: boolean;
  layoutDensity: 'compact' | 'standard';
  answerMarker: AnswerMarkerType;
  scannerCapability: ScannerCapability;
}

export const BAL_ITEM_CATALOG: ItemDescriptor[] = [
  {
    type: 'section',
    label: 'Section',
    description: 'Groups questions under a heading.',
    icon: 'layers',
    available: true,
    group: 'research',
    usesVariableName: false,
    supportsRequired: false,
    usesOptions: false,
    fixedOptionCount: null,
    acceptsScale: false,
    canSplitAcrossPages: true,
    layoutDensity: 'standard',
    answerMarker: 'none',
    scannerCapability: 'unsupported'
  },
  {
    type: 'instruction',
    label: 'Instructional text',
    description: 'Heading and explanatory text shown between questions.',
    icon: 'align-left',
    available: true,
    group: 'research',
    usesVariableName: false,
    supportsRequired: false,
    usesOptions: false,
    fixedOptionCount: null,
    acceptsScale: false,
    canSplitAcrossPages: true,
    layoutDensity: 'compact',
    answerMarker: 'none',
    scannerCapability: 'unsupported'
  },
  {
    type: 'single_choice',
    label: 'Single choice',
    description: 'One answer selected from a list of options.',
    icon: 'circle-check',
    available: true,
    group: 'basic',
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: true,
    fixedOptionCount: null,
    acceptsScale: true,
    canSplitAcrossPages: true,
    layoutDensity: 'standard',
    answerMarker: 'bubble',
    scannerCapability: 'automatic'
  },
  {
    type: 'multiple_choice',
    label: 'Multiple choice',
    description: 'Several answers selected from a list, with optional limits.',
    icon: 'checkbox',
    available: true,
    group: 'basic',
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: true,
    fixedOptionCount: null,
    acceptsScale: true,
    canSplitAcrossPages: true,
    layoutDensity: 'standard',
    answerMarker: 'checkbox',
    scannerCapability: 'automatic'
  },
  {
    type: 'yes_no',
    label: 'Yes / No',
    description: 'A binary choice with editable coding.',
    icon: 'toggle',
    available: true,
    group: 'basic',
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: true,
    fixedOptionCount: 2,
    acceptsScale: false,
    canSplitAcrossPages: true,
    layoutDensity: 'compact',
    answerMarker: 'bubble',
    scannerCapability: 'automatic'
  },
  {
    type: 'likert_scale',
    label: 'Likert scale',
    description: 'Rated points with labels and coding values.',
    icon: 'sliders',
    available: true,
    group: 'structured',
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: true,
    fixedOptionCount: null,
    acceptsScale: false,
    canSplitAcrossPages: true,
    layoutDensity: 'standard',
    answerMarker: 'bubble',
    scannerCapability: 'automatic'
  },
  {
    type: 'short_text',
    label: 'Short text',
    description: 'A short free-text answer with optional length limit.',
    icon: 'text-cursor',
    available: true,
    group: 'basic',
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: false,
    fixedOptionCount: null,
    acceptsScale: false,
    canSplitAcrossPages: false,
    layoutDensity: 'compact',
    answerMarker: 'line',
    scannerCapability: 'manual-review'
  },
  {
    type: 'long_text',
    label: 'Long text',
    description: 'A longer free-text answer.',
    icon: 'file-text',
    available: true,
    group: 'basic',
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: false,
    fixedOptionCount: null,
    acceptsScale: false,
    canSplitAcrossPages: false,
    layoutDensity: 'standard',
    answerMarker: 'box',
    scannerCapability: 'manual-review'
  },
  {
    type: 'number',
    label: 'Number',
    description: 'A numeric answer with range, step, and unit.',
    icon: 'hash',
    available: true,
    group: 'basic',
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: false,
    fixedOptionCount: null,
    acceptsScale: false,
    canSplitAcrossPages: false,
    layoutDensity: 'compact',
    answerMarker: 'box',
    scannerCapability: 'manual-review'
  },
  {
    type: 'date',
    label: 'Date',
    description: 'A calendar date answer.',
    icon: 'calendar',
    available: true,
    group: 'basic',
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: false,
    fixedOptionCount: null,
    acceptsScale: false,
    canSplitAcrossPages: false,
    layoutDensity: 'compact',
    answerMarker: 'box',
    scannerCapability: 'manual-review'
  },
  {
    type: 'matrix',
    label: 'Matrix / grid',
    description: 'Rows of sub-questions sharing columns or a reusable scale.',
    icon: 'table',
    available: true,
    group: 'structured',
    usesVariableName: true,
    supportsRequired: true,
    usesOptions: false,
    fixedOptionCount: null,
    acceptsScale: true,
    canSplitAcrossPages: false,
    layoutDensity: 'compact',
    answerMarker: 'bubble',
    scannerCapability: 'automatic'
  },
  {
    type: 'consent',
    label: 'Consent',
    description: 'A structured consent statement with an acknowledgement.',
    icon: 'shield',
    available: true,
    group: 'research',
    usesVariableName: false,
    supportsRequired: true,
    usesOptions: false,
    fixedOptionCount: null,
    acceptsScale: false,
    canSplitAcrossPages: true,
    layoutDensity: 'standard',
    answerMarker: 'checkbox',
    scannerCapability: 'manual-review'
  },
  {
    type: 'participant_signature',
    label: 'Participant signature',
    description: 'A signature field for the participant.',
    icon: 'pencil',
    available: true,
    group: 'research',
    usesVariableName: false,
    supportsRequired: false,
    usesOptions: false,
    fixedOptionCount: null,
    acceptsScale: false,
    canSplitAcrossPages: false,
    layoutDensity: 'standard',
    answerMarker: 'none',
    scannerCapability: 'unsupported'
  },
  {
    type: 'researcher_signature',
    label: 'Researcher signature',
    description: 'A signature field for the researcher.',
    icon: 'pencil',
    available: true,
    group: 'research',
    usesVariableName: false,
    supportsRequired: false,
    usesOptions: false,
    fixedOptionCount: null,
    acceptsScale: false,
    canSplitAcrossPages: false,
    layoutDensity: 'standard',
    answerMarker: 'none',
    scannerCapability: 'unsupported'
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

export const BAL_GROUP_LABELS: Record<ItemGroup, string> = {
  basic: 'Basic',
  structured: 'Structured',
  research: 'Research'
};

export function bal_grouped_catalog(): { group: ItemGroup; items: ItemDescriptor[] }[] {
  const bal_groups: ItemGroup[] = ['basic', 'structured', 'research'];
  return bal_groups.map((bal_group) => ({
    group: bal_group,
    items: bal_addable_catalog().filter((bal_entry) => bal_entry.group === bal_group)
  }));
}
