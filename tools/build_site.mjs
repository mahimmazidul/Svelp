import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  BAL_PAGES,
  BAL_404,
  BAL_SITE_BASE,
  BAL_SITE_ORIGIN
} from './site_content.mjs';
import {
  bal_render_public_page,
  bal_render_404,
  bal_render_robots,
  bal_render_sitemap,
  BAL_SITE_CSS
} from './render_site.mjs';

const bal_repo_root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bal_public_root = join(bal_repo_root, 'public');

function bal_write(bal_rel, bal_content) {
  const bal_path = join(bal_public_root, bal_rel);
  mkdirSync(dirname(bal_path), { recursive: true });
  writeFileSync(bal_path, bal_content);
}

for (const bal_page of BAL_PAGES) {
  if (!bal_page.slug) continue;
  bal_write(join(bal_page.slug, 'index.html'), bal_render_public_page(bal_page));
}

bal_write('404.html', bal_render_404(BAL_404));
bal_write('robots.txt', bal_render_robots());
bal_write('sitemap.xml', bal_render_sitemap(BAL_PAGES));
writeFileSync(join(bal_public_root, 'site.css'), BAL_SITE_CSS);
writeFileSync(
  join(bal_public_root, 'docs.css'),
  '.docs-body { padding-top: 1.5rem; padding-bottom: 2rem; }\n.docs-body h2 { margin-top: 2rem; font-size: 1.35rem; }\n.docs-body h3 { margin-top: 1.4rem; font-size: 1.1rem; }\n.docs-body pre { margin: 0.6rem 0; }\n.docs-body table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }\n.docs-body th, .docs-body td { border: 1px solid var(--line); padding: 0.4rem 0.6rem; text-align: left; }\n'
);


const bal_docs_md = readFileSync(join(bal_repo_root, 'docs', 'source-language.md'), 'utf8');
bal_write(join('docs', 'source-language', 'index.html'), bal_render_docs_page(bal_docs_md));

function bal_render_docs_page(bal_markdown) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Svelp Questionnaire Source v1 — Language Reference</title>
    <meta name="description" content="Complete reference for the Svelp questionnaire source language: syntax, question types, scales, matrices, consent, signatures, examples, and limitations." />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${BAL_SITE_ORIGIN}${BAL_SITE_BASE}/docs/source-language/" />
    <link rel="icon" type="image/svg+xml" href="../../favicon.svg" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Svelp" />
    <meta property="og:title" content="Svelp Questionnaire Source v1 — Language Reference" />
    <meta property="og:description" content="Full syntax reference for the svelp questionnaire source language, with complete and Bangla examples." />
    <meta property="og:url" content="${BAL_SITE_ORIGIN}${BAL_SITE_BASE}/docs/source-language/" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="Svelp Questionnaire Source v1 — Language Reference" />
    <meta name="twitter:description" content="Full syntax reference for the svelp questionnaire source language, with complete and Bangla examples." />
    <link rel="stylesheet" href="../../site.css" />
    <link rel="stylesheet" href="../../docs.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="wrap header-row">
        <a class="brand" href="../../">Svelp</a>
        <nav aria-label="Public site">
          <a href="../">Docs</a>
          <a href="../features/">Features</a>
        </nav>
        <a class="cta small" href="../../">Open Svelp</a>
      </div>
    </header>
    <main class="wrap wrap-narrow docs-body">
      <h1>Svelp Questionnaire Source v1 — Language Reference</h1>
      <p class="lede">The complete reference for the Svelp questionnaire source language, published from the same document the app ships offline.</p>
${bal_markdown_to_html(bal_markdown)}
    </main>
    <footer class="site-footer">
      <div class="wrap footer-row">
        <span>Svelp — offline-first research questionnaires.</span>
        <a href="../../">Open the app</a>
        <a href="../">Docs</a>
      </div>
    </footer>
  </body>
</html>
`;
}

function bal_markdown_to_html(bal_markdown) {
  const bal_lines = bal_markdown.split('\n');
  const bal_out = [];
  let bal_in_code = false;
  let bal_list_open = false;
  for (const bal_raw of bal_lines) {
    const bal_line = bal_raw.replace(/\s+$/, '');
    if (bal_line.trim().startsWith('```')) {
      if (bal_list_open) { bal_out.push('      </ul>'); bal_list_open = false; }
      bal_out.push(bal_in_code ? '      </pre>' : '      <pre>');
      bal_in_code = !bal_in_code;
      continue;
    }
    if (bal_in_code) {
      bal_out.push(`      ${bal_escape_html(bal_line)}`);
      continue;
    }
    const bal_h = bal_line.match(/^(#{1,4})\s+(.*)$/);
    if (bal_h) {
      if (bal_list_open) { bal_out.push('      </ul>'); bal_list_open = false; }
      const bal_level = Math.min(bal_h[1].length + 1, 4);
      bal_out.push(`      <h${bal_level}>${bal_inline(bal_h[2])}</h${bal_level}>`);
      continue;
    }
    const bal_li = bal_line.match(/^\s*[-*]\s+(.*)$/);
    if (bal_li) {
      if (!bal_list_open) { bal_out.push('      <ul>'); bal_list_open = true; }
      bal_out.push(`        <li>${bal_inline(bal_li[1])}</li>`);
      continue;
    }
    if (bal_list_open) { bal_out.push('      </ul>'); bal_list_open = false; }
    if (bal_line.trim() === '') continue;
    bal_out.push(`      <p>${bal_inline(bal_line.trim())}</p>`);
  }
  if (bal_list_open) bal_out.push('      </ul>');
  if (bal_in_code) bal_out.push('      </pre>');
  return bal_out.join('\n');
}

function bal_inline(bal_text) {
  let bal_out = bal_escape_html(bal_text);
  bal_out = bal_out.replace(/`([^`]+)`/g, '<code>$1</code>');
  bal_out = bal_out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  bal_out = bal_out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (bal_m, bal_label, bal_href) => {
    if (bal_href.startsWith('/')) return `<a href="../../${bal_href.slice(1)}">${bal_label}</a>`;
    return `<a href="${bal_href}">${bal_label}</a>`;
  });
  return bal_out;
}

function bal_escape_html(bal_text) {
  return bal_text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

console.log(`Public site written for ${BAL_SITE_ORIGIN}${BAL_SITE_BASE} (${BAL_PAGES.length} pages + docs + 404 + robots + sitemap).`);
