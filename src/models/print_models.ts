import type { PrintLayoutGeometry } from '../features/print/print_layout';
import type { PrintSettings } from './types';

export interface PrintLayoutRecord {
  id: string;
  questionnaireId: string;
  projectId: string;
  questionnaireVersion: number;
  fingerprint: string;
  paperSize: 'a4' | 'letter';
  orientation: 'portrait' | 'landscape';
  settingsSnapshot: PrintSettings;
  geometry: PrintLayoutGeometry;
  createdAt: number;
  updatedAt: number;
}

export interface PrintBatchRecord {
  id: string;
  projectId: string;
  questionnaireId: string;
  questionnaireVersion: number;
  fingerprint: string;
  layoutId: string;
  respondentIds: string[];
  settings: PrintSettings;
  pageCount: number;
  includeMachineIdentifier: boolean;
  includeHumanReadableId: boolean;
  createdAt: number;
}
