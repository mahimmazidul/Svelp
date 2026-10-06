import { dhon_questionnaire_for_responses } from '../../db/questionnaires_repo';
import { ken_pori_scan_batches, ken_pori_scan_pages } from '../../db/scan_repo';
import { ken_pori_scales } from '../../db/scales_repo';
import { ken_pori_responses_by_project } from '../../db/response_repo';
import type { QuestionnaireRecord, ResponseScaleRecord } from '../../models/types';
import type { ResponseRecord } from '../../models/response_models';
import { bal_build_print_document } from '../print/print_layout';
import { bal_validate_dataset, type DatasetIssue } from '../export/dataset_validation';
import { bal_completeness_for_respondents, bal_questionnaire_summary, type bal_RespondentStatus, type bal_QuestionnaireSummary } from './reading_completeness';

export interface bal_DatasetContext {
  questionnaire: QuestionnaireRecord;
  scales: ResponseScaleRecord[];
  responses: ResponseRecord[];
  respondents: string[];
  statuses: Map<string, bal_RespondentStatus>;
  summary: bal_QuestionnaireSummary;
  issues: DatasetIssue[];
  expectedPages: number;
}

export async function bal_load_dataset_context(bal_project_id: string): Promise<bal_DatasetContext | null> {
  const bal_responses = await ken_pori_responses_by_project(bal_project_id);
  const bal_questionnaire = await dhon_questionnaire_for_responses(bal_project_id, bal_responses);
  if (!bal_questionnaire) return null;
  const bal_scales = await ken_pori_scales();
  const bal_doc = bal_build_print_document({ questionnaire: bal_questionnaire, scales: bal_scales, respondentId: '' });
  const bal_found: Record<string, number[]> = {};
  const bal_ready_pages: {
    id: string;
    respondentId: string;
    pageNumber: number;
    questionnaireVersion: number | null;
  }[] = [];
  for (const bal_batch of await ken_pori_scan_batches(bal_project_id)) {
    for (const bal_page of await ken_pori_scan_pages(bal_batch.id)) {
      if (bal_page.status !== 'ready' || !bal_page.respondentId || bal_page.pageNumber === null) continue;
      bal_found[bal_page.respondentId] = [...(bal_found[bal_page.respondentId] ?? []), bal_page.pageNumber];
      bal_ready_pages.push({
        id: bal_page.id,
        respondentId: bal_page.respondentId,
        pageNumber: bal_page.pageNumber,
        questionnaireVersion: bal_page.questionnaireVersion
      });
    }
  }
  const bal_respondents = [...new Set(bal_responses.map((bal_response) => bal_response.respondentId))].sort();
  const bal_statuses = bal_completeness_for_respondents(
    bal_respondents,
    bal_questionnaire,
    bal_doc.pages.length,
    bal_responses,
    bal_found
  );
  return {
    questionnaire: bal_questionnaire,
    scales: bal_scales,
    responses: bal_responses,
    respondents: bal_respondents,
    statuses: bal_statuses,
    summary: bal_questionnaire_summary([...bal_statuses.values()]),
    issues: bal_validate_dataset({
      questionnaire: bal_questionnaire,
      scales: bal_scales,
      responses: bal_responses,
      readyPages: bal_ready_pages,
      expectedPages: bal_doc.pages.length
    }),
    expectedPages: bal_doc.pages.length
  };
}
