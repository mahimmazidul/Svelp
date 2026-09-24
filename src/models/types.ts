export type ProjectStatus = 'active' | 'archived';

export interface ProjectRecord {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
}

export type QuestionnaireStatus = 'draft' | 'published';

export type PaperSize = 'a4' | 'letter';

export type Orientation = 'portrait' | 'landscape';

export interface ChoiceOption {
  id: string;
  label: string;
  coding: string | null;
}

export type ItemTypeName =
  | 'section'
  | 'instruction'
  | 'single_choice'
  | 'multiple_choice'
  | 'yes_no'
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'date'
  | 'time'
  | 'likert_scale'
  | 'matrix'
  | 'ranking'
  | 'consent'
  | 'participant_signature'
  | 'researcher_signature';

export interface TextValidation {
  maxLength?: number | null;
}

export interface NumberValidation {
  min?: number | null;
  max?: number | null;
  step?: number | null;
  decimalAllowed?: boolean;
}

export interface SelectionValidation {
  minSelections?: number | null;
  maxSelections?: number | null;
}

export interface MatrixValidation {
  requireAllRows?: boolean;
}

export type ItemValidation = TextValidation &
  NumberValidation &
  SelectionValidation &
  MatrixValidation;

export interface MatrixRow {
  id: string;
  label: string;
}

export interface MatrixColumn {
  id: string;
  label: string;
  coding: string | null;
}

export type ConsentSectionKind =
  | 'purpose'
  | 'procedures'
  | 'risks'
  | 'benefits'
  | 'confidentiality'
  | 'voluntary'
  | 'withdrawal'
  | 'contacts';

export interface ConsentSection {
  id: string;
  kind: ConsentSectionKind;
  title: string;
  body: string;
}

export interface ConsentConfig {
  title: string;
  introduction: string;
  sections: ConsentSection[];
  acknowledgementLabel: string;
}

export interface SignatureConfig {
  signerRole: string;
  includePrintedName: boolean;
  includeDate: boolean;
}

export type InstructionEmphasis = 'normal' | 'callout';

export type MatrixSelectionMode = 'single' | 'multiple';

export interface QuestionnaireItem {
  id: string;
  type: ItemTypeName;
  variableName: string | null;
  label: string;
  required: boolean;
  options: ChoiceOption[];
  coding: string | null;
  validation: ItemValidation | null;
  scannerConfig: Record<string, unknown> | null;
  printConfig: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  scaleId: string | null;
  placeholder: string | null;
  heading: string | null;
  emphasis: InstructionEmphasis;
  rows: MatrixRow[];
  columns: MatrixColumn[];
  selectionMode: MatrixSelectionMode;
  consent: ConsentConfig | null;
  signature: SignatureConfig | null;
  unitLabel: string | null;
}

export interface SectionPrintConfig {
  pageBreakBefore?: boolean;
}

export interface QuestionnaireSection {
  id: string;
  type: 'section';
  title: string;
  description: string | null;
  items: QuestionnaireItem[];
  printConfig: SectionPrintConfig | null;
  metadata: Record<string, unknown> | null;
}

export interface QuestionnaireRecord {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  version: number;
  language: string;
  paperSize: PaperSize;
  orientation: Orientation;
  theme: string | null;
  status: QuestionnaireStatus;
  metadata: Record<string, unknown> | null;
  sections: QuestionnaireSection[];
  createdAt: number;
  updatedAt: number;
}

export interface ResponseScaleRecord {
  id: string;
  name: string;
  options: ChoiceOption[];
  createdAt: number;
  updatedAt: number;
}
