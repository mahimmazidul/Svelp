import { describe, expect, it } from 'vitest';
import { bal_line_height, bal_measure_text, bal_measure_units, bal_wrap_text } from './print_fonts';

describe('text measurement', () => {
  it('is deterministic for identical input', () => {
    const bal_a = bal_measure_text('How often do you consume fish?', { family: 'helvetica', bold: false }, 11);
    const bal_b = bal_measure_text('How often do you consume fish?', { family: 'helvetica', bold: false }, 11);
    expect(bal_a).toBe(bal_b);
  });

  it('measures wide characters wider than narrow ones', () => {
    const bal_wide = bal_measure_units('W', { family: 'helvetica', bold: false });
    const bal_narrow = bal_measure_units('i', { family: 'helvetica', bold: false });
    expect(bal_wide).toBeGreaterThan(bal_narrow * 3);
  });

  it('scales linearly with font size', () => {
    const bal_11 = bal_measure_text('Hello World', { family: 'helvetica', bold: false }, 11);
    const bal_22 = bal_measure_text('Hello World', { family: 'helvetica', bold: false }, 22);
    expect(bal_22).toBeCloseTo(bal_11 * 2, 6);
  });

  it('applies the bold safety factor', () => {
    const bal_regular = bal_measure_units('Bold heading', { family: 'helvetica', bold: false });
    const bal_bold = bal_measure_units('Bold heading', { family: 'helvetica', bold: true });
    expect(bal_bold).toBeGreaterThan(bal_regular);
    expect(bal_bold).toBeCloseTo(bal_regular * 1.06, 4);
  });

  it('never underestimates the width jsPDF will actually draw', async () => {
    const { jsPDF } = await import('jspdf');
    const bal_doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const bal_samples = [
      'Hello World',
      'How often do you consume fish?',
      'Section 1: Household information',
      'FFQ-037 P2/3'
    ];
    for (const bal_family of ['helvetica', 'times', 'courier'] as const) {
      bal_doc.setFont(bal_family, 'normal');
      bal_doc.setFontSize(11);
      for (const bal_text of bal_samples) {
        const bal_mine = bal_measure_text(bal_text, { family: bal_family, bold: false }, 11);
        const bal_actual = bal_doc.getTextWidth(bal_text);
        expect(bal_mine).toBeGreaterThanOrEqual(bal_actual - 0.01);
        expect(bal_mine).toBeLessThan(bal_actual * 1.03);
      }
    }
  });

  it('uses fixed pitch metrics for courier', () => {
    expect(bal_measure_units('il', { family: 'courier', bold: false })).toBe(
      bal_measure_units('WW', { family: 'courier', bold: false })
    );
  });
});

describe('line height', () => {
  it('scales with font size', () => {
    expect(bal_line_height(10)).toBeCloseTo(bal_line_height(20) / 2, 6);
    expect(bal_line_height(10)).toBeGreaterThan(4.5);
    expect(bal_line_height(10)).toBeLessThan(5.2);
  });
});

describe('text wrapping', () => {
  it('keeps every line within the maximum width', () => {
    const bal_font = { family: 'helvetica' as const, bold: false };
    const bal_max = 60;
    const bal_lines = bal_wrap_text(
      'The purpose of this study is to understand household food consumption patterns over the last month.',
      bal_font,
      11,
      bal_max
    );
    expect(bal_lines.length).toBeGreaterThan(1);
    for (const bal_line of bal_lines) {
      expect(bal_measure_text(bal_line, bal_font, 11)).toBeLessThanOrEqual(bal_max + 0.01);
    }
  });

  it('respects hard line breaks', () => {
    const bal_lines = bal_wrap_text('First line\nSecond line', { family: 'helvetica', bold: false }, 11, 200);
    expect(bal_lines).toEqual(['First line', 'Second line']);
  });

  it('breaks words longer than a whole line', () => {
    const bal_lines = bal_wrap_text(
      'Supercalifragilisticexpialidociousandthenmoreletters',
      { family: 'helvetica', bold: false },
      11,
      25
    );
    expect(bal_lines.length).toBeGreaterThan(1);
    for (const bal_line of bal_lines) {
      expect(bal_measure_text(bal_line, { family: 'helvetica', bold: false }, 11)).toBeLessThanOrEqual(25.01);
    }
  });

  it('returns one empty line for empty paragraphs', () => {
    expect(bal_wrap_text('', { family: 'helvetica', bold: false }, 11, 50)).toEqual(['']);
  });
});
