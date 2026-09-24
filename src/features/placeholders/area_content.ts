import type { IconName } from '../../icons/icon_defs';

export interface AreaContent {
  title: string;
  icon: IconName;
  lead: string;
  bullets: string[];
  note?: { text: string; label: string; href: string };
}

export const shawya_area_content: Record<
  'print' | 'scan' | 'responses' | 'export' | 'settings',
  AreaContent
> = {
  print: {
    title: 'Print',
    icon: 'printer',
    lead:
      'Print output is not part of this release. Svelp will generate print-ready questionnaires directly from the questionnaire definition, and will also support overlaying a definition onto existing PDF forms.',
    bullets: [
      'Native print rendering from the same definition used by Preview',
      'A4 and Letter paper, portrait and landscape',
      'Section breaks, page numbering, and page-safe margins',
      'Machine-readable page identifiers and scanner markers',
      'Overlay mode for externally produced PDF forms'
    ]
  },
  scan: {
    title: 'Scan',
    icon: 'scan',
    lead:
      'Paper capture is not part of this release. A future release will process batches of photographed or scanned pages entirely on this device and queue uncertain answers for review.',
    bullets: [
      'Batch image import with original images preserved',
      'Page identification by questionnaire, version, respondent, and page number',
      'Mark detection with confidence values',
      'Duplicate and missing page detection',
      'Manual review queue, reprocessing, and a full audit trail'
    ]
  },
  responses: {
    title: 'Responses',
    icon: 'table',
    lead:
      'Response capture is not part of this release. Responses will be stored on this device and kept attached to the exact questionnaire version they were collected with.',
    bullets: [
      'Version-locked local response storage',
      'Response tables for review and correction',
      'Uncertain-answer review carried over from scanning',
      'Stable respondent and question identifiers'
    ]
  },
  export: {
    title: 'Export',
    icon: 'download',
    lead:
      'Data export is not part of this release. CSV, XLSX, and JSON exports will be generated from stored responses, together with a codebook derived from the questionnaire definition.',
    bullets: [
      'CSV, XLSX, and JSON output formats',
      'Codebook generation from the questionnaire definition',
      'Version-aware, stable column naming'
    ],
    note: {
      text: 'Project-level backup is available today from the Projects screen.',
      label: 'Go to Projects',
      href: '#/projects'
    }
  },
  settings: {
    title: 'Settings',
    icon: 'sliders',
    lead:
      'Project settings are not part of this release. Paper size, orientation, language, and questionnaire version management will be controlled here.',
    bullets: [
      'Paper size and orientation defaults',
      'Questionnaire language',
      'Version publishing and freezing',
      'Audit log'
    ]
  }
};
