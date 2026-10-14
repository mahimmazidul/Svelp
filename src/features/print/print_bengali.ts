import { BAL_BENGALI_UPM, BAL_BENGALI_WIDTHS } from './print_bengali_widths';

export interface bal_PathCommand {
  command: 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'bezierCurveTo' | 'closePath';
  args: number[];
}

export interface bal_ShapedGlyph {
  commands: bal_PathCommand[];
  advance: number;
  xOffset: number;
  yOffset: number;
}

export interface bal_ShapeResult {
  glyphs: bal_ShapedGlyph[];
  advanceUnits: number;
}

interface bal_FontkitGlyph {
  path: { commands: { command: string; args: number[] }[] };
  advanceWidth: number;
}

interface bal_FontkitFont {
  unitsPerEm: number;
  layout(bal_text: string): {
    glyphs: bal_FontkitGlyph[];
    positions: { xAdvance: number; yOffset: number; xOffset: number }[];
  };
  glyphForCodePoint(bal_cp: number): bal_FontkitGlyph;
}

let bal_font: bal_FontkitFont | null = null;
let bal_load_promise: Promise<boolean> | null = null;

export function bal_has_bengali(bal_text: string): boolean {
  return /[\u0980-\u09FF]/.test(bal_text);
}

export function bal_bengali_font_ready(): boolean {
  return bal_font !== null;
}

export function bal_bengali_fallback_units(bal_text: string): number | null {
  if (!bal_has_bengali(bal_text)) return null;
  let bal_total = 0;
  let bal_bengali_chars = 0;
  for (const bal_char of bal_text) {
    const bal_width = BAL_BENGALI_WIDTHS[bal_char.codePointAt(0) ?? 32];
    if (bal_width !== undefined) {
      bal_total += bal_width;
      bal_bengali_chars += 1;
    }
  }
  if (bal_bengali_chars === 0) return null;
  return bal_total;
}

export function bal_bengali_measure_units(bal_text: string): number | null {
  if (!bal_has_bengali(bal_text)) return null;
  if (!bal_font) return bal_bengali_fallback_units(bal_text);
  return bal_shape_text(bal_text)?.advanceUnits ?? bal_bengali_fallback_units(bal_text);
}

export function bal_shape_text(bal_text: string): bal_ShapeResult | null {
  if (!bal_font) return null;
  const bal_layout = bal_font.layout(bal_text);
  const bal_glyphs: bal_ShapedGlyph[] = [];
  let bal_advance = 0;
  for (let bal_i = 0; bal_i < bal_layout.glyphs.length; bal_i += 1) {
    const bal_glyph = bal_layout.glyphs[bal_i];
    const bal_position = bal_layout.positions[bal_i];
    const bal_commands: bal_PathCommand[] = [];
    for (const bal_cmd of bal_glyph.path.commands) {
      const bal_type = bal_cmd.command as bal_PathCommand['command'];
      if (bal_type === 'quadraticCurveTo' || bal_type === 'bezierCurveTo' || bal_type === 'moveTo' || bal_type === 'lineTo' || bal_type === 'closePath') {
        bal_commands.push({ command: bal_type, args: bal_cmd.args });
      }
    }
    bal_glyphs.push({
      commands: bal_commands,
      advance: bal_position.xAdvance,
      xOffset: bal_position.xOffset,
      yOffset: bal_position.yOffset
    });
    bal_advance += bal_position.xAdvance;
  }
  return { glyphs: bal_glyphs, advanceUnits: bal_advance };
}

export async function bal_load_bengali_shaper(): Promise<boolean> {
  if (bal_font) return true;
  if (bal_load_promise) return bal_load_promise;
  bal_load_promise = (async () => {
    try {
      const bal_data = (await import('./print_bengali_font_data')) as {
        BAL_BENGALI_FONT_B64: string;
      };
      const bal_binary = atob(bal_data.BAL_BENGALI_FONT_B64);
      const bal_bytes = new Uint8Array(bal_binary.length);
      for (let bal_i = 0; bal_i < bal_binary.length; bal_i += 1) {
        bal_bytes[bal_i] = bal_binary.charCodeAt(bal_i);
      }
      const bal_fontkit = (await import('fontkit')) as unknown as {
        create(bal_buffer: Uint8Array): bal_FontkitFont;
      };
      const bal_loaded = bal_fontkit.create(bal_bytes);
      if (!bal_loaded || bal_loaded.unitsPerEm <= 0) return false;
      bal_font = bal_loaded;
      return true;
    } catch {
      return false;
    }
  })();
  return bal_load_promise;
}

const BAL_QUAD_THIRD = 2 / 3;

export function bal_command_to_cubic(
  bal_cmd: bal_PathCommand,
  bal_prev_x: number,
  bal_prev_y: number
): { op: 'c'; c: [number, number, number, number, number, number] } | null {
  if (bal_cmd.command !== 'quadraticCurveTo') return null;
  const [bal_qx, bal_qy, bal_x, bal_y] = bal_cmd.args;
  return {
    op: 'c',
    c: [
      bal_prev_x + (bal_qx - bal_prev_x) * BAL_QUAD_THIRD,
      bal_prev_y + (bal_qy - bal_prev_y) * BAL_QUAD_THIRD,
      bal_x + (bal_qx - bal_x) * BAL_QUAD_THIRD,
      bal_y + (bal_qy - bal_y) * BAL_QUAD_THIRD,
      bal_x,
      bal_y
    ]
  };
}

export const BAL_BENGALI_UNITS_PER_EM = BAL_BENGALI_UPM;
