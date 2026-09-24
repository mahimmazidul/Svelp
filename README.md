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
- **PWA installation and offline operation** after the first load.

Answer reading, OCR, and response data export are intentionally not part of the
current phase. The Scan pipeline stops at recovered, identified, quality-assessed
pages; Responses, Export, and Settings placeholders describe planned behavior
instead of pretending to work.

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
  versioning strategy, offline behavior, the native print system (coordinate model,
  pagination engine, matrix splitting, scanner-safe rules, page identifiers, respondent
  batches, scanner geometry schema, and PDF generation), and the scan ingestion
  pipeline (local computer vision, QR identification, canonical normalization, quality
  model, worker strategy, and privacy).
- [CHANGELOG.md](./CHANGELOG.md) — release history.

## Source code policy

Source files contain no comments. Explanations live in this README and in
ARCHITECTURE.md. Internal implementation identifiers follow an internal naming vocabulary;
all user-facing labels are plain professional English, and persisted research data always
uses stable descriptive field names.
