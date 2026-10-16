import { describe, expect, it } from 'vitest';
import bal_reference_markdown from '/docs/source-language.md?raw';
import { bal_slex } from './shobdo_lexer';
import { bal_sparse } from './naksha_parser';
import { bal_svalidate } from './bhul_validate';
import { bal_plan_apply } from './bani_compile';
import { bal_source_serialize } from './lekha_serialize';

interface bal_Block {
  info: string;
  body: string;
}

function bal_extract_blocks(bal_markdown: string): bal_Block[] {
  const bal_blocks: bal_Block[] = [];
  const bal_lines = bal_markdown.split('\n');
  let bal_index = 0;
  while (bal_index < bal_lines.length) {
    const bal_line = bal_lines[bal_index];
    if (bal_line.startsWith('```svelp')) {
      const bal_info = bal_line.slice(3).trim();
      const bal_body: string[] = [];
      bal_index += 1;
      while (bal_index < bal_lines.length && bal_lines[bal_index] !== '```') {
        bal_body.push(bal_lines[bal_index]);
        bal_index += 1;
      }
      bal_blocks.push({ info: bal_info, body: bal_body.join('\n') });
    }
    bal_index += 1;
  }
  return bal_blocks;
}

function bal_compile_fully(bal_source: string): { bal_ok: boolean; bal_messages: string[] } {
  const bal_lexed = bal_slex(bal_source);
  const bal_parsed = bal_sparse(bal_lexed.tokens, bal_lexed.errors);
  const bal_issues = bal_svalidate(bal_parsed.doc);
  const bal_messages = [
    ...bal_lexed.errors.map((bal_e) => bal_e.message),
    ...bal_parsed.errors.map((bal_e) => bal_e.message),
    ...bal_issues.filter((bal_i) => bal_i.severity === 'error').map((bal_i) => bal_i.message)
  ];
  if (bal_messages.length > 0) return { bal_ok: false, bal_messages };
  const bal_plan = bal_plan_apply(bal_parsed.doc, null, []);
  if (!bal_plan.ok) return { bal_ok: false, bal_messages: bal_plan.errors };
  return { bal_ok: true, bal_messages: [] };
}

describe('source language reference examples', () => {
  const bal_markdown = bal_reference_markdown;
  const bal_blocks = bal_extract_blocks(bal_markdown);

  it('finds the tagged example blocks in the reference', () => {
    expect(bal_blocks.filter((bal_b) => bal_b.info === 'svelp').length).toBeGreaterThanOrEqual(14);
    expect(bal_blocks.filter((bal_b) => bal_b.info.startsWith('svelp-error')).length).toBeGreaterThanOrEqual(9);
  });

  for (const [bal_i, bal_block] of bal_blocks.entries()) {
    if (bal_block.info === 'svelp') {
      it(`valid example #${bal_i + 1} parses, validates, and compiles`, () => {
        const bal_result = bal_compile_fully(bal_block.body);
        expect(bal_result.bal_messages, `example #${bal_i + 1}`).toEqual([]);
        expect(bal_result.bal_ok, `example #${bal_i + 1}`).toBe(true);
      });
    } else if (bal_block.info.startsWith('svelp-error')) {
      const bal_expected = bal_block.info.replace('svelp-error', '').trim();
      it(`error example #${bal_i + 1} fails with "${bal_expected}"`, () => {
        const bal_result = bal_compile_fully(bal_block.body);
        expect(bal_result.bal_ok, `example #${bal_i + 1}`).toBe(false);
        expect(
          bal_result.bal_messages.some((bal_m) => bal_m.includes(bal_expected)),
          `example #${bal_i + 1} messages: ${JSON.stringify(bal_result.bal_messages)}`
        ).toBe(true);
      });
    }
  }

  it('the full example round-trips through the canonical serializer', () => {
    const bal_full = bal_blocks.filter((bal_b) => bal_b.info === 'svelp').map((bal_b) => bal_b.body);
    const bal_canonical = bal_full
      .map((bal_body) => {
        const bal_lexed = bal_slex(bal_body);
        const bal_parsed = bal_sparse(bal_lexed.tokens, bal_lexed.errors);
        const bal_plan = bal_plan_apply(bal_parsed.doc, null, []);
        if (!bal_plan.ok) return null;
        return bal_source_serialize(bal_plan.questionnaire, bal_plan.scales);
      })
      .find((bal_out) => bal_out !== null && bal_out.text.includes('Household Food Waste Survey'));
    expect(bal_canonical).not.toBeNull();
    expect(bal_canonical!.skipped).toEqual([]);
    const bal_second = bal_compile_fully(bal_canonical!.text);
    expect(bal_second.bal_ok).toBe(true);
  });

  it('the bangla example round-trips preserving bangla labels', () => {
    const bal_bn = bal_blocks.filter((bal_b) => bal_b.info === 'svelp').map((bal_b) => bal_b.body).find((bal_body) => bal_body.includes('গৃহস্থালির'));
    expect(bal_bn).toBeDefined();
    const bal_lexed = bal_slex(bal_bn!);
    const bal_parsed = bal_sparse(bal_lexed.tokens, bal_lexed.errors);
    const bal_plan = bal_plan_apply(bal_parsed.doc, null, []);
    if (!bal_plan.ok) throw new Error(`bangla plan failed: ${bal_plan.errors.join('; ')}`);
    const bal_serialized = bal_source_serialize(bal_plan.questionnaire, bal_plan.scales);
    expect(bal_serialized.skipped).toEqual([]);
    expect(bal_serialized.text).toContain('আপনার বয়স কত?');
    expect(bal_serialized.text).toContain('unit "বছর"');
  });
});
