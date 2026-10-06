import type { bal_AstDocument, bal_AstItem, bal_AstScale } from './naksha_parser';
import { bal_slug_variable } from './bani_compile';

export type bal_Severity = 'error' | 'warning' | 'info';

export interface bal_SemanticIssue {
  line: number;
  column: number;
  severity: bal_Severity;
  message: string;
}

function bal_unique_with_suffix(bal_base: string, bal_taken: Set<string>): string {
  if (!bal_taken.has(bal_base)) return bal_base;
  let bal_n = 2;
  while (bal_taken.has(`${bal_base}_${bal_n}`)) bal_n += 1;
  return `${bal_base}_${bal_n}`;
}

export function bal_suggested_variable(bal_label: string, bal_taken: Set<string>): string {
  return bal_unique_with_suffix(bal_slug_variable(bal_label), bal_taken);
}

interface bal_OptionsHost {
  options: { key: string; label: string; code: string | null; line: number }[];
}

function bal_check_scale_options(
  bal_scale: bal_OptionsHost,
  bal_what: string,
  bal_issues: bal_SemanticIssue[]
): void {
  const bal_keys = new Set<string>();
  const bal_codes = new Map<string, string>();
  for (const bal_option of bal_scale.options) {
    if (bal_keys.has(bal_option.key)) {
      bal_issues.push({
        line: bal_option.line,
        column: 1,
        severity: 'error',
        message: `Duplicate option key "${bal_option.key}" in ${bal_what}.`
      });
    }
    bal_keys.add(bal_option.key);
    if (bal_option.code !== null) {
      const bal_existing = bal_codes.get(bal_option.code);
      if (bal_existing !== undefined) {
        bal_issues.push({
          line: bal_option.line,
          column: 1,
          severity: 'error',
          message: `Duplicate code "${bal_option.code}" in ${bal_what}: "${bal_existing}" and "${bal_option.key}".`
        });
      } else {
        bal_codes.set(bal_option.code, bal_option.key);
      }
    }
  }
}

export function bal_svalidate(bal_doc: bal_AstDocument): bal_SemanticIssue[] {
  const bal_issues: bal_SemanticIssue[] = [];

  if (bal_doc.meta.title === null || bal_doc.meta.title.trim().length === 0) {
    bal_issues.push({ line: 1, column: 1, severity: 'error', message: 'The questionnaire needs a title: title "…".' });
  }

  const bal_scale_names = new Set<string>();
  const bal_scales_by_name = new Map<string, bal_AstScale>();
  for (const bal_scale of bal_doc.scales) {
    if (bal_scale_names.has(bal_scale.name)) {
      bal_issues.push({
        line: bal_scale.line,
        column: 1,
        severity: 'error',
        message: `Duplicate scale "${bal_scale.name}". Scales are defined once and reused.`
      });
      continue;
    }
    bal_scale_names.add(bal_scale.name);
    bal_scales_by_name.set(bal_scale.name, bal_scale);
    if (bal_scale.options.length === 0) {
      bal_issues.push({
        line: bal_scale.line,
        column: 1,
        severity: 'error',
        message: `Scale "${bal_scale.name}" has no options.`
      });
    }
    bal_check_scale_options(bal_scale, `scale "${bal_scale.name}"`, bal_issues);
  }

  const bal_taken_names = new Set<string>();
  const bal_check_item = (bal_item: bal_AstItem): void => {
    if (bal_item.label.trim().length === 0) {
      bal_issues.push({
        line: bal_item.line,
        column: 1,
        severity: 'error',
        message: `"${bal_item.head}" is missing its label text.`
      });
    }
    const bal_is_data = !['instruction', 'consent', 'participant_signature', 'researcher_signature'].includes(bal_item.head);
    if (bal_is_data && bal_item.key === null) {
      bal_issues.push({
        line: bal_item.line,
        column: 1,
        severity: 'info',
        message: `No variable name given. Apply will suggest "${bal_suggested_variable(bal_item.label, bal_taken_names)}".`
      });
    }
    if (bal_item.key !== null) {
      if (bal_taken_names.has(bal_item.key)) {
        bal_issues.push({
          line: bal_item.line,
          column: 1,
          severity: 'error',
          message: `Duplicate variable "${bal_item.key}". Variable names must be unique.`
        });
      }
      bal_taken_names.add(bal_item.key);
    }
    for (const bal_bulk of bal_item.bulkItems) {
      if (bal_taken_names.has(bal_bulk.variableName)) {
        bal_issues.push({
          line: bal_bulk.line,
          column: 1,
          severity: 'error',
          message: `Duplicate variable "${bal_bulk.variableName}". Variable names must be unique.`
        });
      }
      bal_taken_names.add(bal_bulk.variableName);
    }
    if (bal_item.head === 'likert' && bal_item.useScale && bal_item.likertPoints.length > 0) {
      bal_issues.push({
        line: bal_item.line,
        column: 1,
        severity: 'error',
        message: 'This likert question has both "use" and inline points. Keep one.'
      });
    }
    if (bal_item.head === 'likert' && !bal_item.useScale && bal_item.likertPoints.length === 0) {
      bal_issues.push({
        line: bal_item.line,
        column: 1,
        severity: 'error',
        message: 'This likert question needs inline points or "use <scale>".'
      });
    }
    if (bal_item.useScale && !bal_scale_names.has(bal_item.useScale)) {
      bal_issues.push({
        line: bal_item.line,
        column: 1,
        severity: 'error',
        message: `Unknown scale "${bal_item.useScale}".`
      });
    }
    if (bal_item.matrixScale && !bal_scale_names.has(bal_item.matrixScale)) {
      bal_issues.push({
        line: bal_item.line,
        column: 1,
        severity: 'error',
        message: `Unknown scale "${bal_item.matrixScale}".`
      });
    }
    if (bal_item.bulkItems.length > 0) {
      if (!bal_item.useScale || !bal_scale_names.has(bal_item.useScale)) {
        bal_issues.push({
          line: bal_item.line,
          column: 1,
          severity: 'error',
          message: 'The questions block needs a known scale: questions using <scale> { … }.'
        });
      }
      if (bal_item.bulkItems.length === 0) {
        bal_issues.push({ line: bal_item.line, column: 1, severity: 'error', message: 'The questions block is empty.' });
      }
    }
    bal_check_scale_options(bal_item, `"${bal_item.key ?? bal_item.label}"`, bal_issues);
    if (bal_item.min !== null && bal_item.max !== null && bal_item.min > bal_item.max) {
      bal_issues.push({
        line: bal_item.line,
        column: 1,
        severity: 'error',
        message: `Minimum ${bal_item.min} is greater than maximum ${bal_item.max}.`
      });
    }
    if (bal_item.step !== null && bal_item.step <= 0) {
      bal_issues.push({ line: bal_item.line, column: 1, severity: 'error', message: 'Step must be a positive integer.' });
    }
    if (bal_item.maxlen !== null && bal_item.maxlen <= 0) {
      bal_issues.push({ line: bal_item.line, column: 1, severity: 'error', message: 'maxlen must be a positive integer.' });
    }
    if (bal_item.head === 'matrix') {
      if (bal_item.rows.length === 0) {
        bal_issues.push({ line: bal_item.line, column: 1, severity: 'error', message: 'This matrix has no rows.' });
      }
      if (!bal_item.matrixScale && bal_item.matrixColumns.length === 0) {
        bal_issues.push({
          line: bal_item.line,
          column: 1,
          severity: 'error',
          message: 'This matrix needs columns: add "scale <name>" or "column" lines.'
        });
      }
      const bal_row_keys = new Set<string>();
      const bal_row_labels = new Set<string>();
      const bal_generated = new Set<string>();
      for (const bal_row of bal_item.rows) {
        if (bal_row.key) {
          if (bal_row_keys.has(bal_row.key)) {
            bal_issues.push({
              line: bal_row.line,
              column: 1,
              severity: 'error',
              message: `Duplicate row key "${bal_row.key}".`
            });
          }
          bal_row_keys.add(bal_row.key);
        } else {
          const bal_suggested = bal_suggested_variable(bal_row.label, bal_generated);
          bal_generated.add(bal_suggested);
          if (bal_suggested !== bal_slug_variable(bal_row.label)) {
            bal_issues.push({
              line: bal_row.line,
              column: 1,
              severity: 'info',
              message: `Row "${bal_row.label}" gets the generated key "${bal_suggested}".`
            });
          }
        }
        if (bal_row_labels.has(bal_row.label)) {
          bal_issues.push({
            line: bal_row.line,
            column: 1,
            severity: 'error',
            message: `Duplicate row label "${bal_row.label}".`
          });
        }
        bal_row_labels.add(bal_row.label);
      }
    }
    if (bal_item.head === 'consent') {
      if (bal_item.consentSections.length === 0) {
        bal_issues.push({
          line: bal_item.line,
          column: 1,
          severity: 'warning',
          message: 'This consent block has no sections (purpose, procedures, …).'
        });
      }
      if (bal_item.acknowledgement === null) {
        bal_issues.push({
          line: bal_item.line,
          column: 1,
          severity: 'warning',
          message: 'This consent block has no acknowledgement label.'
        });
      }
    }
  };

  for (const bal_item of bal_doc.looseItems) bal_check_item(bal_item);
  for (const bal_section of bal_doc.sections) {
    for (const bal_item of bal_section.items) bal_check_item(bal_item);
  }

  return bal_issues;
}
