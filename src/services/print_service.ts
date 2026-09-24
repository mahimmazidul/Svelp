import { new_id } from '../utils/id';
import type { PrintBatchRecord, PrintLayoutRecord } from '../models/print_models';
import type { QuestionnaireRecord, ResponseScaleRecord } from '../models/types';
import { bal_build_print_document, type bal_PrintDocument } from '../features/print/print_layout';
import { bal_questionnaire_fingerprint, bal_plan_respondent_ids, type bal_BatchPlanInput } from '../features/print/print_batch';
import { bal_normalize_print_settings } from '../features/print/print_settings';
import { bal_save_batch_with_layout, ken_pori_layouts_by_questionnaire } from '../db/print_repo';

export interface bal_GenerateBatchInput {
  questionnaire: QuestionnaireRecord;
  scales: ResponseScaleRecord[];
  projectId: string;
  plan: bal_BatchPlanInput;
}

export interface bal_GeneratedBatch {
  batch: PrintBatchRecord;
  layout: PrintLayoutRecord;
  documents: bal_PrintDocument[];
  missingQuestionnaireVersion: boolean;
}

export async function bal_generate_batch(
  bal_input: bal_GenerateBatchInput
): Promise<bal_GeneratedBatch> {
  const bal_plan = bal_plan_respondent_ids(bal_input.plan);
  if (!bal_plan.valid) {
    throw new Error(bal_plan.errors.join(' '));
  }
  const bal_settings = bal_normalize_print_settings(bal_input.questionnaire.printSettings);
  const bal_fingerprint = bal_questionnaire_fingerprint(bal_input.questionnaire);
  const bal_sample = bal_build_print_document({
    questionnaire: bal_input.questionnaire,
    scales: bal_input.scales,
    respondentId: bal_plan.respondentIds[0] ?? ''
  });

  const bal_existing = await ken_pori_layouts_by_questionnaire(bal_input.questionnaire.id);
  const bal_matched = bal_existing.find((bal_row) => bal_row.fingerprint === bal_fingerprint);
  const bal_now = Date.now();
  const bal_layout: PrintLayoutRecord = bal_matched ?? {
    id: new_id(),
    questionnaireId: bal_input.questionnaire.id,
    projectId: bal_input.projectId,
    questionnaireVersion: bal_input.questionnaire.version,
    fingerprint: bal_fingerprint,
    paperSize: bal_input.questionnaire.paperSize,
    orientation: bal_input.questionnaire.orientation,
    settingsSnapshot: bal_settings,
    geometry: bal_sample.geometry,
    createdAt: bal_now,
    updatedAt: bal_now
  };
  if (bal_matched) {
    bal_layout.settingsSnapshot = bal_settings;
    bal_layout.geometry = bal_sample.geometry;
    bal_layout.updatedAt = bal_now;
  }

  const bal_batch: PrintBatchRecord = {
    id: new_id(),
    projectId: bal_input.projectId,
    questionnaireId: bal_input.questionnaire.id,
    questionnaireVersion: bal_input.questionnaire.version,
    fingerprint: bal_fingerprint,
    layoutId: bal_layout.id,
    respondentIds: bal_plan.respondentIds,
    settings: bal_settings,
    pageCount: bal_sample.pageCount,
    includeMachineIdentifier: bal_settings.showMachineIdentifier,
    includeHumanReadableId: bal_settings.footer.showHumanIdentifier,
    createdAt: bal_now
  };

  const bal_documents = bal_plan.respondentIds.map((bal_respondent_id) =>
    bal_build_print_document({
      questionnaire: bal_input.questionnaire,
      scales: bal_input.scales,
      respondentId: bal_respondent_id
    })
  );

  await bal_save_batch_with_layout(bal_batch, bal_layout);
  return {
    batch: bal_batch,
    layout: bal_layout,
    documents: bal_documents,
    missingQuestionnaireVersion: false
  };
}

export function bal_render_respondent(
  bal_questionnaire: QuestionnaireRecord,
  bal_scales: ResponseScaleRecord[],
  bal_respondent_id: string
): bal_PrintDocument {
  return bal_build_print_document({
    questionnaire: bal_questionnaire,
    scales: bal_scales,
    respondentId: bal_respondent_id
  });
}
