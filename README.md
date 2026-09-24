# Svelp

**Survey Help, simplified.**

Svelp is an offline-first research questionnaire platform. It reduces manual work in
paper-based surveys: questionnaires are designed once as structured data and later drive
digital previews, print-ready paper forms, scanner templates, and data exports from the
same definition.

This is the first implementation phase. It delivers the application foundation:

- responsive application shell (desktop sidebar, tablet rail, mobile top bar and bottom navigation)
- routing across Projects, Build, Preview, Print, Scan, Responses, Export, and Settings
- local persistence in IndexedDB with explicit schema versions
- core questionnaire schema with stable identifiers
- project management (create, open, rename, duplicate, delete, backup, import)
- a working questionnaire builder for sections, instructional text, and single-choice questions
- a participant-facing preview rendered from the questionnaire definition
- PWA installation and offline operation after the first load

Scanning, QR processing, computer vision, OCR, and PDF processing are intentionally not
part of this phase. Placeholder screens describe what each future area will do instead of
pretending to work.

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

The application has no backend and no network dependencies. All data lives in the
browser's IndexedDB on the device. A service worker precaches the application shell, so
after the first load Svelp keeps working without internet.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — application structure, database schema, questionnaire
  schema, responsive strategy, versioning strategy, offline behavior, and the planned print
  and scanner integrations.

## Source code policy

Source files contain no comments. Explanations live in this README and in
ARCHITECTURE.md. Internal implementation identifiers follow an internal naming vocabulary;
all user-facing labels are plain professional English.
