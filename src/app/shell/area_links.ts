import type { IconName } from '../../icons/icon_defs';
import type { ProjectArea } from '../router/routes';

export interface AreaLink {
  area: ProjectArea;
  label: string;
  icon: IconName;
}

export const BAL_AREA_LINKS: AreaLink[] = [
  { area: 'build', label: 'Build', icon: 'layers' },
  { area: 'preview', label: 'Preview', icon: 'eye' },
  { area: 'print', label: 'Print', icon: 'printer' },
  { area: 'scan', label: 'Scan', icon: 'scan' },
  { area: 'responses', label: 'Responses', icon: 'table' },
  { area: 'export', label: 'Export', icon: 'download' },
  { area: 'settings', label: 'Settings', icon: 'sliders' }
];
