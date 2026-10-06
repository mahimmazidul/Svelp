# Svelp Questionnaire Source — Language Specification v1

Svelp Questionnaire Source is a concise, declarative text language for authoring
questionnaires. Source files compile into the standard Svelp questionnaire schema;
they never create a second questionnaire model and never execute code.

- Language version: `svelp 1` (this is the language version, not the questionnaire version).
- Canonical file extension: `.svelp.txt`.
- Source files are optional authoring files. MAHIM remains the full-fidelity
  transfer format, and JSON export remains the structured interoperability format.

## Round-trip semantics

`source → questionnaire → source` preserves questionnaire *meaning*: structure,
labels, variables, codes, validation rules, scales, matrix rows and columns,
consent content, signature options, and print page breaks.

The canonical serializer may normalize formatting. Whitespace, indentation,
blank lines, quote escaping style, and directive order inside one question are
not preserved. A string that contains a line break is emitted as a `"""`
text block at column zero; a single-line string stays quoted on one line.

## Lexical structure

| Token       | Form                                                        |
| ----------- | ----------------------------------------------------------- |
| keyword     | one of the reserved words below, case sensitive             |
| identifier  | `[a-z_][a-z0-9_]*` (keys, variables, scale names)            |
| integer     | `-?[0-9]+`                                                  |
| string      | `"…"` on one line, with `\"` `\\` `\n` escapes               |
| text block  | `"""` … line containing only `"""` (raw content, no escapes) |
| punctuation | `{ }`                                                        |

Comments do not exist in v1. The language is data only: no expressions,
no functions, no code execution.

### Reserved words

`svelp title description language paper orientation section new_page instruction
callout single multiple yesno shorttext longtext number date time likert matrix
consent participant_signature researcher_signature required min max step unit
maxlen option code use scale columns column rows single_per_row multiple_per_row
keep_together yes no questions using introduction purpose procedures risks
benefits confidentiality voluntary withdrawal contacts acknowledgement
printed_name no_printed_name date no_date role true false`

## Grammar (EBNF)

```ebnf
document     = "svelp" INTEGER , meta* , block* ;
meta         = "title" STRING | "description" STRING | "language" STRING
             | "paper" ("a4" | "letter") | "orientation" ("portrait" | "landscape") ;
block        = section | scaledef | item ;
section      = "section" IDENTIFIER? STRING , sectiondir* , item* ;
sectiondir   = "new_page" | "description" STRING ;
scaledef     = "scale" IDENTIFIER , scaleopt+ ;
scaleopt     = "option" IDENTIFIER STRING , [ "code" (STRING | INTEGER) ] ;
item         = instruction | consent | signature | question | bulk ;
instruction  = "instruction" IDENTIFIER? STRING , [ "callout" ] ;
consent      = "consent" IDENTIFIER? STRING , consentdir+ ;
consentdir   = "introduction" body | "acknowledgement" STRING | consentsection , [ STRING ] , body ;
consentsection = "purpose" | "procedures" | "risks" | "benefits"
               | "confidentiality" | "voluntary" | "withdrawal" | "contacts" ;
signature    = sighead IDENTIFIER? STRING , sigdir* ;
sighead      = "participant_signature" | "researcher_signature" ;
sigdir       = "printed_name" | "no_printed_name" | "date" | "no_date" | "role" STRING ;
question     = qhead IDENTIFIER? STRING , qdir* ;
qhead        = "single" | "multiple" | "yesno" | "shorttext" | "longtext" | "number"
             | "date" | "time" | "likert" | "matrix" ;
qdir         = "required"
             | "min" INTEGER | "max" INTEGER | "step" INTEGER
             | "unit" STRING | "maxlen" INTEGER
             | "yes" (STRING | INTEGER) | "no" (STRING | INTEGER)
             | "option" IDENTIFIER STRING , [ "code" (STRING | INTEGER) ]
             | INTEGER STRING
             | "use" IDENTIFIER
             | "scale" IDENTIFIER
             | "columns" IDENTIFIER
             | "column" IDENTIFIER STRING , [ "code" (STRING | INTEGER) ]
             | "single_per_row" | "multiple_per_row"
             | "keep_together" ("true" | "false")
             | "rows" rowsbody ;
rowsbody     = "{" , rowdef+ , "}" | TEXTBLOCK | STRING ;
rowdef       = IDENTIFIER STRING | STRING ;
bulk         = "questions" "using" IDENTIFIER , "{" , bulkitem+ , "}" ;
bulkitem     = IDENTIFIER STRING ;
body         = TEXTBLOCK | STRING ;
```

Notes:

- The optional `IDENTIFIER` after a head keyword is the item's stable key. For
  data questions the variable name doubles as the stable key. Omitting the key
  or the variable makes the compiler suggest one deterministically from the
  label; after Apply the canonical source shows the resulting name.
- `yes` / `no` set the yes/no codings; defaults are `1` and `0`.
- A bare `INTEGER STRING` line under `likert` declares an inline scale point.
- `scale` under `matrix` or a question assigns a reusable response scale
  (`columns` is the matrix spelling). `use` assigns one to a single choice.
- `rows` accepts a braced block, or one text block containing either
  `key,Label` CSV lines or one label per line.

## Meaning of constructs

| Source                       | Schema                                                              |
| ---------------------------- | ------------------------------------------------------------------- |
| `section`                    | `QuestionnaireSection` (`new_page` → `printConfig.pageBreakBefore`) |
| `instruction`                | `instruction` item (`callout` → `emphasis: "callout"`)              |
| `single`                     | `single_choice`                                                     |
| `multiple`                   | `multiple_choice` (`min`/`max` → `minSelections`/`maxSelections`)   |
| `yesno`                      | `yes_no`                                                            |
| `shorttext` / `longtext`     | `short_text` / `long_text` (`maxlen` → `maxLength`)                 |
| `number`                     | `number` (`min`/`max`/`step`/`unit`)                                |
| `date` / `time`              | `date` / `time`                                                     |
| `likert`                     | `likert_scale` (inline points or `use`)                             |
| `matrix`                     | `matrix` (`rows`, `columns`/`scale`, `single_per_row` default)      |
| `consent`                    | `consent` item with `ConsentConfig`                                 |
| `participant_signature`      | `participant_signature`                                             |
| `researcher_signature`       | `researcher_signature`                                              |
| `scale`                      | reusable `ResponseScaleRecord` (project-wide)                       |
| `questions using <scale>`    | expands to ordinary `single_choice` items                           |

`ranking` items exist in the questionnaire schema but are not expressible in
source v1. A questionnaire containing a ranking item can be serialized and
viewed, but applying that source is blocked with a validation error, because the
apply would remove the ranking item. Move ranking items to another section
authored in the visual builder, or wait for a later language version.

`keep_together` is not emitted in v1; matrix print grouping stays under the
print system's control.

## Identity preservation

Every item and section carries a hidden stable key in its schema `metadata`
(`sourceKey`). The key is set when an item is first created (from source or the
visual builder's first source Apply) and never shown in source text.

When source is applied:

1. Items match by `metadata.sourceKey`.
2. Otherwise by `variableName` (the key is then backfilled).
3. Otherwise the item is new and receives a fresh stable id.

Items present in the questionnaire but absent from the source are removed only
when Apply is confirmed; the preview reports removals explicitly. Changing a
variable name therefore keeps the item id, because the hidden key still matches.

Options inside a matched item keep their ids by matching `coding` first, then
label. Matrix rows and columns match by stable slug first, then label.

## Canonical formatting

The serializer emits, in order: `svelp 1`, `title`, `description` (if set),
`language` (if not `en`), `paper`/`orientation` (if not defaults), scale
definitions, then sections and items. Two blank lines between sections, one
between items. Options indent by two spaces, matrix rows by four. A string
that contains a line break is emitted as a `"""` text block at column zero;
single-line strings stay quoted inline. Consent `introduction` and
consent-section bodies are emitted on the line after their keyword. `yes`/`no`
codes are omitted when they equal the `1`/`0` defaults. Double quotes always
use `\"` with `\\` escapes; text blocks never escape.
