# Changelog

All notable changes to Svelp are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
