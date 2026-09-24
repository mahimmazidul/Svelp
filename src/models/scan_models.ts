export type ScanPageStatus =
  | 'queued'
  | 'decoding'
  | 'identifying'
  | 'aligning'
  | 'normalizing'
  | 'ready'
  | 'needs-review'
  | 'duplicate'
  | 'unsupported'
  | 'failed';

export type ScanIssueCategory =
  | 'unidentified'
  | 'multiple-identifiers'
  | 'alignment-failed'
  | 'corner-correction-required'
  | 'duplicate'
  | 'poor-quality'
  | 'version-mismatch'
  | 'unsupported-file'
  | 'failed-decode'
  | 'possible-multiple-sheets';

export type QualityAspectStatus = 'good' | 'warning' | 'error' | 'unknown';

export type AlignmentConfidence = 'high' | 'inferred' | 'manual' | 'failed';

export interface QualityResult {
  overallStatus: 'good' | 'warning' | 'error';
  blurStatus: QualityAspectStatus;
  exposureStatus: QualityAspectStatus;
  glareStatus: QualityAspectStatus;
  alignmentStatus: QualityAspectStatus;
  resolutionStatus: QualityAspectStatus;
  croppingStatus: QualityAspectStatus;
  qualityIssues: string[];
}

export interface ScanTransformRecord {
  markerPoints: { x: number; y: number }[] | null;
  manualPoints: { x: number; y: number }[] | null;
  homography: number[] | null;
  sourceWidth: number;
  sourceHeight: number;
  outWidth: number;
  outHeight: number;
  rotationApplied: 0 | 90 | 180 | 270;
  pixelsPerMm: number;
}

export interface ScanAlignmentRecord {
  confidence: AlignmentConfidence;
  markersFound: number;
  rotationApplied: 0 | 90 | 180 | 270;
  inferenceNote: string | null;
}

export interface ScanPageRecord {
  id: string;
  batchId: string;
  projectId: string;
  questionnaireId: string | null;
  questionnaireVersion: number | null;
  respondentId: string | null;
  pageNumber: number | null;
  status: ScanPageStatus;
  sourceAssetId: string | null;
  normalizedAssetId: string | null;
  sourceName: string;
  sourceType: 'image' | 'pdf' | 'unknown';
  sourceHash: string;
  sourceBytes: number;
  normalizedBytes: number;
  thumbSource: string | null;
  thumbNormalized: string | null;
  identitySource: 'qr' | 'manual' | null;
  payload: string | null;
  detectedPayloads: string[] | null;
  quality: QualityResult | null;
  alignment: ScanAlignmentRecord | null;
  transform: ScanTransformRecord | null;
  issues: ScanIssueCategory[];
  errorMessage: string | null;
  processingMs: number;
  createdAt: number;
  updatedAt: number;
}

export interface ScanAssetRecord {
  id: string;
  batchId: string;
  pageId: string;
  kind: 'source' | 'normalized';
  mime: string;
  bytes: Blob;
  width: number;
  height: number;
  size: number;
  createdAt: number;
}

export type ScanBatchStatus = 'ingesting' | 'processing' | 'review' | 'done' | 'cancelled';

export interface ScanBatchSummary {
  totalPages: number;
  ready: number;
  needsReview: number;
  duplicates: number;
  failed: number;
  unsupported: number;
  queued: number;
  respondents: number;
  complete: number;
  incomplete: number;
}

export interface ScanBatchRecord {
  id: string;
  projectId: string;
  questionnaireId: string | null;
  questionnaireVersion: number | null;
  status: ScanBatchStatus;
  keepOriginals: boolean;
  summary: ScanBatchSummary;
  createdAt: number;
  updatedAt: number;
}

export type ScanAuditKind =
  | 'manual-identification'
  | 'manual-corner-correction'
  | 'duplicate-resolution'
  | 'page-rejection'
  | 'replacement-selected'
  | 'batch-cancelled'
  | 'originals-removed';

export interface ScanAuditEventRecord {
  id: string;
  batchId: string;
  pageId: string | null;
  kind: ScanAuditKind;
  detail: string;
  createdAt: number;
}

export interface ScanBatchStats {
  sourceBytes: number;
  normalizedBytes: number;
}
