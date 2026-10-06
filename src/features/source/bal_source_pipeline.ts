import { bal_slex, bal_is_reserved_word } from './shobdo_lexer';
import { bal_sparse } from './naksha_parser';
import { bal_svalidate, type bal_SemanticIssue } from './bhul_validate';
import { bal_plan_apply, type bal_ApplyPlan } from './bani_compile';
import { bal_source_serialize } from './lekha_serialize';
import type { QuestionnaireRecord, ResponseScaleRecord } from '../../models/types';

export interface bal_SourceProblems {
  errors: bal_SemanticIssue[];
  warnings: bal_SemanticIssue[];
  infos: bal_SemanticIssue[];
}

export interface bal_ParseOutcome {
  ok: boolean;
  problems: bal_SourceProblems;
  applyPlan: bal_ApplyPlan | null;
}

export function bal_source_problems(bal_source: string): bal_ParseOutcome {
  const bal_lexed = bal_slex(bal_source);
  const bal_parsed = bal_sparse(bal_lexed.tokens, bal_lexed.errors);
  const bal_issues = bal_svalidate(bal_parsed.doc);
  const bal_all: bal_SemanticIssue[] = [
    ...bal_parsed.errors.map((bal_e) => ({ ...bal_e, severity: 'error' as const })),
    ...bal_issues
  ];
  const bal_has_lex_or_parse_errors = bal_parsed.errors.length > 0;
  const bal_blocking = bal_all.filter((bal_i) => bal_i.severity === 'error').length > 0;
  if (bal_has_lex_or_parse_errors || bal_blocking) {
    return {
      ok: false,
      applyPlan: null,
      problems: {
        errors: bal_all.filter((bal_i) => bal_i.severity === 'error'),
        warnings: bal_all.filter((bal_i) => bal_i.severity === 'warning'),
        infos: bal_all.filter((bal_i) => bal_i.severity === 'info')
      }
    };
  }
  return {
    ok: true,
    applyPlan: null,
    problems: {
      errors: [],
      warnings: bal_all.filter((bal_i) => bal_i.severity === 'warning'),
      infos: bal_all.filter((bal_i) => bal_i.severity === 'info')
    }
  };
}

export function bal_source_apply_plan(
  bal_source: string,
  bal_previous: QuestionnaireRecord | null,
  bal_scales: ResponseScaleRecord[],
  bal_variables_with_data: Set<string>
): bal_ParseOutcome {
  const bal_outcome = bal_source_problems(bal_source);
  if (!bal_outcome.ok || !bal_previous) return bal_outcome;
  const bal_lexed = bal_slex(bal_source);
  const bal_parsed = bal_sparse(bal_lexed.tokens, bal_lexed.errors);
  const bal_plan = bal_plan_apply(bal_parsed.doc, bal_previous, bal_scales, bal_variables_with_data);
  if (!bal_plan.ok) {
    return {
      ok: false,
      applyPlan: null,
      problems: {
        errors: bal_plan.errors.map((bal_message) => ({
          line: 1,
          column: 1,
          severity: 'error' as const,
          message: bal_message
        })),
        warnings: bal_outcome.problems.warnings,
        infos: bal_outcome.problems.infos
      }
    };
  }
  return { ok: true, applyPlan: bal_plan, problems: bal_outcome.problems };
}

export function bal_source_format(bal_source: string): string | null {
  const bal_lexed = bal_slex(bal_source);
  const bal_parsed = bal_sparse(bal_lexed.tokens, bal_lexed.errors);
  if (bal_parsed.errors.length > 0) return null;
  const bal_plan = bal_plan_apply(bal_parsed.doc, null, []);
  if (!bal_plan.ok) return null;
  return bal_source_serialize(bal_plan.questionnaire, bal_plan.scales).text;
}

export function bal_source_from_questionnaire(
  bal_questionnaire: QuestionnaireRecord,
  bal_scales: ResponseScaleRecord[]
): { text: string; skipped: { label: string; type: string }[] } {
  return bal_source_serialize(bal_questionnaire, bal_scales);
}

export { bal_is_reserved_word };
