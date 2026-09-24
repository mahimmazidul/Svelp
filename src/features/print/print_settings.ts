import type {
  PrintDensity,
  PrintFontFamily,
  PrintIdentifierConfig,
  PrintLogoConfig,
  PrintMarkerConfig,
  PrintSettings,
  PrintThemeConfig,
  PrintThemeName
} from '../../models/types';
import { BAL_DEFAULT_MARGINS, BAL_MIN_MARGIN_MM, type PrintMargins } from './print_paper';

export const BAL_PRINT_THEME_NAMES: PrintThemeName[] = [
  'academic',
  'clinical',
  'minimal',
  'compact',
  'institutional'
];

export const BAL_PRINT_THEME_LABELS: Record<PrintThemeName, string> = {
  academic: 'Academic',
  clinical: 'Clinical',
  minimal: 'Minimal',
  compact: 'Compact',
  institutional: 'Institutional'
};

export const BAL_PRINT_FONT_LABELS: Record<PrintFontFamily, string> = {
  helvetica: 'Helvetica (sans)',
  times: 'Times (serif)',
  courier: 'Courier (mono)'
};

const BAL_THEME_BASE: Record<PrintThemeName, Omit<PrintThemeConfig, 'name'>> = {
  academic: { fontFamily: 'times', baseFontSize: 11, headingScale: 1.25, lineWeight: 0.25 },
  clinical: { fontFamily: 'helvetica', baseFontSize: 10.5, headingScale: 1.2, lineWeight: 0.3 },
  minimal: { fontFamily: 'helvetica', baseFontSize: 10.5, headingScale: 1.1, lineWeight: 0.2 },
  compact: { fontFamily: 'helvetica', baseFontSize: 9.5, headingScale: 1.15, lineWeight: 0.2 },
  institutional: { fontFamily: 'helvetica', baseFontSize: 11, headingScale: 1.3, lineWeight: 0.35 }
};

export const BAL_DENSITY_LABELS: Record<PrintDensity, string> = {
  compact: 'Compact',
  standard: 'Standard',
  comfortable: 'Comfortable'
};

const BAL_DENSITY_ROW_SPACING: Record<PrintDensity, number> = {
  compact: 4.4,
  standard: 5.6,
  comfortable: 7.2
};

const BAL_DENSITY_QUESTION_SPACING: Record<PrintDensity, number> = {
  compact: 5,
  standard: 6.5,
  comfortable: 9
};

export interface PrintPreset {
  name: string;
  label: string;
  paperSize: 'a4' | 'letter';
  orientation: 'portrait' | 'landscape';
  themeName: PrintThemeName;
  density: PrintDensity;
  margins: PrintMargins;
  scannerMode: boolean;
}

export const BAL_PRINT_PRESETS: PrintPreset[] = [
  {
    name: 'academic-a4',
    label: 'Academic A4',
    paperSize: 'a4',
    orientation: 'portrait',
    themeName: 'academic',
    density: 'standard',
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    scannerMode: false
  },
  {
    name: 'compact-a4',
    label: 'Compact A4',
    paperSize: 'a4',
    orientation: 'portrait',
    themeName: 'compact',
    density: 'compact',
    margins: { top: 14, right: 13, bottom: 14, left: 13 },
    scannerMode: false
  },
  {
    name: 'clinical-a4',
    label: 'Clinical A4',
    paperSize: 'a4',
    orientation: 'portrait',
    themeName: 'clinical',
    density: 'standard',
    margins: { top: 18, right: 16, bottom: 18, left: 16 },
    scannerMode: true
  },
  {
    name: 'letter-standard',
    label: 'Letter Standard',
    paperSize: 'letter',
    orientation: 'portrait',
    themeName: 'institutional',
    density: 'standard',
    margins: { top: 18, right: 18, bottom: 18, left: 18 },
    scannerMode: false
  }
];

function bal_clamp(bal_value: number, bal_min: number, bal_max: number, bal_fallback: number): number {
  if (typeof bal_value !== 'number' || !Number.isFinite(bal_value)) return bal_fallback;
  return Math.min(bal_max, Math.max(bal_min, bal_value));
}

function bal_clean_text(bal_value: unknown, bal_fallback: string): string {
  return typeof bal_value === 'string' ? bal_value : bal_fallback;
}

function bal_flag(bal_value: unknown, bal_fallback: boolean): boolean {
  return typeof bal_value === 'boolean' ? bal_value : bal_fallback;
}

export function bal_theme_config(bal_name: PrintThemeName): PrintThemeConfig {
  return { name: bal_name, ...BAL_THEME_BASE[bal_name] };
}

export function bal_default_print_settings(bal_theme: PrintThemeName = 'academic'): PrintSettings {
  return {
    margins: { ...BAL_DEFAULT_MARGINS },
    theme: bal_theme_config(bal_theme),
    density: 'standard',
    questionSpacing: BAL_DENSITY_QUESTION_SPACING.standard,
    header: {
      showTitle: true,
      showInstitution: false,
      institution: '',
      showStudyCode: false,
      studyCode: '',
      showVersion: true,
      showRespondentId: true,
      respondentIdLabel: 'Respondent ID'
    },
    footer: {
      showPageNumbers: true,
      showStudyCode: false,
      confidentialityNote: '',
      showHumanIdentifier: true
    },
    showMachineIdentifier: true,
    scannerMode: false,
    marker: { diameterMm: 4.8, regionPaddingMm: 1.4 },
    identifier: { sizeMm: 20, errorCorrection: 'M' },
    respondentArea: { enabled: true, label: 'Respondent ID' },
    logo: null
  };
}

export function bal_apply_preset(bal_preset: PrintPreset): PrintSettings {
  const bal_settings = bal_default_print_settings(bal_preset.themeName);
  bal_settings.margins = { ...bal_preset.margins };
  bal_settings.density = bal_preset.density;
  bal_settings.questionSpacing = BAL_DENSITY_QUESTION_SPACING[bal_preset.density];
  bal_settings.scannerMode = bal_preset.scannerMode;
  return bal_settings;
}

function bal_normalize_margins(bal_raw: unknown): PrintMargins {
  const bal_source = bal_raw && typeof bal_raw === 'object' ? (bal_raw as Record<string, unknown>) : {};
  const bal_clamp_margin = (bal_value: unknown, bal_fallback: number) =>
    bal_clamp(bal_value as number, BAL_MIN_MARGIN_MM, 40, bal_fallback);
  return {
    top: bal_clamp_margin(bal_source.top, BAL_DEFAULT_MARGINS.top),
    right: bal_clamp_margin(bal_source.right, BAL_DEFAULT_MARGINS.right),
    bottom: bal_clamp_margin(bal_source.bottom, BAL_DEFAULT_MARGINS.bottom),
    left: bal_clamp_margin(bal_source.left, BAL_DEFAULT_MARGINS.left)
  };
}

function bal_normalize_theme(bal_raw: unknown): PrintThemeConfig {
  const bal_source = bal_raw && typeof bal_raw === 'object' ? (bal_raw as Record<string, unknown>) : {};
  const bal_name = BAL_PRINT_THEME_NAMES.includes(bal_source.name as PrintThemeName)
    ? (bal_source.name as PrintThemeName)
    : 'academic';
  const bal_base = BAL_THEME_BASE[bal_name];
  const bal_family = ['helvetica', 'times', 'courier'].includes(bal_source.fontFamily as string)
    ? (bal_source.fontFamily as PrintFontFamily)
    : bal_base.fontFamily;
  return {
    name: bal_name,
    fontFamily: bal_family,
    baseFontSize: bal_clamp(bal_source.baseFontSize as number, 8, 14, bal_base.baseFontSize),
    headingScale: bal_clamp(bal_source.headingScale as number, 1.05, 1.6, bal_base.headingScale),
    lineWeight: bal_clamp(bal_source.lineWeight as number, 0.15, 0.6, bal_base.lineWeight)
  };
}

function bal_normalize_marker(bal_raw: unknown): PrintMarkerConfig {
  const bal_source = bal_raw && typeof bal_raw === 'object' ? (bal_raw as Record<string, unknown>) : {};
  return {
    diameterMm: bal_clamp(bal_source.diameterMm as number, 3.6, 6, 4.8),
    regionPaddingMm: bal_clamp(bal_source.regionPaddingMm as number, 0.8, 3, 1.4)
  };
}

function bal_normalize_identifier(bal_raw: unknown): PrintIdentifierConfig {
  const bal_source = bal_raw && typeof bal_raw === 'object' ? (bal_raw as Record<string, unknown>) : {};
  const bal_ec = ['L', 'M', 'Q', 'H'].includes(bal_source.errorCorrection as string)
    ? (bal_source.errorCorrection as PrintIdentifierConfig['errorCorrection'])
    : 'M';
  return {
    sizeMm: bal_clamp(bal_source.sizeMm as number, 12, 30, 20),
    errorCorrection: bal_ec
  };
}

function bal_normalize_logo(bal_raw: unknown): PrintLogoConfig | null {
  const bal_source = bal_raw && typeof bal_raw === 'object' ? (bal_raw as Record<string, unknown>) : null;
  if (!bal_source || typeof bal_source.dataUrl !== 'string' || bal_source.dataUrl.length === 0) return null;
  return {
    dataUrl: bal_source.dataUrl,
    widthMm: bal_clamp(bal_source.widthMm as number, 8, 60, 24)
  };
}

export function bal_normalize_print_settings(bal_raw: unknown): PrintSettings {
  const bal_defaults = bal_default_print_settings();
  if (!bal_raw || typeof bal_raw !== 'object') return bal_defaults;
  const bal_source = bal_raw as Record<string, unknown>;
  const bal_header = (bal_source.header && typeof bal_source.header === 'object'
    ? bal_source.header
    : {}) as Record<string, unknown>;
  const bal_footer = (bal_source.footer && typeof bal_source.footer === 'object'
    ? bal_source.footer
    : {}) as Record<string, unknown>;
  const bal_respondent = (bal_source.respondentArea && typeof bal_source.respondentArea === 'object'
    ? bal_source.respondentArea
    : {}) as Record<string, unknown>;
  const bal_density = ['compact', 'standard', 'comfortable'].includes(bal_source.density as string)
    ? (bal_source.density as PrintDensity)
    : 'standard';
  return {
    margins: bal_normalize_margins(bal_source.margins),
    theme: bal_normalize_theme(bal_source.theme),
    density: bal_density,
    questionSpacing: bal_clamp(
      bal_source.questionSpacing as number,
      2,
      14,
      BAL_DENSITY_QUESTION_SPACING[bal_density]
    ),
    header: {
      showTitle: bal_flag(bal_header.showTitle, true),
      showInstitution: bal_flag(bal_header.showInstitution, false),
      institution: bal_clean_text(bal_header.institution, ''),
      showStudyCode: bal_flag(bal_header.showStudyCode, false),
      studyCode: bal_clean_text(bal_header.studyCode, ''),
      showVersion: bal_flag(bal_header.showVersion, true),
      showRespondentId: bal_flag(bal_header.showRespondentId, true),
      respondentIdLabel: bal_clean_text(bal_header.respondentIdLabel, 'Respondent ID')
    },
    footer: {
      showPageNumbers: bal_flag(bal_footer.showPageNumbers, true),
      showStudyCode: bal_flag(bal_footer.showStudyCode, false),
      confidentialityNote: bal_clean_text(bal_footer.confidentialityNote, ''),
      showHumanIdentifier: bal_flag(bal_footer.showHumanIdentifier, true)
    },
    showMachineIdentifier: bal_flag(bal_source.showMachineIdentifier, true),
    scannerMode: bal_flag(bal_source.scannerMode, false),
    marker: bal_normalize_marker(bal_source.marker),
    identifier: bal_normalize_identifier(bal_source.identifier),
    respondentArea: {
      enabled: bal_flag(bal_respondent.enabled, true),
      label: bal_clean_text(bal_respondent.label, 'Respondent ID')
    },
    logo: bal_normalize_logo(bal_source.logo)
  };
}

export function bal_row_spacing(bal_settings: PrintSettings): number {
  return BAL_DENSITY_ROW_SPACING[bal_settings.density];
}

export function bal_band_heights(
  bal_settings: PrintSettings
): { header: number | null; footer: number | null } {
  const bal_header_parts = [
    bal_settings.header.showTitle,
    bal_settings.header.showInstitution && bal_settings.header.institution.trim().length > 0,
    bal_settings.header.showVersion,
    bal_settings.header.showStudyCode && bal_settings.header.studyCode.trim().length > 0,
    bal_settings.header.showRespondentId && bal_settings.respondentArea.enabled
  ];
  const bal_header = bal_header_parts.some(Boolean) ? 12 : null;
  const bal_footer_parts = [
    bal_settings.footer.showPageNumbers,
    bal_settings.footer.showStudyCode && bal_settings.header.studyCode.trim().length > 0,
    bal_settings.footer.confidentialityNote.trim().length > 0,
    bal_settings.footer.showHumanIdentifier && bal_settings.showMachineIdentifier
  ];
  let bal_footer = bal_footer_parts.some(Boolean) ? 10 : 0;
  if (bal_settings.showMachineIdentifier) {
    bal_footer = Math.max(bal_footer, bal_settings.identifier.sizeMm + 2.5);
  }
  return { header: bal_header, footer: bal_footer > 0 ? bal_footer : null };
}
