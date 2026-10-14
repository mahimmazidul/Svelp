declare module 'fontkit' {
  export interface FontkitGlyphPath {
    commands: { command: string; args: number[] }[];
  }
  export interface FontkitGlyph {
    advanceWidth: number;
    path: FontkitGlyphPath;
  }
  export interface FontkitPosition {
    xAdvance: number;
    yOffset: number;
    xOffset: number;
  }
  export interface FontkitFont {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    layout(text: string): { glyphs: FontkitGlyph[]; positions: FontkitPosition[] };
    glyphForCodePoint(codePoint: number): FontkitGlyph;
  }
  export function create(buffer: Uint8Array): FontkitFont;
}
