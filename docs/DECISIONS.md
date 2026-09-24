# Svelp design decisions

Phase-by-phase records of decisions that later phases must respect.

## Phase 2 decisions

### Response-scale references are live in drafts, frozen at publish

Draft questions store `scaleId` and resolve options from the scale library at render
time. Three safety rules bound this:

1. Deleting an in-use scale always requires explicit confirmation and writes snapshot
   copies of the current options into every referencing question in the same
   transaction; references are cleared, never left dangling.
2. Detaching (or pasting custom matrix columns) snapshots options into the item and
   clears `scaleId`; afterwards the item no longer follows the scale.
3. When publishing is implemented, the published questionnaire version will embed
   snapshot copies of the scales it uses. Responses resolve against the frozen copy, so
   later edits to the shared library can never change what a collected response means.

Import treats scale-ID collisions the same way: the bundle's scale is copied under a new
ID and the imported questions are remapped, so a local scale is never mutated.

### Variable names are deterministic, never guessed

Suggestions come from a fixed rule: Unicode-normalize, lowercase, split on
non-alphanumerics, drop a fixed stopword list, join up to three content words with
underscores, cap at 32 characters. The same label always suggests the same name.
Researchers can always override; uniqueness within a questionnaire is enforced with a
visible error; automatic suffixes (`rice_2`) prevent collisions in bulk creation and
duplication.

### Validation informs, never blocks

The validation engine returns structured issues with navigation targets. Editing is
never blocked, and no modal interrupts typing. The preview reuses the same per-item rule
evaluation for its test mode so researchers see participant-facing behavior without any
data being recorded.

### Matrix paste converts scale links explicitly

Pasting matrix columns while a scale is assigned switches the matrix to custom columns
(the paste cannot express codings for a shared scale). This is treated as an intentional
user action, surfaced in the paste dialog text, and is fully undoable.

### Capability metadata stays architectural

Per-type print metadata (page splitting, density, answer marker) and scanner capability
(automatic, manual-review, unsupported) live in the item catalog as data for future
renderers. The UI does not present scanner jargon; the only user-visible trace today is
informational copy. No coordinates exist anywhere in the schema yet — Phase 3's print
renderer will generate them from the definition.

## Phase 1 decisions

### Hash routing

The app is served as static files and must work offline from any host; hash routes need
no server rewrites and keep deep links functional in a service-worker context.

### One database, explicit versions

All entities live in one IndexedDB database (`svelp`) with a registry mapping database
versions to the stores they introduce. Upgrades replay sequentially and never recreate
existing stores. Records are additionally normalized on load so newly added fields
default cleanly on old data.

### Stable IDs and derived numbering

Every persisted entity gets a UUID at creation. Displayed question numbers are computed
from array order and never stored, so reordering cannot corrupt references and exports
can rely on IDs alone.

### Definition is the single source of truth

The builder, the preview, and every future renderer (print, scanner template, codebook)
consume only the persisted questionnaire record. No renderer shares state or components
with the editor.

### No comments in source

All explanation lives in documentation files. Internal identifiers use the project's
internal vocabulary; persisted keys and UI text stay professional.
