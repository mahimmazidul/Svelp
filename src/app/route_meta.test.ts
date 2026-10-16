import { describe, expect, it } from 'vitest';
import { BAL_DEFAULT_META, bal_canonical_for_route, bal_is_raw_app_entry, bal_meta_for_route } from './route_meta';

describe('raw app entry detection', () => {
  it('treats empty hashes as the indexable app entry', () => {
    expect(bal_is_raw_app_entry('')).toBe(true);
    expect(bal_is_raw_app_entry('#')).toBe(true);
    expect(bal_is_raw_app_entry('#/')).toBe(true);
    expect(bal_is_raw_app_entry('#/projects')).toBe(false);
  });
});

describe('route metadata', () => {
  it('marks all application routes noindex', () => {
    for (const bal_area of ['build', 'preview', 'print', 'scan', 'responses', 'export', 'settings']) {
      expect(bal_meta_for_route('project', bal_area).noindex, bal_area).toBe(true);
    }
    expect(bal_meta_for_route('scan', null).noindex).toBe(true);
    expect(bal_meta_for_route('projects', null).noindex).toBe(true);
    expect(bal_meta_for_route('not-found', null).noindex).toBe(true);
  });

  it('gives every application route a unique title and description', () => {
    const bal_metas = ['build', 'preview', 'print', 'scan', 'responses', 'export', 'settings'].map((bal_area) =>
      bal_meta_for_route('project', bal_area)
    );
    const bal_titles = new Set(bal_metas.map((bal_m) => bal_m.title));
    expect(bal_titles.size).toBe(bal_metas.length);
    for (const bal_m of bal_metas) {
      expect(bal_m.title.startsWith('Svelp')).toBe(true);
      expect(bal_m.description.length).toBeGreaterThan(20);
    }
  });

  it('keeps the app entry indexable with the product metadata', () => {
    expect(BAL_DEFAULT_META.noindex).toBe(false);
    expect(bal_meta_for_route('projects', null).title).toBe('Svelp — Projects');
    expect(bal_canonical_for_route('projects')).toBe('https://mahimmazidul.github.io/Svelp/');
    expect(bal_canonical_for_route('project')).toBe('https://mahimmazidul.github.io/Svelp/');
  });
});
