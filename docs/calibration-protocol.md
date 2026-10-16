# Phase 7 calibration: scanner recognition proof and physical validation protocol

Status: **engineering-complete / physical-validation-pending**. Every number in this document comes from
deterministic simulated captures rendered by the print pipeline and degraded by the capture presets in
`src/features/calibration/degradation.ts`. Nothing here is a physical measurement. When printed forms and
real phone captures exist, follow [Physical validation protocol](#physical-validation-protocol) and record
results as physical, never mixed with these numbers.

## Objectives and priority order

1. No incorrect auto-accepted answers (false auto-accepts are the headline metric and are never averaged away or buried).
2. Reliable review routing for anything uncertain.
3. Usable scan success rate (auto-accept throughput).
4. Confirm Compact as the safe default print density.
5. Decide whether Dense stays available.

## Harness

- `src/features/calibration/calibration_ground_truth.ts` — machine-readable ground truth
  (`questionnaireId`, `version`, `printProfile`, `pageId`, `respondentId`, `answers[{itemId, expectedValue, expectedStatus}]`,
  stable UUID item ids only, never display labels). Ground truth is derived from questionnaire structure and
  marked intent, never from recognition output. Issues are validated, never silently repaired.
- `src/features/calibration/calibration_plan.ts` — maps stable ids to print regions for a page.
- `src/features/calibration/page_frame.ts` — composes the canonical photo of a printed page at 5.9 px/mm
  (BAL_CANONICAL_PX_PER_MM): content text, answer regions, alignment markers, vector QR.
- `src/features/calibration/degradation.ts` — deterministic degradations (blur, brightness, contrast,
  perspective warp, shadow, noise, partial crop, JPEG-style compression) and 20 named capture presets
  grouped good / acceptable / poor / unusable.
- `src/features/calibration/evaluate.ts` — ingest, degrade, identify, normalize, read, compare to ground
  truth; classifies every disagreement (false-accept-wrong-value, false-accept-should-not-accept,
  missed-mark, unnecessary-review, missed-review, blank-routed-review, manual-misroute).
- `src/features/calibration/report.ts` — aggregation; exact counts, rates only as ratios of exact counts.
- Suites: `src/features/calibration/evaluate.test.ts` (harness), `src/test/calibration_density.test.ts`
  (density comparison, styles, Bangla, matrix-heavy, 51-page batch), `src/test/calibration_thresholds.test.ts`
  (confidence analysis, threshold sensitivity, failure corpus).
- Machine-readable artifact: `docs/calibration-results-simulated.json` (86 samples, per-sample counters and
  preserved failure lines). Regenerate by re-running the suites; the JSON reflects the exact committed run of
  recognition `R1` / profile `default-v1` at 5.9 px/mm.

## Measured results (simulated captures only)

Headline safety result: **0 false auto-accepts in 206 ground-truth answers across 86 degraded samples.**
No missed marks and no missed reviews were observed in any suite. Every degradation that damaged
recognition pushed work to review (unnecessary-review 27, blank-routed-review 54 across the artifact),
which is the intended conservative failure direction.

| Density | Answers | Correct auto-accepts | False auto-accepts | Unnecessary reviews | Blank-caused reviews | Blanks correct | QR | Normalization | ms/page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Comfortable | 64 | 27 | **0** | 5 | 6 | 26 | 87.5% | 100% | ~694 |
| Compact | 85 | 30 | **0** | 13 | 16 | 26 | 83.9% | 100% | ~823 |
| Dense | 85 | 34 | **0** | 9 | 32 | 10 | 83.9% | 100% | ~798 |
| Bangla (compact) | 18 | 5 | **0** | 4 | 5 | 4 | 66.7% | 100% | ~1123 |
| Bangla (dense) | 18 | 5 | **0** | 4 | 6 | 3 | 66.7% | 100% | ~1160 |

Mark styles at Compact, straight capture: fill, partial fill, tick, X, slash, faint pen, and heavy scribble
auto-accept correctly; pencil routes to review; two strong marks in one question route to review;
slash-plus-fill corrections route to review; a tiny stray mark near a bubble and an accidental edge touch
are conservatively routed to review rather than read as blank (safe direction, documented as known
behavior, not tuned). The 60-row x 7-column matrix reads correctly at Compact and Dense with clean column
separation. The injected dual-mark review case routes to review at all three densities. A capture that
crops away two alignment markers fails normalization loudly and produces no accepts.

Findings that shaped decisions:

- Blur is the only QR killer. Every QR failure in the artifact is a slight-blur sample; marker-based
  normalization still succeeded on those pages, so the failure surfaces as a template-match retry rather
  than a wrong page. No threshold was changed; capture guidance says retake blurred pages.
- Dense routes most blank bubbles to review (blank recall ~0.31 of blank answers in its bucket versus
  ~0.81 at Comfortable). Safe, but throughput collapses; combined with no safety advantage over Compact
  this drives the Dense decision below.
- Minimum observed auto-accept confidence is 0.765 against the 0.750 floor (margin 0.015, the faint-pen
  case). Faint pen legitimately sits near the floor; under degradation it flips to review, which is correct.

## Threshold decision record

Profile `default-v1` (recognition `R1`), all tuning evidence from the same simulated set, tuning/holdout
split not used because the sample is too small for a split — stated explicitly: the set is too small to
tune, so nothing was retuned.

| Candidate change | Measured effect | Decision |
| --- | --- | --- |
| acceptanceConfidence 0.75 -> 0.65 | +1 correct accept of 18 (17 -> 18), 0 false accepts | **Keep 0.75.** Gain is 1 answer; margin-to-error evidence absent; conservative hold. |
| markCenterRatio 0.055 -> 0.045 / 0.065 | 17 correct, 0 false accepts at both | **Keep 0.055.** No gain at either step. |
| any change for blur-QR | Normalization unaffected; QR recovers on retake | **No change.** Capture guidance, not thresholds. |

Historical batches stay traceable: results interpret against the profile version recorded with them;
reprocessing under a newer profile happens only when explicitly requested.

## Density decision

- **Compact stays the default.** 0 false auto-accepts, healthy blank recall, fastest practical scanning,
  and the 7-column matrix reads cleanly.
- **Dense stays available but is not recommended.** 0 false auto-accepts (safe), but most blanks route to
  review, so batches need heavy manual review. Keep it for forms that genuinely cannot fit otherwise.

## Physical validation protocol

Use this exact protocol when physical samples exist. Record printer model/type (laser, inkjet, photocopy),
paper (ordinary white; size; duplex), phone model/camera mode/resolution/HDR, and instrument (black
ballpoint, blue ballpoint, gel pen, HB pencil, darker pencil) per sample. Never fabricate or extrapolate.

1. Print at 100% scale (disable fit-to-page/shrink-oversized). Verify printed geometry with a ruler:
   bubble diameter and pitch, QR module legibility, marker size, margins. If scaling tests are run, test
   98%, 100%, 102% explicitly and advertise only what passes; never claim untested tolerance.
2. Duplex: scan both sides as independent pages; check bleed-through does not create marks or break quality.
3. Capture each page in the 14 scenarios (straight; left/right tilt; top/bottom perspective; slight
   rotation; too far; too close; indoor dim; daylight bright; corner shadow; glare on bubbles; uneven
   light; motion blur; wrinkled paper; not flat). Skip only absurd cases. Prefer more than one phone.
4. Mark styles to cover per style list (fill, partial fill, tick, X, slash, heavy scribble, faint pen,
   dark pencil, rough pencil, partial pencil, cross-out correction, two strong marks, tiny stray near a
   bubble, accidental edge touch, blank), instruments per pen/pencil list, including cross-outs staying
   review unless strong deterministic evidence exists.
5. Ground truth is written before scanning, from the questionnaire structure, keyed by stable UUIDs, in
   the `calibration_ground_truth.ts` format with per-sample metadata (density, printer, device, lighting,
   angle, instrument, style, notes, image id).
6. Batch target 50-100 physical pages; report the actual count. Report metrics separately for physical
   and simulated; false auto-accepts lead the report. Confidence is analyzed against correctness and is
   never called a probability.
7. Every fixed bug gains a regression entry (synthetic where possible, physical crop only with consent
   and no personal data). No personal or participant data is committed.

### Explicitly blocked until physical samples exist

- Physical false-auto-accept rate, physical QR/normalization success rates, physical timing.
- Print-scaling tolerance claims, duplex bleed-through verdicts, printer-specific guidance.
- Any final statement that physical validation passed. Until then the honest label is
  physical-validation-pending.

## Known limits

- Simulated captures prove the pipeline end to end and guard regressions; they cannot prove behavior on
  real paper, ink, cameras, or hands.
- Slight blur defeats QR decode at every density (simulated); users get the missing-template resume flow,
  not a wrong page.
- Tiny strays and edge touches route to review instead of reading as blank (conservative, intentional).
- Faint pen accepts with ~0.015 confidence margin; degraded faint marks correctly drop to review.
- Very light gray fills (around 200/255, delta ~55) fall below the ink decision and read as blank. This is
  the conservative direction for auto-accepts but silently drops a possible mark; the capture guidance is
  to use ordinary pen pressure. Recorded as a finding, not tuned.
- Content-free pages (no printed text) fail the quality gate and route everything to review; real printed
  forms always carry content texture. Synthetic harness pages therefore render content lines.
- Dense density has low blank recall (heavy review load); Compact is the recommended default.
- Bangla recognition is geometry-based and language-independent; Bangla pages matched Compact behavior
  including matrix rows, with QR degradation under blur identical to English pages.

## Mobile production checks

The production build was verified at 360, 390, and 1440 with the production navigation smoke (74 checks)
plus the mobile reading, source mode, responses/export, MAHIM portability, table controls, and storage
smokes, all green on the current build. Two real mobile defects were found and fixed during this pass:

- The builder's canvas tools row and mobile toolbar forced a ~385px minimum layout on 360px screens,
  scaling the whole page and dropping bottom-nav taps onto the toolbar. Both rows now wrap.
- The review-queue cards and export page content could sit underneath the fixed bottom nav, making the
  first card's Open button untappable at the default scroll position. Page containers now reserve
  bottom-nav clearance.

The reading QA smoke's region fixture (`qa/smoke-regions.json`) is regenerated from the current print
layout whenever the layout changes; a stale fixture paints marks at outdated bubble positions and must
never be used to judge recognition behavior.
