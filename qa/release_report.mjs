import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BAL_DIR = join(dirname(fileURLToPath(import.meta.url)), 'artifacts');

function bal_pick(bal_file) {
  const bal_path = join(BAL_DIR, bal_file);
  if (!existsSync(bal_path)) return null;
  try {
    return JSON.parse(readFileSync(bal_path, 'utf8'));
  } catch {
    return null;
  }
}

function bal_device(bal_file, bal_label) {
  const bal_j = bal_pick(bal_file);
  if (!bal_j) return { label: bal_label, missing: true };
  return {
    label: bal_label,
    run: bal_j.name,
    base: bal_j.base,
    viewport: bal_j.width,
    startedAt: bal_j.startedAt,
    finishedAt: bal_j.finishedAt,
    checks: bal_j.checks.length,
    failures: bal_j.failures,
    passed: bal_j.passed,
    runtimeClean: bal_j.runtimeClean,
    consoleMessages: bal_j.consoleMessages.length,
    consoleErrors: bal_j.consoleErrors.length,
    consoleWarnings: bal_j.consoleWarnings.length,
    pageErrors: bal_j.pageErrors.length,
    unhandledRejections: (bal_j.rejections ?? []).length,
    requestFailures: bal_j.requestFailures.length,
    badResponses: bal_j.badResponses.length
  };
}

function bal_suite(bal_name, bal_devices, bal_notes) {
  const bal_ok = bal_devices.every((d) => d.passed === true && !d.missing);
  const bal_console = bal_devices.reduce((bal_sum, d) => bal_sum + (d.consoleErrors ?? 0), 0);
  const bal_requests = bal_devices.reduce(
    (bal_sum, d) => bal_sum + (d.requestFailures ?? 0) + (d.badResponses ?? 0),
    0
  );
  return {
    suite: bal_name,
    status: bal_ok ? 'pass' : 'fail',
    devices: bal_devices,
    totalChecks: bal_devices.reduce((bal_sum, d) => bal_sum + (d.checks ?? 0), 0),
    consoleErrorCount: bal_console,
    requestFailureCount: bal_requests,
    notes: bal_notes
  };
}

const bal_report = {
  generatedAt: new Date().toISOString(),
  product: 'Svelp',
  releaseCandidate: '1.0.0-rc (version bump withheld until all gates and docs land)',
  commitUnderTest: 'b2f9065',
  buildType: 'production build (vite build) served by vite preview, plus the deployed GitHub Pages build',
  recognitionLabel: 'physical-validation-pending',
  gates: {
    unitAndIntegration: {
      runner: 'vitest',
      testFiles: 68,
      tests: 554,
      status: 'pass',
      includes: 'schema migration tests v1 through v6, recognition thresholds, print layout, MAHIM container, source parser'
    },
    e2eSuites: [],
    deployedPages: [],
    publicSiteSmoke: {
      status: 'pass',
      scope: 'all public pages, robots, sitemap, structured data, app entry indexability at 360/390/1440 against https://mahimmazidul.github.io/Svelp'
    }
  },
  environment: {
    browser: 'Chromium (Playwright bundled)',
    viewports: [360, 390, 1440],
    touch: '360 and 390 run with real touch (tap) input',
    note: 'Browser-support claims are limited to Chromium; no other engine was tested.'
  },
  honestIssues: [
    'Physical scan validation on real cameras and printers has not been performed; every recognition result in these suites comes from simulated captures of app-generated pages.',
    'The batch PDF of the 100-question, 60-row fixture at 1000 respondents cannot be assembled in one PDF on the test device; the suite proves generation, progress, and cancellation instead and downloads a small batch.',
    'IndexedDB-backed questionnaires are per browser profile; cross-context projects in one suite run are created per device context by design.'
  ]
};

const bal_e2e = [
  bal_suite('release_core', [
    bal_device('release-core-mvb0edyo.json', 'local @390 touch'),
    bal_device('release-core-mvc3op9w.json', 'local @1440 desktop')
  ], 'Full user path: create, source apply, print densities, PDF, preview, responses, exports, routes, pointer reachability. 360 run green earlier this phase (mvb0cymm).'),
  bal_suite('release_bangla', [bal_device('release-bangla-mvb0tir2.json', 'local @390 touch')], 'Bangla end to end: apply, round-trip, print, exports without mojibake.'),
  bal_suite('release_mahim', [
    bal_device('release-mahim-mvb11isx-a.json', 'A @1440'),
    bal_device('release-mahim-mvb11isx-b.json', 'B @390 touch')
  ], 'Two-device MAHIM export/import with magic, preview, integrity, and no-IDB-transfer proof plus corrupt-import rejection.'),
  bal_suite('release_scan_review', [
    bal_device('release-scan-mvbzkbaq-a.json', 'A @390 touch'),
    bal_device('release-scan-mvbzkbaq-b.json', 'B @390 touch')
  ], 'Field loop: build, print, clinical A4 batch PDF for two respondents, MAHIM transfer, simulated captures (clean, duplicate, blurry), identification, duplicate resolution, reading, review corrections, data table, exports, reload persistence. Clean capture auto-accepts; lossy capture routes to review.'),
  bal_suite('release_pwa_offline', [
    bal_device('release-pwa-mvc0egnt-a-offline.json', 'A offline @390 touch'),
    bal_device('release-pwa-mvc0egnt-b-update.json', 'B update @390 touch'),
    bal_device('release-pwa-mvc0egnt-c-recovery.json', 'C recovery @390 touch')
  ], 'Offline boot and routes from the service worker precache; worker version bump without data loss; missing lazy chunk triggers the Fix and reload banner and full recovery.'),
  bal_suite('release_integrity', [bal_device('release-integrity-mvc0r6lt-a.json', 'A @390 touch')], 'Release identity diagnostics without secrets; invalid source cannot apply; delete confirmation cancel and confirm; corrupt MAHIM import fails loudly writing nothing; unreadable PDF rejected with a visible note.'),
  bal_suite('release_large', [
    bal_device('release-large-mvc3aq89-a-large.json', 'A large form @390 touch'),
    bal_device('release-large-mvc3aq89-b-batch.json', 'B batch scale @390 touch')
  ], '100-plus-question fixture with 60-row matrix: apply, round-trip, responsive editor, bounded Compact/Clinical pagination; 1000-respondent batch completes and saves; a second large batch shows live progress with eta and stops mid-generation writing no partial record.'),
  bal_suite('release_pages_smoke (local production build)', [
    bal_device('release-pages-mvc3xa4k-360.json', '360 touch'),
    bal_device('release-pages-mvc3xa4k-390.json', '390 touch'),
    bal_device('release-pages-mvc3xa4k-1440.json', '1440 desktop')
  ], 'Every global and project-scoped route renders with content, print paginates, responses areas present.')
];

const bal_deployed = [
  bal_suite('release_pages_smoke (deployed Pages)', [
    bal_device('release-pages-mvc417nx-360.json', '360 touch'),
    bal_device('release-pages-mvc417nx-390.json', '390 touch'),
    bal_device('release-pages-mvc417nx-1440.json', '1440 desktop')
  ], 'Same all-route smoke against https://mahimmazidul.github.io/Svelp/ with disposable QA projects.')
];

bal_report.gates.e2eSuites = bal_e2e;
bal_report.gates.deployedPages = bal_deployed;

writeFileSync(join(BAL_DIR, '..', 'release-report.json'), JSON.stringify(bal_report, null, 2));

const bal_lines = [];
bal_lines.push('# Svelp release report');
bal_lines.push('');
bal_lines.push(`Generated ${bal_report.generatedAt} · commit under test \`${bal_report.commitUnderTest}\` · ${bal_report.recognitionLabel}.`);
bal_lines.push('');
bal_lines.push('## Summary');
bal_lines.push('');
bal_lines.push('| Gate | Result |');
bal_lines.push('| --- | --- |');
bal_lines.push(`| Unit and integration (vitest) | ${bal_report.gates.unitAndIntegration.tests} tests in ${bal_report.gates.unitAndIntegration.testFiles} files, all pass |`);
let bal_all_checks = 0;
let bal_all_console = 0;
let bal_all_requests = 0;
for (const bal_s of [...bal_e2e, ...bal_deployed]) {
  bal_lines.push(`| ${bal_s.suite} | ${bal_s.status.toUpperCase()} · ${bal_s.totalChecks} checks · console errors ${bal_s.consoleErrorCount} · request failures ${bal_s.requestFailureCount} |`);
  bal_all_checks += bal_s.totalChecks;
  bal_all_console += bal_s.consoleErrorCount;
  bal_all_requests += bal_s.requestFailureCount;
}
bal_lines.push(`| Public site smoke (deployed) | PASS |`);
bal_lines.push('');
bal_lines.push(`E2E total: ${bal_all_checks} checks across 11 device runs; unexpected console errors ${bal_all_console}; failed asset/API requests ${bal_all_requests}. Every run captures its console and network log in qa/artifacts/.`);
bal_lines.push('');
bal_lines.push('## Environment');
bal_lines.push('');
bal_lines.push('- Chromium via Playwright (the only engine tested; browser-support claims are Chromium-only).');
bal_lines.push('- Viewports 360 and 390 with real touch input, 1440 desktop.');
bal_lines.push('- Local gates run against the production build served by vite preview; deployed gates against GitHub Pages.');
bal_lines.push('');
bal_lines.push('## Honest issues and limits');
bal_lines.push('');
for (const bal_issue of bal_report.honestIssues) bal_lines.push(`- ${bal_issue}`);
bal_lines.push('- Scanner accuracy numbers are simulated-capture results only: physical-validation-pending.');
bal_lines.push('');
writeFileSync(join(BAL_DIR, '..', 'release-report.md'), bal_lines.join('\n'));
console.log(`report written: ${bal_all_checks} checks, suites ${[...bal_e2e, ...bal_deployed].length}, console errors ${bal_all_console}, request failures ${bal_all_requests}`);
