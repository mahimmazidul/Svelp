import { BAL_NAV_LINKS, BAL_SITE_BASE, BAL_SITE_ORIGIN } from './site_content.mjs';


function bal_escape(bal_text) {
  return bal_text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function bal_json_ld(bal_page) {
  return JSON.stringify(bal_page.jsonLd).replace(/</g, '\\u003c');
}

function bal_doc_href(bal_href, bal_prefix) {
  return bal_href === null ? `${bal_prefix}docs/` : `${bal_prefix}${bal_href.replace(/^\//, '')}`;
}

function bal_prefix_for(bal_slug) {
  const bal_depth = bal_slug.split('/').filter(Boolean).length;
  return '../'.repeat(bal_depth);
}

function bal_section_html(bal_section, bal_prefix) {
  const bal_out = [`      <section class="card">`, `        <h2>${bal_escape(bal_section.h2)}</h2>`];
  for (const bal_p of bal_section.paras ?? []) {
    bal_out.push(`        <p>${bal_escape(bal_p)}</p>`);
  }
  if (bal_section.steps) {
    bal_out.push('        <ol class="steps">');
    for (const [bal_head, bal_body] of bal_section.steps) {
      bal_out.push(`          <li><strong>${bal_escape(bal_head)}</strong><span>${bal_escape(bal_body)}</span></li>`);
    }
    bal_out.push('        </ol>');
  }
  if (bal_section.list) {
    bal_out.push('        <ul>');
    for (const bal_item of bal_section.list) {
      bal_out.push(`          <li>${bal_escape(bal_item)}</li>`);
    }
    bal_out.push('        </ul>');
  }
  if (bal_section.doclinks) {
    bal_out.push('        <ul class="doclinks">');
    for (const [bal_head, bal_body, bal_href] of bal_section.doclinks) {
      bal_out.push(
        `          <li><a href="${bal_doc_href(bal_href, bal_prefix)}"><strong>${bal_escape(bal_head)}</strong></a><span>${bal_escape(bal_body)}</span></li>`
      );
    }
    bal_out.push('        </ul>');
  }
  if (bal_section.code) {
    bal_out.push(`        <pre><code>${bal_escape(bal_section.code.trim())}</code></pre>`);
  }
  if (bal_section.cta) {
    bal_out.push(
      `        <div class="cta-row"><a class="cta" href="${bal_prefix}">Open Svelp</a><a class="cta secondary" href="${bal_prefix}docs/">Read the docs</a></div>`
    );
  }
  bal_out.push('      </section>');
  return bal_out.join('\n');
}

export function bal_render_public_page(bal_page) {
  const bal_canonical = `${BAL_SITE_ORIGIN}${BAL_SITE_BASE}/${bal_page.slug ? bal_page.slug + '/' : ''}`;
  const bal_url = bal_canonical;
  const bal_prefix = bal_prefix_for(bal_page.slug);
  const bal_nav = BAL_NAV_LINKS.map(
    (bal_link) =>
      `          <a href="${bal_prefix}${bal_link.href.slice(1)}"${
        bal_page.slug.startsWith(bal_link.href.slice(1, -1)) ? ' aria-current="page"' : ''
      }>${bal_link.label}</a>`
  ).join('\n');
  const bal_sections = (bal_page.sections ?? []).map((bal_section) => bal_section_html(bal_section, bal_prefix)).join('\n');
  const bal_json = bal_page.jsonLd
    ? `    <script type="application/ld+json">\n${bal_json_ld(bal_page)}\n    </script>\n`
    : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${bal_escape(bal_page.title)}</title>
    <meta name="description" content="${bal_escape(bal_page.description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${bal_canonical}" />
    <meta name="theme-color" content="#ffffff" />
    <link rel="icon" type="image/svg+xml" href="${bal_prefix}favicon.svg" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Svelp" />
    <meta property="og:title" content="${bal_escape(bal_page.ogTitle ?? bal_page.title)}" />
    <meta property="og:description" content="${bal_escape(bal_page.ogDescription ?? bal_page.description)}" />
    <meta property="og:url" content="${bal_url}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${bal_escape(bal_page.ogTitle ?? bal_page.title)}" />
    <meta name="twitter:description" content="${bal_escape(bal_page.ogDescription ?? bal_page.description)}" />
${bal_json}    <link rel="stylesheet" href="${bal_prefix}site.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="wrap header-row">
        <a class="brand" href="${bal_prefix}">Svelp</a>
        <nav aria-label="Public site">
${bal_nav}
        </nav>
        <a class="cta small" href="${bal_prefix}">Open Svelp</a>
      </div>
    </header>
    <main class="wrap">
      <div class="hero">
        <h1>${bal_escape(bal_page.h1)}</h1>
        <p class="lede">${bal_escape(bal_page.lede)}</p>
      </div>
${bal_sections}
    </main>
    <footer class="site-footer">
      <div class="wrap footer-row">
        <span>Svelp — offline-first research questionnaires.</span>
        <a href="${bal_prefix}">Open the app</a>
        <a href="${bal_prefix}docs/">Docs</a>
        <a href="${bal_prefix}privacy/">Privacy</a>
      </div>
    </footer>
  </body>
</html>
`;
}

export function bal_render_404(bal_404) {
  const bal_prefix = '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${bal_escape(bal_404.title)}</title>
    <meta name="description" content="${bal_escape(bal_404.description)}" />
    <meta name="robots" content="noindex, follow" />
    <link rel="canonical" href="${BAL_SITE_ORIGIN}${BAL_SITE_BASE}/404.html" />
    <link rel="icon" type="image/svg+xml" href="${bal_prefix}favicon.svg" />
    <link rel="stylesheet" href="${bal_prefix}site.css" />
  </head>
  <body>
    <main class="wrap wrap-narrow notfound">
      <h1>Page not found</h1>
      <p>This page does not exist. It may have moved, or the address may be wrong.</p>
      <div class="cta-row">
        <a class="cta" href="${bal_prefix}">Go to the homepage</a>
        <a class="cta secondary" href="${bal_prefix}docs/">Read the docs</a>
      </div>
    </main>
  </body>
</html>
`;
}

export function bal_render_robots() {
  return `User-agent: *
Allow: /
Disallow: ${BAL_SITE_BASE}/index.html

Sitemap: ${BAL_SITE_ORIGIN}${BAL_SITE_BASE}/sitemap.xml
`;
}

export function bal_render_sitemap(bal_pages) {
  const bal_entries = bal_pages
    .map((bal_page) => {
      const bal_loc = `${BAL_SITE_ORIGIN}${BAL_SITE_BASE}/${bal_page.slug ? bal_page.slug + '/' : ''}`;
      return `  <url>
    <loc>${bal_loc}</loc>
  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${bal_entries}
</urlset>
`;
}

export const BAL_SITE_CSS = `:root { --ink: #16233b; --muted: #5b6472; --line: #dfe3e9; --accent: #2438c6; --bg: #ffffff; --card: #f7f8fa; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; color: var(--ink); background: var(--bg); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Bengali", "Hind Siliguri", sans-serif; }
.wrap { max-width: 64rem; margin: 0 auto; padding: 0 1.25rem; }
.wrap-narrow { max-width: 40rem; }
.site-header { border-bottom: 1px solid var(--line); background: var(--bg); }
.header-row { display: flex; align-items: center; gap: 1rem; min-height: 3.5rem; flex-wrap: wrap; padding-top: 0.5rem; padding-bottom: 0.5rem; }
.brand { font-weight: 700; font-size: 1.05rem; color: var(--ink); text-decoration: none; letter-spacing: 0.01em; }
.site-header nav { display: flex; gap: 0.9rem; flex-wrap: wrap; }
.site-header nav a { color: var(--muted); text-decoration: none; font-size: 0.95rem; padding: 0.35rem 0.2rem; }
.site-header nav a:hover, .site-header nav a[aria-current="page"] { color: var(--accent); }
.hero { padding: 2.5rem 0 1rem; }
h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 0.75rem; }
.lede { font-size: 1.1rem; color: var(--muted); margin: 0; max-width: 46rem; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 1.25rem 1.4rem; margin: 1rem 0 1.4rem; }
.card h2 { font-size: 1.15rem; margin: 0 0 0.6rem; }
.card p { margin: 0.4rem 0; }
.card ul, .card ol { margin: 0.4rem 0; padding-left: 1.3rem; }
.card li { margin: 0.3rem 0; }
ol.steps { list-style: none; padding-left: 0; counter-reset: step; }
ol.steps li { counter-increment: step; padding: 0.5rem 0 0.5rem 2.4rem; position: relative; }
ol.steps li::before { content: counter(step); position: absolute; left: 0; top: 0.55rem; width: 1.6rem; height: 1.6rem; border-radius: 50%; background: var(--accent); color: #fff; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; justify-content: center; }
ol.steps li strong { display: block; }
ol.steps li span { color: var(--muted); }
ul.doclinks { list-style: none; padding-left: 0; }
ul.doclinks li { padding: 0.45rem 0; border-bottom: 1px solid var(--line); }
ul.doclinks li:last-child { border-bottom: 0; }
ul.doclinks a { color: var(--accent); text-decoration: none; font-weight: 600; }
ul.doclinks a:hover { text-decoration: underline; }
ul.doclinks span { display: block; color: var(--muted); font-size: 0.95rem; }
pre { background: #101725; color: #e8edf5; padding: 1rem 1.1rem; border-radius: 8px; overflow-x: auto; font-size: 0.85rem; line-height: 1.5; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.cta-row { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem; }
.cta { display: inline-block; background: var(--accent); color: #fff; padding: 0.65rem 1.2rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.95rem; min-height: 44px; line-height: 1.4; }
.cta.secondary { background: transparent; color: var(--accent); border: 1px solid var(--accent); }
.cta.small { padding: 0.4rem 0.9rem; min-height: 36px; }
.cta:hover { filter: brightness(1.08); }
.site-footer { border-top: 1px solid var(--line); margin-top: 2rem; }
.footer-row { display: flex; gap: 1.2rem; flex-wrap: wrap; align-items: center; padding: 1.1rem 1.25rem; color: var(--muted); font-size: 0.9rem; }
.footer-row a { color: var(--muted); }
.notfound { padding: 4rem 1.25rem; }
@media (max-width: 700px) {
  h1 { font-size: 1.6rem; }
  .hero { padding-top: 1.8rem; }
  .header-row { gap: 0.6rem; }
  .site-header nav { gap: 0.7rem; }
  .card { padding: 1rem 1rem; }
}
`;
