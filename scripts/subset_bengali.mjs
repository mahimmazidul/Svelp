import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import subsetFont from 'subset-font';
import woff2 from 'wawoff2';
import * as fontkit from 'fontkit';

const BAL_SOURCE = 'tools/fonts/NotoSansBengali-Regular.ttf';
const BAL_OUT_WOFF2 = 'public/fonts/bangla-subset.woff2';
const BAL_OUT_TTF = 'public/fonts/bangla-subset.ttf';
const BAL_OUT_TS = 'src/features/print/print_bengali_widths.ts';

function bal_range(bal_from, bal_to) {
  const bal_out = [];
  for (let bal_cp = bal_from; bal_cp <= bal_to; bal_cp += 1) bal_out.push(bal_cp);
  return bal_out;
}

const BAL_CODEPOINTS = [
  ...bal_range(0x20, 0x7e),
  ...bal_range(0x0980, 0x09ff),
  0x0964,
  0x0965,
  0x2013,
  0x2014,
  0x2018,
  0x2019,
  0x201c,
  0x201d,
  0x2026,
  0x00b7,
  0x200c,
  0x200d,
  0x00d7
];
const BAL_TEXT = String.fromCodePoint(...BAL_CODEPOINTS);

const bal_source = readFileSync(BAL_SOURCE);
const bal_ttf = await subsetFont(bal_source, BAL_TEXT, { targetFormat: 'truetype' });
const bal_woff2 = await woff2.compress(bal_ttf);
mkdirSync('public/fonts', { recursive: true });
writeFileSync(BAL_OUT_TTF, bal_ttf);
writeFileSync(BAL_OUT_WOFF2, Buffer.from(bal_woff2));

const bal_font = fontkit.create(new Uint8Array(bal_ttf));
const bal_upm = bal_font.unitsPerEm;
const bal_entries = [];
for (const bal_cp of BAL_CODEPOINTS) {
  const bal_glyph = bal_font.glyphForCodePoint(bal_cp);
  bal_entries.push([bal_cp, bal_glyph.advanceWidth]);
}
const bal_lines = [];
for (let bal_i = 0; bal_i < bal_entries.length; bal_i += 8) {
  bal_lines.push('  ' + bal_entries.slice(bal_i, bal_i + 8).map(([bal_cp, bal_w]) => `${bal_cp}: ${bal_w}`).join(', '));
}
const bal_ts = `export const BAL_BENGALI_UPM = ${bal_upm};

export const BAL_BENGALI_WIDTHS: Record<number, number> = {
${bal_lines.join(',\n')}
};
`;
writeFileSync(BAL_OUT_TS, bal_ts);

const bal_check = bal_font.layout('ক্ষ ি কি স্বাক্ষর প্রশ্নপত্র');
console.log(
  JSON.stringify({
    sourceBytes: bal_source.length,
    ttfBytes: bal_ttf.length,
    woff2Bytes: bal_woff2.length,
    upm: bal_upm,
    glyphs: bal_check.glyphs.length,
    positions: bal_check.positions.slice(0, 4).map((bal_p) => [bal_p.xAdvance, bal_p.yAdvance])
  })
);
