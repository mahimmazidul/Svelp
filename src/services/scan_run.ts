import type { PrintLayoutRecord } from '../models/print_models';
import type { ScanBatchRecord, ScanPageRecord } from '../models/scan_models';
import type { bal_ScanProcessor } from './scan_service';
import {
  BAL_CANONICAL_PX_PER_MM,
  bal_canonical_dimensions,
  bal_flag_identity_duplicate,
  bal_log_scan_action,
  bal_new_id,
  bal_page_transform_from_result,
  bal_resolve_identity,
  bal_validate_manual_assignment
} from './scan_service';
import { bal_eta_label, bal_record_stage, bal_create_eta_estimator, type bal_EtaEstimator } from '../features/scan/scan_eta';
import {
  dhon_scan_asset,
  dhon_scan_batch,
  ken_pori_scan_pages,
  bal_save_scan_asset,
  bal_save_scan_page,
  bal_save_scan_batch
} from '../db/scan_repo';
export function bal_new_batch_for_project(
  bal_project_id: string,
  bal_questionnaire_id: string | null,
  bal_questionnaire_version: number | null,
  bal_keep_originals: boolean
): Promise<ScanBatchRecord> {
  const bal_now = Date.now();
  const bal_batch: ScanBatchRecord = {
    id: bal_new_id(),
    projectId: bal_project_id,
    questionnaireId: bal_questionnaire_id,
    questionnaireVersion: bal_questionnaire_version,
    status: 'ingesting',
    keepOriginals: bal_keep_originals,
    summary: {
      totalPages: 0,
      ready: 0,
      needsReview: 0,
      duplicates: 0,
      failed: 0,
      unsupported: 0,
      queued: 0,
      respondents: 0,
      complete: 0,
      incomplete: 0
    },
    createdAt: bal_now,
    updatedAt: bal_now
  };
  return bal_save_scan_batch(bal_batch).then(() => bal_batch);
}

function bal_plain<T>(bal_value: T): T {
  return JSON.parse(JSON.stringify(bal_value)) as T;
}

async function bal_delete_asset_keys(bal_ids: string[]): Promise<void> {
  const { bal_delete_keys } = await import('../db/client');
  await bal_delete_keys('scanAssets', bal_ids);
}

export interface bal_PageSpecSource {
  centersMm: { x: number; y: number }[];
  widthMm: number;
  heightMm: number;
  qrCenterMm?: { x: number; y: number };
}

export function bal_canonical_spec_from_layout(
  bal_layout: PrintLayoutRecord | null,
  bal_fallback: bal_PageSpecSource
): bal_PageSpecSource {
  if (!bal_layout) return bal_fallback;
  const bal_page = bal_layout.geometry.pages[0];
  if (!bal_page || bal_page.alignmentMarkers.length !== 4) return bal_fallback;
  const bal_centers = [...bal_page.alignmentMarkers]
    .sort((bal_a, bal_b) => bal_a.rect.y - bal_b.rect.y || bal_a.rect.x - bal_b.rect.x)
    .map((bal_m) => ({ x: bal_m.rect.x + bal_m.rect.width / 2, y: bal_m.rect.y + bal_m.rect.height / 2 }));
  const bal_qr = bal_page.identifier?.qrBounds;
  return {
    centersMm: [bal_centers[0], bal_centers[1], bal_centers[3], bal_centers[2]],
    widthMm: bal_page.width,
    heightMm: bal_page.height,
    qrCenterMm: bal_qr
      ? { x: bal_qr.x + bal_qr.width / 2, y: bal_qr.y + bal_qr.height / 2 }
      : undefined
  };
}

export async function bal_stage_decode_source(
  bal_blob: Blob
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const bal_bitmap = await createImageBitmap(bal_blob, { imageOrientation: 'from-image' });
  const bal_canvas = document.createElement('canvas');
  bal_canvas.width = bal_bitmap.width;
  bal_canvas.height = bal_bitmap.height;
  const bal_context = bal_canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  bal_context.drawImage(bal_bitmap, 0, 0);
  const bal_image_data = bal_context.getImageData(0, 0, bal_bitmap.width, bal_bitmap.height);
  bal_bitmap.close();
  return { data: bal_image_data.data, width: bal_image_data.width, height: bal_image_data.height };
}

export async function bal_default_encode_normalized(bal_image: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}): Promise<{ bytes: Blob; width: number; height: number } | null> {
  const bal_canvas = document.createElement('canvas');
  bal_canvas.width = bal_image.width;
  bal_canvas.height = bal_image.height;
  const bal_context = bal_canvas.getContext('2d') as CanvasRenderingContext2D;
  bal_context.putImageData(new ImageData(bal_image.data, bal_image.width, bal_image.height), 0, 0);
  const bal_blob = await new Promise<Blob | null>((bal_resolve) =>
    bal_canvas.toBlob((bal_result) => bal_resolve(bal_result), 'image/jpeg', 0.92)
  );
  if (!bal_blob) return null;
  return { bytes: bal_blob, width: bal_image.width, height: bal_image.height };
}

export interface bal_ProcessPageOptions {
  page: ScanPageRecord;
  batch: ScanBatchRecord;
  layouts: PrintLayoutRecord[];
  processor: bal_ScanProcessor;
  decodeSource: (bal_blob: Blob) => Promise<{ data: Uint8ClampedArray; width: number; height: number }>;
  encodeNormalized: (
    bal_image: { data: Uint8ClampedArray; width: number; height: number }
  ) => Promise<{ bytes: Blob; width: number; height: number } | null>;
}

function bal_set_status(bal_page: ScanPageRecord, bal_status: ScanPageRecord['status']): ScanPageRecord {
  const bal_updated = { ...bal_plain(bal_page), status: bal_status, updatedAt: Date.now() };
  return bal_updated;
}

async function bal_persist_status(bal_page: ScanPageRecord, bal_status: ScanPageRecord['status']): Promise<ScanPageRecord> {
  const bal_updated = bal_set_status(bal_page, bal_status);
  await bal_save_scan_page(bal_updated);
  return bal_updated;
}

export async function bal_process_one_page(bal_options: bal_ProcessPageOptions): Promise<ScanPageRecord> {
  let bal_page = bal_options.page;
  const bal_started = Date.now();

  const bal_source_asset = bal_page.sourceAssetId ? await dhon_scan_asset(bal_page.sourceAssetId) : null;
  if (!bal_source_asset) {
    bal_page = await bal_persist_status(bal_page, 'failed');
    const bal_failed = {
      ...bal_plain(bal_page),
      errorMessage: 'The original file is missing from local storage.',
      issues: [...new Set([...bal_page.issues, 'failed-decode' as const])]
    };
    await bal_save_scan_page(bal_failed);
    return bal_failed;
  }

  bal_page = await bal_persist_status(bal_page, 'decoding');
  let bal_image: { data: Uint8ClampedArray; width: number; height: number };
  try {
    bal_image = await bal_options.decodeSource(bal_source_asset.bytes);
  } catch {
    bal_page = await bal_persist_status(bal_page, 'failed');
    const bal_failed = {
      ...bal_plain(bal_page),
      status: 'failed' as const,
      errorMessage: `Could not decode ${bal_page.sourceName}.`,
      issues: [...new Set([...bal_page.issues, 'failed-decode' as const])]
    };
    await bal_save_scan_page(bal_failed);
    return bal_failed;
  }

  bal_page = await bal_persist_status(bal_page, 'identifying');
  const bal_layout = bal_options_layout_for(bal_options.layouts, bal_options.batch);
  const bal_dimensions = bal_layout
    ? bal_canonical_dimensions(bal_layout.paperSize, bal_layout.orientation)
    : bal_canonical_dimensions('a4', 'portrait');
  const bal_spec = bal_canonical_spec_from_layout(bal_layout ?? null, {
    centersMm: [
      { x: 8.5, y: 8.5 },
      { x: 201.5, y: 8.5 },
      { x: 201.5, y: 288.5 },
      { x: 8.5, y: 288.5 }
    ],
    widthMm: 210,
    heightMm: 297,
    qrCenterMm: { x: 184, y: 269 }
  });

  bal_page = await bal_persist_status(bal_page, 'aligning');
  let bal_result;
  try {
    bal_result = await bal_options.processor({
      imageData: bal_image,
      spec: bal_spec,
      outWidthPx: bal_dimensions.width,
      outHeightPx: bal_dimensions.height,
      pxPerMm: BAL_CANONICAL_PX_PER_MM
    });
  } catch {
    bal_page = await bal_persist_status(bal_page, 'failed');
    const bal_failed = {
      ...bal_plain(bal_page),
      status: 'failed' as const,
      errorMessage: `Something went wrong while recovering ${bal_page.sourceName}.`,
      issues: [...new Set([...bal_page.issues, 'failed-decode' as const])]
    };
    await bal_save_scan_page(bal_failed);
    return bal_failed;
  }

  bal_page = await bal_persist_status(bal_page, 'normalizing');
  const bal_identity = bal_resolve_identity(bal_result.payloads, bal_options.layouts);

  let bal_normalized_asset_id: string | null = null;
  let bal_normalized_bytes = 0;
  if (bal_result.normalized && bal_result.found) {
    const bal_encoded = await bal_options.encodeNormalized(bal_result.normalized);
    if (bal_encoded) {
      bal_normalized_asset_id = bal_new_id();
      await bal_save_scan_asset({
        id: bal_normalized_asset_id,
        batchId: bal_page.batchId,
        pageId: bal_page.id,
        kind: 'normalized',
        mime: 'image/jpeg',
        bytes: bal_encoded.bytes,
        width: bal_encoded.width,
        height: bal_encoded.height,
        size: bal_encoded.bytes.size,
        createdAt: Date.now()
      });
      bal_normalized_bytes = bal_encoded.bytes.size;
    }
  }

  let bal_status: ScanPageRecord['status'] = 'ready';
  const bal_issues: ScanPageRecord['issues'] = [];
  let bal_error_message: string | null = null;

  if (!bal_result.found) {
    bal_status = 'needs-review';
    bal_issues.push('alignment-failed');
    bal_error_message = bal_result.inferenceNote ?? 'Alignment markers could not be recovered.';
    if (bal_identity.questionnaireId) {
      bal_issues.push(...bal_identity.issues);
    } else if (!bal_issues.includes('unidentified')) {
      bal_issues.push('unidentified');
    }
  } else if (bal_identity.questionnaireId === null) {
    bal_status = 'needs-review';
    bal_issues.push(...bal_identity.issues);
    bal_error_message = bal_identity.reviewReason;
  } else {
    if (bal_identity.issues.length > 0) {
      bal_status = 'needs-review';
      bal_issues.push(...bal_identity.issues);
      bal_error_message = bal_identity.reviewReason;
    }
    if (bal_result.confidence === 'inferred') {
      bal_issues.push('corner-correction-required');
      if (bal_status === 'ready') bal_status = 'needs-review';
    }
    if (bal_result.quality && bal_result.quality.overallStatus === 'error') {
      bal_issues.push('poor-quality');
      bal_error_message = bal_error_message ?? 'The recovered page has serious quality problems.';
      if (bal_status === 'ready') bal_status = 'needs-review';
    }
  }

  const bal_transform = bal_page_transform_from_result(
    bal_result,
    bal_image.width,
    bal_image.height,
    bal_dimensions.width,
    bal_dimensions.height,
    BAL_CANONICAL_PX_PER_MM
  );
  if (bal_page.transform?.manualPoints) {
    bal_transform.manualPoints = bal_page.transform.manualPoints;
  }

  let bal_next: ScanPageRecord = {
    ...bal_plain(bal_page),
    status: bal_status,
    questionnaireId: bal_identity.questionnaireId ?? bal_page.questionnaireId,
    questionnaireVersion: bal_identity.questionnaireVersion ?? bal_page.questionnaireVersion,
    respondentId: bal_identity.respondentId ?? bal_page.respondentId,
    pageNumber: bal_identity.pageNumber ?? bal_page.pageNumber,
    identitySource: bal_result.payloads.length > 0 ? 'qr' : null,
    payload: bal_result.payloads[0] ?? bal_page.payload,
    detectedPayloads: bal_result.payloads.length > 1 ? bal_result.payloads : null,
    quality: bal_result.quality,
    alignment: {
      confidence: bal_result.confidence,
      markersFound: bal_result.markersFound,
      rotationApplied: bal_result.rotationApplied,
      inferenceNote: bal_result.inferenceNote
    },
    transform: bal_result.found ? bal_transform : bal_page.transform,
    issues: [...new Set(bal_issues)],
    errorMessage: bal_error_message,
    normalizedAssetId: bal_normalized_asset_id ?? bal_page.normalizedAssetId,
    normalizedBytes: bal_normalized_bytes > 0 ? bal_normalized_bytes : bal_page.normalizedBytes,
    processingMs: Date.now() - bal_started,
    updatedAt: Date.now()
  };

  if (bal_next.status === 'ready' && bal_next.questionnaireId) {
    const bal_existing = await ken_pori_scan_pages(bal_next.batchId);
    const bal_marked = await bal_flag_identity_duplicate(bal_next, bal_existing);
    if (bal_marked.length > 0) {
      bal_next = bal_marked[0];
    }
  }

  if (!bal_options.batch.keepOriginals && bal_next.sourceAssetId) {
    await bal_delete_asset_keys([bal_next.sourceAssetId]);
    bal_next = { ...bal_next, sourceAssetId: null };
  }

  await bal_save_scan_page(bal_next);
  return bal_next;
}

export interface bal_QueueRunUpdate {
  processed: number;
  total: number;
  currentPage: ScanPageRecord | null;
  etaLabel: string;
}

export interface bal_QueueRunResult {
  processed: number;
  failed: number;
  cancelled: boolean;
}

export async function bal_run_batch_queue(
  bal_batch_id: string,
  bal_layouts: PrintLayoutRecord[],
  bal_processor: bal_ScanProcessor,
  bal_decode: (bal_blob: Blob) => Promise<{ data: Uint8ClampedArray; width: number; height: number }>,
  bal_encode: (
    bal_image: { data: Uint8ClampedArray; width: number; height: number }
  ) => Promise<{ bytes: Blob; width: number; height: number } | null>,
  bal_on_update: (bal_update: bal_QueueRunUpdate) => void,
  bal_is_cancelled: () => boolean,
  bal_estimator?: bal_EtaEstimator
): Promise<bal_QueueRunResult> {
  const bal_batch = await dhon_scan_batch(bal_batch_id);
  if (!bal_batch) return { processed: 0, failed: 0, cancelled: false };
  const bal_active: ScanBatchRecord = { ...bal_plain(bal_batch), status: 'processing', updatedAt: Date.now() };
  await bal_save_scan_batch(bal_active);
  const bal_queue = (await ken_pori_scan_pages(bal_batch_id)).filter((bal_page) => bal_page.status === 'queued');
  const bal_estimator_local = bal_estimator ?? bal_create_eta_estimator();
  let bal_processed = 0;
  let bal_failed = 0;
  for (const bal_queued of bal_queue) {
    if (bal_is_cancelled()) {
      const bal_cancelled_batch = { ...bal_active, status: 'cancelled' as const, updatedAt: Date.now() };
      await bal_save_scan_batch(bal_cancelled_batch);
      return { processed: bal_processed, failed: bal_failed, cancelled: true };
    }
    const bal_stage_start = Date.now();
    const bal_result_page = await bal_process_one_page({
      page: bal_queued,
      batch: bal_active,
      layouts: bal_layouts,
      processor: bal_processor,
      decodeSource: bal_decode,
      encodeNormalized: bal_encode
    });
    if (bal_result_page.status === 'failed') bal_failed += 1;
    bal_processed += 1;
    bal_record_stage(bal_estimator_local, 'total', Date.now() - bal_stage_start);
    const bal_remaining = bal_queue.length - bal_processed;
    bal_on_update({
      processed: bal_processed,
      total: bal_queue.length,
      currentPage: bal_result_page,
      etaLabel: bal_eta_label(bal_estimator_local, [{ stage: 'total', count: bal_remaining }])
    });
  }
  const bal_final_pages = await ken_pori_scan_pages(bal_batch_id);
  const bal_summary = bal_compute_summary_rows(bal_final_pages);
  const bal_done_batch: ScanBatchRecord = {
    ...bal_active,
    status: 'review',
    summary: bal_summary,
    updatedAt: Date.now()
  };
  await bal_save_scan_batch(bal_done_batch);
  return { processed: bal_processed, failed: bal_failed, cancelled: false };
}

function bal_compute_summary_rows(bal_pages: ScanPageRecord[]): ScanBatchRecord['summary'] {
  const bal_summary = {
    totalPages: bal_pages.length,
    ready: 0,
    needsReview: 0,
    duplicates: 0,
    failed: 0,
    unsupported: 0,
    queued: 0,
    respondents: 0,
    complete: 0,
    incomplete: 0
  };
  for (const bal_page of bal_pages) {
    switch (bal_page.status) {
      case 'ready':
        bal_summary.ready += 1;
        break;
      case 'needs-review':
        bal_summary.needsReview += 1;
        break;
      case 'duplicate':
        bal_summary.duplicates += 1;
        break;
      case 'failed':
        bal_summary.failed += 1;
        break;
      case 'unsupported':
        bal_summary.unsupported += 1;
        break;
      default:
        bal_summary.queued += 1;
    }
  }
  bal_summary.respondents = new Set(
    bal_pages
      .filter((bal_page) => bal_page.respondentId !== null)
      .map((bal_page) => `${bal_page.questionnaireId}|${bal_page.questionnaireVersion}|${bal_page.respondentId}`)
  ).size;
  return bal_summary;
}

export async function bal_add_files_to_batch(
  bal_batch: ScanBatchRecord,
  bal_files: { name: string; type: string; bytes: Blob }[]
): Promise<{ added: ScanPageRecord[]; unsupported: ScanPageRecord[] }> {
  const bal_added: ScanPageRecord[] = [];
  const bal_unsupported: ScanPageRecord[] = [];
  const bal_existing = await ken_pori_scan_pages(bal_batch.id);
  for (const bal_file of bal_files) {
    const bal_lower = bal_file.name.toLowerCase();
    const bal_is_image =
      bal_file.type.startsWith('image/') ||
      ['.jpg', '.jpeg', '.png', '.webp'].some((bal_ext) => bal_lower.endsWith(bal_ext));
    const bal_is_pdf = bal_file.type === 'application/pdf' || bal_lower.endsWith('.pdf');
    const bal_now = Date.now();
    const bal_bytes = bal_file.bytes.size;
    const bal_hash = await bal_hash_source_bytes(await bal_file.bytes.arrayBuffer());
    const bal_record: ScanPageRecord = {
      id: bal_new_id(),
      batchId: bal_batch.id,
      projectId: bal_batch.projectId,
      questionnaireId: null,
      questionnaireVersion: null,
      respondentId: null,
      pageNumber: null,
      status: bal_is_image || bal_is_pdf ? 'queued' : 'unsupported',
      sourceAssetId: null,
      normalizedAssetId: null,
      sourceName: bal_file.name,
      sourceType: bal_is_image ? 'image' : bal_is_pdf ? 'pdf' : 'unknown',
      sourceHash: bal_hash,
      sourceBytes: bal_bytes,
      normalizedBytes: 0,
      thumbSource: null,
      thumbNormalized: null,
      identitySource: null,
      payload: null,
      detectedPayloads: null,
      quality: null,
      alignment: null,
      transform: null,
      issues: bal_is_image || bal_is_pdf ? [] : ['unsupported-file'],
      errorMessage:
        bal_is_image || bal_is_pdf
          ? null
          : `${bal_file.name} is not a supported image or PDF file.`,
      processingMs: 0,
      createdAt: bal_now,
      updatedAt: bal_now
    };
    if (bal_record.status === 'queued') {
      const bal_twin = bal_existing.find((bal_other) => bal_other.sourceHash === bal_hash);
      if (bal_twin) {
        bal_record.status = 'duplicate';
        bal_record.issues = ['duplicate'];
        bal_record.errorMessage = `Identical file already imported as ${bal_twin.sourceName}.`;
      }
    }
    if (bal_record.status === 'queued' || bal_record.status === 'duplicate') {
      const bal_asset_id = bal_new_id();
      bal_record.sourceAssetId = bal_asset_id;
      await bal_save_scan_asset({
        id: bal_asset_id,
        batchId: bal_batch.id,
        pageId: bal_record.id,
        kind: 'source',
        mime: bal_file.type || 'application/octet-stream',
        bytes: bal_file.bytes,
        width: 0,
        height: 0,
        size: bal_bytes,
        createdAt: bal_now
      });
    }
    await bal_save_scan_page(bal_record);
    bal_existing.push(bal_record);
    if (bal_record.status === 'unsupported') bal_unsupported.push(bal_record);
    else bal_added.push(bal_record);
  }
  const bal_all = await ken_pori_scan_pages(bal_batch.id);
  const bal_updated_batch: ScanBatchRecord = {
    ...bal_plain(bal_batch),
    updatedAt: Date.now(),
    summary: bal_compute_summary_rows(bal_all)
  };
  await bal_save_scan_batch(bal_updated_batch);
  return { added: bal_added, unsupported: bal_unsupported };
}

async function bal_hash_source_bytes(bal_bytes: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bal_digest = await crypto.subtle.digest('SHA-256', bal_bytes);
    return [...new Uint8Array(bal_digest)]
      .map((bal_byte) => bal_byte.toString(16).padStart(2, '0'))
      .join('');
  }
  let bal_h1 = 0x811c9dc5;
  let bal_h2 = 0x01000193;
  const bal_view = new Uint8Array(bal_bytes);
  for (let bal_i = 0; bal_i < bal_view.length; bal_i++) {
    bal_h1 = ((bal_h1 ^ bal_view[bal_i]) * 0x01000193) >>> 0;
    bal_h2 = ((bal_h2 + bal_view[bal_i] * (bal_i + 1)) * 0x85ebca6b) >>> 0;
  }
  return `fnv-${bal_h1.toString(16)}${bal_h2.toString(16)}`;
}

export async function bal_apply_manual_corner_correction(
  bal_page_id: string,
  bal_corner_points_px: { x: number; y: number }[],
  bal_layouts: PrintLayoutRecord[],
  bal_processor: bal_ScanProcessor,
  bal_decode: (bal_blob: Blob) => Promise<{ data: Uint8ClampedArray; width: number; height: number }>,
  bal_encode: (
    bal_image: { data: Uint8ClampedArray; width: number; height: number }
  ) => Promise<{ bytes: Blob; width: number; height: number } | null>
): Promise<ScanPageRecord | null> {
  const { dhon_scan_page } = await import('../db/scan_repo');
  const bal_page = await dhon_scan_page(bal_page_id);
  if (!bal_page) return null;
  if (bal_corner_points_px.length !== 4) return null;
  const { dhon_scan_batch } = await import('../db/scan_repo');
  const bal_batch = await dhon_scan_batch(bal_page.batchId);
  if (!bal_batch) return null;
  const bal_layout = bal_options_layout_for(bal_layouts, bal_batch);
  const bal_dimensions = bal_layout
    ? bal_canonical_dimensions(bal_layout.paperSize, bal_layout.orientation)
    : bal_canonical_dimensions('a4', 'portrait');
  const bal_reset: ScanPageRecord = {
    ...bal_plain(bal_page),
    status: 'queued',
    transform: {
      markerPoints: null,
      manualPoints: bal_corner_points_px,
      homography: null,
      sourceWidth: bal_page.transform?.sourceWidth ?? 0,
      sourceHeight: bal_page.transform?.sourceHeight ?? 0,
      outWidth: bal_dimensions.width,
      outHeight: bal_dimensions.height,
      rotationApplied: 0,
      pixelsPerMm: BAL_CANONICAL_PX_PER_MM
    },
    updatedAt: Date.now()
  };
  await bal_save_scan_page(bal_reset);
  const bal_corrected = await bal_process_one_page({
    page: bal_reset,
    batch: bal_batch,
    layouts: bal_layouts,
    processor: (bal_input) => bal_processor({ ...bal_input, manualCorners: bal_corner_points_px }),
    decodeSource: bal_decode,
    encodeNormalized: bal_encode
  });
  await bal_log_scan_action(
    bal_page.batchId,
    bal_page.id,
    'manual-corner-correction',
    `Four-corner correction applied to ${bal_page.sourceName}.`
  );
  return bal_corrected;
}

function bal_options_layout_for(bal_layouts: PrintLayoutRecord[], bal_batch: ScanBatchRecord): PrintLayoutRecord | null {
  return (
    bal_layouts.find(
      (bal_candidate) =>
        bal_candidate.questionnaireId === bal_batch.questionnaireId &&
        (bal_batch.questionnaireVersion === null ||
          bal_candidate.questionnaireVersion === bal_batch.questionnaireVersion)
    ) ?? null
  );
}

export async function bal_reprocess_page(
  bal_page_id: string,
  bal_layouts: PrintLayoutRecord[],
  bal_processor: bal_ScanProcessor,
  bal_decode: (bal_blob: Blob) => Promise<{ data: Uint8ClampedArray; width: number; height: number }>,
  bal_encode: (
    bal_image: { data: Uint8ClampedArray; width: number; height: number }
  ) => Promise<{ bytes: Blob; width: number; height: number } | null>
): Promise<ScanPageRecord | null> {
  const { dhon_scan_page } = await import('../db/scan_repo');
  const bal_page = await dhon_scan_page(bal_page_id);
  if (!bal_page) return null;
  const { dhon_scan_batch } = await import('../db/scan_repo');
  const bal_batch = await dhon_scan_batch(bal_page.batchId);
  if (!bal_batch) return null;
  if (bal_page.transform?.manualPoints || bal_page.alignment?.confidence === 'manual') {
    await bal_log_scan_action(
      bal_page.batchId,
      bal_page.id,
      'page-rejection',
      `Page ${bal_page.sourceName} reprocessed; a saved manual correction warning was acknowledged.`
    );
  }
  const bal_reset: ScanPageRecord = {
    ...bal_plain(bal_page),
    status: 'queued',
    updatedAt: Date.now()
  };
  await bal_save_scan_page(bal_reset);
  return bal_process_one_page({
    page: bal_reset,
    batch: bal_batch,
    layouts: bal_layouts,
    processor: bal_processor,
    decodeSource: bal_decode,
    encodeNormalized: bal_encode
  });
}

export async function bal_set_page_thumbs(
  bal_page_id: string,
  bal_thumb_source: string | null,
  bal_thumb_normalized: string | null
): Promise<void> {
  const { dhon_scan_page } = await import('../db/scan_repo');
  const bal_page = await dhon_scan_page(bal_page_id);
  if (!bal_page) return;
  await bal_save_scan_page({
    ...bal_plain(bal_page),
    thumbSource: bal_thumb_source ?? bal_page.thumbSource,
    thumbNormalized: bal_thumb_normalized ?? bal_page.thumbNormalized,
    updatedAt: Date.now()
  });
}

export async function bal_manual_identify_page(
  bal_page_id: string,
  bal_assignment: { questionnaireId: string; version: number; respondentId: string; pageNumber: number },
  bal_layouts: PrintLayoutRecord[],
  bal_pages: ScanPageRecord[]
): Promise<{ ok: boolean; error: string | null; warning: string | null; page: ScanPageRecord | null }> {
  const { dhon_scan_page } = await import('../db/scan_repo');
  const bal_page = await dhon_scan_page(bal_page_id);
  if (!bal_page) return { ok: false, error: 'Page not found.', warning: null, page: null };
  const bal_validation = bal_validate_manual_assignment(
    bal_assignment,
    bal_layouts,
    bal_pages,
    bal_page.id
  );
  if (!bal_validation.ok) {
    return { ok: false, error: bal_validation.error, warning: null, page: null };
  }
  const bal_remaining_issues = bal_page.issues.filter(
    (bal_issue) => bal_issue !== 'unidentified' && bal_issue !== 'multiple-identifiers' && bal_issue !== 'possible-multiple-sheets'
  );
  const bal_can_be_ready =
    bal_remaining_issues.length === 0 &&
    bal_page.normalizedAssetId !== null &&
    bal_page.alignment?.confidence !== 'failed' &&
    bal_page.quality?.overallStatus !== 'error';
  const bal_status: ScanPageRecord['status'] = bal_can_be_ready
    ? 'ready'
    : bal_page.status === 'duplicate'
      ? 'duplicate'
      : 'needs-review';
  const bal_updated: ScanPageRecord = {
    ...bal_plain(bal_page),
    questionnaireId: bal_assignment.questionnaireId,
    questionnaireVersion: bal_assignment.version,
    respondentId: bal_assignment.respondentId,
    pageNumber: bal_assignment.pageNumber,
    identitySource: 'manual',
    status: bal_status,
    issues: bal_remaining_issues,
    errorMessage: bal_remaining_issues.length > 0 ? bal_page.errorMessage : null,
    updatedAt: Date.now()
  };
  await bal_save_scan_page(bal_updated);
  await bal_log_scan_action(
    bal_page.batchId,
    bal_page.id,
    'manual-identification',
    `Assigned ${bal_assignment.questionnaireId} v${bal_assignment.version}, respondent ${bal_assignment.respondentId}, page ${bal_assignment.pageNumber}.`
  );
  if (bal_validation.warning) {
    await bal_flag_identity_duplicate(bal_updated, bal_pages);
  }
  const bal_refreshed = await dhon_scan_page(bal_page_id);
  return { ok: true, error: null, warning: bal_validation.warning, page: bal_refreshed ?? bal_updated };
}

export type bal_DuplicateResolution = 'keep-a' | 'keep-b' | 'keep-both' | 'reject';

export async function bal_resolve_duplicate_pair(
  bal_page_a_id: string,
  bal_page_b_id: string,
  bal_resolution: bal_DuplicateResolution
): Promise<void> {
  const { dhon_scan_page } = await import('../db/scan_repo');
  const bal_page_a = await dhon_scan_page(bal_page_a_id);
  const bal_page_b = await dhon_scan_page(bal_page_b_id);
  if (!bal_page_a || !bal_page_b) return;
  const bal_updates: ScanPageRecord[] = [];
  const bal_apply = (
    bal_page: ScanPageRecord,
    bal_outcome: 'kept' | 'rejected' | 'restored'
  ): ScanPageRecord => {
    if (bal_outcome === 'kept') {
      const bal_issues = bal_page.issues.filter((bal_issue) => bal_issue !== 'duplicate');
      return {
        ...bal_plain(bal_page),
        status: bal_issues.length === 0 && bal_page.normalizedAssetId ? 'ready' : 'needs-review',
        issues: bal_issues,
        errorMessage: null,
        updatedAt: Date.now()
      };
    }
    if (bal_outcome === 'restored') {
      const bal_issues = bal_page.issues.filter((bal_issue) => bal_issue !== 'duplicate');
      return {
        ...bal_plain(bal_page),
        status: bal_issues.length === 0 ? 'needs-review' : bal_page.status,
        issues: bal_issues,
        updatedAt: Date.now()
      };
    }
    return {
      ...bal_plain(bal_page),
      status: 'duplicate',
      issues: [...new Set([...bal_page.issues, 'duplicate' as const])],
      errorMessage: 'Marked as rejected during duplicate resolution.',
      updatedAt: Date.now()
    };
  };
  if (bal_resolution === 'keep-a') {
    bal_updates.push(bal_apply(bal_page_a, 'kept'), bal_apply(bal_page_b, 'rejected'));
  } else if (bal_resolution === 'keep-b') {
    bal_updates.push(bal_apply(bal_page_b, 'kept'), bal_apply(bal_page_a, 'rejected'));
  } else if (bal_resolution === 'keep-both') {
    bal_updates.push(bal_apply(bal_page_a, 'restored'), bal_apply(bal_page_b, 'restored'));
  } else {
    bal_updates.push(bal_apply(bal_page_a, 'rejected'), bal_apply(bal_page_b, 'rejected'));
  }
  for (const bal_update of bal_updates) await bal_save_scan_page(bal_update);
  await bal_log_scan_action(
    bal_page_a.batchId,
    bal_page_a.id,
    'duplicate-resolution',
    `Duplicate pair resolved: ${bal_resolution} (${bal_page_a.sourceName} vs ${bal_page_b.sourceName}).`
  );
}

export async function bal_remove_originals(bal_batch_id: string): Promise<void> {
  const bal_pages = await ken_pori_scan_pages(bal_batch_id);
  const bal_ids: string[] = [];
  for (const bal_page of bal_pages) {
    if (bal_page.sourceAssetId) bal_ids.push(bal_page.sourceAssetId);
  }
  await bal_delete_asset_keys(bal_ids);
  for (const bal_page of bal_pages) {
    await bal_save_scan_page({ ...bal_plain(bal_page), sourceAssetId: null, updatedAt: Date.now() });
  }
  const { dhon_scan_batch } = await import('../db/scan_repo');
  const bal_batch = await dhon_scan_batch(bal_batch_id);
  if (bal_batch) {
    await bal_save_scan_batch({ ...bal_plain(bal_batch), keepOriginals: false, updatedAt: Date.now() });
  }
  await bal_log_scan_action(bal_batch_id, null, 'originals-removed', `Removed ${bal_ids.length} original files from local storage.`);
}

export async function bal_delete_scan_batch(bal_batch_id: string): Promise<void> {
  const bal_pages = await ken_pori_scan_pages(bal_batch_id);
  const bal_asset_ids: string[] = [];
  for (const bal_page of bal_pages) {
    if (bal_page.sourceAssetId) bal_asset_ids.push(bal_page.sourceAssetId);
    if (bal_page.normalizedAssetId) bal_asset_ids.push(bal_page.normalizedAssetId);
  }
  await bal_delete_asset_keys(bal_asset_ids);
  const { bal_delete_keys } = await import('../db/client');
  await bal_delete_keys(
    'scanPages',
    bal_pages.map((bal_page) => bal_page.id)
  );
  const bal_audit = await ken_pori_audit_events_safe(bal_batch_id);
  await bal_delete_keys(
    'scanAuditEvents',
    bal_audit.map((bal_event) => bal_event.id)
  );
  await bal_delete_keys('scanBatches', [bal_batch_id]);
}

async function ken_pori_audit_events_safe(bal_batch_id: string) {
  const { ken_pori_audit_events } = await import('../db/scan_repo');
  return ken_pori_audit_events(bal_batch_id);
}
