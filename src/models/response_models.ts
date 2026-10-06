export type RecognitionStatus =
  | 'accepted'
  | 'blank'
  | 'needs-review'
  | 'ambiguous'
  | 'multiple-marks'
  | 'manual-only'
  | 'unreadable';

export type ResponseAuditAction =
  | 'manual-correction'
  | 'manual-transcription'
  | 'marked-blank'
  | 'accepted-machine'
  | 'reprocess-overwrite'
  | 'deferred';

export interface RecognitionThresholdProfile {
  markCenterRatio: number;
  markAddedRatio: number;
  ambiguousFloorRatio: number;
  strokeAreaPx: number;
  ambiguitySeparation: number;
  acceptanceConfidence: number;
  glareFractionMax: number;
  inkDeltaGray: number;
  noiseMultiplier: number;
  regionMarginMm: number;
}

export interface RecognitionProfileRecord {
  algorithmVersion: string;
  thresholdProfile: RecognitionThresholdProfile;
  acceptanceThreshold: number;
  createdAt: number;
}

export type RecognitionRunScope = 'page' | 'respondent' | 'batch' | 'project';

export interface RecognitionRunRecord {
  id: string;
  projectId: string;
  batchId: string | null;
  questionnaireId: string | null;
  questionnaireVersion: number | null;
  scope: RecognitionRunScope;
  algorithmVersion: string;
  thresholdProfile: RecognitionThresholdProfile;
  acceptanceThreshold: number;
  pagesProcessed: number;
  regionsProcessed: number;
  accepted: number;
  blanks: number;
  needsReview: number;
  unreadable: number;
  preservedManual: number;
  overwroteMachine: number;
  startedAt: number;
  finishedAt: number;
  createdAt: number;
}

export interface ResponseRecord {
  id: string;
  projectId: string;
  batchId: string | null;
  questionnaireId: string;
  questionnaireVersion: number;
  respondentId: string;
  itemId: string;
  variableName: string | null;
  itemType: string;
  rowId: string | null;
  columnId: string | null;
  value: string[];
  codedValue: string[] | null;
  status: RecognitionStatus;
  confidence: number | null;
  machineValue: string[] | null;
  machineStatus: RecognitionStatus | null;
  machineConfidence: number | null;
  manuallyReviewed: boolean;
  validationIssues: string[];
  sourcePageId: string | null;
  sourceRegionRect: { x: number; y: number; width: number; height: number } | null;
  algorithmVersion: string;
  thresholdProfileName: string;
  recognitionRunId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ResponseAuditEventRecord {
  id: string;
  projectId: string;
  responseId: string;
  respondentId: string;
  itemId: string;
  rowId: string | null;
  previousValue: string[] | null;
  previousStatus: RecognitionStatus | null;
  finalValue: string[] | null;
  finalStatus: RecognitionStatus | null;
  action: ResponseAuditAction;
  createdAt: number;
}

export interface BlankReferenceRecord {
  id: string;
  fingerprint: string;
  pageNumber: number;
  questionnaireVersion: number;
  mime: string;
  bytes: Blob;
  widthPx: number;
  heightPx: number;
  createdAt: number;
}

export interface RespondentCompleteness {
  respondentId: string;
  questionnaireId: string | null;
  questionnaireVersion: number | null;
  status: 'complete' | 'needs-review' | 'missing-required' | 'missing-page';
  missingRequiredVariables: string[];
  needsReviewCount: number;
  pageIssues: string[];
}

export const BAL_READER_ALGORITHM_VERSION = 'R1';
export const BAL_THRESHOLD_PROFILE_NAME = 'default-v1';

export const BAL_DEFAULT_THRESHOLD_PROFILE: RecognitionThresholdProfile = {
  markCenterRatio: 0.055,
  markAddedRatio: 0.11,
  ambiguousFloorRatio: 0.025,
  strokeAreaPx: 14,
  ambiguitySeparation: 0.3,
  acceptanceConfidence: 0.75,
  glareFractionMax: 0.3,
  inkDeltaGray: 45,
  noiseMultiplier: 3,
  regionMarginMm: 2.6
};

export interface DatasetSnapshotCounts {
  autoAccepted: number;
  reviewedCorrected: number;
  blank: number;
  needsReview: number;
  manualOnly: number;
  unreadable: number;
}

export interface DatasetSnapshotRecord {
  id: string;
  projectId: string;
  questionnaireId: string;
  questionnaireVersion: number;
  algorithmVersion: string;
  profileName: string;
  respondentCount: number;
  unresolvedCount: number;
  missingPageRespondents: number;
  counts: DatasetSnapshotCounts;
  exportConfig: { format: string; optionColumns: boolean; bom: boolean; includeDiagnostics: boolean };
  svelpVersion: string;
  createdAt: number;
}
