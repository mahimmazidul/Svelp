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
  printSettings: PrintSettings | null;
  sections: QuestionnaireSection[];
  createdAt: number;
  updatedAt: number;
}

export type PrintThemeName = 'academic' | 'clinical' | 'minimal' | 'compact' | 'institutional';

export type PrintFontFamily = 'helvetica' | 'times' | 'courier';

export type PrintDensity = 'compact' | 'standard' | 'comfortable';

export interface PrintThemeConfig {
  name: PrintThemeName;
  fontFamily: PrintFontFamily;
  baseFontSize: number;
  headingScale: number;
  lineWeight: number;
}

export interface PrintHeaderConfig {
  showTitle: boolean;
  showInstitution: boolean;
  institution: string;
  showStudyCode: boolean;
  studyCode: string;
  showVersion: boolean;
  showRespondentId: boolean;
  respondentIdLabel: string;
}

export interface PrintFooterConfig {
  showPageNumbers: boolean;
  showStudyCode: boolean;
  confidentialityNote: string;
  showHumanIdentifier: boolean;
}

export interface PrintMarkerConfig {
  diameterMm: number;
  regionPaddingMm: number;
}

export interface PrintIdentifierConfig {
  sizeMm: number;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
}

export interface PrintLogoConfig {
  dataUrl: string;
  widthMm: number;
}

export interface PrintSettings {
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  theme: PrintThemeConfig;
  density: PrintDensity;
  questionSpacing: number;
  header: PrintHeaderConfig;
  footer: PrintFooterConfig;
  showMachineIdentifier: boolean;
  scannerMode: boolean;
  marker: PrintMarkerConfig;
  identifier: PrintIdentifierConfig;
  respondentArea: {
    enabled: boolean;
    label: string;
  };
  logo: PrintLogoConfig | null;
}

export interface ResponseScaleRecord {
  id: string;
  name: string;
  options: ChoiceOption[];
  createdAt: number;
  updatedAt: number;
}
