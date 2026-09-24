export type IconName =
  | 'plus'
  | 'x'
  | 'check'
  | 'chevron-up'
  | 'chevron-down'
  | 'chevron-right'
  | 'arrow-left'
  | 'menu'
  | 'more'
  | 'pencil'
  | 'trash'
  | 'copy'
  | 'eye'
  | 'printer'
  | 'scan'
  | 'table'
  | 'download'
  | 'upload'
  | 'sliders'
  | 'search'
  | 'file-text'
  | 'align-left'
  | 'circle-check'
  | 'info'
  | 'alert'
  | 'calendar'
  | 'clock'
  | 'hash'
  | 'sort'
  | 'layers'
  | 'folder'
  | 'checkbox'
  | 'toggle'
  | 'text-cursor'
  | 'shield'
  | 'history'
  | 'undo'
  | 'redo'
  | 'list'
  | 'wand';

export interface IconPrimitive {
  tag: 'path' | 'circle' | 'rect';
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rx?: number;
  filled?: boolean;
}

export const icon_primitives: Record<IconName, IconPrimitive[]> = {
  plus: [{ tag: 'path', d: 'M12 5v14' }, { tag: 'path', d: 'M5 12h14' }],
  x: [{ tag: 'path', d: 'M6 6l12 12' }, { tag: 'path', d: 'M18 6L6 18' }],
  check: [{ tag: 'path', d: 'M5 12.5l4.5 4.5L19 7.5' }],
  'chevron-up': [{ tag: 'path', d: 'M6 14.5l6-6 6 6' }],
  'chevron-down': [{ tag: 'path', d: 'M6 9.5l6 6 6-6' }],
  'chevron-right': [{ tag: 'path', d: 'M9.5 6l6 6-6 6' }],
  'arrow-left': [{ tag: 'path', d: 'M19 12H5' }, { tag: 'path', d: 'M12 19l-7-7 7-7' }],
  menu: [
    { tag: 'path', d: 'M4 7h16' },
    { tag: 'path', d: 'M4 12h16' },
    { tag: 'path', d: 'M4 17h16' }
  ],
  more: [
    { tag: 'circle', cx: 5, cy: 12, r: 1.5, filled: true },
    { tag: 'circle', cx: 12, cy: 12, r: 1.5, filled: true },
    { tag: 'circle', cx: 19, cy: 12, r: 1.5, filled: true }
  ],
  pencil: [
    {
      tag: 'path',
      d: 'M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 0l.5.5a2.1 2.1 0 0 1 0 3L8.5 19L4 20z'
    },
    { tag: 'path', d: 'M13.5 7l3.5 3.5' }
  ],
  trash: [
    { tag: 'path', d: 'M4 7h16' },
    {
      tag: 'path',
      d: 'M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7'
    },
    {
      tag: 'path',
      d: 'M6.5 7l0.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l0.8-12'
    },
    { tag: 'path', d: 'M10 11v6' },
    { tag: 'path', d: 'M14 11v6' }
  ],
  copy: [
    { tag: 'rect', x: 9, y: 9, width: 11, height: 11, rx: 2 },
    { tag: 'path', d: 'M15 5V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1' }
  ],
  eye: [
    {
      tag: 'path',
      d: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'
    },
    { tag: 'circle', cx: 12, cy: 12, r: 3 }
  ],
  printer: [
    { tag: 'path', d: 'M7 8V3.5h10V8' },
    { tag: 'path', d: 'M5 16H4a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 4 8h16a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 20 16h-1' },
    { tag: 'rect', x: 7, y: 13, width: 10, height: 7.5, rx: 1 }
  ],
  scan: [
    { tag: 'path', d: 'M4 8V6a2 2 0 0 1 2-2h2' },
    { tag: 'path', d: 'M16 4h2a2 2 0 0 1 2 2v2' },
    { tag: 'path', d: 'M20 16v2a2 2 0 0 1-2 2h-2' },
    { tag: 'path', d: 'M8 20H6a2 2 0 0 1-2-2v-2' },
    { tag: 'path', d: 'M4 12h16' }
  ],
  table: [
    { tag: 'rect', x: 3, y: 4.5, width: 18, height: 15, rx: 2 },
    { tag: 'path', d: 'M3 10h18' },
    { tag: 'path', d: 'M9.5 10v9.5' },
    { tag: 'path', d: 'M15.5 10v9.5' }
  ],
  download: [
    { tag: 'path', d: 'M12 4v11' },
    { tag: 'path', d: 'M7 10.5l5 5 5-5' },
    { tag: 'path', d: 'M4.5 20h15' }
  ],
  upload: [
    { tag: 'path', d: 'M12 15V4' },
    { tag: 'path', d: 'M7 8.5l5-5 5 5' },
    { tag: 'path', d: 'M4.5 20h15' }
  ],
  sliders: [
    { tag: 'path', d: 'M4 7.5h8' },
    { tag: 'path', d: 'M18 7.5h2' },
    { tag: 'circle', cx: 15, cy: 7.5, r: 2.5 },
    { tag: 'path', d: 'M4 16.5h2' },
    { tag: 'path', d: 'M12 16.5h8' },
    { tag: 'circle', cx: 9, cy: 16.5, r: 2.5 }
  ],
  search: [
    { tag: 'circle', cx: 11, cy: 11, r: 6.5 },
    { tag: 'path', d: 'M20 20l-4.4-4.4' }
  ],
  'file-text': [
    {
      tag: 'path',
      d: 'M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L13.5 3z'
    },
    { tag: 'path', d: 'M13.5 3v5.5H19' },
    { tag: 'path', d: 'M9 13h6' },
    { tag: 'path', d: 'M9 16.5h6' }
  ],
  'align-left': [
    { tag: 'path', d: 'M4 6h16' },
    { tag: 'path', d: 'M4 11h10' },
    { tag: 'path', d: 'M4 16h13' }
  ],
  'circle-check': [
    { tag: 'circle', cx: 12, cy: 12, r: 8.5 },
    { tag: 'path', d: 'M8.5 12.2l2.4 2.4 4.6-5' }
  ],
  info: [
    { tag: 'circle', cx: 12, cy: 12, r: 8.5 },
    { tag: 'path', d: 'M12 11v5' },
    { tag: 'path', d: 'M12 8.1v.01' }
  ],
  alert: [
    { tag: 'path', d: 'M12 4.5L2.8 20h18.4L12 4.5z' },
    { tag: 'path', d: 'M12 10v4.5' },
    { tag: 'path', d: 'M12 17.6v.01' }
  ],
  calendar: [
    { tag: 'rect', x: 4, y: 5.5, width: 16, height: 15, rx: 2 },
    { tag: 'path', d: 'M4 10.5h16' },
    { tag: 'path', d: 'M8.5 3.5v4' },
    { tag: 'path', d: 'M15.5 3.5v4' }
  ],
  clock: [
    { tag: 'circle', cx: 12, cy: 12, r: 8.5 },
    { tag: 'path', d: 'M12 7.5V12l3 2' }
  ],
  hash: [
    { tag: 'path', d: 'M5 9h14' },
    { tag: 'path', d: 'M5 15h14' },
    { tag: 'path', d: 'M10 4l-1.5 16' },
    { tag: 'path', d: 'M15.5 4L14 20' }
  ],
  sort: [
    { tag: 'path', d: 'M7 4v13' },
    { tag: 'path', d: 'M4 14l3 3 3-3' },
    { tag: 'path', d: 'M17 20V7' },
    { tag: 'path', d: 'M14 10l3-3 3 3' }
  ],
  layers: [
    { tag: 'path', d: 'M12 3.5l8.5 4.7L12 12.9 3.5 8.2 12 3.5z' },
    { tag: 'path', d: 'M20.5 12.6L12 17.3l-8.5-4.7' },
    { tag: 'path', d: 'M20.5 16.6L12 21.3l-8.5-4.7' }
  ],
  folder: [
    {
      tag: 'path',
      d: 'M3.5 7A1.5 1.5 0 0 1 5 5.5h4.2l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5V7z'
    }
  ],
  checkbox: [
    { tag: 'rect', x: 4, y: 4, width: 16, height: 16, rx: 3 },
    { tag: 'path', d: 'M8.5 12.5l2.5 2.5 4.8-5.5' }
  ],
  toggle: [
    { tag: 'rect', x: 3, y: 8, width: 18, height: 8, rx: 4 },
    { tag: 'circle', cx: 15.5, cy: 12, r: 1.8, filled: true }
  ],
  'text-cursor': [
    { tag: 'path', d: 'M8 4h8' },
    { tag: 'path', d: 'M12 4v16' },
    { tag: 'path', d: 'M8 20h8' }
  ],
  shield: [
    { tag: 'path', d: 'M12 3.5l7 2.5v6c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V6l7-2.5z' },
    { tag: 'path', d: 'M9 12l2 2 4-4.5' }
  ],
  history: [
    { tag: 'path', d: 'M4 12a8 8 0 1 0 2.3-5.6L4 8.7' },
    { tag: 'path', d: 'M4 4.5v4.2h4.2' },
    { tag: 'path', d: 'M12 8v4l2.6 1.6' }
  ],
  undo: [
    { tag: 'path', d: 'M8.5 5L4 9.5L8.5 14' },
    { tag: 'path', d: 'M4 9.5h9a6 6 0 0 1 6 6v.5' }
  ],
  redo: [
    { tag: 'path', d: 'M15.5 5L20 9.5L15.5 14' },
    { tag: 'path', d: 'M20 9.5h-9a6 6 0 0 0-6 6v.5' }
  ],
  list: [
    { tag: 'path', d: 'M9 6h11' },
    { tag: 'path', d: 'M9 12h11' },
    { tag: 'path', d: 'M9 18h11' },
    { tag: 'path', d: 'M4.5 6h.01' },
    { tag: 'path', d: 'M4.5 12h.01' },
    { tag: 'path', d: 'M4.5 18h.01' }
  ],
  wand: [
    { tag: 'path', d: 'M5 19L16.5 7.5' },
    { tag: 'path', d: 'M14.5 5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L11 8.5l2.5-1 1-2.5z' },
    { tag: 'path', d: 'M5.5 4.5L6 6l1.5.5L6 7l-.5 1.5L5 7l-1.5-.5L5 6l.5-1.5z' }
  ]
};
