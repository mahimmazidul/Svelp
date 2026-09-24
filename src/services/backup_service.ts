import { bal_run_tx } from '../db/client';
import { ken_pori_projects } from '../db/projects_repo';
import { ken_pori_questionnaires } from '../db/questionnaires_repo';
import { ken_pori_scales } from '../db/scales_repo';

import type {
  ProjectRecord,
  QuestionnaireRecord,
  ResponseScaleRecord
} from '../models/types';
import { normalize_questionnaire } from '../models/factories';
import { new_id } from '../utils/id';

export interface SvelpBundleV2 {
  format: 'svelp.project';
  formatVersion: 2;
  exportedAt: string;
  project: ProjectRecord;
  questionnaire: QuestionnaireRecord;
  scales: ResponseScaleRecord[];
}

export type SvelpBundle = SvelpBundleV2;

export type BiriyaniOutcome =
  | { status: 'imported'; project: ProjectRecord }
  | { status: 'imported-as-copy'; project: ProjectRecord };

export function hati_bundle(
  bal_project: ProjectRecord,
  bal_questionnaire: QuestionnaireRecord,
  bal_scales: ResponseScaleRecord[]
): SvelpBundleV2 {
  return {
    format: 'svelp.project',
    formatVersion: 2,
    exportedAt: new Date().toISOString(),
    project: { ...bal_project },
    questionnaire: structuredClone(bal_questionnaire),
    scales: structuredClone(bal_scales)
  };
}

export function hati_bundle_filename(bal_title: string): string {
  const bal_slug =
    bal_title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'project';
  return `svelp-project-${bal_slug}.json`;
}

function bal_is_plain_object(bal_value: unknown): bal_value is Record<string, unknown> {
  return typeof bal_value === 'object' && bal_value !== null && !Array.isArray(bal_value);
}

export function biriyani_parse(
  bal_text: string
): { ok: true; bundle: SvelpBundle } | { ok: false; reason: string } {
  let bal_parsed: unknown;
  try {
    bal_parsed = JSON.parse(bal_text);
  } catch {
    return { ok: false, reason: 'The file does not contain valid JSON.' };
  }
  if (!bal_is_plain_object(bal_parsed)) {
    return { ok: false, reason: 'The file does not contain a Svelp project bundle.' };
  }
  if (bal_parsed.format !== 'svelp.project') {
    return { ok: false, reason: 'This file is not a Svelp project bundle.' };
  }
  if (bal_parsed.formatVersion !== 1 && bal_parsed.formatVersion !== 2) {
    return {
      ok: false,
      reason: 'This bundle uses a newer format version than this version of Svelp supports.'
    };
  }
  const bal_project = bal_parsed.project;
  const bal_questionnaire = bal_parsed.questionnaire;
  if (
    !bal_is_plain_object(bal_project) ||
    typeof bal_project.id !== 'string' ||
    typeof bal_project.title !== 'string'
  ) {
    return { ok: false, reason: 'The bundle is missing valid project metadata.' };
  }
  if (
    !bal_is_plain_object(bal_questionnaire) ||
    typeof bal_questionnaire.id !== 'string' ||
    !Array.isArray(bal_questionnaire.sections)
  ) {
    return { ok: false, reason: 'The bundle is missing a valid questionnaire.' };
  }
  const bal_scales_raw = Array.isArray(bal_parsed.scales) ? bal_parsed.scales : [];
  for (const bal_scale of bal_scales_raw) {
    if (
      !bal_is_plain_object(bal_scale) ||
      typeof bal_scale.id !== 'string' ||
      typeof bal_scale.name !== 'string' ||
      !Array.isArray(bal_scale.options)
    ) {
      return { ok: false, reason: 'The bundle contains an invalid response scale.' };
    }
  }
  return {
    ok: true,
    bundle: {
      format: 'svelp.project',
      formatVersion: 2,
      exportedAt:
        typeof bal_parsed.exportedAt === 'string' ? bal_parsed.exportedAt : '',
      project: bal_project as unknown as ProjectRecord,
      questionnaire: normalize_questionnaire(bal_questionnaire),
      scales: bal_scales_raw as unknown as ResponseScaleRecord[]
    }
  };
}

export interface BiriyaniPlan {
  collision: boolean;
  project: ProjectRecord;
  questionnaire: QuestionnaireRecord;
  scales: ResponseScaleRecord[];
}

export function biriyani_plan(
  bal_bundle: SvelpBundle,
  bal_existing_project_ids: string[],
  bal_existing_questionnaire_ids: string[],
  bal_existing_scale_ids: string[]
): BiriyaniPlan {
  const bal_collision =
    bal_existing_project_ids.includes(bal_bundle.project.id) ||
    bal_existing_questionnaire_ids.includes(bal_bundle.questionnaire.id);
  const bal_scale_id_map = new Map<string, string>();
  const bal_scales = bal_bundle.scales.map((bal_scale) => {
    if (!bal_existing_scale_ids.includes(bal_scale.id)) {
      return { ...bal_scale, options: bal_scale.options.map((bal_o) => ({ ...bal_o })) };
    }
    const bal_fresh_id = new_id();
    bal_scale_id_map.set(bal_scale.id, bal_fresh_id);
    return {
      ...bal_scale,
      id: bal_fresh_id,
      name: `${bal_scale.name} (imported)`.trim(),
      options: bal_scale.options.map((bal_o) => ({ ...bal_o }))
    };
  });
  let bal_project: ProjectRecord;
  let bal_questionnaire: QuestionnaireRecord;
  if (!bal_collision) {
    bal_project = { ...bal_bundle.project };
    bal_questionnaire = { ...bal_bundle.questionnaire, projectId: bal_project.id };
  } else {
    bal_project = {
      ...bal_bundle.project,
      id: new_id(),
      title: `${bal_bundle.project.title} (imported)`.trim(),
      updatedAt: Date.now()
    };
    bal_questionnaire = {
      ...bal_bundle.questionnaire,
      id: new_id(),
      projectId: bal_project.id
    };
  }
  bal_questionnaire.sections = bal_questionnaire.sections.map((bal_section) => ({
    ...bal_section,
    items: bal_section.items.map((bal_item) => {
      if (!bal_item.scaleId || !bal_scale_id_map.has(bal_item.scaleId)) return bal_item;
      return { ...bal_item, scaleId: bal_scale_id_map.get(bal_item.scaleId) as string };
    })
  }));
  return { collision: bal_collision, project: bal_project, questionnaire: bal_questionnaire, scales: bal_scales };
}

export async function biriyani_project(bal_text: string): Promise<BiriyaniOutcome> {
  const bal_parsed = biriyani_parse(bal_text);
  if (!bal_parsed.ok) throw new Error(bal_parsed.reason);
  const bal_projects = await ken_pori_projects();
  const bal_questionnaires = await ken_pori_questionnaires();
  const bal_scales = await ken_pori_scales();
  const bal_plan = biriyani_plan(
    bal_parsed.bundle,
    bal_projects.map((bal_p) => bal_p.id),
    bal_questionnaires.map((bal_q) => bal_q.id),
    bal_scales.map((bal_s) => bal_s.id)
  );
  await bal_run_tx(['projects', 'questionnaires', 'responseScales'], 'readwrite', (bal_tx) => {
    bal_tx.objectStore('projects').put(bal_plan.project);
    bal_tx.objectStore('questionnaires').put(bal_plan.questionnaire);
    const bal_scale_store = bal_tx.objectStore('responseScales');
    for (const bal_scale of bal_plan.scales) bal_scale_store.put(bal_scale);
  });
  return {
    status: bal_plan.collision ? 'imported-as-copy' : 'imported',
    project: bal_plan.project
  };
}
