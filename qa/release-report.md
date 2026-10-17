# Svelp release report

Generated 2026-10-17T08:15:57.916Z · commit under test `1e08280` · physical-validation-pending.

## Summary

| Gate | Result |
| --- | --- |
| Unit and integration (vitest) | 554 tests in 68 files, all pass |
| release_core | PASS · 83 checks · console errors 0 · request failures 0 |
| release_bangla | PASS · 23 checks · console errors 0 · request failures 0 |
| release_mahim | PASS · 25 checks · console errors 0 · request failures 0 |
| release_scan_review | PASS · 48 checks · console errors 0 · request failures 0 |
| release_pwa_offline | PASS · 26 checks · console errors 0 · request failures 0 |
| release_integrity | PASS · 24 checks · console errors 0 · request failures 0 |
| release_large | PASS · 28 checks · console errors 0 · request failures 0 |
| release_core (1.0.0 release-candidate build) | PASS · 41 checks · console errors 0 · request failures 0 |
| release_pages_smoke (local production build) | PASS · 45 checks · console errors 0 · request failures 0 |
| release_pages_smoke (deployed Pages) | PASS · 45 checks · console errors 0 · request failures 0 |
| Public site smoke (deployed) | PASS |

E2E total: 388 checks across 11 device runs; unexpected console errors 0; failed asset/API requests 0. Every run captures its console and network log in qa/artifacts/.

## Environment

- Chromium via Playwright (the only engine tested; browser-support claims are Chromium-only).
- Viewports 360 and 390 with real touch input, 1440 desktop.
- Local gates run against the production build served by vite preview; deployed gates against GitHub Pages.

## Honest issues and limits

- Physical scan validation on real cameras and printers has not been performed; every recognition result in these suites comes from simulated captures of app-generated pages.
- The batch PDF of the 100-question, 60-row fixture at 1000 respondents cannot be assembled in one PDF on the test device; the suite proves generation, progress, and cancellation instead and downloads a small batch.
- IndexedDB-backed questionnaires are per browser profile; cross-context projects in one suite run are created per device context by design.
- Scanner accuracy numbers are simulated-capture results only: physical-validation-pending.
