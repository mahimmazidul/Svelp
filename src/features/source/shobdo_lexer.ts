export const BAL_SOURCE_LANGUAGE_VERSION = 1;

export type bal_STokenKind =
  | 'keyword'
  | 'identifier'
  | 'integer'
  | 'string'
  | 'textblock'
  | 'lbrace'
  | 'rbrace'
  | 'eof';

export interface bal_SToken {
  kind: bal_STokenKind;
  value: string;
  line: number;
  column: number;
}

export interface bal_SLexError {
  line: number;
  column: number;
  message: string;
}

const BAL_KEYWORDS = new Set([
  'svelp',
  'title',
  'description',
  'language',
  'paper',
  'orientation',
  'section',
  'new_page',
  'instruction',
  'callout',
  'single',
  'multiple',
  'yesno',
  'shorttext',
  'longtext',
  'number',
  'date',
  'time',
  'likert',
  'matrix',
  'consent',
  'participant_signature',
  'researcher_signature',
  'required',
  'min',
  'max',
  'step',
  'unit',
  'maxlen',
  'option',
  'code',
  'use',
  'scale',
  'columns',
  'column',
  'rows',
  'single_per_row',
  'multiple_per_row',
  'keep_together',
  'yes',
  'no',
  'questions',
  'using',
  'introduction',
  'purpose',
  'procedures',
  'risks',
  'benefits',
  'confidentiality',
  'voluntary',
  'withdrawal',
  'contacts',
  'acknowledgement',
  'printed_name',
  'no_printed_name',
  'no_date',
  'role',
  'true',
  'false'
]);

const BAL_IDENTIFIER_START = /^[a-z_]$/;

function bal_is_identifier_word(bal_word: string): boolean {
  if (bal_word.length === 0) return false;
  if (!BAL_IDENTIFIER_START.test(bal_word[0])) return false;
  return /^[a-z0-9_]*$/.test(bal_word.slice(1));
}

function bal_scan_text_block(
  bal_lines: string[],
  bal_start: number
): { body: string; next_index: number; closed: boolean } {
  const bal_body: string[] = [];
  let bal_index = bal_start;
  while (bal_index < bal_lines.length) {
    if (bal_lines[bal_index].trim() === '"""') {
      return { body: bal_body.join('\n'), next_index: bal_index + 1, closed: true };
    }
    bal_body.push(bal_lines[bal_index]);
    bal_index += 1;
  }
  return { body: bal_body.join('\n'), next_index: bal_index, closed: false };
}

export function bal_slex(bal_source: string): { tokens: bal_SToken[]; errors: bal_SLexError[] } {
  const bal_tokens: bal_SToken[] = [];
  const bal_errors: bal_SLexError[] = [];
  const bal_lines = bal_source.split(/\r\n|\r|\n/);
  let bal_line_index = 0;
  while (bal_line_index < bal_lines.length) {
    const bal_line = bal_lines[bal_line_index];
    const bal_line_no = bal_line_index + 1;
    if (bal_line.trim() === '"""') {
      const bal_block = bal_scan_text_block(bal_lines, bal_line_index + 1);
      bal_line_index = bal_block.next_index;
      if (!bal_block.closed) {
        bal_errors.push({
          line: bal_line_no,
          column: 1,
          message: 'This text block is never closed. End it with a line containing only """.'
        });
      }
      bal_tokens.push({ kind: 'textblock', value: bal_block.body, line: bal_line_no, column: 1 });
      continue;
    }
    let bal_pos = 0;
    let bal_block_done = false;
    while (bal_pos < bal_line.length && !bal_block_done) {
      const bal_ch = bal_line[bal_pos];
      if (bal_ch === ' ' || bal_ch === '\t') {
        bal_pos += 1;
        continue;
      }
      if (bal_line.startsWith('"""', bal_pos)) {
        const bal_rest = bal_line.slice(bal_pos + 3);
        if (bal_rest.trim().length === 0) {
          const bal_block = bal_scan_text_block(bal_lines, bal_line_index + 1);
          bal_line_index = bal_block.next_index;
          if (!bal_block.closed) {
            bal_errors.push({
              line: bal_line_no,
              column: bal_pos + 1,
              message: 'This text block is never closed. End it with a line containing only """.'
            });
          }
          bal_tokens.push({
            kind: 'textblock',
            value: bal_block.body,
            line: bal_line_no,
            column: bal_pos + 1
          });
          bal_block_done = true;
          break;
        }
        bal_errors.push({
          line: bal_line_no,
          column: bal_pos + 1,
          message: 'A multiline text block must end its opening line right after """.'
        });
        bal_pos = bal_line.length;
        continue;
      }
      if (bal_ch === '"') {
        bal_pos += 1;
        let bal_value = '';
        let bal_closed = false;
        while (bal_pos < bal_line.length) {
          const bal_c = bal_line[bal_pos];
          if (bal_c === '\\') {
            if (bal_pos + 1 >= bal_line.length) {
              bal_errors.push({
                line: bal_line_no,
                column: bal_pos + 1,
                message: 'Dangling escape at end of line.'
              });
              bal_pos += 1;
              continue;
            }
            const bal_next = bal_line[bal_pos + 1];
            if (bal_next === '"') bal_value += '"';
            else if (bal_next === '\\') bal_value += '\\';
            else if (bal_next === 'n') bal_value += '\n';
            else if (bal_next === 't') bal_value += '\t';
            else bal_value += bal_next;
            bal_pos += 2;
            continue;
          }
          if (bal_c === '"') {
            bal_closed = true;
            bal_pos += 1;
            break;
          }
          bal_value += bal_c;
          bal_pos += 1;
        }
        if (!bal_closed) {
          bal_errors.push({
            line: bal_line_no,
            column: bal_pos + 1,
            message: 'Missing closing quote. Use """ on its own lines for multiline text.'
          });
        }
        bal_tokens.push({ kind: 'string', value: bal_value, line: bal_line_no, column: 1 });
        continue;
      }
      if (bal_ch === '{') {
        bal_tokens.push({ kind: 'lbrace', value: '{', line: bal_line_no, column: bal_pos + 1 });
        bal_pos += 1;
        continue;
      }
      if (bal_ch === '}') {
        bal_tokens.push({ kind: 'rbrace', value: '}', line: bal_line_no, column: bal_pos + 1 });
        bal_pos += 1;
        continue;
      }
      if (/[0-9]/.test(bal_ch) || (bal_ch === '-' && /[0-9]/.test(bal_line[bal_pos + 1] ?? ''))) {
        let bal_end = bal_pos + 1;
        while (bal_end < bal_line.length && /[0-9]/.test(bal_line[bal_end])) bal_end += 1;
        if (/[a-zA-Z_]/.test(bal_line[bal_end] ?? '')) {
          bal_errors.push({
            line: bal_line_no,
            column: bal_pos + 1,
            message: `Numbers cannot contain letters. Check "${bal_line.slice(bal_pos, bal_end + 1)}".`
          });
        }
        bal_tokens.push({
          kind: 'integer',
          value: bal_line.slice(bal_pos, bal_end),
          line: bal_line_no,
          column: bal_pos + 1
        });
        bal_pos = bal_end;
        continue;
      }
      if (BAL_IDENTIFIER_START.test(bal_ch)) {
        let bal_end = bal_pos + 1;
        while (bal_end < bal_line.length && /[a-zA-Z0-9_]/.test(bal_line[bal_end])) bal_end += 1;
        const bal_word = bal_line.slice(bal_pos, bal_end);
        if (!bal_is_identifier_word(bal_word)) {
          bal_errors.push({
            line: bal_line_no,
            column: bal_pos + 1,
            message: `Identifiers use lowercase letters, digits, and underscores: "${bal_word}".`
          });
          bal_pos = bal_end;
          continue;
        }
        bal_tokens.push({
          kind: BAL_KEYWORDS.has(bal_word) ? 'keyword' : 'identifier',
          value: bal_word,
          line: bal_line_no,
          column: bal_pos + 1
        });
        bal_pos = bal_end;
        continue;
      }
      if (bal_ch === '#') {
        bal_errors.push({
          line: bal_line_no,
          column: bal_pos + 1,
          message: 'Comments do not exist in Svelp source v1. Remove the "#" text.'
        });
        bal_pos = bal_line.length;
        continue;
      }
      bal_errors.push({
        line: bal_line_no,
        column: bal_pos + 1,
        message: `Unexpected character "${bal_ch}".`
      });
      bal_pos += 1;
    }
    if (!bal_block_done) bal_line_index += 1;
  }
  bal_tokens.push({
    kind: 'eof',
    value: '',
    line: bal_lines.length,
    column: (bal_lines[bal_lines.length - 1]?.length ?? 0) + 1
  });
  return { tokens: bal_tokens, errors: bal_errors };
}
