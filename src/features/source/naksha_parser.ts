export type bal_ItemHead =
  | 'instruction'
  | 'single'
  | 'multiple'
  | 'yesno'
  | 'shorttext'
  | 'longtext'
  | 'number'
  | 'date'
  | 'time'
  | 'likert'
  | 'matrix'
  | 'consent'
  | 'participant_signature'
  | 'researcher_signature';

export interface bal_AstOption {
  key: string;
  label: string;
  code: string | null;
  line: number;
}

export interface bal_AstLikertPoint {
  code: string;
  label: string;
  line: number;
}

export interface bal_AstRow {
  key: string | null;
  label: string;
  line: number;
}

export interface bal_AstConsentSection {
  kind: string;
  title: string | null;
  body: string;
  line: number;
}

export interface bal_AstBulkItem {
  variableName: string;
  label: string;
  line: number;
}

export interface bal_AstItem {
  head: bal_ItemHead;
  key: string | null;
  label: string;
  line: number;
  required: boolean;
  callout: boolean;
  min: number | null;
  max: number | null;
  step: number | null;
  unit: string | null;
  maxlen: number | null;
  yesCode: string | null;
  noCode: string | null;
  options: bal_AstOption[];
  likertPoints: bal_AstLikertPoint[];
  useScale: string | null;
  matrixScale: string | null;
  matrixColumns: bal_AstOption[];
  singlePerRow: boolean;
  multiplePerRow: boolean;
  rows: bal_AstRow[];
  consentIntroduction: string | null;
  consentSections: bal_AstConsentSection[];
  acknowledgement: string | null;
  printedName: boolean | null;
  date: boolean | null;
  role: string | null;
  bulkItems: bal_AstBulkItem[];
}

export interface bal_AstSection {
  key: string | null;
  title: string;
  line: number;
  newPage: boolean;
  description: string | null;
  items: bal_AstItem[];
}

export interface bal_AstScale {
  name: string;
  line: number;
  options: bal_AstOption[];
}

export interface bal_AstMeta {
  title: string | null;
  description: string | null;
  language: string | null;
  paper: 'a4' | 'letter' | null;
  orientation: 'portrait' | 'landscape' | null;
  line: number;
}

export interface bal_AstDocument {
  version: number | null;
  meta: bal_AstMeta;
  sections: bal_AstSection[];
  scales: bal_AstScale[];
  looseItems: bal_AstItem[];
}

export interface bal_SourcesError {
  line: number;
  column: number;
  message: string;
}

const BAL_ITEM_HEADS: bal_ItemHead[] = [
  'instruction',
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
  'researcher_signature'
];

const BAL_CONSENT_KINDS = new Set([
  'purpose',
  'procedures',
  'risks',
  'benefits',
  'confidentiality',
  'voluntary',
  'withdrawal',
  'contacts'
]);

const BAL_CONSENT_TITLES: Record<string, string> = {
  purpose: 'Purpose',
  procedures: 'Procedures',
  risks: 'Risks',
  benefits: 'Benefits',
  confidentiality: 'Confidentiality',
  voluntary: 'Voluntary participation',
  withdrawal: 'Withdrawal',
  contacts: 'Contacts'
};

export function bal_consent_default_title(bal_kind: string): string {
  return BAL_CONSENT_TITLES[bal_kind] ?? bal_kind;
}

function bal_new_item(bal_head: bal_ItemHead, bal_line: number): bal_AstItem {
  return {
    head: bal_head,
    key: null,
    label: '',
    line: bal_line,
    required: false,
    callout: false,
    min: null,
    max: null,
    step: null,
    unit: null,
    maxlen: null,
    yesCode: null,
    noCode: null,
    options: [],
    likertPoints: [],
    useScale: null,
    matrixScale: null,
    matrixColumns: [],
    singlePerRow: true,
    multiplePerRow: false,
    rows: [],
    consentIntroduction: null,
    consentSections: [],
    acknowledgement: null,
    printedName: null,
    date: null,
    role: null,
    bulkItems: []
  };
}

interface bal_ParseState {
  tokens: bal_Token[];
  pos: number;
  errors: bal_SourcesError[];
  doc: bal_AstDocument;
  section: bal_AstSection | null;
  scale: bal_AstScale | null;
  item: bal_AstItem | null;
  finished: boolean;
}

type bal_Token = import('./shobdo_lexer').bal_SToken;
type bal_SLexError = import('./shobdo_lexer').bal_SLexError;

function bal_error(bal_state: bal_ParseState, bal_token: bal_Token, bal_message: string): void {
  bal_state.errors.push({ line: bal_token.line, column: bal_token.column, message: bal_message });
}

function bal_peek(bal_state: bal_ParseState): bal_Token {
  return bal_state.tokens[bal_state.pos];
}

function bal_next(bal_state: bal_ParseState): bal_Token {
  return bal_state.tokens[bal_state.pos++];
}

function bal_is_keyword(bal_state: bal_ParseState, bal_word: string): boolean {
  const bal_token = bal_peek(bal_state);
  return bal_token.kind === 'keyword' && bal_token.value === bal_word;
}

function bal_accept_keyword(bal_state: bal_ParseState, bal_word: string): bal_Token | null {
  return bal_is_keyword(bal_state, bal_word) ? bal_next(bal_state) : null;
}

function bal_head_of(bal_token: bal_Token): bal_ItemHead | null {
  if (bal_token.kind !== 'keyword') return null;
  return (BAL_ITEM_HEADS as string[]).includes(bal_token.value) ? (bal_token.value as bal_ItemHead) : null;
}

const BAL_HEAD_SET = new Set(BAL_ITEM_HEADS);

function bal_starts_block(bal_state: bal_ParseState, bal_token: bal_Token): boolean {
  if (bal_token.kind !== 'keyword') return false;
  if (bal_state.item !== null && bal_state.item.head === 'participant_signature' && bal_token.value === 'date') {
    return false;
  }
  if (bal_state.item !== null && bal_state.item.head === 'researcher_signature' && bal_token.value === 'date') {
    return false;
  }
  if (BAL_HEAD_SET.has(bal_token.value as bal_ItemHead)) return true;
  if (bal_token.value === 'section') return true;
  if (bal_token.value === 'scale' || bal_token.value === 'questions') return bal_state.item === null;
  return false;
}

function bal_expect_string(bal_state: bal_ParseState, bal_what: string): string | null {
  const bal_token = bal_peek(bal_state);
  if (bal_token.kind === 'string' || bal_token.kind === 'textblock') {
    bal_next(bal_state);
    return bal_token.value;
  }
  bal_error(bal_state, bal_token, `Expected ${bal_what} in double quotes.`);
  return null;
}

function bal_expect_integer(bal_state: bal_ParseState, bal_what: string): number | null {
  const bal_token = bal_peek(bal_state);
  if (bal_token.kind === 'integer') {
    bal_next(bal_state);
    return Number(bal_token.value);
  }
  bal_error(bal_state, bal_token, `Expected ${bal_what} as an integer.`);
  return null;
}

function bal_expect_code(bal_state: bal_ParseState): string | null {
  const bal_token = bal_peek(bal_state);
  if (bal_token.kind === 'integer' || bal_token.kind === 'string') {
    bal_next(bal_state);
    return bal_token.value;
  }
  bal_error(bal_state, bal_token, 'Expected a code as an integer or a quoted string.');
  return null;
}

function bal_expect_identifier(bal_state: bal_ParseState, bal_what: string): string | null {
  const bal_token = bal_peek(bal_state);
  if (bal_token.kind === 'identifier') {
    bal_next(bal_state);
    return bal_token.value;
  }
  bal_error(bal_state, bal_token, `Expected a name for ${bal_what}.`);
  return null;
}

function bal_parse_option(bal_state: bal_ParseState, bal_head_token: bal_Token): bal_AstOption | null {
  const bal_key = bal_expect_identifier(bal_state, 'the option key');
  if (bal_key === null) return null;
  const bal_label_token = bal_peek(bal_state);
  let bal_label: string | null = null;
  if (bal_label_token.kind === 'string' || bal_label_token.kind === 'textblock') {
    bal_label = bal_next(bal_state).value;
  } else {
    bal_error(bal_state, bal_head_token, `Expected an option label after "option ${bal_key}".`);
    return null;
  }
  let bal_code: string | null = null;
  if (bal_accept_keyword(bal_state, 'code')) bal_code = bal_expect_code(bal_state);
  return { key: bal_key, label: bal_label, code: bal_code, line: bal_head_token.line };
}

function bal_parse_rows_body(bal_state: bal_ParseState, bal_rows_token: bal_Token): bal_AstRow[] {
  const bal_rows: bal_AstRow[] = [];
  const bal_token = bal_peek(bal_state);
  if (bal_token.kind === 'lbrace') {
    bal_next(bal_state);
    while (bal_peek(bal_state).kind !== 'rbrace' && bal_peek(bal_state).kind !== 'eof') {
      bal_rows.push(...bal_parse_row_entry(bal_state));
    }
    if (bal_peek(bal_state).kind === 'rbrace') bal_next(bal_state);
    else bal_error(bal_state, bal_peek(bal_state), 'Expected "}" to close the rows block.');
    return bal_rows;
  }
  if (bal_token.kind === 'textblock' || bal_token.kind === 'string') {
    bal_next(bal_state);
    const bal_text = bal_token.kind === 'textblock' ? bal_token.value : bal_token.value.replace(/\\n/g, '\n');
    for (const bal_line of bal_text.split('\n')) {
      const bal_trimmed = bal_line.trim();
      if (bal_trimmed.length === 0) continue;
      const bal_comma = bal_trimmed.indexOf(',');
      if (bal_comma > 0) {
        const bal_key_part = bal_trimmed.slice(0, bal_comma).trim();
        bal_rows.push({
          key: /^[a-z_][a-z0-9_]*$/.test(bal_key_part) ? bal_key_part : null,
          label: bal_trimmed.slice(bal_comma + 1).trim(),
          line: bal_token.line
        });
      } else {
        bal_rows.push({ key: null, label: bal_trimmed, line: bal_token.line });
      }
    }
    return bal_rows;
  }
  bal_error(bal_state, bal_token, 'Expected "rows" to be followed by a braced block or a text block.');
  void bal_rows_token;
  return bal_rows;
}

function bal_parse_row_entry(bal_state: bal_ParseState): bal_AstRow[] {
  const bal_token = bal_peek(bal_state);
  if (bal_token.kind === 'string' || bal_token.kind === 'textblock') {
    bal_next(bal_state);
    return [{ key: null, label: bal_token.value, line: bal_token.line }];
  }
  if (bal_token.kind === 'identifier') {
    bal_next(bal_state);
    const bal_key = bal_token.value;
    const bal_label = bal_expect_string(bal_state, `a row label after row key "${bal_key}"`);
    if (bal_label === null) return [];
    return [{ key: bal_key, label: bal_label, line: bal_token.line }];
  }
  if (bal_token.kind === 'keyword' && bal_token.value !== 'rbrace') {
    bal_error(bal_state, bal_token, `The reserved word "${bal_token.value}" cannot be a row key. Quote the row label instead.`);
    bal_next(bal_state);
    return [];
  }
  bal_error(bal_state, bal_token, 'Expected a row key with a quoted label, or a quoted label.');
  bal_next(bal_state);
  return [];
}

function bal_parse_question_directive(bal_state: bal_ParseState, bal_item: bal_AstItem): void {
  const bal_token = bal_next(bal_state);
  const bal_word = bal_token.value;
  switch (bal_word) {
    case 'required':
      bal_item.required = true;
      return;
    case 'callout':
      bal_item.callout = true;
      return;
    case 'min':
      bal_item.min = bal_expect_integer(bal_state, 'a minimum');
      return;
    case 'max':
      bal_item.max = bal_expect_integer(bal_state, 'a maximum');
      return;
    case 'step':
      bal_item.step = bal_expect_integer(bal_state, 'a step');
      return;
    case 'unit':
      bal_item.unit = bal_expect_string(bal_state, 'a unit string');
      return;
    case 'maxlen':
      bal_item.maxlen = bal_expect_integer(bal_state, 'a maximum length');
      return;
    case 'yes':
      bal_item.yesCode = bal_expect_code(bal_state);
      return;
    case 'no':
      bal_item.noCode = bal_expect_code(bal_state);
      return;
    case 'option': {
      const bal_option = bal_parse_option(bal_state, bal_token);
      if (bal_option) bal_item.options.push(bal_option);
      return;
    }
    case 'use':
      bal_item.useScale = bal_expect_identifier(bal_state, 'a scale name after "use"');
      return;
    case 'scale':
      bal_item.matrixScale = bal_expect_identifier(bal_state, 'a scale name after "scale"');
      return;
    case 'columns':
      bal_item.matrixScale = bal_expect_identifier(bal_state, 'a scale name after "columns"');
      return;
    case 'column': {
      const bal_option = bal_parse_option(bal_state, bal_token);
      if (bal_option) bal_item.matrixColumns.push(bal_option);
      return;
    }
    case 'single_per_row':
      bal_item.singlePerRow = true;
      return;
    case 'multiple_per_row':
      bal_item.multiplePerRow = true;
      bal_item.singlePerRow = false;
      return;
    case 'keep_together': {
      const bal_flag = bal_peek(bal_state);
      if (bal_flag.kind === 'keyword' && (bal_flag.value === 'true' || bal_flag.value === 'false')) {
        bal_next(bal_state);
      } else {
        bal_error(bal_state, bal_flag, 'Expected true or false after "keep_together".');
      }
      return;
    }
    case 'rows':
      bal_item.rows.push(...bal_parse_rows_body(bal_state, bal_token));
      return;
    case 'introduction':
      bal_item.consentIntroduction = bal_expect_string(bal_state, 'an introduction text');
      return;
    case 'acknowledgement':
      bal_item.acknowledgement = bal_expect_string(bal_state, 'an acknowledgement label');
      return;
    case 'printed_name':
      bal_item.printedName = true;
      return;
    case 'no_printed_name':
      bal_item.printedName = false;
      return;
    case 'date':
      if (bal_item.head === 'date') return;
      bal_item.date = true;
      return;
    case 'no_date':
      bal_item.date = false;
      return;
    case 'role':
      bal_item.role = bal_expect_string(bal_state, 'a signer role');
      return;
    default: {
      if (/^[0-9]+$/.test(bal_word) && bal_item.head === 'likert') {
        const bal_label = bal_expect_string(bal_state, `a scale label after the point ${bal_word}`);
        if (bal_label !== null) bal_item.likertPoints.push({ code: bal_word, label: bal_label, line: bal_token.line });
        return;
      }
      bal_error(bal_state, bal_token, `"${bal_word}" is not valid here. Check the directives allowed for ${bal_item.head}.`);
    }
  }
}

function bal_parse_item(bal_state: bal_ParseState, bal_head_token: bal_Token): void {
  const bal_item = bal_new_item(bal_head_token.value as bal_ItemHead, bal_head_token.line);
  if (bal_peek(bal_state).kind === 'identifier') {
    bal_item.key = bal_next(bal_state).value;
  }
  let bal_label: string | null = null;
  const bal_label_token = bal_peek(bal_state);
  if (bal_label_token.kind === 'string' || bal_label_token.kind === 'textblock') {
    bal_label = bal_next(bal_state).value;
  } else {
    bal_error(bal_state, bal_head_token, `Expected a question label after "${bal_item.head}".`);
  }
  if (bal_label !== null) bal_item.label = bal_label;
  bal_state.item = bal_item;
  if (bal_state.section) bal_state.section.items.push(bal_item);
  else bal_state.doc.looseItems.push(bal_item);
  while (!bal_starts_block(bal_state, bal_peek(bal_state)) && bal_peek(bal_state).kind !== 'eof') {
    const bal_token = bal_peek(bal_state);
    if (bal_token.kind === 'keyword' && BAL_CONSENT_KINDS.has(bal_token.value) && bal_item.head === 'consent') {
      bal_next(bal_state);
      let bal_title: string | null = null;
      if (bal_peek(bal_state).kind === 'string') bal_title = bal_next(bal_state).value;
      const bal_body_token = bal_peek(bal_state);
      if (bal_body_token.kind === 'string' || bal_body_token.kind === 'textblock') {
        bal_next(bal_state);
        bal_item.consentSections.push({ kind: bal_token.value, title: bal_title, body: bal_body_token.value, line: bal_token.line });
      } else {
        bal_error(bal_state, bal_body_token, `Expected the "${bal_token.value}" consent text in quotes.`);
      }
      continue;
    }
    if (bal_token.kind === 'keyword' || bal_token.kind === 'integer') {
      bal_parse_question_directive(bal_state, bal_item);
      continue;
    }
    bal_error(bal_state, bal_token, `Unexpected ${bal_token.kind} in ${bal_item.head}. Expected a directive or a new question.`);
    bal_next(bal_state);
  }
}

function bal_parse_bulk(bal_state: bal_ParseState): void {
  bal_next(bal_state);
  if (!bal_accept_keyword(bal_state, 'using')) {
    bal_error(bal_state, bal_peek(bal_state), 'Expected "using" after "questions".');
  }
  const bal_scale = bal_expect_identifier(bal_state, 'a scale name after "questions using"');
  const bal_open = bal_peek(bal_state);
  if (bal_open.kind !== 'lbrace') {
    bal_error(bal_state, bal_open, 'Expected "{" to open the questions block.');
    return;
  }
  bal_next(bal_state);
  const bal_item = bal_new_item('single', bal_open.line);
  bal_item.useScale = bal_scale;
  if (bal_state.section) bal_state.section.items.push(bal_item);
  else bal_state.doc.looseItems.push(bal_item);
  bal_state.item = bal_item;
  while (bal_peek(bal_state).kind !== 'rbrace' && bal_peek(bal_state).kind !== 'eof') {
    const bal_entry = bal_peek(bal_state);
    if (bal_entry.kind === 'identifier') {
      bal_next(bal_state);
      const bal_label = bal_expect_string(bal_state, `a question label after "${bal_entry.value}"`);
      if (bal_label !== null) bal_item.bulkItems.push({ variableName: bal_entry.value, label: bal_label, line: bal_entry.line });
      continue;
    }
    if (bal_starts_block(bal_state, bal_entry)) break;
    bal_error(bal_state, bal_entry, 'Expected "name \\"Label\\"" entries in the questions block.');
    bal_next(bal_state);
  }
  if (bal_peek(bal_state).kind === 'rbrace') bal_next(bal_state);
  else bal_error(bal_state, bal_peek(bal_state), 'Expected "}" to close the questions block.');
  bal_state.item = null;
}

function bal_parse_scale(bal_state: bal_ParseState, bal_head_token: bal_Token): void {
  const bal_name = bal_expect_identifier(bal_state, 'a scale name after "scale"');
  if (bal_name === null) return;
  const bal_scale: bal_AstScale = { name: bal_name, line: bal_head_token.line, options: [] };
  bal_state.scale = bal_scale;
  bal_state.doc.scales.push(bal_scale);
  while (!bal_starts_block(bal_state, bal_peek(bal_state)) && bal_peek(bal_state).kind !== 'eof') {
    if (bal_is_keyword(bal_state, 'option')) {
      const bal_option_token = bal_next(bal_state);
      const bal_option = bal_parse_option(bal_state, bal_option_token);
      if (bal_option) bal_scale.options.push(bal_option);
      continue;
    }
    bal_error(bal_state, bal_peek(bal_state), 'Expected "option" definitions in the scale.');
    bal_next(bal_state);
  }
  bal_state.scale = null;
}

function bal_parse_section(bal_state: bal_ParseState, bal_head_token: bal_Token): void {
  let bal_key: string | null = null;
  if (bal_peek(bal_state).kind === 'identifier') bal_key = bal_next(bal_state).value;
  const bal_title = bal_expect_string(bal_state, 'a section title after "section"');
  if (bal_title === null) return;
  const bal_section: bal_AstSection = {
    key: bal_key ?? null,
    title: bal_title,
    line: bal_head_token.line,
    newPage: false,
    description: null,
    items: []
  };
  bal_state.section = bal_section;
  bal_state.doc.sections.push(bal_section);
  bal_state.item = null;
  while (!bal_starts_block(bal_state, bal_peek(bal_state)) && bal_peek(bal_state).kind !== 'eof') {
    if (bal_is_keyword(bal_state, 'new_page')) {
      bal_next(bal_state);
      bal_section.newPage = true;
      continue;
    }
    if (bal_is_keyword(bal_state, 'description')) {
      bal_next(bal_state);
      bal_section.description = bal_expect_string(bal_state, 'a section description');
      continue;
    }
    bal_error(bal_state, bal_peek(bal_state), 'Expected "new_page", "description", or a question inside the section.');
    bal_next(bal_state);
  }
}

function bal_parse_meta(bal_state: bal_ParseState): void {
  const bal_token = bal_next(bal_state);
  switch (bal_token.value) {
    case 'title':
      bal_state.doc.meta.title = bal_expect_string(bal_state, 'a title string');
      break;
    case 'description':
      bal_state.doc.meta.description = bal_expect_string(bal_state, 'a description string');
      break;
    case 'language':
      bal_state.doc.meta.language = bal_expect_string(bal_state, 'a language code');
      break;
    case 'paper': {
      const bal_value = bal_peek(bal_state);
      if (bal_value.kind === 'keyword' || bal_value.kind === 'identifier') {
        if (bal_value.value === 'a4' || bal_value.value === 'letter') {
          bal_next(bal_state);
          bal_state.doc.meta.paper = bal_value.value;
        } else {
          bal_error(bal_state, bal_value, 'Expected a4 or letter after "paper".');
        }
      } else {
        bal_error(bal_state, bal_value, 'Expected a4 or letter after "paper".');
      }
      break;
    }
    case 'orientation': {
      const bal_value = bal_peek(bal_state);
      if (bal_value.kind === 'keyword' || bal_value.kind === 'identifier') {
        if (bal_value.value === 'portrait' || bal_value.value === 'landscape') {
          bal_next(bal_state);
          bal_state.doc.meta.orientation = bal_value.value;
        } else {
          bal_error(bal_state, bal_value, 'Expected portrait or landscape after "orientation".');
        }
      } else {
        bal_error(bal_state, bal_value, 'Expected portrait or landscape after "orientation".');
      }
      break;
    }
    default:
      bal_error(bal_state, bal_token, `"${bal_token.value}" is not valid before the first section.`);
  }
}

export function bal_sparse(bal_tokens: bal_Token[], bal_lex_errors: bal_SLexError[]): {
  doc: bal_AstDocument;
  errors: bal_SourcesError[];
} {
  const bal_state: bal_ParseState = {
    tokens: bal_tokens,
    pos: 0,
    errors: [...bal_lex_errors],
    doc: {
      version: null,
      meta: { title: null, description: null, language: null, paper: null, orientation: null, line: 1 },
      sections: [],
      scales: [],
      looseItems: []
    },
    section: null,
    scale: null,
    item: null,
    finished: false
  };
  const bal_version = bal_peek(bal_state);
  if (bal_is_keyword(bal_state, 'svelp')) {
    bal_next(bal_state);
    if (bal_peek(bal_state).kind === 'integer') {
      bal_state.doc.version = Number(bal_next(bal_state).value);
    } else {
      bal_error(bal_state, bal_peek(bal_state), 'Expected the language version after "svelp", for example: svelp 1');
    }
  } else {
    bal_error(bal_state, bal_version, 'The file must start with "svelp 1".');
  }
  while (bal_peek(bal_state).kind !== 'eof') {
    const bal_token = bal_peek(bal_state);
    if (bal_state.doc.version !== 1 && bal_state.doc.version !== null) {
      bal_error(
        bal_state,
        bal_version,
        `Svelp source version ${bal_state.doc.version} is not supported by this release. This build reads version 1.`
      );
      bal_state.finished = true;
      break;
    }
    const bal_head = bal_head_of(bal_token);
    if (bal_head) {
      bal_next(bal_state);
      bal_parse_item(bal_state, { ...bal_token, value: bal_head });
      continue;
    }
    if (bal_is_keyword(bal_state, 'section')) {
      bal_parse_section(bal_state, bal_next(bal_state));
      continue;
    }
    if (bal_is_keyword(bal_state, 'scale')) {
      bal_parse_scale(bal_state, bal_next(bal_state));
      continue;
    }
    if (bal_is_keyword(bal_state, 'questions')) {
      bal_parse_bulk(bal_state);
      continue;
    }
    if (bal_token.kind === 'keyword' && ['title', 'description', 'language', 'paper', 'orientation'].includes(bal_token.value)) {
      bal_parse_meta(bal_state);
      continue;
    }
    bal_error(bal_state, bal_token, `"${bal_token.value || bal_token.kind}" cannot start a line here. Expected a question, section, or scale.`);
    bal_next(bal_state);
  }
  return { doc: bal_state.doc, errors: bal_state.errors };
}
