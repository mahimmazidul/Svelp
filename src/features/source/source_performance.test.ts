import { describe, expect, it } from 'vitest';
import { bal_slex } from './shobdo_lexer';
import { bal_sparse } from './naksha_parser';
import { bal_svalidate } from './bhul_validate';
import { bal_plan_apply } from './bani_compile';
import { bal_source_serialize } from './lekha_serialize';
import { bal_source_apply_plan } from './bal_source_pipeline';

function bal_large_source(): string {
  const bal_lines: string[] = ['svelp 1', 'title "Large survey"', ''];
  bal_lines.push('scale frequency');
  for (let bal_p = 0; bal_p < 7; bal_p += 1) {
    bal_lines.push(`option point_${bal_p} "Point ${bal_p}" code ${bal_p}`);
  }
  bal_lines.push('');
  for (let bal_s = 0; bal_s < 5; bal_s += 1) {
    bal_lines.push(`section "Section ${bal_s} "`.replace('  ', ' '));
    bal_lines.push('');
    for (let bal_q = 0; bal_q < 24; bal_q += 1) {
      const bal_n = bal_s * 24 + bal_q;
      bal_lines.push(`single q_${bal_n} "Question ${bal_n} label"`);
      bal_lines.push(`  option opt_a "Choice A" code 1`);
      bal_lines.push(`  option opt_b "Choice B" code 2`);
      bal_lines.push('  required');
      bal_lines.push('');
    }
    bal_lines.push(`matrix matrix_${bal_s} "Matrix ${bal_s}"`);
    bal_lines.push('  scale frequency');
    bal_lines.push('  rows {');
    for (let bal_r = 0; bal_r < 60; bal_r += 1) {
      bal_lines.push(`    row_${bal_r} "Row label ${bal_r}"`);
    }
    bal_lines.push('  }');
    bal_lines.push('');
  }
  return bal_lines.join('\n');
}

describe('large questionnaire source performance', () => {
  it('parses validates compiles and serializes 120 questions with 60 row matrices', () => {
    const bal_source = bal_large_source();
    const bal_start = performance.now();
    const bal_lexed = bal_slex(bal_source);
    const bal_parsed = bal_sparse(bal_lexed.tokens, bal_lexed.errors);
    expect(bal_parsed.errors).toEqual([]);
    const bal_issues = bal_svalidate(bal_parsed.doc);
    expect(bal_issues.filter((bal_i) => bal_i.severity === 'error')).toEqual([]);
    const bal_plan = bal_plan_apply(bal_parsed.doc, null, []);
    if (!bal_plan.ok) throw new Error(JSON.stringify(bal_plan.errors));
    const bal_item_count = bal_plan.questionnaire.sections.reduce(
      (bal_sum, bal_section) => bal_sum + bal_section.items.length,
      0
    );
    expect(bal_item_count).toBe(125);
    expect(bal_plan.questionnaire.sections[0].items.find((bal_i) => bal_i.type === 'matrix')?.rows).toHaveLength(60);
    const bal_serialized = bal_source_serialize(bal_plan.questionnaire, bal_plan.scales);
    expect(bal_serialized.skipped).toEqual([]);
    const bal_round = bal_sparse(bal_slex(bal_serialized.text).tokens, []);
    expect(bal_round.errors).toEqual([]);
    const bal_elapsed = performance.now() - bal_start;
    expect(bal_elapsed).toBeLessThan(3000);
  });

  it('applies edited large source against a previous questionnaire within budget', () => {
    const bal_source = bal_large_source();
    const bal_lexed = bal_slex(bal_source);
    const bal_parsed = bal_sparse(bal_lexed.tokens, bal_lexed.errors);
    const bal_first = bal_plan_apply(bal_parsed.doc, null, []);
    if (!bal_first.ok) throw new Error('first apply failed');
    const bal_previous = bal_first.questionnaire;
    const bal_previous_scales = bal_first.scales;
    const bal_edited = bal_source.replace('title "Large survey"', 'title "Large survey revised"');
    const bal_start = performance.now();
    const bal_second = bal_source_apply_plan(bal_edited, bal_previous, bal_previous_scales, new Set());
    const bal_elapsed = performance.now() - bal_start;
    expect(bal_second.ok).toBe(true);
    if (bal_second.ok && bal_second.applyPlan && bal_second.applyPlan.ok) {
      expect(bal_second.applyPlan.changes.itemsRemoved).toBe(0);
      expect(bal_second.applyPlan.changes.itemsAdded).toBe(0);
    } else {
      throw new Error('second apply produced no plan');
    }
    expect(bal_elapsed).toBeLessThan(3000);
  });
});
