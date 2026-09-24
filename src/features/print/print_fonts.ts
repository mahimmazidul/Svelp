export type PrintFontKey = 'helvetica' | 'times' | 'courier';

export interface PrintFontStyle {
  family: PrintFontKey;
  bold: boolean;
}

const BAL_WIDTHS_HELVETICA: number[] = [
  280, 280, 350, 550, 550, 890, 660, 190, 330, 330, 390, 580, 280, 330, 280,
  280, 550, 550, 550, 550, 550, 550, 550, 550, 550, 550, 280, 280, 580, 580,
  580, 550, 1010, 660, 660, 720, 720, 660, 610, 780, 720, 280, 500, 660, 550,
  830, 720, 780, 660, 780, 720, 660, 610, 720, 660, 940, 660, 660, 610, 280,
  280, 280, 470, 550, 330, 550, 550, 500, 550, 550, 280, 550, 550, 220, 220,
  500, 220, 830, 550, 550, 550, 550, 330, 500, 280, 550, 500, 720, 500, 500,
  500, 330, 260, 330, 580
];

const BAL_WIDTHS_TIMES: number[] = [
  250, 330, 410, 500, 500, 830, 780, 180, 330, 330, 500, 560, 250, 330, 250,
  280, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 280, 280, 560, 560,
  560, 440, 920, 720, 660, 660, 720, 610, 550, 720, 720, 330, 390, 720, 610,
  890, 720, 720, 550, 720, 660, 550, 610, 720, 720, 940, 720, 720, 610, 330,
  280, 330, 470, 500, 330, 440, 500, 440, 500, 440, 330, 500, 500, 280, 280,
  500, 280, 780, 500, 500, 500, 500, 330, 390, 280, 500, 500, 720, 500, 500,
  440, 480, 200, 480, 540
];

const BAL_WIDTHS_COURIER: number[] = [
  600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600,
  600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600,
  600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600,
  600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600,
  600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600,
  600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600,
  600, 600, 600, 600, 600
];


const BAL_FONT_TABLES: Record<PrintFontKey, number[]> = {
  helvetica: BAL_WIDTHS_HELVETICA,
  times: BAL_WIDTHS_TIMES,
  courier: BAL_WIDTHS_COURIER
};

const BAL_BOLD_FACTOR = 1.06;

function bal_char_units(bal_font: PrintFontKey, bal_code: number): number {
  const bal_table = BAL_FONT_TABLES[bal_font];
  return bal_table[bal_code - 32] ?? bal_table[0];
}

export function bal_measure_units(bal_text: string, bal_font: PrintFontStyle): number {
  let bal_total = 0;
  for (const bal_char of bal_text) {
    bal_total += bal_char_units(bal_font.family, bal_char.codePointAt(0) ?? 32);
  }
  return bal_font.bold ? bal_total * BAL_BOLD_FACTOR : bal_total;
}

export function bal_measure_text(
  bal_text: string,
  bal_font: PrintFontStyle,
  bal_size_pt: number
): number {
  return (bal_measure_units(bal_text, bal_font) / 1000) * bal_size_pt * 0.35277778;
}

export function bal_line_height(bal_size_pt: number): number {
  return bal_size_pt * 1.38 * 0.35277778;
}

export function bal_wrap_text(
  bal_text: string,
  bal_font: PrintFontStyle,
  bal_size_pt: number,
  bal_max_width_mm: number
): string[] {
  const bal_lines: string[] = [];
  for (const bal_paragraph of bal_text.split('\n')) {
    const bal_words = bal_paragraph.split(/\s+/).filter((bal_w) => bal_w.length > 0);
    if (bal_words.length === 0) {
      bal_lines.push('');
      continue;
    }
    let bal_current = '';
    for (const bal_word of bal_words) {
      const bal_candidate = bal_current.length === 0 ? bal_word : `${bal_current} ${bal_word}`;
      if (bal_measure_text(bal_candidate, bal_font, bal_size_pt) <= bal_max_width_mm) {
        bal_current = bal_candidate;
        continue;
      }
      if (bal_current.length > 0) {
        bal_lines.push(bal_current);
        bal_current = '';
      }
      if (bal_measure_text(bal_word, bal_font, bal_size_pt) > bal_max_width_mm) {
        let bal_piece = '';
        for (const bal_char of bal_word) {
          const bal_next = bal_piece + bal_char;
          if (bal_piece.length > 0 && bal_measure_text(bal_next, bal_font, bal_size_pt) > bal_max_width_mm) {
            bal_lines.push(bal_piece);
            bal_piece = bal_char;
          } else {
            bal_piece = bal_next;
          }
        }
        bal_current = bal_piece;
      } else {
        bal_current = bal_word;
      }
    }
    if (bal_current.length > 0) bal_lines.push(bal_current);
  }
  return bal_lines;
}
