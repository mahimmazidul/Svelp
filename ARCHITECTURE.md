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

## 15. Portable data and project backup

### The MAHIM container

Svelp's portable data files use MAHIM, a versioned binary container format for portable
application data. MAHIM is section-oriented, extensible, and integrity-aware; the current
reference implementation is written in TypeScript. Svelp consumes MAHIM as an external
format dependency — the authoritative specification and implementation live in the
[MAHIM repository](https://github.com/mahimmazidul/mahim), and no part of MAHIM is
reimplemented or forked inside Svelp. The integrated build artifact of the reference
implementation is vendored under `vendor/mahim/` at a pinned upstream commit with its
provenance recorded in `vendor/mahim/README.md`; MAHIM is not on the npm registry, and a
plain git dependency cannot produce its build output, so the vendored artifact is the
documented integration path.

Files are always recognized by their MAHIM header (magic bytes plus application
identifier), never by the `.mahim` extension. Three version numbers stay strictly
separate in every file:

- the MAHIM format version (container mechanics),
- the Svelp application identifier `svelp` (registered in MAHIM's application
  identifier registry),
- the Svelp data payload version (currently `1`), which describes the Svelp schema
  inside the container and evolves independently of both.

### Package modes

**Export for another device** (`questionnaire-transfer`) moves one questionnaire version
to another installation with full scanner fidelity: the project record, the exact
questionnaire version with all sections, items, coding, and validation, every referenced
response scale, the print layout with deterministic scanner geometry (page metadata,
alignment-marker geometry, answer regions, machine page-identifier configuration, print
settings snapshot), and print batch metadata. Scans, responses, recognition results,
unrelated versions, and UI state are excluded. Exporting a draft is allowed; the file
carries the version that exists at export time, and printing before export is what adds
the scanner geometry.

**Export project backup** (`project-backup`) captures the whole project: metadata, the
questionnaire definition, scales, print configuration and geometry, print batch records,
scan batches with page identification and recovery metadata, scan audit history,
recognized responses with their recognition runs and audit history, blank-reference
metadata, and device settings rows that the device does not already have. Binary scan
images are opt-in through explicit checkboxes (original scans, normalized pages,
thumbnails, responses) with an approximate size estimate before export; a backup never
silently grows to multi-gigabyte size.

### Container sections

Structured data is serialized as canonical CBOR (MAHIM never carries JSON). JavaScript
number precision is preserved by a tagged fixed-point representation (`svelp-fixed`,
scale 10^-6) applied at encode time and reversed at decode time, because MAHIM's
canonical CBOR profile forbids floating-point numbers. Binary assets (scan originals,
normalized pages, blank-reference sheets) are raw MAHIM asset sections referenced by a
CBOR asset index, stored without recompression. Every file carries MAHIM's CRC32C
integrity checksums and a SHA-256 file digest, and import verifies all of them.

Section names: `manifest`, `project`, `questionnaires`, `scales`, `print`,
`scan-metadata`, `responses`, `settings`, `asset-index`, plus `asset-<n>` binaries.

### Filenames

One sanitizer serves every exported name: trim, collapse whitespace into hyphens, strip
filesystem-invalid characters and control characters, collapse repeated hyphens, remove
leading and trailing dots/hyphens, preserve safe Unicode, cap length, and never expose
internal IDs. Patterns:

- Transfer: `<Project>-v<version>.mahim`
- Backup: `<Project>-backup-YYYY-MM-DD.mahim` (device-local date)
- Legacy JSON export: `<Project>-v<version>-questionnaire.json`
- Print batch PDF: `<Project>-v<version>-<first>-<last>.pdf`

### Import validation and collisions

Import runs in stages: read, verify integrity, validate the Svelp payload schema
independently of the container (ids, enums, geometry bounds, references, asset MIME and
size limits), check existing local data, then commit once in a single IndexedDB
transaction across all affected stores. A failure before the commit leaves the device
unchanged; nothing is written partially.

Rejections are specific: not a MAHIM file; corrupt (integrity failure — distinct from a
schema error); a valid MAHIM file of another application ("This is a valid MAHIM file,
but it belongs to another application and cannot be imported into Svelp."); an
unsupported MAHIM format version; and a newer Svelp payload version ("This file was
created by a newer Svelp data format and cannot be imported by this version."). An
invalid payload is never partially imported.

Stable IDs (project, questionnaire, version, items, scales, print-layout identity,
scanner geometry references) travel unchanged, so printed sheets from one device resolve
on another. Collisions are explicit, never silent overwrites:

- identical canonical content: deduplicated and reported as already available;
- the same immutable questionnaire-version identity with different content: an integrity
  conflict that blocks merge and offers replace (explicit confirmation) or import-as-copy;
- a project-ID conflict: import as copy (new identity, "(imported)" title, printed pages
  keep resolving through the study code and version, but duplicate geometry may make
  identification ambiguous — the dialog warns) or replace after confirmation;
- settings rows: imported only for keys the device does not already have.

### Scanner missing-template recovery

A scanned page whose identifier decodes to a study code and version with no local
template is preserved with a `template-missing` issue — never discarded. Its review card
shows "Questionnaire template not available on this device. Required: `<code>` Version
`<n>`" with an import action. Importing a MAHIM transfer file from that banner restores
the template and geometry, then reprocesses the preserved pages from their stored
originals without re-selecting any image. A code that matches an existing template of a
different version is reported as a version mismatch instead.

### Legacy JSON bundle

The Phase 1 JSON bundle (format `svelp.project`) remains available as a legacy option
for questionnaire-only exchange. It has no MAHIM framing, no integrity verification, no
scanner geometry, and its import-as-copy collision behavior regenerates identities; it
is documented as legacy and the MAHIM transfer/backup files are the portable format.

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

## 19. Answer recognition, review, and export

The Responses and Export areas turn recovered, identified, quality-assessed pages
into structured research data. The pipeline is deterministic geometry and image
difference only: no AI, no OCR, no cloud services, no local neural models, and no
handwriting interpretation of any kind.

### Recognition pipeline

For every ready page the run service loads its normalized image from Phase 4,
resolves the exact print document that produced it (questionnaire id and version,
layout fingerprint), and takes the known answer regions from the stored scanner
geometry. Recognition never searches the page for bubbles: each region is cropped
from the scan and from the canonical blank reference with a small configurable
margin, and compared there and only there.

Blank references are rendered by the same print renderer and layout version that
produced the paper, cached in the `blankReferences` store keyed by layout
fingerprint and page number, and reused across respondents. No blank page is
re-rendered per respondent.

Per region the extractor measures added dark-pixel ratio, center-zone ratio,
largest connected stroke area and dark stroke area, mean ink depth, ring noise,
glare ratio (printed ink that vanished under a bright spot), and component count,
all relative to the blank reference. A page-level noise floor (median ring noise
across regions) raises the detection thresholds adaptively, so noisy paper needs
stronger marks without a global fixed threshold. A glare gate sends a region to
unreadable instead of guessing through a bright spot.

### Interpretation

Single choice, yes/no, and Likert rows read as single choice: one detected mark
with enough evidence is accepted; zero marks is a first-class blank; two or more
detected marks never auto-accept (multiple-marks, with near-tie called out as
ambiguous); very light ink alone stays ambiguous rather than blank. Multiple
choice and multi-selection matrix rows evaluate each option independently and
enforce minimum/maximum selection rules; over-selection goes to review with all
marks preserved, never silently trimmed. Matrix rows map results to stable row and
column IDs; visible row numbers are never identity. Text, number, date, and time
regions are surfaced as manual-only records for transcription. Signatures are not
interpreted.

### Confidence semantics

Confidence is a deterministic evidence score: weighted mark evidence, separation
from the runner-up, local noise, Phase 4 page quality, and ink depth. It is not a
calibrated probability and is never shown as one; the UI shows derived categories
(Accepted, Needs review, Ambiguous, Blank, Unreadable) plus a coarse clarity
percentage. Auto-acceptance additionally requires the configured acceptance
threshold from the recognition profile.

### Recognition profiles and runs

Defaults live in `BAL_DEFAULT_THRESHOLD_PROFILE` (algorithm version `R1`, profile
`default-v1`). An advanced disclosure on the Responses page exposes three safe
controls — mark sensitivity, ambiguity tolerance, auto-accept threshold — persisted
in the settings store; custom values record profile name `custom-v1`. Every
recognition run persists a `recognitionRuns` row with the full threshold profile,
scope, counters, and timestamps, and every response records the algorithm version,
profile name, and run id that produced it, so reprocessed results are always
distinguishable from originals and history is never rewritten.

### Persistence, audit, and reprocessing

Schema version 5 adds `responses`, `recognitionRuns`, `responseAuditEvents`, and
`blankReferences`. A response stores the final value and status alongside the
original machine value, machine status, and machine confidence; manual review sets
`manuallyReviewed` and appends a `responseAuditEvents` row (previous value/status,
final value/status, action, timestamp). Reprocessing keeps manual corrections by
default; skipping already-reviewed respondents and full recompute (which overwrites
with an audit event) are explicit choices. Runs process page by page with bounded
memory, persist incrementally, can be cancelled safely, and report a real
stage-aware ETA; already-persisted results stay valid and a rerun resumes the
remaining work.

### Review workflow

The review queue lists only problematic responses (ambiguous, multiple marks,
needs review, unreadable, manual-only pending). The inspector shows the question,
the source crop, detected result, confidence category, validation issues, and the
audit history; reviewers accept the detection, pick another answer, mark blank or
unreadable, or transcribe manual-only values, with optional keyboard shortcuts
(numbers, B for blank). Desktop uses a side placement with a full grid; mobile
uses a bottom sheet with stacked, large touch targets.

### Completeness

Each respondent gets a derived status — complete, needs review, missing required
responses, or missing page — from their responses (confirmed answers or reviewed
values count) against the questionnaire's required items and the pages actually
identified in Phase 4. The responses table shows the status per respondent.

### Exports

The Export page produces a wide clean dataset: one respondent per row, one
variable per column, coded values derived live from the questionnaire schema
(option/matrix column coding, falling back to labels). Matrix items expand to
`<variable>_<row-slug>` columns with deterministic collision suffixes, never row
numbers. Cells carry final reviewed values only; answers still awaiting review are
empty in the clean dataset. JSON export mirrors the wide shape with metadata. An
optional diagnostics mode appends per-variable status, confidence, machine value,
and corrected flag columns; diagnostics never enter the clean dataset by default.
A generated codebook lists every variable with question label, type, required
state, matrix row label, and per-option coded values from the schema. Filenames go
through the shared sanitizer as `<Project>-v<version>-responses.csv` / `.json` and
`<Project>-v<version>-codebook.csv`. XLSX is intentionally not produced: no
spreadsheet library exists in the project and adding one (roughly a megabyte)
would violate the dependency policy; the CSV opens directly in Excel and LibreOffice.

### Benchmark methodology

`reading_benchmark.ts` builds a fixed questionnaire through the real print layout,
renders deterministic synthetic scans (filled, partial, tick, cross, slash, faint
pen, rough pencil, noise, shadow, blur, glare away from and over the region, two
marks, near-ties, over-selection, yes/no combinations, matrix rows, crossed-out
corrections, untouched pages, and a manual-only field) and scores every fixture
against ground truth. Counters track correct and incorrect auto-accepts, review
routing, blank detection, false marks, and manual-only reporting. The test suite
asserts zero incorrect auto-accepts — the primary objective — plus correct routing
of every uncertain fixture; it does not optimize for maximum acceptance and claims
nothing about real-world accuracy.

### Real-world validation procedure

To validate on physical forms: print one questionnaire version's batch, mark the
copies by hand covering ballpoint pen fills, pencil shading, ticks, crosses,
slashes, faint marks, mild shadow, and mild blur, scan or photograph them through
the normal Scan flow, read the responses, then enter ground truth by hand in the
review inspector for every machine-readable question and compare the table against
the accepted answers. Report only counts measured this way on this hardware; the
benchmark numbers above are synthetic and not real-world accuracy claims.

### Limitations

Very faint or textured pencil marks route to review rather than auto-accepting.
Two strong marks in a mutually exclusive question always require human review, by
design. Glare over an answer region makes that region unreadable. Crossed-out
corrections are ambiguous by nature and go to review. Handwriting of any kind is
never interpreted automatically. Confidence is not a probability.

## 20. Testing

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

- `reading_marks.test.ts` — added-ink extraction, calibration, mark scoring, and
  page interpretation for every mark style and quality effect,
- `reading_blank.test.ts`, `reading_geometry.test.ts` — blank reference caching and
  geometry-to-region mapping,
- `reading_benchmark.test.ts` — the deterministic fixture benchmark with zero
  incorrect auto-accepts,
- `reading_run.test.ts` — end-to-end runs including manual-preservation modes,
  version mismatches, a sixty-respondent batch, and a matrix-heavy questionnaire,
- `reading_completeness.test.ts` — respondent completeness levels,
- `recognition_settings.test.ts` — recognition profile derivation and bounds,
- `export_dataset.test.ts` — dataset columns, coded values, matrix naming,
  codebook generation, CSV escaping, filenames,
- `mahim_backup_roundtrip.test.ts` — full backup round trips including review
  state, recognition runs, and audit events,
- `migration_v5.test.ts` — the v5 migration adding response stores safely.

Run them with `npm run test`; `npm run check` and `npm run lint` cover types and style.
