import { writable } from 'svelte/store';
import { match_route, type AppRoute } from './routes';

function bal_current_path(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

function bal_route_from_hash(): AppRoute {
  return match_route(bal_current_path());
}

const ken_pori_store = writable<AppRoute>(bal_route_from_hash());

if (!window.location.hash) {
  window.location.replace('#/projects');
}

window.addEventListener('hashchange', () => {
  ken_pori_store.set(bal_route_from_hash());
});

export const route_store = {
  subscribe: ken_pori_store.subscribe
};

export function navigate(bal_path: string): void {
  window.location.hash = bal_path;
}

export function projects_href(): string {
  return '#/projects';
}

export function project_area_href(bal_project_id: string, bal_area: string): string {
  return `#/project/${encodeURIComponent(bal_project_id)}/${bal_area}`;
}
