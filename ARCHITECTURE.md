# Svelp architecture

This document explains how Svelp is structured, how data is modeled and persisted, and how
the current implementation prepares for the future print, scanning, and export phases
without requiring architectural rewrites.

## 1. Technology choices

| Concern | Choice |
| --- | --- |
| UI framework | Svelte 5 with runes |
| Build tool | Vite 7 |
| Language | TypeScript (strict) |
| Routing | Small internal hash router, no router dependency |
| Persistence | IndexedDB behind a service/repository layer |
| Print engine | Custom deterministic layout in millimetres; SVG preview and jsPDF output |
| QR page codes | qrcode-generator (local module matrix, drawn as vectors) |
| PWA | vite-plugin-pwa (Workbox precache of the built shell) |
| Testing | Vitest with fake-indexeddb |
| Runtime dependencies | none |

Svelp is fully local. There is no backend, no analytics, no telemetry, and no remote API.
The only packages are dev dependencies for building, checking, and testing.

## 2. Application structure

```
src/
  main.ts                     entry: styles, service worker registration, app mount
  App.svelte                  route switch, loads project context per project route
  app.css                     imports design tokens and base styles
  styles/
    tokens.css                typography, spacing, color, radius, z-index, breakpoints
    base.css                  element resets, focus, page container, shared page classes
  app/
    router/
      routes.ts               route parsing: AppRoute union and area validation
      route_store.ts          hash change listener, route_store, navigate helpers
    project_context.svelte.ts per-project load state for the shell and pages
    shell/                    desktop sidebar, mobile top bar/bottom nav, brand mark
  components/ui/              design-system components (Button, Dialog, Sheet, fields…)
  icons/
    icon_defs.ts              hand-drawn SVG primitive library, one consistent stroke style
    Icon.svelte               icon renderer
  models/
    types.ts                  persisted domain types
    factories.ts              constructors, deep clones with fresh stable IDs, normalization
    item_catalog.ts           item type registry: groups, capability metadata, availability
    numbering.ts              derived section/question numbers
    variable_names.ts         deterministic variable-name suggestion and validation
    questionnaire_validation.ts  structured validation issues
    scale_options.ts          scale resolution and usage scanning
  db/
    client.ts                 IndexedDB open, versioned migrations, generic operations
    projects_repo.ts          project records
    questionnaires_repo.ts    questionnaire records
    scales_repo.ts            response-scale records
    settings_repo.ts          key-value settings
  services/
    project_service.ts        project lifecycle across stores
    scale_service.ts          scale lifecycle, usage reports, delete-with-detach
    backup_service.ts         project bundle export, parse, collision-aware import
  features/
    projects/                 projects dashboard and project dialogs
    builder/                  builder state, pure operations, panels, per-type editors
    preview/                  participant-facing renderers and test mode
    placeholders/             Print, Scan, Responses, Export, Settings screens
  utils/                      debounce, id generation, date format, download, focus trap
```

Presentation, domain logic, and persistence are separated. Svelte components never talk to
IndexedDB directly; they call stores and services, which call the repository modules,
which call the generic database client.

### Naming convention

Internal identifiers deliberately use an internal vocabulary (for example `bal_project`,
`heda_state`, `shawya_dialog`, `malta_export`). This marks implementation-level names and
keeps them distinct from domain concepts. Persisted data contracts never use these names;
they use stable descriptive field names (`id`, `title`, `version`, `sections`, …).
User-facing text is professional English only.

## 3. Routing

Routing is hash-based so the built application works from any static host and offline
without server rewrites.

| Hash | Screen |
| --- | --- |
| `#/projects` | Projects dashboard |
| `#/project/:id/build` | Builder |
| `#/project/:id/preview` | Participant preview with test mode |
| `#/project/:id/print` | Print placeholder |
| `#/project/:id/scan` | Scan workspace (batch ingestion and page recovery) |
| `#/project/:id/responses` | Responses placeholder |
| `#/project/:id/export` | Export placeholder |
| `#/project/:id/settings` | Project settings placeholder |

Navigation model:

- Desktop (≥1024px): persistent sidebar with global Projects link and, inside a project,
  links to all seven areas.
- Tablet (768–1023px): the sidebar collapses to an icon rail.
- Mobile (<768px): top bar (back, title, overflow) plus bottom tabs for Projects, Build,
  Scan, and Data; the More sheet lists every area.

The builder adapts per width: three panels (structure / canvas / properties) on desktop,
two panels on tablet, and a single column on mobile with a structure drawer, an inline
properties section, and a sticky toolbar (undo, redo, check, scales, add). All reorder
controls are explicit up/down buttons — there is no hover-only or drag-only interaction.

## 4. Local database and migrations

All persistent data lives in one IndexedDB database named `svelp`. Schema versions are
explicit: `PSTU_CDI_STORES` maps each database version to the stores and indexes it
introduces, and the upgrade path replays versions sequentially inside
`onupgradeneeded`. Existing stores are never recreated, so Phase 1 projects survive every
upgrade untouched.

| Version | Stores added |
| --- | --- |
| 1 | `projects` (index `updatedAt`), `questionnaires` (index `projectId`), `settings` |
| 2 | `responseScales` (indexes `name`, `updatedAt`) |

Planned stores for later versions (not created yet): `questionnaireVersions`,
`responses`, `scans`, `scanImages`, `auditEvents`.

### Print persistence model

Print data is separated so one layout serves every respondent copy of a version:

- `PrintLayoutRecord` — one per distinct questionnaire content (matched by a content
  fingerprint hash of title, version, paper, orientation, and all sections). It stores
  the paper settings snapshot and the full scanner geometry. Regenerating a batch for an
  unchanged questionnaire reuses the stored layout instead of re-laying-out.
- `PrintBatchRecord` — one per generation run. It references the questionnaire id and
  version, the fingerprint, the layout id, the respondent id list, and the print settings
  used. It never duplicates the questionnaire content.

Batches never mutate the questionnaire. The base record carries no respondent IDs; batch
identifiers live only in the batch. Because a batch pins the questionnaire version and
fingerprint, later edits to the draft cannot silently change what an old batch printed:
if the questionnaire changes, new batches get a new fingerprint and layout, and the old
batch metadata keeps pointing at the exact content it was generated from.

On top of schema migrations, records pass through `normalize_questionnaire` when loaded.
Normalization fills any field introduced after a record was written (for example items
created before matrices existed gain empty `rows`, `columns`, and `selectionMode`), and
moves unknown legacy keys into `metadata` instead of dropping them. This lets the item
schema evolve without a data-breaking migration for every added field.

The client exposes a small promise-based API (`bal_get`, `bal_put`, `bal_get_all`,
`bal_get_all_by_index`, `bal_run_tx`, `bal_delete_keys`, `bal_clear`). Multi-store
operations — deleting a scale together with detaching its referencing questions, or
importing a project with its questionnaire and scales — run in one transaction so local
data can never be left half-written.

## 5. Questionnaire schema

Projects and questionnaires are separate records. A project currently owns exactly one
draft questionnaire, found through the `projectId` index.

```ts
ProjectRecord {
  id, title, description, status: 'active' | 'archived', createdAt, updatedAt
}

QuestionnaireRecord {
  id, projectId, title, description,
  version, status: 'draft' | 'published',
  language, paperSize: 'a4' | 'letter', orientation, theme, metadata,
  sections: QuestionnaireSection[], createdAt, updatedAt
}

QuestionnaireSection {
  id, type: 'section', title, description, items: QuestionnaireItem[],
  printConfig: { pageBreakBefore?: boolean } | null,   // print layout placeholder
  metadata
}

QuestionnaireItem {
  id, type, variableName, label, required,
  options: [{ id, label, coding }],                    // coded choice points
  coding,                                              // item-level coding placeholder
  validation,                                          // typed per item type, see below
  scannerConfig,                                       // future scanner geometry placeholder
  printConfig,                                         // future print layout placeholder
  metadata,                                            // unknown/future keys live here
  scaleId,                                             // reusable response-scale reference
  placeholder, heading, emphasis,                      // text/instruction presentation
  rows, columns, selectionMode,                        // matrix structure, 'single'|'multiple'
  consent,                                             // structured consent content
  signature,                                           // signature field configuration
  unitLabel                                            // number unit (years, kg, …)
}

ResponseScaleRecord {
  id, name, options: [{ id, label, coding }], createdAt, updatedAt
}
```

Key decisions:

- **Stable IDs.** Every item, option, matrix row, matrix column, consent section, scale,
  section, questionnaire, and project gets a generated UUID at creation. IDs never change
  on reorder, rename, or renumber. Duplication always mints fresh IDs.
- **Derived numbering.** `derive_numbering` computes displayed section labels and `Q1…Qn`
  numbers from array order at render time. Numbers are never stored.
- **Validation payloads are typed per item type** and stored in `validation`:
  - short/long text: `{ maxLength }`
  - number: `{ min, max, step, decimalAllowed }`
  - multiple choice: `{ minSelections, maxSelections }`
  - matrix: `{ requireAllRows }`
- **Likert scales** are items whose options are the rated points (label + coding), with
  3/5/7-point presets. Endpoint labels are simply the first/last point labels, so every
  point can carry its own label and code.
- **Yes / No** is a specialized choice item with exactly two editable options, coded
  Yes = 1 and No = 0 by default.
- **Multilingual readiness.** Text fields are plain strings and the questionnaire carries
  a `language` code. Renderers read only from the model, so text fields can widen to
  localized variants later without touching renderer architecture.
- **Matrix architecture.** Rows and columns are stable-ID lists on the item.
  `selectionMode` is `single` or `multiple`. Columns can come from the item itself or,
  when `scaleId` is set, from a reusable scale (live). Multiline paste creates one row or
  column per pasted line; pasting columns converts a scale-linked matrix to custom
  columns, an explicit user action rather than a silent change.

## 6. Response scales

Response scales are a device-wide library in the `responseScales` store, reusable across
projects and questions (FFQ frequency, agreement, and similar). The management panel
supports create, rename, option editing with coding, reordering, add, multiline paste,
duplicate, and delete.

**Reference semantics (documented decision).** Questions reference scales *live* by
`scaleId` while a questionnaire is a draft: edits to a shared scale intentionally appear
in every question using it, because scales are managed as a deliberate library. The
safety rules around that live reference are:

1. **Delete is never silent.** Deleting a scale that is in use requires an explicit
   confirmation stating how many questions use it. On confirmation, every referencing
   question receives a snapshot copy of the scale's current options (`scaleId` cleared),
   inside one transaction with the deletion. Data is preserved; references never dangle
   through a UI action.
2. **Explicit detach.** Assigning custom columns or detaching snapshots the current scale
   options into the item, after which the item no longer follows the scale.
3. **Version safety.** When publishing is implemented, the frozen questionnaire version
   will snapshot the scales it uses, so collected responses always resolve against the
   exact option text and codings that were shown to respondents. Live references are a
   draft-time convenience only; published artifacts never depend on the mutable library.
4. **Import collisions.** Importing a bundle whose scale ID already exists locally
   imports the bundle's scale as a separate copy and remaps the imported questions to the
   copy, so a shared local scale is never mutated by an import.

## 7. Builder state, undo, and autosave

`builder_state` owns the draft questionnaire, the scale list, the selection, save status,
and undo/redo stacks. All edits flow through pure functions in `builder_ops.ts` applied
immutably.

- **Autosave** is debounced (600 ms) and additionally flushed when the tab is hidden or
  closed, so no substantial work is lost. A restrained save indicator shows Saved,
  Saving…, Unsaved changes, or Save failed.
- **Undo/redo** keeps snapshots of the questionnaire plus selection (limit 100). Rapid
  text edits of the same field coalesce into a single undo step (900 ms window), so
  typing a label does not flood history. Undo and redo are available as toolbar buttons
  and via Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y). Redo clears on a new edit.

## 8. Variable names

Every data-producing question carries an editable `variableName`, unique within the
questionnaire. Suggestions are deterministic — no AI: the label is normalized
(diacritics folded, lowercased), split on non-alphanumerics, a fixed stopword list
removes question scaffolding ("how", "do", "your", "please", …), the first three content
words are joined with underscores, and the result is capped at 32 characters. For
example, "How often do you consume fish?" suggests a form based on its content words
(such as `often_consume_fish` under the current rules); researchers can edit freely or
press Suggest again after changing the label. Uniqueness is validated with a clear
error, duplication auto-suffixes (`rice_2`), and bulk creation previews every generated
name before anything is created.

## 9. Bulk creation

The bulk creator pastes one question label per line and, in one action, creates one
question per line in a chosen section — all sharing a selected response scale and type
(single or multiple choice). Variable names are planned deterministically and shown in a
preview list before creation. The whole batch is a single undo step. This is the primary
workflow for FFQ-style questionnaires with long food lists.

## 10. Validation

`validate_questionnaire` returns structured issues, each carrying a code, severity
(error or warning), human message, and navigation targets (`sectionId`, `itemId`,
`scaleId`). The Check panel lists issues and jumps straight to the affected item.

Detected problems include: duplicate/missing/invalid variable names, empty question
labels or section titles, choice questions with fewer than two options, duplicate option
codes, invalid numeric ranges and steps, multiple-choice minimum greater than maximum
(or exceeding the option count), matrices without rows or columns or with empty
row/column labels, empty consent acknowledgement, broken scale references, scales with
fewer than two options, and unnamed scales.

Validation never blocks editing; it is an on-demand report. The preview applies the same
rules as interactive participant validation (see below).

## 11. Print-readiness and scanner capability metadata

The item catalog carries per-type layout and capability metadata that the Phase 3 print
renderer and scanner generator will consume:

| Metadata | Values today | Purpose |
| --- | --- | --- |
| `canSplitAcrossPages` | sections, instructions, choices: true; text/number/date/matrix/signatures: false | page-breaking decisions |
| `layoutDensity` | `compact` or `standard` | print spacing presets |
| `answerMarker` | `bubble`, `checkbox`, `box`, `line`, `none` | which mark shape the print renderer draws |
| `scannerCapability` | `automatic`, `manual-review`, `unsupported` | whether marks can be read automatically |

No coordinates are generated or stored anywhere. `scannerConfig` and `printConfig`
remain per-item placeholders. The eventual scanner geometry will be produced by the print
renderer from the same definition — Svelp will never maintain a separate scanner template
system.

Text answers, numbers, dates, and consent acknowledgements are classified
`manual-review`: a future scanner can detect *that* something was written, but reading
handwriting needs human review. Signatures are `unsupported` for automatic reading;
paper signatures are kept as images for audit.

## 12. Preview and test mode

`features/preview` renders every implemented item type from the questionnaire definition
only, sharing no editing components with the builder. It loads the record straight from
IndexedDB, which keeps the definition the single source of truth.

Test mode lets the researcher fill the questionnaire as a fake respondent: required
rules, selection limits, numeric ranges, length limits, matrix row requirements, and
consent acknowledgement all validate against the same rule set used later for real
digital responses (`bal_validate_answers`). A Check answers action lists per-question
errors, Reset clears everything, and nothing is ever persisted — answers live in local
component state only, clearly labeled, so future real response storage can never be
polluted by testing.

Signatures are captured on a local `<canvas>` with pointer events (touch and mouse) and
kept in the test answer state as an image data URL. No third-party service is involved.
On paper, signature items will print as framed boxes with printed-name and date lines.

## 13. Versioning strategy

The model carries `version` and `status: 'draft' | 'published'` on every questionnaire.

Planned flow:

1. A questionnaire is edited freely while `status` is `draft`. Autosave never creates
   versions.
2. Publishing freezes a draft: the record (with snapshot copies of its scales) is copied
   into the future `questionnaireVersions` store as an immutable version, and the draft
   continues on a new version number.
3. Responses and scans record the questionnaire `id` they were collected against, so
   they always remain attached to the exact version — including its frozen scale
   snapshots — that produced them.

Publishing is intentionally not implemented yet.

## 14. Offline behavior and PWA

`vite-plugin-pwa` generates a service worker that precaches every built asset with
`autoUpdate` registration, plus the web manifest and icons. After the first load, Svelp
needs no network at any time: hash routing keeps deep links working offline, and all
features run against local IndexedDB. There is nothing to degrade when offline because
there is no online mode.

## 15. Project backup and import

Projects export as a JSON bundle (format `svelp.project`, `formatVersion` 2):

```json
{
  "format": "svelp.project",
  "formatVersion": 2,
  "exportedAt": "…",
  "project": { … },
  "questionnaire": { … },
  "scales": [ … ]
}
```

The bundle includes every response scale the questionnaire references. Import accepts
both v2 bundles and Phase 1 v1 bundles (which simply have no scales), normalizes records
to the current schema, preserves all stable IDs, and resolves collisions explicitly:

- No collision: project, questionnaire, and scales are written exactly as exported.
- Project or questionnaire ID collision: imported as a separate copy with fresh IDs and
  an "(imported)" title suffix.
- Scale ID collision: the bundle's scale is imported as a separate copy and the imported
  questions are remapped to the copy, so no local scale is ever mutated by an import.

A future `.svelp` package (for example a zip container with responses and scans) can
evolve from this bundle by bumping `formatVersion`.

## 16. Print system

The Print area turns the questionnaire definition into deterministic paper output. One
layout engine feeds two backends: an SVG renderer for the on-screen page preview and a
jsPDF writer for native offline PDF export. Both consume the same measured block model,
so the preview and the PDF agree exactly.

### Coordinate system

All print geometry is computed in millimetres. The engine never reads the browser
viewport. Page boxes come from physical presets (A4 210 × 297 mm, Letter 215.9 × 279.4
mm, orientation-swapped for landscape) minus configurable margins (minimum 10 mm). Each
page carries header and footer bands sized by the enabled header/footer fields, a content
box, and a scanner-safe box inset 3 mm from the content box. Every stored rectangle also
has a normalized copy (all values 0–1 relative to the page) so Phase 4 can work after
perspective correction regardless of camera resolution.

### Text measurement

The engine embeds the standard base-14 width tables for Helvetica, Times, and Courier
(extracted from the same tables jsPDF draws with), scaled by font size and a 1.06 bold
safety factor. Wrapping is greedy word wrap with long-word breaking, so line breaks in
the preview and the PDF are identical. An integration test pins engine measurements
against live jsPDF metrics.

### Block model and item renderers

Every item type becomes measured chunks with fixed millimetre heights: section heads
(keep-with-next, optional forced break), instructions (callouts draw a rule), questions
(stem + option rows with bubble/checkbox markers and per-option answer regions, or text
lines/boxes for written answers), matrix heads and rows, consent paragraphs and one
acknowledgement block, and signature blocks (role label, signature line, printed name and
date lines). `questionSpacing` and density presets interleave breathing room between
blocks. Keep-together defaults follow the item catalog: choice, yes/no, Likert, text,
and signature chunks are atomic; questions with option lists may split only at option
boundaries (continuation pages restate the stem with ", continued").

### Pagination engine

The paginator runs a greedy fill over the chunk queue: forced section breaks, keep-with-
next for headings and matrix headers, split-at-option-boundary for overlong questions,
and move-whole-to-next-page otherwise. Matrix rows are individual chunks, so a large
matrix flows across pages; when a page break occurs inside a matrix, the engine injects
a continuation header (shortened title + ", continued" + repeated column headers) before
the next row, keeping row order and scanner geometry intact. Consent splits at paragraph
boundaries only; the acknowledgement block is atomic.

### Print themes and settings

Five themes (Academic, Clinical, Minimal, Compact, Institutional) fix the font family,
base size, heading scale, and line weight, with modest user overrides. Settings cover
margins, density, question spacing, header fields (title, institution, study code,
version, respondent ID box), footer fields (page numbers, readable page code, study code,
confidentiality note), the machine-readable identifier and its size, scanner-readable
mode, and mark size. Settings persist on the questionnaire (`printSettings`) after
defensive normalization (clamped values, sanitized study code). Presets (Academic A4,
Compact A4, Clinical A4, Letter Standard) set paper, theme, density, margins, and the
scanner-mode default in one step.

### Page identifiers

Every page can carry a compact machine identifier: payload
`S1|<STUDYCODE>|<version>|<respondentId>|<page>` (study code sanitized to A–Z0–9, at
most 8 characters). The QR module matrix is generated locally with qrcode-generator at
error-correction M and drawn as vector rectangles with a 4-module quiet zone, default
20 mm square. A human-readable fallback (`FFQ-037 P2/3`) prints in the footer for manual
recovery. Identifier bounds, payload, and module count are part of the page geometry.

### Scanner-readable mode and geometry output

Scanner mode adds four filled square alignment markers (7 mm, positioned inside the
margins, never on the paper edge), enforces mark size and margin rules, and drives the
print-readiness validator. The layout produces a full geometry document: per page —
content/safe/header/footer bounds, respondent ID box, identifier payload + QR bounds,
alignment marker boxes, item bounds, and answer regions. Answer regions carry the item
id, variable name, item type, option/row/column ids, option coding, marker type, and
selection behavior (single, multiple, or written) with physical and normalized rects.
Choice questions and matrices are `automatic`-capable; text, number, date, and consent
are `manual-review`; signatures are `unsupported` — the same capability classification
the item catalog has carried since Phase 2.

### Print-readiness validation

`bal_validate_print` returns structured issues (severity error/warning/info, category
layout/scanner/identifier/margins/spacing, linked to page and item): overflow beyond the
printable area, missing alignment markers or identifiers in scanner mode, tight margins
(<15 mm), small marks (<4 mm), small page codes (<18 mm), overlapping answer regions,
undersized signature areas, and identifier/marker collisions. The Print area shows a
grouped Ready/Warnings/Errors report; no fake percentages.

### Batch generation

The batch planner produces sequential zero-padded respondent IDs (prefix, start,
padding, up to 500) or accepts a pasted ID list, rejecting duplicates and showing the
first/last ID before generation. One run renders every respondent's document (only the
QR payload and readable code differ between copies), merges them into a single PDF, and
persists the batch + layout as described above. Anonymous numeric IDs (`001`, `002`, …)
work without any prefix.

### PDF generation

PDF export is fully client-side and offline. jsPDF draws text as real text (base-14
fonts, exact metrics), bubbles/checkboxes/boxes/lines as vectors, the QR and alignment
markers as filled vector rects, and produces per-respondent or merged multi-respondent
files. jspdf is loaded lazily only when exporting. A future external-PDF overlay mode
(stamping identifiers onto existing PDFs) can reuse the identifier and geometry layers
without touching this pipeline; only the page backdrop source changes.

### Geometry overlays

The preview can toggle overlay layers (content bounds, scanner-safe bounds, answer
regions, item bounds, QR quiet zone) drawn only in SVG — they never appear in the PDF.
This exists to verify scanner geometry by eye before committing to a print run.

## 18. Scan ingestion and page recovery

The Scan area turns unordered photos and PDFs of printed pages into identified,
normalized, quality-assessed pages stored locally, without reading any answers.

### Pipeline

Each page moves through explicit stages, never one giant function: decode source
(EXIF orientation honored via createImageBitmap), identify (local QR decode of the
Phase 3 payload, matched against stored print layouts), align (marker detection and
homography), normalize (canonical warp and rotation), assess quality, associate,
deduplicate, and persist. A page sits in exactly one state at a time
(queued/decoding/identifying/aligning/normalizing/ready/needs-review/duplicate/
unsupported/failed) and every transition is persisted, so a batch can be cancelled,
reopened, and resumed.

### Computer vision

The recovery engine is hand-rolled and deterministic: adaptive binarization via an
integral image, connected components with a square filter calibrated to the 7 mm
marker geometry, rotation-hypothesis search over all residual-valid corner labelings,
direct linear transformation to solve the homography, and a bilinear warp into
canonical dimensions. OpenCV was deliberately not added; the needed operations are
small, testable, and dependency-free.

### Workers and performance

All CV and QR work runs in a dedicated module worker; the page's pixels are
transferred (never copied) to and from it. The main thread handles file decoding, PDF
rendering through pdf.js, JPEG encoding, thumbnails, hashing, and IndexedDB writes.
A long-running estimator module computes a rolling, stage-aware, honestly rounded
remaining-time estimate with tests asserting no NaN, Infinity, or negative values.

### Data model

Schema version 4 adds scanBatches (status, keepOriginals, counters), scanPages
(identity, per-stage state, quality statuses, alignment and transform metadata
including detected or manual corner points and the homography, source hash and
byte sizes, thumbnail data URLs), scanAssets (source and normalized image blobs),
and scanAuditEvents (manual actions only). Assets live behind the repositories;
originals are kept by default and removal is confirmed, audited, and irreversible.

### Privacy

Nothing related to scanning leaves the device: no uploads, no remote APIs, no
telemetry, and no network fetches in the pipeline. Filenames and respondent
identifiers exist only in local IndexedDB.

## 17. Testing

Vitest covers the layers where correctness matters most, with IndexedDB emulated by
fake-indexeddb:

- `variable_names.test.ts` — deterministic suggestions, stopwords, length caps,
  uniquification, validation,
- `questionnaire_validation.test.ts` — every issue code and the valid-questionnaire case,
- `builder_ops.test.ts` — items, options, matrix row/column operations, paste semantics,
  likert presets, scale assign/detach snapshots, bulk planning/creation, deep-clone
  isolation,
- `scale_service.test.ts` — scale CRUD, usage reports, delete-with-detach, bundle
  scale collection,
- `bundle_roundtrip.test.ts` — full export→wipe→import cycles including matrix, scales,
  consent, coded options, and validation payloads, plus scale-collision remapping,
- `migration.test.ts` — v1→v2 upgrade creating `responseScales` while preserving
  Phase 1 records,
- `db.test.ts`, `backup_service.test.ts`, `numbering.test.ts` — project lifecycle
  transactions, bundle parsing and collision planning, derived numbering.

Run them with `npm run test`; `npm run check` and `npm run lint` cover types and style.
