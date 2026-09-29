import type { BalInspectedPackage } from './mahim_import';
import { bal_payload_equal } from './mahim_payload';
import type { ProjectRecord } from '../../models/types';
import { ken_pori_projects } from '../../db/projects_repo';
import { dhon_questionnaire, ken_pori_questionnaires } from '../../db/questionnaires_repo';
import { dhon_scale, ken_pori_scales } from '../../db/scales_repo';

export type BalCollisionAction = 'add' | 'dedupe' | 'update' | 'conflict';

export interface BalProjectCollision {
  projectId: string;
  action: BalCollisionAction;
  localTitle: string | null;
  detail: string;
}

export interface BalQuestionnaireCollision {
  questionnaireId: string;
  incomingVersion: number;
  localVersion: number | null;
  action: BalCollisionAction;
  detail: string;
}

export interface BalScaleCollision {
  scaleId: string;
  action: BalCollisionAction;
  detail: string;
}

export interface BalCollisionPlan {
  project: BalProjectCollision;
  questionnaires: BalQuestionnaireCollision[];
  scales: BalScaleCollision[];
  requiresUserChoice: boolean;
  integrityConflict: boolean;
}

export async function bal_plan_collisions(
  bal_inspected: BalInspectedPackage
): Promise<BalCollisionPlan> {
  const bal_local_projects = await ken_pori_projects();
  const bal_local_project = bal_local_projects.find(
    (bal_p) => bal_p.id === bal_inspected.project.id
  );
  let bal_project_action: BalCollisionAction = 'add';
  let bal_project_detail = 'The project is new on this device.';
  if (bal_local_project) {
    if (bal_payload_equal(bal_local_project, bal_inspected.project)) {
      bal_project_action = 'dedupe';
      bal_project_detail = 'This project is already available on this device and will not be duplicated.';
    } else {
      bal_project_action = 'conflict';
      bal_project_detail = 'A different project with the same identity already exists on this device.';
    }
  }
  const bal_q_plan: BalQuestionnaireCollision[] = [];
  for (const bal_q of bal_inspected.questionnaires) {
    const bal_local_q = await dhon_questionnaire(bal_q.id);
    if (!bal_local_q) {
      bal_q_plan.push({
        questionnaireId: bal_q.id,
        incomingVersion: bal_q.version,
        localVersion: null,
        action: 'add',
        detail: 'The questionnaire is new on this device.'
      });
      continue;
    }
    if (bal_local_q.version === bal_q.version) {
      if (bal_payload_equal(bal_local_q, bal_q)) {
        bal_q_plan.push({
          questionnaireId: bal_q.id,
          incomingVersion: bal_q.version,
          localVersion: bal_local_q.version,
          action: 'dedupe',
          detail: 'This questionnaire version is already available on this device.'
        });
      } else {
        bal_q_plan.push({
          questionnaireId: bal_q.id,
          incomingVersion: bal_q.version,
          localVersion: bal_local_q.version,
          action: 'conflict',
          detail: 'The same questionnaire version exists with different content. Version identities are immutable, so the import cannot merge this file.'
        });
      }
      continue;
    }
    if (bal_q.version > bal_local_q.version) {
      bal_q_plan.push({
        questionnaireId: bal_q.id,
        incomingVersion: bal_q.version,
        localVersion: bal_local_q.version,
        action: 'update',
        detail: `The file carries a newer version (v${bal_q.version}) than the local definition (v${bal_local_q.version}).`
      });
      continue;
    }
    bal_q_plan.push({
      questionnaireId: bal_q.id,
      incomingVersion: bal_q.version,
      localVersion: bal_local_q.version,
      action: 'conflict',
      detail: `The file carries an older version (v${bal_q.version}) than the local definition (v${bal_local_q.version}).`
    });
  }
  const bal_scale_plan: BalScaleCollision[] = [];
  for (const bal_scale of bal_inspected.scales) {
    const bal_local_scale = await dhon_scale(bal_scale.id);
    if (!bal_local_scale) {
      bal_scale_plan.push({
        scaleId: bal_scale.id,
        action: 'add',
        detail: 'New scale.'
      });
    } else if (bal_payload_equal(bal_local_scale, bal_scale)) {
      bal_scale_plan.push({
        scaleId: bal_scale.id,
        action: 'dedupe',
        detail: 'Scale already available.'
      });
    } else {
      bal_scale_plan.push({
        scaleId: bal_scale.id,
        action: 'conflict',
        detail: 'A different scale with the same id exists locally.'
      });
    }
  }
  const bal_integrity_conflict =
    bal_q_plan.some((bal_q) => bal_q.action === 'conflict');
  const bal_requires_user_choice =
    bal_project_action === 'conflict' || bal_integrity_conflict;
  return {
    project: {
      projectId: bal_inspected.project.id,
      action: bal_project_action,
      localTitle: bal_local_project?.title ?? null,
      detail: bal_project_detail
    },
    questionnaires: bal_q_plan,
    scales: bal_scale_plan,
    requiresUserChoice: bal_requires_user_choice,
    integrityConflict: bal_integrity_conflict
  };
}

export type BalImportResolution = 'merge' | 'replace' | 'copy' | 'cancel';

export interface BalCopyRemapping {
  projectId: string;
  questionnaireIds: Record<string, string>;
  scaleIds: Record<string, string>;
  titleSuffix: string;
}

function bal_random_id(bal_prefix: string): string {
  const bal_bytes = new Uint8Array(8);
  crypto.getRandomValues(bal_bytes);
  const bal_hex = Array.from(bal_bytes)
    .map((bal_b) => bal_b.toString(16).padStart(2, '0'))
    .join('');
  return `${bal_prefix}-${bal_hex}`;
}

export async function bal_build_copy_remapping(
  bal_inspected: BalInspectedPackage
): Promise<BalCopyRemapping> {
  const bal_local_projects = await ken_pori_projects();
  const bal_local_q = await ken_pori_questionnaires();
  const bal_local_scales = await ken_pori_scales();
  const bal_taken_projects = new Set(bal_local_projects.map((bal_p) => bal_p.id));
  const bal_taken_q = new Set(bal_local_q.map((bal_q) => bal_q.id));
  const bal_taken_scales = new Set(bal_local_scales.map((bal_s) => bal_s.id));
  const bal_project_id = bal_random_id('proj');
  while (bal_taken_projects.has(bal_project_id)) {
    bal_taken_projects.add(bal_project_id);
  }
  const bal_questionnaire_ids: Record<string, string> = {};
  for (const bal_q of bal_inspected.questionnaires) {
    if (!bal_taken_q.has(bal_q.id)) {
      bal_questionnaire_ids[bal_q.id] = bal_q.id;
      bal_taken_q.add(bal_q.id);
    } else {
      const bal_new_id = bal_random_id('q');
      bal_questionnaire_ids[bal_q.id] = bal_new_id;
      bal_taken_q.add(bal_new_id);
    }
  }
  const bal_scale_ids: Record<string, string> = {};
  for (const bal_scale of bal_inspected.scales) {
    if (!bal_taken_scales.has(bal_scale.id)) {
      bal_scale_ids[bal_scale.id] = bal_scale.id;
      bal_taken_scales.add(bal_scale.id);
    } else {
      const bal_new_id = bal_random_id('scale');
      bal_scale_ids[bal_scale.id] = bal_new_id;
      bal_taken_scales.add(bal_new_id);
    }
  }
  return {
    projectId: bal_project_id,
    questionnaireIds: bal_questionnaire_ids,
    scaleIds: bal_scale_ids,
    titleSuffix: ' (imported)'
  };
}

export function bal_apply_copy_remapping(
  bal_inspected: BalInspectedPackage,
  bal_remap: BalCopyRemapping
): BalInspectedPackage {
  const bal_project: ProjectRecord = {
    ...bal_inspected.project,
    id: bal_remap.projectId,
    title: bal_inspected.project.title + bal_remap.titleSuffix
  };
  const bal_questionnaires = bal_inspected.questionnaires.map((bal_q) => ({
    ...bal_q,
    id: bal_remap.questionnaireIds[bal_q.id],
    projectId: bal_remap.projectId,
    title: bal_remap.questionnaireIds[bal_q.id] === bal_q.id
      ? bal_q.title
      : bal_q.title + bal_remap.titleSuffix
  }));
  const bal_scales = bal_inspected.scales.map((bal_scale) => ({
    ...bal_scale,
    id: bal_remap.scaleIds[bal_scale.id],
    name: bal_remap.scaleIds[bal_scale.id] === bal_scale.id
      ? bal_scale.name
      : bal_scale.name + bal_remap.titleSuffix
  }));
  const bal_layouts = bal_inspected.print.layouts.map((bal_layout) => ({
    ...bal_layout,
    id: `${bal_layout.id}@${bal_remap.projectId}`,
    projectId: bal_remap.projectId,
    questionnaireId: bal_remap.questionnaireIds[bal_layout.questionnaireId]
  }));
  const bal_batches = bal_inspected.print.batches.map((bal_batch) => ({
    ...bal_batch,
    id: `${bal_batch.id}@${bal_remap.projectId}`,
    projectId: bal_remap.projectId,
    questionnaireId: bal_remap.questionnaireIds[bal_batch.questionnaireId],
    layoutId: `${bal_batch.layoutId}@${bal_remap.projectId}`
  }));
  const bal_q_remap = (bal_id: string | null): string | null =>
    bal_id === null ? null : bal_remap.questionnaireIds[bal_id] ?? bal_id;
  const bal_scan = bal_inspected.scan
    ? {
        batches: bal_inspected.scan.batches.map((bal_b) => ({
          ...bal_b,
          id: `${bal_b.id}@${bal_remap.projectId}`,
          projectId: bal_remap.projectId,
          questionnaireId: bal_q_remap(bal_b.questionnaireId)
        })),
        pages: bal_inspected.scan.pages.map((bal_p) => ({
          ...bal_p,
          id: `${bal_p.id}@${bal_remap.projectId}`,
          batchId: `${bal_p.batchId}@${bal_remap.projectId}`,
          projectId: bal_remap.projectId,
          questionnaireId: bal_q_remap(bal_p.questionnaireId)
        })),
        auditEvents: bal_inspected.scan.auditEvents.map((bal_e) => ({
          ...bal_e,
          id: `${bal_e.id}@${bal_remap.projectId}`,
          batchId: `${bal_e.batchId}@${bal_remap.projectId}`,
          pageId: bal_e.pageId === null ? null : `${bal_e.pageId}@${bal_remap.projectId}`
        }))
      }
    : null;
  const bal_responses = bal_inspected.responses
    ? {

        ...bal_inspected.responses,
        responses: bal_inspected.responses.responses.map((bal_r) => ({
          ...bal_r,
          id: `${bal_r.id}@${bal_remap.projectId}`,
          projectId: bal_remap.projectId,
          batchId: bal_r.batchId === null ? null : `${bal_r.batchId}@${bal_remap.projectId}`,
          questionnaireId: bal_remap.questionnaireIds[bal_r.questionnaireId] ?? bal_r.questionnaireId
        })),
        recognitionRuns: bal_inspected.responses.recognitionRuns.map((bal_r) => ({
          ...bal_r,
          id: `${bal_r.id}@${bal_remap.projectId}`,
          projectId: bal_remap.projectId,
          batchId: bal_r.batchId === null ? null : `${bal_r.batchId}@${bal_remap.projectId}`,
          questionnaireId: bal_r.questionnaireId === null ? null : bal_remap.questionnaireIds[bal_r.questionnaireId] ?? null
        })),
        auditEvents: bal_inspected.responses.auditEvents.map((bal_e) => ({
          ...bal_e,
          id: `${bal_e.id}@${bal_remap.projectId}`,
          projectId: bal_remap.projectId
        })),
        blankReferences: bal_inspected.responses.blankReferences.map((bal_ref) => ({
          ...bal_ref,
          id: `${bal_ref.id}@${bal_remap.projectId}`
        }))
      }
    : null;
  const bal_asset_index = bal_inspected.assetIndex.map((bal_entry) => ({
    ...bal_entry,
    assetId:
      bal_entry.kind === 'blank-reference'
        ? `${bal_entry.assetId}@${bal_remap.projectId}`
        : bal_entry.assetId,
    pageId:
      bal_entry.pageId === null ? null : `${bal_entry.pageId}@${bal_remap.projectId}`
  }));
  return {
    ...bal_inspected,
    project: bal_project,
    questionnaires: bal_questionnaires,
    scales: bal_scales,
    print: { layouts: bal_layouts, batches: bal_batches },
    scan: bal_scan,
    responses: bal_responses,
    assetIndex: bal_asset_index
  };
}
