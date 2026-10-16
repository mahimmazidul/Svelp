export interface bal_RouteMeta {
  title: string;
  description: string;
  noindex: boolean;
}

const BAL_SITE_ORIGIN = 'https://mahimmazidul.github.io';
export const BAL_SITE_BASE = '/Svelp';

const BAL_META: Record<string, bal_RouteMeta> = {
  projects: {
    title: 'Svelp — Projects',
    description: 'Your local Svelp projects. Questionnaires are stored on this device.',
    noindex: true
  },
  scan: {
    title: 'Svelp — Scan',
    description: 'Import completed paper forms and run local, deterministic recognition.',
    noindex: true
  },
  build: {
    title: 'Svelp — Build',
    description: 'Build questionnaires visually or in Svelp source.',
    noindex: true
  },
  preview: {
    title: 'Svelp — Preview',
    description: 'Preview the digital questionnaire.',
    noindex: true
  },
  print: {
    title: 'Svelp — Print',
    description: 'Generate scanner-ready PDF print files and print batches.',
    noindex: true
  },
  responses: {
    title: 'Svelp — Data',
    description: 'Review scanned responses and export research data.',
    noindex: true
  },
  export: {
    title: 'Svelp — Export',
    description: 'Export responses and codebooks.',
    noindex: true
  },
  settings: {
    title: 'Svelp — Settings',
    description: 'Project settings and storage tools.',
    noindex: true
  }
};

export const BAL_DEFAULT_META: bal_RouteMeta = {
  title: 'Svelp — Survey Builder & Paper Questionnaire Scanner',
  description:
    'Build research questionnaires, generate scanner-ready paper forms, batch-process completed surveys, review uncertain responses, and export structured data with an offline-first workflow.',
  noindex: false
};

export function bal_meta_for_route(bal_route_name: string, bal_area: string | null): bal_RouteMeta {
  if (bal_route_name === 'project' && bal_area !== null) {
    return BAL_META[bal_area] ?? { title: 'Svelp', description: BAL_DEFAULT_META.description, noindex: true };
  }
  if (bal_route_name === 'project') return BAL_META.build;
  if (bal_route_name === 'projects') return BAL_META.projects;
  if (bal_route_name === 'scan') return BAL_META.scan;
  if (bal_route_name === 'not-found') {
    return { title: 'Svelp — Page not found', description: 'This Svelp page does not exist.', noindex: true };
  }
  return BAL_DEFAULT_META;
}

export function bal_canonical_for_route(bal_route_name: string): string {
  if (bal_route_name === 'projects' || bal_route_name === 'project') return `${BAL_SITE_ORIGIN}${BAL_SITE_BASE}/`;
  return `${BAL_SITE_ORIGIN}${BAL_SITE_BASE}/`;
}

function bal_upsert_meta(bal_selector: string, bal_apply: (bal_el: HTMLMetaElement) => void): void {
  let bal_el = document.head.querySelector<HTMLMetaElement>(bal_selector);
  if (!bal_el) {
    bal_el = document.createElement('meta');
    const bal_match = bal_selector.match(/\[([a-z-]+)="([^"]+)"\]/);
    if (bal_match) bal_el.setAttribute(bal_match[1], bal_match[2]);
    document.head.appendChild(bal_el);
  }
  bal_apply(bal_el);
}

function bal_upsert_link(bal_rel: string, bal_href: string): void {
  let bal_el = document.head.querySelector<HTMLLinkElement>(`link[rel="${bal_rel}"]`);
  if (!bal_el) {
    bal_el = document.createElement('link');
    bal_el.rel = bal_rel;
    document.head.appendChild(bal_el);
  }
  bal_el.href = bal_href;
}

export function bal_apply_route_meta(bal_meta: bal_RouteMeta, bal_route_name: string): void {
  document.title = bal_meta.title;
  bal_upsert_meta('meta[name="description"]', (bal_el) => bal_el.setAttribute('content', bal_meta.description));
  bal_upsert_meta('meta[name="robots"]', (bal_el) =>
    bal_el.setAttribute('content', bal_meta.noindex ? 'noindex, nofollow' : 'index, follow')
  );
  bal_upsert_meta('meta[property="og:title"]', (bal_el) => bal_el.setAttribute('content', bal_meta.title));
  bal_upsert_meta('meta[property="og:description"]', (bal_el) => bal_el.setAttribute('content', bal_meta.description));
  bal_upsert_meta('meta[property="og:url"]', (bal_el) => bal_el.setAttribute('content', bal_canonical_for_route(bal_route_name)));
  bal_upsert_link('canonical', bal_canonical_for_route(bal_route_name));
}
