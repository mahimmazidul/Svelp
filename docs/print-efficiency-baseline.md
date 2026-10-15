# Print-efficiency overhaul — measured baseline and plan

Date: 2026-10-14. All numbers measured from `src/features/print/*` at commit
"Drop stale geometry key from global scan fixture" (main), not estimated.

## Benchmark

`src/test/print_benchmark_fixtures.ts` adds `bal_food_wastage_benchmark()`:
the Food Wastage questionnaire shape (67 items, 7 sections):

| Section | Content |
| --- | --- |
| A Household information | 9 demographics (single choice) |
| B Food knowledge | 19 yes/no/don't-know items |
| C Attitudes | 20 five-point Likert items, shared scale |
| D Practices | 9 frequency items, shared scale |
| E Food waste frequency | 1 matrix, 27 rows x 5 columns |
| F Leftovers and habits | 6 items (choice, mixed scales) |
| G Consent | consent (2 sections + acknowledgement), participant + researcher signatures |

Measured baseline page counts (A4, default margins, academic theme):

| Settings | Pages |
| --- | --- |
| academic theme, standard density, margins 18/16/18/16 | **19** |
| same, density = compact (existing) | **18** |
| Bangla survey `bal_bangla_survey()` (reference) | 5 |

Targets for the benchmark: 4–5 preferred, 6 acceptable, 7 poor, 8–10 unacceptable.

## Measured engine constants (current)

Paper and regions (`print_paper.ts`):

- A4 210 x 297 mm; letter 215.9 x 279.4 mm.
- Default margins: top 18, right 16, bottom 18, left 16 mm.
- `BAL_MIN_MARGIN_MM` 10; `BAL_SCANNER_MIN_MARGIN_MM` 15; `BAL_SAFE_PADDING_MM` 3.
- Header band 11 mm, footer band 10 mm (in setting constants; `bal_band_heights`
  actually emits 12 mm header / 10 mm footer when furniture is shown).
- Usable content height measured at runtime: **226.5 mm/page** on A4.

Typography (`print_settings.ts`, `print_fonts.ts`):

- Themes: academic times 11 pt (scale 1.25, default), clinical helvetica 10.5
  (1.2), minimal helvetica 10.5 (1.1), compact helvetica 9.5 (1.15),
  institutional helvetica 11 (1.3).
- Line height = pt x 1.38 x 0.3528 mm -> 11 pt = 5.35 mm/line.
- Densities (existing, `PrintDensity = compact | standard | comfortable`):
  row spacing 4.4 / 5.6 / 7.2 mm; question spacing 5 / 6.5 / 9 mm.
- In-chunk gaps: line gap 1.2 mm; stem-to-options 1.6 mm; stem-to-tail 1.2 mm;
  option-to-option spacing = rowSpacing x 0.55.

Marks and identifiers:

- Answer bubble: diameter 4.8 mm, region padding 1.4 mm -> 7.6 mm cell.
- Alignment markers: `BAL_MARKER_SIZE_MM` 7, inset 5 mm.
- QR identifier: 20 mm, error correction M.
- Scanner-safe minimums are NOT centralized: bubble/QR live in per-questionnaire
  settings defaults, alignment markers in `print_paper.ts`.

Blocks (`print_blocks.ts`):

- Option row height = max(text lines, marker 7.6 mm); option c2c = row height +
  rowSpacing x 0.55 (standard: 7.6 + 3.1 = **10.7 mm per yes/no option row**).
- Matrix row height = max(text + 1.6, marker + 1.6, 7.2) = **9.2 mm** standard.
- Matrix label column: min(46 mm, 40% width); matrix header wrapped per column.
- Number/short-text tails: 7.5 mm tall (26 mm / 24 mm wide); long text 24 mm.
- Section head: title lines (heading scale 1.25) + description + 2.6 mm.
- `questionSpacing` is added to every chunk height at build time (consent
  chunks at 0.45x), including the last chunk of a page.

Pagination (`print_paginate.ts`):

- Keep rules: section-head and matrix-head and consent-para keep-with-next
  (one chunk lookahead only); question chunks may split mid-options; matrix
  rows never split individually; continuation heading ("..., continued") with
  repeated column headers is injected on matrix page turns.
- No widow/orphan control beyond keep-with-next; no section-level keep-together
  (good); forced break only via explicit `pageBreakBefore`.

Recognition geometry (`print_layout.ts`):

- Per page: `itemBounds` + `answerRegions` (choice/matrix/consent/text/number/
  date/respondent) with normalized + mm rects; alignment markers per corner;
  QR + respondent box drawn by the same document builder.

## Why the benchmark explodes to 19 pages

1. **No shared-scale tables.** Every Likert/yes-no/frequency item renders as a
   stem + one vertical option row per option. A 5-option Likert item costs
   ~ stem 5.4 + 5 x 10.7 + questionSpacing 6.5 = **65 mm each** -> Section C
   alone is ~5.5 pages. Sections B and C + D = ~14 of the 19 pages.
2. **Vertical option stacks for binary questions.** A yes/no could be one
   5.5–7 mm row (`text ○ Yes ○ No`) instead of ~27 mm (stem + 2 rows + spacing).
3. **Generous marks.** 7.6 mm bubble cell and 9.2 mm matrix rows set the floor
   everywhere; a 3.6 mm bubble with 5.2 mm cell keeps scanner-safe c2c (>2.5 mm
   gaps at our densities) while cutting row heights ~30%.
4. **Margins.** 18/16/18/16 with 226.5 mm content vs scanner-safe 15 mm
   (~235 mm content). Header/footer bands: 22 mm for furniture that could sit
   in 14 mm.
5. **Per-chunk trailing `questionSpacing`** and multi-line stems add ~6.5 mm of
   dead space after every one of ~60 non-matrix items (~390 mm = 1.7 pages).
6. **Demographics** render as full-width questions even when two or three fit
   side by side.

## Plan (commit sequence, measure page count after each)

1. **Density profiles**: DONE (commit 80bfebf). `PrintDensity` is now
   `comfortable | compact | dense`; legacy persisted values map
   standard->compact, compact->dense so old forms render identically.
   Scanner minimums centralized in `src/features/print/print_scan_minimums.ts`.
   Measured benchmark: comfortable 22, compact 18, dense 19 pages
   (density alone barely helps; option-row geometry dominates).
2. **Compact shared-scale tables**: DONE. Adjacent items with identical
   resolved options (label+coding signature) and single selection group into
   `scale-table-head` + `scale-table-row` chunks (labels once, shared aligned
   columns, continuation headers on page turns). Runs never cross section,
   signature, page-break or instruction boundaries. Isolated yes_no renders
   inline (`text ○ Yes ○ No`); answer regions stay per member item + option so
   recognition is unchanged. Item-level pageBreakBefore now honored on
   questions too. Benchmark: comfortable 11, compact 10, dense 11 pages
   (from 22/18/19). Bangla survey unchanged at 5 pages.
3. **Typography/spacing**: DONE. Default margins 18/16/18/16 -> 15 mm all
   around (scanner-safe floor); presets aligned; header band 12 -> 11 mm;
   density now also selects line factor (1.38 / 1.32 / 1.26) and tighter
   question spacing (8 / 5 / 3.6) and row spacing (6.4 / 5.2 / 4.2);
   section-head and consent-title pads trimmed.
   Benchmark: comfortable 11, compact 10, dense 10. Bangla survey 5 -> 4.
4. **Content-aware rows**: DONE. Scale-table label column widens from the
   measured widest member label (shaper-aware for Bangla) capped at 55%
   content width; short options of stacked questions lay out in a measured
   multi-column grid for compact/dense (comfortable keeps stacks);
   consent-ack and signature runs keep together.
   Benchmark: comfortable 9, compact 7, dense 7 (last page 87-92 mm).
5. **Dense matrix pagination**: DONE. Matrix/scale-table rows already split
   with repeated continuation headers and intact rows; added a widow rule —
   a break that would leave exactly one row to start the next page moves the
   last two rows over together.
   Benchmark: unchanged 9/7/7 (rule costs nothing when breaks already fall
   between row groups).
6. **Mark geometry + QR/marker footprint**: DONE. Density now selects
   engine-owned mark dimensions (bubble 4.8/4.4/3.8 mm, cell 7.6/6.4/5.4 mm,
   QR 20/18/14 mm, alignment marker 7/7/6 mm) all clamped to the centralized
   scanner minimums; persisted marker/identifier values only tighten, never
   loosen. Row floors now follow the mark cell (matrix rows 8.8 -> 6.6 mm in
   dense). Legacy density value 'standard' maps to 'compact'; new values are
   identity. Benchmark: comfortable 9, compact 6, dense 6. Bangla compact 4.
6b. **Signature pairing**: two consecutive signature items draw side by side
   as one `signature-pair` chunk (per-column item bounds, full sign space
   retained). Benchmark: comfortable 9, compact 6, dense 5 (preferred band).
   Bangla: comfortable 4, compact 3, dense 3.
7. **Utilization diagnostics + validator gates**: DONE.
   `print_diagnostics.ts` (dev-only) reports usable/occupied/whitespace and
   flags mostly-empty interior pages, nearly empty final pages, and
   overfilled pages. `print_validate.ts` adds: sub-floor bubble/QR sizes are
   errors (scanner minima from the centralized module), marks closer than
   1.6 mm, overlapping content blocks, left/top margin violations, marker
   obstruction, and degenerate regions. Dense never bypasses validation.
8. **Batch page estimates + chunked generation**: DONE. Batch cap raised to
   1000; `bal_estimate_batch_copies` totals pages and sheets (duplex divides
   by two, odd pages round up); the batch sheet shows the totals plus a
   duplex toggle and chunked generation (25 documents per frame) with a
   progress bar and ETA. Page codes stay per page, so duplex stays
   scanner-safe.
9. **Benchmark regressions + density docs**: DONE.
   `src/test/print_benchmarks.test.ts` pins measured counts (9/6/5),
   acceptance band (compact+dense <= 6), zero validation errors per density,
   FFQ 60x7 columns, KAP 20/20/20 at <= 4 pages compact, single-page consent
   + signature pair, and a full `svelp 1` source round-trip producing
   byte-identical page SVGs. Calibration sets for all three densities in
   `src/test/print_calibration_fixtures.ts` (Bangla demographic, knowledge,
   Likert, 25-row frequency, FFQ 60x7, consent/signature). Decision: Compact
   is the default density (see docs/print-density.md). Found and fixed on the
   way: consent section bodies with default titles failed to reparse
   (parser now decides title-vs-body by string count), and scale names with
   hyphens produced unlexable DSL keys (fixture renamed).
10. **Recognition regression** on every geometry change (bubble/tick/X/partial/
    faint/multiple/blank; false-accept measurement).

Rule: page counts are measured at every checkpoint and recorded here; targets
are validation numbers, never hardcoded.
