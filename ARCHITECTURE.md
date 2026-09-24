# Svelp architecture

This document explains how Svelp is structured, how data is modeled and persisted, and how
the current foundation prepares for the future print, scanning, export, and versioning
phases without requiring architectural rewrites.

## 1. Technology choices

| Concern | Choice |
| --- | --- |
| UI framework | Svelte 5 with runes |
| Build tool | Vite 7 |
| Language | TypeScript (strict) |
| Routing | Small internal hash router, no router dependency |
| Persistence | IndexedDB behind a service/repository layer |
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
    shell/
      AppShell.svelte         desktop sidebar or mobile top bar + bottom navigation
      Sidebar.svelte          desktop navigation with per-project area links
      MobileNav.svelte        mobile bottom tabs (Projects, Build, Scan, Data, More)
      MoreSheet.svelte        bottom sheet listing all project areas on mobile
      BrandMark.svelte        static SVG logo with optional wordmark
      area_links.ts           project area metadata
  components/ui/              design-system components (Button, Dialog, Sheet, fields…)
  icons/
    icon_defs.ts              hand-drawn SVG path library, one consistent stroke style
    Icon.svelte               icon renderer
  models/
    types.ts                  persisted domain types
    factories.ts              constructors and deep clones with fresh stable IDs
    item_catalog.ts           item type registry with availability flags
    numbering.ts              derived section/question numbers
    variable_names.ts         variable-name generation and validation
  db/
    client.ts                 IndexedDB open, versioned migrations, generic operations
    projects_repo.ts          project records
    questionnaires_repo.ts    questionnaire records
    settings_repo.ts          key-value settings
  services/
    project_service.ts        project lifecycle across stores (create/duplicate/delete)
    backup_service.ts         project bundle export, parse, collision-aware import
  features/
    projects/                 projects dashboard and project dialogs
    builder/                  builder state, pure operations, panels, item editors
    preview/                  participant-facing renderers (separate from builder UI)
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
| `#/project/:id/preview` | Participant preview |
| `#/project/:id/print` | Print placeholder |
| `#/project/:id/scan` | Scan placeholder |
| `#/project/:id/responses` | Responses placeholder |
| `#/project/:id/export` | Export placeholder |
| `#/project/:id/settings` | Project settings placeholder |

`match_route` parses a path into an `AppRoute` union; `App.svelte` switches on the union.
Unknown paths render a not-found screen. Navigation is plain anchor links, so middle-click
and keyboard navigation work for free.

Navigation model:

- Desktop (≥1024px): persistent sidebar with global Projects link and, inside a project,
  links to all seven areas.
- Tablet (768–1023px): the sidebar collapses to an icon rail.
- Mobile (<768px): top bar (back, title, overflow) plus bottom tabs for Projects, Build,
  Scan, and Data; the More sheet lists every area.

## 4. Local database

All persistent data lives in one IndexedDB database named `svelp`. Schema versions are
explicit: `PSTU_CDI_STORES` maps each database version to the stores and indexes it
introduces, and the upgrade path replays versions sequentially inside
`onupgradeneeded`. Adding future entities means appending a new version entry and
bumping `BAL_DB_VERSION` — existing stores are never recreated.

Version 1 creates:

| Store | Key | Indexes | Contents |
| --- | --- | --- | --- |
| `projects` | `id` | `updatedAt` | project metadata |
| `questionnaires` | `id` | `projectId` | full questionnaire definitions |
| `settings` | `key` | — | local key-value settings |

Planned stores for later versions (not created yet): `questionnaireVersions`,
`responseScales`, `responses`, `scans`, `scanImages`, `auditEvents`.

The client exposes a small promise-based API (`bal_get`, `bal_put`, `bal_get_all`,
`bal_get_all_by_index`, `bal_run_tx`, `bal_delete_keys`, `bal_clear`). Multi-store
operations — creating a project together with its draft questionnaire, duplicating, or
deleting — run in one transaction so local data can never be left half-written.

UI code never imports the client; it goes through `services/` and `db/*_repo.ts`.

## 5. Project and questionnaire data model

Projects and questionnaires are separate records. A project currently owns exactly one
draft questionnaire, found through the `projectId` index.

```ts
ProjectRecord {
  id, title, description, status: 'active' | 'archived',
  createdAt, updatedAt
}

QuestionnaireRecord {
  id, projectId, title, description,
  version, status: 'draft' | 'published',
  language, paperSize: 'a4' | 'letter',
  orientation: 'portrait' | 'landscape',
  theme, metadata,
  sections: QuestionnaireSection[],
  createdAt, updatedAt
}

QuestionnaireSection {
  id, type: 'section', title, description, items: QuestionnaireItem[]
}

QuestionnaireItem {
  id,
  type,                        // 'section' | 'instruction' | 'single_choice' | …
  variableName,                // stable analysis name, unique per questionnaire
  label, required,
  options: [{ id, label, coding }],
  coding, validation,
  scannerConfig,               // reserved for scanner geometry from the print renderer
  printConfig                  // reserved for print layout overrides
}
```

Key decisions:

- **Stable IDs.** Every item, option, section, questionnaire, and project gets a generated
  UUID at creation. IDs never change when items are reordered, renamed, or renumbered.
- **Derived numbering.** `derive_numbering` computes displayed section labels and `Q1…Qn`
  numbers from array order at render time. Instruction items are skipped in question
  numbering. Numbers are never stored, so insertion and reordering cannot corrupt
  references.
- **Variable names.** Questions carry an editable, validated, unique `variableName`
  (`q1`, `q2`, … by default, `age`, `income`, … by choice). Exports and codebooks will use
  variable names, not question numbers. Duplicating a question mints a fresh ID and a
  unique variable name (`q1_2`).
- **Type openness.** `ItemTypeName` already enumerates all planned types (multiple choice,
  yes/no, text, number, date, time, Likert, matrix, ranking, consent, signatures, …). The
  item catalog marks each type as available or upcoming; the builder's Add menu disables
  unavailable types with an explicit "Upcoming" tag instead of faking them. Only
  `section`, `instruction`, and `single_choice` are editable in this phase.
- **Multilingual readiness.** `label` is currently a single string, and the questionnaire
  carries a `language` code. Because all text flows through the item model and renderers
  read only from the model, text fields can later widen to localized variants without
  touching renderer architecture.

## 6. State architecture

State is layered by lifetime:

1. **Persisted domain data** — IndexedDB, owned by repositories/services.
2. **Builder document state** — `builder_state` holds the draft questionnaire currently
   being edited plus selection and save status. All edits go through pure functions in
   `builder_ops.ts` (add/update/move/duplicate/delete for sections, items, and options),
   applied immutably. Changes mark the state dirty and a 600 ms debounce persists them;
   flushing also happens when the tab is hidden. No keystroke writes to disk immediately.
3. **Project context** — `project_context` caches the project record for the open project
   route.
4. **UI state** — dialogs, sheets, and menus are local component state and are never
   persisted.

There is no global store; each feature owns its slice. The preview never imports builder
state — it loads the questionnaire from the database, which proves the definition is the
single source of truth.

## 7. Builder

Desktop uses the three-panel layout: structure (left), editing canvas (center), properties
inspector (right). Tablet keeps structure and canvas. Mobile becomes a single column: the
canvas with an inline properties section, a Structure button opening a start-side sheet,
and a sticky toolbar with the Add menu.

Implemented operations, all persisted: add section, add instructional text, add
single-choice question, edit question text, edit option labels, edit option codings, add
option, remove option (minimum one kept), reorder options, reorder items (across section
boundaries), duplicate items and sections, delete items and sections (with confirmation),
edit section titles and descriptions, and select in structure or canvas.

## 8. Preview and the renderer plan

`features/preview` renders the participant-facing questionnaire from
`QuestionnaireRecord` only. Its components (`SectionView`, `InstructionView`,
`SingleChoiceView`) are deliberately separate from builder editing components, because the
same definition must feed multiple renderers later:

| Renderer | Consumes |
| --- | --- |
| Digital renderer (this phase's preview) | questionnaire definition |
| Print renderer (future) | definition + paper size, orientation, page breaks |
| Scanner template generator (future) | definition + print layout geometry |
| Codebook generator (future) | definition (variable names, options, codings) |

The print renderer should eventually produce, alongside pages, the machine-readable
geometry (answer-mark coordinates, alignment markers, page IDs) that the scanner consumes.
Scanner coordinates must come from the renderer — Svelp must never grow a separately
maintained scanner template system.

## 9. Versioning strategy

The model already carries `version` and `status: 'draft' | 'published'` on every
questionnaire, and `ProjectRecord`/`QuestionnaireRecord` timestamps are maintained.

Planned flow, for which the schema is prepared:

1. A questionnaire is edited freely while `status` is `draft`. Autosave never creates
   versions.
2. Publishing freezes a draft: the record is copied into `questionnaireVersions` (a future
   store) as an immutable version, and the draft continues on a new version number.
3. Responses and scans record the questionnaire `id` they were collected against, so they
   always remain attached to the exact version that produced them.

Publishing is intentionally not implemented in this phase.

## 10. Offline behavior and PWA

`vite-plugin-pwa` generates a service worker that precaches every built asset (HTML, JS,
CSS, icons, fonts) with an `autoUpdate` registration, and supplies the web manifest
(installed name, standalone display, theme, maskable icon). The application shell is a
local application: after the first load, no network request is needed. Hash routing keeps
deep links working offline. All features run entirely against local IndexedDB; there is
nothing to degrade when offline because there is no online mode.

## 11. Project backup and import

Projects export as a JSON bundle:

```json
{
  "format": "svelp.project",
  "formatVersion": 1,
  "exportedAt": "…",
  "project": { … },
  "questionnaire": { … }
}
```

Export preserves all stable IDs. Import validates the format tag and version, then checks
for ID collisions:

- No collision: the project and questionnaire are written exactly as exported.
- Collision: the import is written as a separate copy with fresh IDs and the title suffix
  "(imported)"; the existing project is never silently overwritten, and the interface
  explains what happened.

A future `.svelp` package (for example a zip container with responses and scans) can
evolve from this bundle by bumping `formatVersion`.

## 12. Future print integration (not implemented)

Designed for, not built in this phase:

- Native Svelp questionnaire generation from the definition (preferred path), and a
  second path that overlays a definition onto externally produced PDFs for direct-edit
  workflows.
- A4 and Letter, portrait and landscape, consent sections, page numbering, section
  breaks, page-safe margins.
- Machine-readable page identification (questionnaire ID, questionnaire version,
  respondent ID, page number) and scanner markers emitted by the print renderer together
  with mark geometry.

The questionnaire record already carries `paperSize` and `orientation`; items carry
`printConfig` for per-question layout overrides.

## 13. Future scanner integration (not implemented)

The scanner phase will add batch image import, page grouping by respondent, duplicate and
missing page detection, image quality checks, alignment and perspective correction, mark
detection with confidence values, a manual review queue for uncertain answers, original
image preservation, reprocessing, and an audit trail — all offline. The architecture
reserves for it:

- `scannerConfig` on every question (geometry placeholder today),
- future stores `scans`, `scanImages`, `auditEvents`,
- version-locked `responses` keyed to the questionnaire version,
- page identity metadata produced by the print renderer rather than hand-maintained
  templates.

## 14. Testing

Vitest covers the layers where correctness matters most, with IndexedDB emulated by
fake-indexeddb:

- `numbering.test.ts` — derived numbering and instruction skipping,
- `variable_names.test.ts` — name generation, uniquification, validation,
- `builder_ops.test.ts` — add/insert/duplicate/move/delete semantics for items, sections,
  and options,
- `backup_service.test.ts` — bundle parse/validate, collision planning, end-to-end
  import-as-copy,
- `db.test.ts` — transactions across stores, rename, duplicate, delete, settings, and
  version mapping.

Run them with `npm run test`. `npm run check` runs svelte-check over the whole codebase
and `npm run lint` runs ESLint (typescript-eslint plus eslint-plugin-svelte).
