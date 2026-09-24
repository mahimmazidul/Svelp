export type ProjectArea =
  | 'build'
  | 'preview'
  | 'print'
  | 'scan'
  | 'responses'
  | 'export'
  | 'settings';

const BAL_AREA_VALUES: ProjectArea[] = [
  'build',
  'preview',
  'print',
  'scan',
  'responses',
  'export',
  'settings'
];

export function is_project_area(bal_value: string): bal_value is ProjectArea {
  return (BAL_AREA_VALUES as string[]).includes(bal_value);
}

export type AppRoute =
  | { name: 'projects' }
  | { name: 'project'; projectId: string; area: ProjectArea }
  | { name: 'not-found'; path: string };

export function match_route(bal_path: string): AppRoute {
  const bal_trimmed = bal_path.replace(/\/+$/, '') || '/';
  if (bal_trimmed === '/' || bal_trimmed === '/projects') return { name: 'projects' };
  const bal_match = bal_trimmed.match(/^\/project\/([^/]+)(?:\/([a-z-]+))?$/);
  if (bal_match) {
    const bal_area = bal_match[2] ?? 'build';
    if (is_project_area(bal_area)) {
      return {
        name: 'project',
        projectId: decodeURIComponent(bal_match[1]),
        area: bal_area
      };
    }
  }
  return { name: 'not-found', path: bal_path };
}
