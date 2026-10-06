# Svelp

**Survey Help, simplified.**

Svelp is an offline-first research questionnaire platform. It reduces manual work in
paper-based surveys: questionnaires are designed once as structured data and later drive
digital previews, print-ready paper forms, scanner templates, and data exports from the
same definition. Everything runs locally in the browser — no backend, no accounts, no
network dependency after the first load.

## What Svelp does today

- **Projects** stored on the device: create, open, rename, duplicate, delete, and back up.
- **A capable questionnaire builder** covering the full authoring flow:
  - Sections and instructional text (heading, body, highlighted-note style)
  - Single choice with coded options and reusable response scales
  - Multiple choice with minimum/maximum selection rules
  - Yes / No with editable coding (Yes = 1, No = 0 by default)
  - Likert scales with 3-, 5-, 7-point, or custom ranges
  - Short and long text with placeholders and length limits
  - Numbers with range, step, decimals, and unit labels
  - Dates
  - Matrix / grid questions with rows and columns, one or many answers per row,
    reusable scales as columns, and multiline paste for rows, columns, and options
  - Structured consent blocks (purpose, procedures, risks, benefits, confidentiality,
    voluntary participation, withdrawal, contacts — the researcher supplies all wording)
  - Participant and researcher signature fields
  - Reusable response scales with a management panel, live assignment, safe detach,
    and usage reporting
  - Bulk question creation by pasting a label list (for example a full FFQ food list),
    with a variable-name preview before creation
  - Deterministic variable-name suggestions, manual editing, and uniqueness validation
  - Questionnaire search, validation panel with issue navigation, and undo/redo
  - An editable questionnaire source view (`svelp` language, `.svelp.txt` files) with
    syntax highlighting, live validation, a click-through problems panel, format and
    round-trip to the visual builder, safe previewed applies, and import/export
- **A participant-facing preview** that renders every supported item type, runs the
  validation rules as a test respondent, supports signature capture on a local canvas,
  and never records or stores answers.
- **A native print system** that lays the same questionnaire out on A4 or Letter paper
  (portrait or landscape) with deterministic millimetre geometry: configurable themes,
  headers, footers, page numbering, keep-together pagination, controlled matrix and
  consent splitting, QR page identifiers, scanner-readable mode with alignment markers,
  a print-readiness report, geometry overlays, respondent batch generation with unique
  coded copies, and offline vector PDF export.
- **Offline batch scanning** that imports photos and PDFs of printed pages in any
  order, decodes their QR identifiers locally, recovers each page to fixed canonical
  dimensions from the printed corner markers, assesses quality deterministically,
  groups pages by respondent, flags duplicates and missing pages, and stores
  everything on the device with resumable batches and honest progress - never reading
  or interpreting answers.
- **Portable data through MAHIM files**: "Export for another device" packages a
  questionnaire version with its referenced scales, print layout, and full scanner
  geometry so printed sheets from one device resolve on another; "Export project
  backup" captures the whole project with opt-in scan images and responses. Imports are
  validated, integrity-checked, collision-aware, and atomic; scanned pages whose
  template is missing are preserved and resume after the template is imported.
- **PWA installation and offline operation** after the first load.

- **Deterministic answer reading and review**: scanned pages are read into
  structured responses using the printed scanner geometry and blank-template
  comparison only — filled bubbles, partial fills, ticks, crosses, slashes, and
  strong pen or light-but-complete marks are recognized, while faint or uncertain
  ink, two competing marks, over-selection, and glare over an answer area are
  routed to a focused review queue instead of being guessed. Manual corrections
  preserve the original machine result, append to an audit trail, and survive
  reprocessing. Respondent completeness (complete, needs review, missing required,
  missing page) is derived per respondent.
- **Response data export**: a clean wide dataset (CSV or JSON) with one respondent
  per row and coded values derived from the questionnaire schema, deterministic
  matrix column names, a generated codebook, sanitized filenames, and an optional
  diagnostics export with recognition status, confidence, machine values, and
  correction flags.
- **A deterministic accuracy benchmark**: controlled synthetic fixtures for every
  supported mark style and quality condition, scored against ground truth with the
  primary objective of zero incorrect auto-accepts.

The Scan pipeline never interprets handwriting: short/long text, handwritten
numbers, dates, and signatures stay manual-only or presence-checked, and Settings
remains a planned area. Recognition is deterministic CV and geometry only — no AI,
no OCR, no cloud services, no local neural models.

## Running Svelp

```sh
npm install
npm run dev
```

Production build and local preview of the built application:

```sh
npm run build
npm run preview
```

Checks:

```sh
npm run check
npm run lint
npm run test
```

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — application structure, database schema and
  migrations, questionnaire schema, response-scale model, validation architecture,
  variable naming, matrix and consent/signature architecture, responsive strategy,
  versioning strategy, offline behavior, portable data and project backup (the MAHIM
  container, package modes, section model, filenames, collision handling, scanner
  missing-template recovery, and the legacy JSON bundle), the native print system
  (coordinate model, pagination engine, matrix splitting, scanner-safe rules, page
  identifiers, respondent batches, scanner geometry schema, and PDF generation), and
  the scan ingestion pipeline (local computer vision, QR identification, canonical
  normalization, quality model, worker strategy, and privacy), and the answer
  recognition system (blank-template comparison, mark scoring, confidence
  semantics, recognition profiles and runs, review workflow, reprocessing rules,
  response schema and audit trail, completeness, export formats and codebook,
  benchmark methodology, a real-world validation procedure, and limitations).
- [CHANGELOG.md](./CHANGELOG.md) — release history.

## Source code policy

Source files contain no comments. Explanations live in this README and in
ARCHITECTURE.md. Internal implementation identifiers follow an internal naming vocabulary;
all user-facing labels are plain professional English, and persisted research data always
uses stable descriptive field names.
