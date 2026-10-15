# Print density profiles

Print density controls how much content fits on a printed page. Three modes
exist: Comfortable, Compact, and Dense. There is no "Ultra" mode — Dense is
the floor, bounded by scanner-safe minimums that never relax.

## Measured defaults (A4, default margins)

| Property | Comfortable | Compact | Dense |
| --- | --- | --- | --- |
| Row spacing (mm) | 6.4 | 5.2 | 4.2 |
| Question spacing (mm) | 8 | 5 | 3.6 |
| Line factor (x font size) | 1.38 | 1.32 | 1.26 |
| Bubble diameter (mm) | 4.8 | 4.4 | 3.8 |
| Bubble cell incl. padding (mm) | 7.6 | 6.4 | 5.4 |
| Page code (QR) size (mm) | 20 | 18 | 14 |
| Alignment marker (mm) | 7 | 7 | 6 |
| Default margins (mm) | 15 | 15 | 15 |

Persisted per-questionnaire marker or identifier values still apply, but only
down to the scanner-safe floors in `src/features/print/print_scan_minimums.ts`
— density can tighten what a saved profile loosens.

Legacy persisted values keep working: the old `standard` density loads as
`compact`; the old `compact` loads as `dense`. New documents default to
`compact`.

## Why Compact is the default

Measured on the Food Wastage benchmark (67 items, 7 sections, Bangla-capable
shaper-aware layout):

| Density | Benchmark pages | Bangla survey pages |
| --- | --- | --- |
| Comfortable | 9 | 4 |
| Compact | 6 | 3 |
| Dense | 5 | 3 |

Compact keeps every scanner minimum with margin to spare (validation reports
zero errors in scanner mode at every density), keeps 4.4 mm bubbles — well
above the 3.6 mm floor — and reads at 10+ pt equivalent line heights. Dense
saves one more page but spends the last of the mark separation budget, so it
is opt-in for teams that need it, not the default. Comfortable exists for
large-type field use.

## Scanner-safe floors (never user-visible)

Bubble diameter 3.6 mm, bubble cell 5.2 mm, center-to-center gap 2.4 mm,
matrix/table row height 6 mm, QR 12 mm with 2 mm quiet zone, alignment
marker 5 mm at 5 mm inset, 15 mm scanner margin, 1.6 mm mark-region gap.
These live only in `print_scan_minimums.ts`; ordinary users see Paper,
Orientation, Density, Duplex, and advanced margins — never mark geometry.
The print-readiness validator turns any sub-floor geometry into errors; Dense
does not bypass validation.

## Page-count expectations (validation bands, not targets)

For a dense KAP-style research questionnaire the benchmark measures:
Comfortable 9, Compact 6, Dense 5 pages. Regression tests pin the measured
counts so layout changes are conscious; the acceptance band (Compact 6 or
better, Dense 5) lives in `src/test/print_benchmarks.test.ts` and in this
document — never as a hardcoded target inside the layout engine.

## Duplex

Every page carries its own QR page code and alignment markers, so
double-sided printing stays scanner-safe. The batch planner reports sheets as
`ceil(pages / 2)` when duplex is on.
