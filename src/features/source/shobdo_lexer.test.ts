import { describe, expect, it } from 'vitest';
import { bal_slex } from './shobdo_lexer';

describe('source lexer', () => {
  it('tokenizes keywords identifiers integers and punctuation with positions', () => {
    const bal_result = bal_slex('svelp 1\nsection demo "Demographics"\nrequired');
    expect(bal_result.errors).toEqual([]);
    expect(bal_result.tokens.map((bal_t) => bal_t.kind)).toEqual([
      'keyword',
      'integer',
      'keyword',
      'identifier',
      'string',
      'keyword',
      'eof'
    ]);
    expect(bal_result.tokens[0]).toMatchObject({ value: 'svelp', line: 1, column: 1 });
    expect(bal_result.tokens[2]).toMatchObject({ value: 'section', line: 2, column: 1 });
    expect(bal_result.tokens[3]).toMatchObject({ value: 'demo', line: 2, column: 9 });
    expect(bal_result.tokens[5]).toMatchObject({ value: 'required', line: 3, column: 1 });
  });

  it('unescapes single-line strings and keeps text blocks raw', () => {
    const bal_result = bal_slex('title "Age \\"range\\" \\\\ done"\ninstruction """\nLine one\n"quoted" inside\n"""\n');
    expect(bal_result.errors).toEqual([]);
    expect(bal_result.tokens[1].value).toBe('Age "range" \\ done');
    expect(bal_result.tokens[2].kind).toBe('keyword');
    expect(bal_result.tokens[3]).toMatchObject({ kind: 'textblock', value: 'Line one\n"quoted" inside' });
  });

  it('reports unterminated strings and stray characters with line and column', () => {
    const bal_result = bal_slex('title "Oops\n%\n');
    expect(bal_result.errors).toEqual([
      { line: 1, column: 12, message: 'Missing closing quote. Use """ on its own lines for multiline text.' },
      { line: 2, column: 1, message: 'Unexpected character "%".' }
    ]);
    expect(bal_result.tokens.filter((bal_t) => bal_t.kind === 'string')).toHaveLength(1);
  });

  it('rejects comments and malformed identifiers explicitly', () => {
    const bal_result = bal_slex('# note\nsingle 9abc "X"');
    expect(bal_result.errors.map((bal_e) => bal_e.line)).toEqual([1, 2]);
    expect(bal_result.errors[0].message).toContain('Comments do not exist');
    expect(bal_result.errors[1].message).toContain('Numbers cannot contain letters');
  });

  it('flags multiline blocks with junk after the opening quotes', () => {
    const bal_result = bal_slex('instruction """oops\n"""\n');
    expect(bal_result.errors[0].message).toContain('must end its opening line right after');
    expect(bal_result.tokens.filter((bal_t) => bal_t.kind === 'textblock')).toHaveLength(1);
  });

  it('accepts a text block opened at the end of a head line', () => {
    const bal_result = bal_slex('instruction """\nBody line\n"""\ncallout');
    expect(bal_result.errors).toEqual([]);
    expect(bal_result.tokens[1]).toMatchObject({ kind: 'textblock', value: 'Body line', line: 1 });
    expect(bal_result.tokens[2]).toMatchObject({ kind: 'keyword', value: 'callout', line: 4 });
  });

  it('handles crlf line endings and the eof token position', () => {
    const bal_result = bal_slex('svelp 1\r\ntitle "T"\r\n');
    expect(bal_result.errors).toEqual([]);
    const bal_eof = bal_result.tokens[bal_result.tokens.length - 1];
    expect(bal_eof).toMatchObject({ kind: 'eof', line: 3, column: 1 });
  });
});
