# Changelog

All notable changes to Svelp are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 0.3.0 - Phase 3: native print system

The questionnaire definition can now produce professional, deterministic,
scanner-ready paper forms and the geometry metadata required for future batch scanning.

### Added

- Native print engine with a millimetre coordinate system: A4 and Letter paper in
  portrait and landscape, physical margins, header and footer bands, and a
  scanner-safe content box; every rectangle stored physically and normalized (0-1).
- Page-based print preview with zoom, fit width, page navigation, and optional geometry
  overlays (content bounds, safe bounds, answer regions, item bounds, QR quiet zone)
  that never appear in the generated PDF.
- Deterministic pagination: keep-together rules per item type, keep-with-next section
  headings, forced page breaks, question option-list splitting at option boundaries,
  matrix splitting with repeated column headers and ", continued" labels, and consent
  splitting at paragraph boundaries with an unbreakable acknowledgement block.
- Five print themes (Academic, Clinical, Minimal, Compact, Institutional) with font,
  size, spacing, and line-weight control; density presets; presets for Academic A4,
  Compact A4, Clinical A4, and Letter Standard.
- Machine-readable page identifiers: local QR generation (vector output, managed quiet
  zone, default 20 mm) encoding study code, questionnaire version, respondent, and page,
  plus a human-readable footer fallback such as FFQ-037 P2/3.
- Scanner-readable mode: four square alignment markers per page inside safe margins,
  mark-size and margin rules, and a print-readiness validator with structured,
  navigable issues (overflow, tight margins, small marks, small page codes, overlapping
  answer regions, missing markers or identifiers, undersized signature areas).
- Full scanner geometry output per page: item bounds and answer regions carrying item,
  option, row, and column identifiers with option coding, marker type, and selection
  behavior - ready for Phase 4 image processing without redesign.
- Respondent batch generation: sequential zero-padded IDs with optional prefix or a
  pasted custom ID list, duplicate protection, anonymous numeric mode, one PDF per
  respondent or a single merged PDF, and persistent batch records pinned to the exact
  questionnaire version and content fingerprint.
- Print layout persistence (IndexedDB v3): printLayouts reused per fingerprint across
  batches, printBatches storing respondent lists and settings; questionnaires are never
  mutated by batch generation.
- Offline vector PDF export via jsPDF with exact base-14 font metrics shared by the
  on-screen preview and the PDF writer; QR codes and alignment markers drawn as vectors.

### Changed

- The Print area replaced its placeholder with the full print workspace (settings,
  live page preview, readiness report, batch generation); Scan, Responses, Export, and
  Settings remain documented placeholders.
- The mobile shell now hides the desktop sidebar below 768px, matching the documented
  top bar and bottom navigation pattern.

### Validation

- svelte-check: 0 errors, 0 warnings
- ESLint: 0 errors, 0 warnings
- Vitest: 147 tests passing, including pagination invariants, geometry bounds,
  non-overlap, normalized coordinates, QR payloads, batch IDs, and PDF output checks
- Production build: successful, PWA precache 20 entries
- Sample PDFs generated and inspected (short, mixed, consent-heavy, 60-row FFQ matrix in
  scanner mode, landscape); Print area exercised in a real browser at 1440, 768, 390,
  and 360 px with no console errors and no horizontal overflow

## 0.2.0 - Phase 2: full questionnaire authoring

The basic builder became a capable research questionnaire authoring system. Existing
Phase 1 projects migrate automatically.

### Added

- New buildable item types: multiple choice, yes/no, Likert scale, short text, long
  text, number, date, matrix/grid, consent, participant signature, and researcher
  signature — alongside the existing section, instructional text, and single choice.
- Reusable response scales: device-wide library, management panel with create, rename,
  option coding, reordering, multiline paste, duplicate, and guarded delete.
  Questions reference scales live while drafting; deleting an in-use scale requires
  explicit confirmation and snapshots current options into referencing questions.
  Scale assignment for single choice, multiple choice, and matrix columns.
- Matrix/grid questions with stable row and column IDs, single or multiple selection
  per row, reusable scales as columns, add/remove/reorder for rows and columns, and
  multiline paste that creates one row or column per pasted line.
- Structured consent blocks with optional purpose, procedures, risks, benefits,
  confidentiality, voluntary participation, withdrawal, and contact sections; the
  researcher supplies all wording. Preview renders an acknowledgement checkbox.
- Participant and researcher signature fields with signer role, optional printed name,
  and optional date. Preview captures signatures on a local canvas.
- Bulk question creation from pasted labels with type, shared scale, target section,
  and a generated variable-name preview before creation.
- Deterministic variable-name suggestions with manual editing and uniqueness
  validation; duplication never collides.
- Undo/redo for builder actions with coalesced text edits, toolbar buttons, and
  Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z / Ctrl+Y shortcuts.
- Questionnaire search by question text, variable name, and section title.
- Validation engine returning structured issues with navigation: duplicate variable
  names, empty labels, too-few options, duplicate codes, invalid ranges and selection
  limits, empty matrices, empty consent acknowledgement, and broken scale references.
- Per-type validation settings: length limits, numeric range/step/decimals, selection
  minimum/maximum, matrix require-all-rows.
- Participant preview rendering every supported type with test mode: validation as a
  fake respondent, reset, and no persistence of test answers.
- Print-readiness metadata per item type (page splitting, layout density, answer
  marker, scanner capability) as architectural preparation; no coordinates generated.
- IndexedDB schema version 2 adding the `responseScales` store through a clean
  migration; load-time normalization fills new fields on Phase 1 records.
- Project bundles now formatVersion 2, carrying referenced response scales; import
  accepts Phase 1 v1 bundles and resolves project, questionnaire, and scale collisions
  explicitly.
- 34 new tests (59 total) covering suggestions, validation, matrix operations, scale
  lifecycle and detach, bulk creation, bundle round trips, and the v1→v2 migration.

### Changed

- The Add menu groups question types into Basic, Structured, and Research categories
  and includes bulk creation.
- Options editors support coded values, reordering, and multiline paste everywhere;
  scale-linked questions show scale options read-only with an explicit detach action.

### Not in this phase

Scanning, QR processing, computer vision, OCR, PDF processing, print generation,
publishing/version freezing, response capture, and data export remain future work.

### Validation

- svelte-check: 0 errors, 0 warnings
- ESLint: 0 errors, 0 warnings
- Vitest: 59 tests passing
- Production build: successful, service worker precaching 16 entries
- Builder reviewed at 360, 390, 768, 1024, and 1440 pixel widths with touch-friendly
  controls and keyboard-accessible dialogs

## 0.1.0 - Phase 1 foundation

Initial implementation phase: application architecture, responsive shell, routing, local
persistence, core questionnaire schema, project management, basic builder, participant
preview, and the PWA/offline foundation.

### Added

- Responsive application shell: desktop sidebar, tablet icon rail, mobile top bar with
  bottom tab navigation and an overflow sheet for the remaining project areas.
- Hash-based routing across Projects, Build, Preview, Print, Scan, Responses, Export, and
  Settings, with a not-found screen for unmapped paths.
- IndexedDB persistence layer (`svelp` database, schema version 1) with explicit
  migration registry, stores for projects, questionnaires, and settings, and
  transactional multi-store operations.
- Project management: create, open, rename, duplicate, and delete with confirmation.
  Projects are stored locally; a draft questionnaire is created with each project.
- Core questionnaire schema with stable UUID identifiers for projects, questionnaires,
  sections, items, and options; derived question numbering; unique editable variable
  names; item types registered for the full planned set with only section, instructional
  text, and single choice editable in this phase.
- Builder with desktop structure/canvas/inspector layout, tablet two-panel layout, and a
  single-column mobile layout with a structure sheet and sticky add toolbar. Sections,
  instructional text, and single-choice questions can be added, edited, reordered,
  duplicated, and deleted; option labels, numeric codings, ordering, addition, and
  removal are supported. All changes autosave to IndexedDB with a visible save state.
- Participant-facing preview rendered from the questionnaire definition by a separate
  renderer family, confirming the definition as the single source of truth.
- Project backup export and collision-aware JSON import preserving stable IDs, imported
  as a separate copy when identifiers already exist.
- PWA foundation: web manifest, generated application icons, and a precaching service
  worker so the installed application works fully offline.
- Placeholder screens for Print, Scan, Responses, Export, and Settings that clearly state
  the area is unavailable in this version and describe the planned behavior.
- Unit tests (25) covering numbering, variable names, builder operations, backup and
  import, and database transactions.

### Not in this phase

Scanning, QR processing, computer vision, OCR, PDF processing, publishing and version
freezing, response capture, and data export remain future work. Placeholder screens
document the intended behavior instead of simulating it.

### Validation

- svelte-check: 0 errors, 0 warnings
- ESLint: 0 errors, 0 warnings
- Vitest: 25 tests passing
- Production build: successful, service worker precaching 16 entries
- Layout reviewed at 360, 390, 768, 1024, and 1440 pixel widths
