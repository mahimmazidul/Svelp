# Svelp SEO and public site architecture

## Deployment context

- Origin: `https://mahimmazidul.github.io`, base path `/Svelp/` (set by the Pages workflow via `BAL_PAGES_BASE`).
- No server. GitHub Pages serves static files only; the app remains a hash-routed SPA.

## Route structure

Public, indexable, real static HTML (generated at build time by `tools/build_site.mjs` from `tools/site_content.mjs` into `public/`, shipped in `dist/`):

- `/Svelp/` — the app entry. It carries the full homepage metadata (title, description, canonical, OG, Twitter, SoftwareApplication JSON-LD) and an indexable `<noscript>` workflow summary. The app keeps working as before; the empty hash (`/Svelp/` with no `#/…`) shows the indexable product metadata, while any explicit app navigation (`#/projects`, `#/project/…`, `#/scan`, unknown routes) switches to unique, `noindex, nofollow` metadata via `src/app/route_meta.ts`.
- `/Svelp/features/`, `/Svelp/questionnaire-builder/`, `/Svelp/paper-survey-scanner/`, `/Svelp/offline-survey-software/`, `/Svelp/uses/ffq/`, `/Svelp/uses/kap-surveys/`, `/Svelp/uses/likert-surveys/`, `/Svelp/uses/clinical-questionnaires/`, `/Svelp/docs/`, `/Svelp/privacy/`, `/Svelp/about/` — static pages with zero app JavaScript.
- `/Svelp/docs/source-language/` — the complete `docs/source-language.md` rendered to HTML at build time; the Source Mode Help sheet links to it (the PWA precaches it, so the link also works offline once installed).
- `/Svelp/404.html` — GitHub Pages custom 404 (noindex). Unknown paths also remain reachable as the SPA's own not-found route.

App routes (`#/…`) are not crawlable URLs and additionally carry `noindex` at runtime.

## Generation pipeline

- `tools/site_content.mjs` — page content/metadata (single source of truth for public copy).
- `tools/render_site.mjs` — deterministic HTML templates (page, 404, robots.txt, sitemap.xml, CSS).
- `tools/build_site.mjs` — writes into `public/`; runs automatically via the `prebuild` npm script, so every `npm run build` produces fresh static pages in `dist/`.
- All internal links between public pages are relative, so the site works under any base path; canonical/OG/sitemap URLs are absolute to the production origin.

## Metadata rules

- Every public page: unique title (≤65 chars), unique description (50–160 chars), exactly one canonical, `robots: index, follow`, OG + Twitter summary tags, exactly one `h1`, semantic `header/nav/main/footer`.
- Homepage JSON-LD is one conservative `SoftwareApplication` (name, applicationCategory, operatingSystem, description, url). No ratings, reviews, offers, or organization claims anywhere.
- App routes get unique titles/descriptions per area and `noindex, nofollow` at runtime; canonical collapses to the app root.
- `robots.txt` allows all crawlers, points at the sitemap, and disallows `/Svelp/index.html` (the bare SPA shell duplicate).
- `sitemap.xml` lists exactly the 12 public URLs (app root + 11 content pages); no lastmod is emitted because content has no reliable change dates.

## Honest-copy constraints (enforced by tests)

- Never "physically validated", "AI-powered", "machine learning", or similar claims.
- Scanner page states it works with Svelp-generated or matching-geometry forms, not arbitrary forms.
- Clinical page states Svelp is not a medical device and makes no compliance claims.
- Privacy page describes local storage (IndexedDB), no backend, and explicit MAHIM/CSV/JSON export as the only data egress; it makes no legal promises.
- Internal vocabulary never appears in public output (tested).

## Search Console

No verification token is committed. To verify later, either add a `public/google<HASH>.html` file or a `<meta name="google-site-verification">` tag in `index.html` and the page templates, then re-deploy.

## Tests and QA

- `src/test/public_site.test.ts` — generator tests (unique metadata, single canonical/H1, JSON-LD parse and key whitelist, robots/sitemap contents, no internal vocabulary, honest-copy constraints).
- `src/app/route_meta.test.ts` — app-side metadata rules and raw-entry detection.
- `qa/smoke_public_site.mjs` — browser E2E at 360/390/1440: every public page 200, unique title/canonical, one h1, OG, zero app scripts, no horizontal overflow, nav/CTA/footer present, nav links resolve, robots/sitemap served, app entry indexable with product metadata, SPA navigation flips to noindex.
