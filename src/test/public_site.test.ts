import { describe, expect, it } from 'vitest';
import { BAL_PAGES, BAL_404, BAL_SITE_BASE, BAL_SITE_ORIGIN } from '../../tools/site_content.mjs';
import {
  BAL_SITE_CSS,
  bal_render_404,
  bal_render_public_page,
  bal_render_robots,
  bal_render_sitemap
} from '../../tools/render_site.mjs';

const BAL_INTERNAL_TOKENS = [
  'bal_',
  'dhon_',
  'ken_pori',
  'biriyani',
  'naksha',
  'shobdo',
  'bhul',
  'bani_',
  'lekha_',
  'boble',
  'kori_'
];

interface bal_Harness {
  bal_html: string;
  bal_canonical: string;
}

function bal_page_html(bal_slug: string): string {
  const bal_page = BAL_PAGES.find((bal_p) => bal_p.slug === bal_slug);
  if (!bal_page) throw new Error(`unknown page ${bal_slug}`);
  return bal_render_public_page(bal_page);
}

function bal_all_static_html(): bal_Harness[] {
  return BAL_PAGES.filter((bal_p) => bal_p.slug).map((bal_p) => ({
    bal_html: bal_render_public_page(bal_p),
    bal_canonical: `${BAL_SITE_ORIGIN}${BAL_SITE_BASE}/${bal_p.slug}/`
  }));
}

describe('public site pages', () => {
  it('gives every page a unique, descriptive title and meta description', () => {
    const bal_titles = BAL_PAGES.map((bal_p) => bal_p.title);
    expect(new Set(bal_titles).size).toBe(bal_titles.length);
    const bal_descs = BAL_PAGES.map((bal_p) => bal_p.description);
    expect(new Set(bal_descs).size).toBe(bal_descs.length);
    for (const bal_p of BAL_PAGES) {
      expect(bal_p.title.length, bal_p.slug).toBeLessThanOrEqual(65);
      expect(bal_p.description.length, bal_p.slug).toBeGreaterThanOrEqual(50);
      expect(bal_p.description.length, bal_p.slug).toBeLessThanOrEqual(160);
      expect(bal_p.h1.length, bal_p.slug).toBeGreaterThan(0);
    }
  });

  it('renders exactly one canonical, robots index, and one h1 per page', () => {
    for (const { bal_html, bal_canonical } of bal_all_static_html()) {
      expect((bal_html.match(/rel="canonical"/g) ?? []).length).toBe(1);
      expect(bal_html).toContain(`href="${bal_canonical}"`);
      expect(bal_html).toContain('<meta name="robots" content="index, follow" />');
      expect((bal_html.match(/<h1[ >]/g) ?? []).length).toBe(1);
    }
  });

  it('renders Open Graph and Twitter metadata on every page', () => {
    for (const { bal_html } of bal_all_static_html()) {
      expect(bal_html).toContain('property="og:title"');
      expect(bal_html).toContain('property="og:description"');
      expect(bal_html).toContain('property="og:url"');
      expect(bal_html).toContain('name="twitter:card" content="summary"');
      expect(bal_html).not.toContain('og:image');
    }
  });

  it('parses the conservative SoftwareApplication JSON-LD on the homepage only', () => {
    const bal_home = bal_page_html('');
    expect(bal_home).toContain('"@type":"SoftwareApplication"');
    const bal_ld = JSON.parse(
      bal_home.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)![1]
    ) as Record<string, string>;
    expect(Object.keys(bal_ld).sort()).toEqual([
      '@context',
      '@type',
      'applicationCategory',
      'description',
      'name',
      'operatingSystem',
      'url'
    ]);
    expect(bal_ld.name).toBe('Svelp');
    for (const { bal_html } of bal_all_static_html()) {
      const bal_ld_block = bal_html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? '';
      expect(bal_ld_block).not.toContain('aggregateRating');
      expect(bal_ld_block).not.toContain('"Review"');
      expect(bal_ld_block).not.toContain('"Offer"');
    }
  });

  it('renders public navigation and an app CTA without app scripts', () => {
    for (const { bal_html } of bal_all_static_html()) {
      expect(bal_html).toContain('Features');
      expect(bal_html).toContain('Docs');
      expect(bal_html).toContain('About');
      expect(bal_html).toContain(`href="${BAL_SITE_BASE}/"`);
      expect(bal_html).not.toMatch(/<script(?![^>]*ld\+json)/);
      expect(bal_html).not.toContain('/src/');
    }
  });

  it('keeps internal vocabulary out of public output', () => {
    const bal_everything = [
      ...bal_all_static_html().map((bal_h) => bal_html_tokens(bal_h.bal_html)),
      BAL_SITE_CSS,
      bal_render_robots(),
      bal_render_sitemap(BAL_PAGES, '')
    ].join('\n');
    for (const bal_token of BAL_INTERNAL_TOKENS) {
      expect(bal_everything.toLowerCase()).not.toContain(bal_token);
    }
  });

  it('renders the 404 page as noindex', () => {
    const bal_html = bal_render_404(BAL_404);
    expect(bal_html).toContain('noindex');
    expect(bal_html).toContain('Page not found');
  });
});

function bal_html_tokens(bal_html: string): string {
  return bal_html.replace(/<[^>]+>/g, ' ');
}

describe('robots and sitemap', () => {
  it('allows crawling, keeps the sitemap absolute, and does not fake lastmod', () => {
    const bal_robots = bal_render_robots();
    expect(bal_robots).toContain('Allow: /');
    expect(bal_robots).toContain(`Sitemap: ${BAL_SITE_ORIGIN}${BAL_SITE_BASE}/sitemap.xml`);
    const bal_sitemap = bal_render_sitemap(BAL_PAGES, '');
    expect(bal_sitemap).toContain('<loc>https://mahimmazidul.github.io/Svelp/</loc>');
    expect(bal_sitemap).not.toContain('<lastmod');
  });

  it('lists exactly the public pages and never project routes', () => {
    const bal_sitemap = bal_render_sitemap(BAL_PAGES, '');
    const bal_locs = [...bal_sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((bal_m) => bal_m[1]);
    expect(bal_locs.length).toBe(BAL_PAGES.length);
    expect(new Set(bal_locs).size).toBe(bal_locs.length);
    for (const bal_loc of bal_locs) {
      expect(bal_loc.startsWith(`${BAL_SITE_ORIGIN}${BAL_SITE_BASE}/`)).toBe(true);
      expect(bal_loc).not.toMatch(/#|\?|\/(projects|print|scan|responses|export|settings)\b/);
    }
    for (const bal_slug of ['features', 'questionnaire-builder', 'paper-survey-scanner', 'offline-survey-software', 'docs', 'privacy', 'about', 'uses/ffq', 'uses/kap-surveys', 'uses/likert-surveys', 'uses/clinical-questionnaires']) {
      expect(bal_locs).toContain(`${BAL_SITE_ORIGIN}${BAL_SITE_BASE}/${bal_slug}/`);
    }
  });
});

describe('public page content claims', () => {
  it('never claims physical validation or AI scanning', () => {
    for (const { bal_html } of bal_all_static_html()) {
      const bal_text = bal_html_tokens(bal_html).toLowerCase();
      expect(bal_text).not.toContain('physically validated');
      expect(bal_text).not.toContain('ai-powered');
      expect(bal_text).not.toContain('artificial intelligence');
      expect(bal_text).not.toContain('machine learning');
    }
  });

  it('describes the scanner honestly on the scanner page', () => {
    const bal_text = bal_html_tokens(bal_page_html('paper-survey-scanner'));
    expect(bal_text).toContain('deterministic');
    expect(bal_text).toContain('generated by Svelp');
    expect(bal_text).toContain('review');
  });

  it('avoids clinical and legal claims on the clinical and privacy pages', () => {
    expect(bal_html_tokens(bal_page_html('uses/clinical-questionnaires'))).toContain('not a medical device');
    expect(bal_html_tokens(bal_page_html('privacy'))).toContain('IndexedDB');
  });
});
