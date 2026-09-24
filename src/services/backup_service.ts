import { bal_run_tx } from '../db/client';
import { ken_pori_projects } from '../db/projects_repo';
import { ken_pori_questionnaires } from '../db/questionnaires_repo';
import type { QuestionnaireRecord, ProjectRecord } from '../models/types';
import { new_id } from '../utils/id';

export interface SvelpBundleV1 {
  format: 'svelp.project';
  formatVersion: 1;
  exportedAt: string;
  project: ProjectRecord;
  questionnaire: QuestionnaireRecord;
}

export type BiriyaniOutcome =
  | { status: 'imported'; project: ProjectRecord }
  | { status: 'imported-as-copy'; project: ProjectRecord };

export function hati_bundle(
  bal_project: ProjectRecord,
  bal_questionnaire: QuestionnaireRecord
): SvelpBundleV1 {
  return {
    format: 'svelp.project',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    project: { ...bal_project },
    questionnaire: structuredClone(bal_questionnaire)
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
): { ok: true; bundle: SvelpBundleV1 } | { ok: false; reason: string } {
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
  if (bal_parsed.formatVersion !== 1) {
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
  return { ok: true, bundle: bal_parsed as unknown as SvelpBundleV1 };
}

export function biriyani_plan(
  bal_bundle: SvelpBundleV1,
  bal_existing_project_ids: string[],
  bal_existing_questionnaire_ids: string[]
): { collision: boolean; project: ProjectRecord; questionnaire: QuestionnaireRecord } {
  const bal_collision =
    bal_existing_project_ids.includes(bal_bundle.project.id) ||
    bal_existing_questionnaire_ids.includes(bal_bundle.questionnaire.id);
  if (!bal_collision) {
    const bal_project: ProjectRecord = { ...bal_bundle.project };
    const bal_questionnaire: QuestionnaireRecord = {
      ...bal_bundle.questionnaire,
      projectId: bal_project.id
    };
    return { collision: false, project: bal_project, questionnaire: bal_questionnaire };
  }
  const bal_project: ProjectRecord = {
    ...bal_bundle.project,
    id: new_id(),
    title: `${bal_bundle.project.title} (imported)`.trim(),
    updatedAt: Date.now()
  };
  const bal_questionnaire: QuestionnaireRecord = {
    ...bal_bundle.questionnaire,
    id: new_id(),
    projectId: bal_project.id
  };
  return { collision: true, project: bal_project, questionnaire: bal_questionnaire };
}

export async function biriyani_project(bal_text: string): Promise<BiriyaniOutcome> {
  const bal_parsed = biriyani_parse(bal_text);
  if (!bal_parsed.ok) throw new Error(bal_parsed.reason);
  const bal_projects = await ken_pori_projects();
  const bal_questionnaires = await ken_pori_questionnaires();
  const bal_plan = biriyani_plan(
    bal_parsed.bundle,
    bal_projects.map((bal_p) => bal_p.id),
    bal_questionnaires.map((bal_q) => bal_q.id)
  );
  await bal_run_tx(['projects', 'questionnaires'], 'readwrite', (bal_tx) => {
    bal_tx.objectStore('projects').put(bal_plan.project);
    bal_tx.objectStore('questionnaires').put(bal_plan.questionnaire);
  });
  return {
    status: bal_plan.collision ? 'imported-as-copy' : 'imported',
    project: bal_plan.project
  };
}
