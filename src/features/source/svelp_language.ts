import { StreamLanguage, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const BAL_KEYWORD_WORDS = new Set([
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

interface bal_Stream {
  peek(): string | undefined;
  eatWhile(bal_match: string): boolean;
  next(): string | undefined;
  skipToEnd(): void;
  match(bal_value: string): boolean;
  string: string;
  start: number;
  pos: number;
}

function bal_token(stream: bal_Stream): string | null {
  if (stream.eatWhile(' \t')) return null;
  if (stream.match('"""')) {
    stream.skipToEnd();
    return 'string';
  }
  if (stream.peek() === '"') {
    stream.next();
    while (true) {
      const bal_ch = stream.peek();
      if (bal_ch === undefined) {
        stream.skipToEnd();
        break;
      }
      if (bal_ch === '\\') {
        stream.next();
        stream.next();
        continue;
      }
      stream.next();
      if (bal_ch === '"') break;
    }
    return 'string';
  }
  if (/[0-9-]/.test(stream.peek() ?? '')) {
    let bal_digits = '';
    while (/[0-9]/.test(stream.peek() ?? '')) {
      bal_digits += stream.next();
    }
    if (bal_digits.length > 0) return 'number';
  }
  if (/[a-z_]/.test(stream.peek() ?? '')) {
    let bal_word = '';
    while (/[a-zA-Z0-9_]/.test(stream.peek() ?? '')) {
      bal_word += stream.next();
    }
    return BAL_KEYWORD_WORDS.has(bal_word) ? 'keyword' : 'variableName';
  }
  stream.next();
  return null;
}

export const bal_svelp_language = StreamLanguage.define({ token: bal_token as never });

export const bal_svelp_highlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.keyword, color: '#7c4dff' },
    { tag: tags.string, color: '#0a7d33' },
    { tag: tags.number, color: '#b25000' },
    { tag: tags.variableName, color: '#334e68' }
  ])
);
