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

export interface QuestionnaireItem {
  id: string;
  type: ItemTypeName;
  variableName: string | null;
  label: string;
  required: boolean;
  options: ChoiceOption[];
  coding: string | null;
  validation: Record<string, unknown> | null;
  scannerConfig: Record<string, unknown> | null;
  printConfig: Record<string, unknown> | null;
}

export interface QuestionnaireSection {
  id: string;
  type: 'section';
  title: string;
  description: string | null;
  items: QuestionnaireItem[];
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
