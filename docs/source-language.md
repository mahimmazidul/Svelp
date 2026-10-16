# Svelp Questionnaire Source — Language Reference v1

Svelp Questionnaire Source ("source mode") is a concise, declarative text language for
authoring questionnaires. Source files compile into the standard Svelp questionnaire
schema; they never create a second questionnaire model and never execute code.

- Language version: `svelp 1`. This is the **source language version**, separate from the
  questionnaire's own version number and from the Svelp app version.
- Canonical file extension: `.svelp.txt`.
- Source files are optional authoring files. MAHIM remains the full-fidelity transfer
  format, and JSON export remains the structured interoperability format.
- The language is **indentation-independent**: leading spaces exist only for readability.
- This document is executable documentation: every block marked `svelp` is parsed,
  validated, and compiled by an automated test, and every block marked `svelp-error`
  must fail with the stated error. If this document and the app ever disagree, one of
  them is wrong — file an issue rather than guessing.

## What Source Mode is

Source Mode is a tab inside a project's Build page. It shows the current questionnaire
serialized as source text. You can edit that text, and **Apply** compiles it back into
the questionnaire. Two independent statuses are shown:

- **Source state** (in the source toolbar): `Valid`, `Invalid`, or `Unapplied changes ·
  valid/invalid`. This means the text parses and compiles. It does **not** mean the
  questionnaire has been saved.
- **Persistence state** (next to the save dot): `All changes saved`, `Unsaved changes`,
  `Saving…`, or `Save failed`. Only the last one, with a **Copy error** action, appears
  when writing to local storage fails; the copied text contains the root cause.

## Minimal questionnaire

```svelp
svelp 1

title "Test Survey"

section background "Background"
description "A short test survey."
```

A source file must start with the header. The smallest useful file has a title and one
section; questions may also sit at the top level before any section.

## Header

` svelp 1 `

- `svelp` is the language marker.
- `1` is the Source Language version. A file with a different version is rejected with
  an explicit "not supported by this release" error instead of being misread.
- The header is unrelated to the questionnaire version (which increments on publish or
  structural change) and to the app version.

## Identifiers

Identifiers name variables, options, scales, and matrix rows:

- Pattern: lowercase letter or `_`, then lowercase letters, digits, `_` (`[a-z_][a-z0-9_]*`).
- Case sensitive; `Age` and `age` are different words, and `Age` is not a valid identifier.
- Hyphens are **not** allowed (`rice-rate` is unlexable); use `rice_rate`.
- Reserved words (list below) cannot be identifiers.
- Valid: `age`, `food_waste`, `_hidden`, `row2`.
- Invalid: `2row`, `rice-rate`, `Age`, `class` is fine but `scale` is reserved.

## Strings and text blocks

- Single-line strings are double-quoted: `"Age in years"`.
- Escapes inside quotes: `\"` for a quote, `\\` for a backslash, `\n` newline, `\t` tab.
  Any other escape keeps the character as-is.
- Multiline text uses a raw text block: a line starting with `"""` (nothing else on it),
  the raw lines, then a line containing only `"""`. Text blocks have **no escapes** —
  every byte between the fences is kept, including quotes and backslashes.

```svelp
svelp 1

title "Text demonstration"

consent demo "Agreement"
  introduction """
  Your answers are confidential.
  Quotes " and backslashes \ need no escaping here.
  """
  purpose "Purpose"
  acknowledgement "I agree"
  required
```

An unterminated quote or text block is a lexical error listed in the Problems panel.

## Questionnaire metadata

These keywords are legal only **before the first section** (top level):

- `title "…"` — required by validation; the questionnaire title.
- `description "…"` — top-level study description.
- `language "bn"` — language code; informational.
- `paper a4` or `paper letter` — print paper size.
- `orientation portrait` or `orientation landscape`.

`description` is also legal **inside a section**, where it is the section description.
After a question it is an error.

```svelp
svelp 1

title "Metadata demonstration"
description "Top-level description"
language "bn"
paper a4
orientation portrait

section details "Details"
description "This description belongs to the section."

shorttext name "Your name"
```

## Sections

```
section key "Display title"
description "Optional section description"
new_page
...items...
```

- The key is optional; an automatically generated one is suggested on Apply.
- `new_page` starts this section on a new printed page.
- A section ends when the next `section`, `scale`, or `questions` block starts (or the
  file ends). There is no `end` keyword and no braces.

```svelp
svelp 1

title "Section demonstration"

section first "First"
description "Shown under the title."

shorttext q1 "Favorite season"

section second "Second"
new_page

shorttext q2 "Favorite month"
```

## Instructions

```svelp
svelp 1

title "Instruction demonstration"

section s "Section"

instruction intro "Please answer for the past seven days."

instruction warn "This section is required."
  callout
```

`callout` renders the instruction as a highlighted box in digital preview and print.

## Question types

Every data question: `head key "Label"` followed by directives. The key is the stable
variable name; if omitted, Apply suggests one deterministically from the label.

### Single choice

```svelp
svelp 1

title "Single choice demonstration"

section s "Section"

single sex "Sex"
  option male "Male" code 1
  option female "Female" code 2
  option other "Other" code 3
  required
```

### Multiple choice

`min`/`max` constrain how many options may be selected (they map to
`minSelections`/`maxSelections`). `required` demands at least one.

```svelp
svelp 1

title "Multiple choice demonstration"

section s "Section"

multiple crops "Which crops do you grow?"
  min 1
  max 3
  option rice "Rice"
  option wheat "Wheat"
  option jute "Jute"
  required
```

### Yes/No

Default codes are `yes 1`, `no 0`; both are customizable.

```svelp
svelp 1

title "Yes/no demonstration"

section s "Section"

yesno owns_land "Do you own land?"
  yes 1
  no 0
  required

yesno has_electricity "Does the home have electricity?"
```

### Short text and long text

`maxlen` maps to the schema `maxLength`.

```svelp
svelp 1

title "Text demonstration"

section s "Section"

shorttext village "Village name"
  maxlen 60
  required

longtext notes "Any notes?"
  maxlen 500
```

### Number

```svelp
svelp 1

title "Number demonstration"

section s "Section"

number age "Age in years"
  min 0
  max 120
  step 1
  unit "years"
  required
```

`min` < `max` is enforced; `step` must be a positive integer.

### Date and time

```svelp
svelp 1

title "Date and time demonstration"

section s "Section"

date visited "Last visit date"
  required

time wake_up "Usual wake up time"
```

### Likert

Inline points (`INTEGER "Label"`) or a reusable scale via `use` — never both.

```svelp
svelp 1

title "Likert demonstration"

scale agreement
  option disagree "Disagree" code 1
  option neutral "Neutral" code 2
  option agree "Agree" code 3

section s "Section"

likert trust "I trust the process"
  1 "Strongly disagree"
  2 "Disagree"
  3 "Neutral"
  4 "Agree"
  5 "Strongly agree"
  required

likert pace "The survey was easy to complete"
  use agreement
```

### Matrix (grid)

A matrix asks one row per question against shared columns. Directives:

- `scale <name>` (or the synonym `columns <name>`) — reusable column scale.
- `column <key> "Label" code N` — inline columns instead of a scale.
- `rows { key "Label" ... }` — braced rows; or a text block/quoted string with one
  `key,Label` CSV line or one label per line.
- `single_per_row` (default) — one answer per row; `multiple_per_row` — several.
- `keep_together (true|false)` is parsed for compatibility but **not emitted** in v1;
  print grouping stays under the print system's control.

Rows without an explicit key get a deterministic slug. Keys must be unique.

```svelp
svelp 1

title "Matrix demonstration"

scale frequency
  option never "Never" code 0
  option sometimes "Sometimes" code 1
  option often "Often" code 2
  option daily "Daily" code 3

section diet "Diet"

matrix staples "How often does your household eat:"
  scale frequency
  single_per_row
  rows {
    rice "Cooked rice"
    bread "Bread and bakery"
    vegetables "Fresh vegetables"
  }
  required

matrix drinks "Which drinks does your household buy?"
  column daily_col "Daily" code 1
  column weekly_col "Weekly" code 2
  multiple_per_row
  rows """
  milk,Milk
  tea,Tea
  """
```

A realistic 60-item food-frequency questionnaire is just this pattern repeated; use the
bulk form below when every row shares one scale.

### Consent

Consent kinds: `purpose`, `procedures`, `risks`, `benefits`, `confidentiality`,
`voluntary`, `withdrawal`, `contacts`. Each takes either a body string or a title string
followed by a body string. `introduction` is a preamble; `acknowledgement` labels the
agree control.

```svelp
svelp 1

title "Consent demonstration"

section s "Section"

consent agree "Participation"
  introduction """
  You may leave the study at any time.
  """
  purpose "Why this study runs"
  procedures "What you will do"
  risks "What risks exist"
  benefits "What benefits exist"
  confidentiality "How your data is protected"
  voluntary "Participation is voluntary"
  withdrawal "How to withdraw"
  contacts "Who to contact"
  acknowledgement "I have read and agree"
  required
```

### Signatures

```svelp
svelp 1

title "Signature demonstration"

section s "Section"

participant_signature respondent_sign "Respondent"
  printed_name
  date
  required

researcher_signature enumerator_sign "Enumerator"
  role "Enumerator"
  no_printed_name
  no_date
```

`printed_name`/`no_printed_name` and `date`/`no_date` toggle the printed fields;
`role` labels the signer.

## Reusable scales

Scales are declared once and reused by `use` (single choice, likert) or `scale`/`columns`
(matrix). Scale names follow identifier rules — lowercase with underscores; hyphens are
not valid and never were lexable. Scale options may carry codes.

```svelp
svelp 1

title "Scale demonstration"

scale agreement
  option strongly_disagree "Strongly disagree" code 1
  option disagree "Disagree" code 2
  option neutral "Neutral" code 3
  option agree "Agree" code 4
  option strongly_agree "Strongly agree" code 5

section s "Section"

single satisfaction "Overall satisfaction"
  use agreement
  required

likert pace "The survey was easy"
  use agreement
```

## Bulk question blocks

`questions using <scale> { key "Label" ... }` expands to ordinary single-choice questions
sharing that scale. A bulk block must start where no question is open — directly after a
`section` line is the reliable place.

```svelp
svelp 1

title "Bulk demonstration"

scale frequency
  option never "Never" code 0
  option often "Often" code 1

section diet "Diet"

questions using frequency {
  breakfast "How often is breakfast wasted?"
  dinner "How often is dinner wasted?"
}
```

## Print-related directives in v1

- `new_page` (section) — page break before the section.
- `paper a4|letter`, `orientation portrait|landscape` — page setup.
- `callout` (instruction) — highlighted instruction box.
- `keep_together (true|false)` (matrix) — parsed, not emitted.

Everything else about printing (bubble sizes, densities, margins) lives in the print
system, not in source.

## Import and export source files

The Source toolbar's **Export** downloads the current text as `<project>-v<version>-questionnaire.svelp.txt`.
**Import** loads a `.svelp.txt` file into the editor as text; nothing is applied until
you press Apply. Copy copies the entire source document; Select all selects it visibly.

## Visual ↔ Source behavior

- Opening Source Mode serializes the current questionnaire; editing the questionnaire in
  the visual builder refreshes the text as long as you have no unapplied edits.
- Apply compiles the text into a plan (sections/items/options matched, added, modified,
  removed), shows a summary dialog for destructive changes (removals, renames, removal
  of questions that already have responses), then updates the questionnaire and saves.
- If persistence fails, the source text and the in-editor questionnaire stay intact, the
  status shows **Save failed** with a **Copy error** action, and the next successful
  Apply or edit retries the save.

## Stable identity behavior

Every item and section carries a hidden stable key in its schema `metadata`
(`sourceKey`), set at creation and never shown in source text. On Apply:

1. Items match by `metadata.sourceKey`.
2. Otherwise by `variableName` (the key is then backfilled).
3. Otherwise the item is new and receives a fresh stable id.

Items present in the questionnaire but absent from the source are removed only when the
destructive-change preview is confirmed. Renaming a variable keeps the item id because
the hidden key still matches. Options keep ids by matching `coding` first, then label;
matrix rows and columns match by stable slug first, then label.

## Published and draft behavior

Opening the Build page of a published project automatically creates a new draft version
(next version number, `draft` status); source edits always apply to drafts. Publishing
itself happens in the visual builder.

## Error handling and save status

Problems are listed in the Problems panel (bottom sheet on mobile) with line numbers;
clicking an issue focuses that line. Severity `error` blocks Apply; warnings and infos do
not. **Valid** (parse+compile) is displayed separately from **Saved** (persistence). When
a save fails, the toolbar's status shows Save failed plus **Copy error**, which copies a
diagnostic like:

```
Error: Failed to save questionnaire
Cause: DataCloneError: …
Stage: questionnaire persistence
Questionnaire: <id>
Project: <id>
```

Invalid source never attempts a save: Apply is disabled until the plan compiles.

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

- The optional `IDENTIFIER` after a head keyword is the item's stable key. For data
  questions the variable name doubles as the stable key. Omitting it makes the compiler
  suggest one deterministically from the label.
- A bare `INTEGER STRING` line under `likert` declares an inline scale point.
- `scale` under `matrix` (or `columns`) assigns a reusable column scale; `use` assigns
  one to a single choice or likert.

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

## Canonical formatting

The serializer emits, in order: `svelp 1`, `title`, `description` (if set), `language`
(if not `en`), `paper`/`orientation` (if not defaults), scale definitions, then sections
and items. Two blank lines between sections, one between items. Options and directives
indent by two spaces, matrix rows by four. A string containing a line break is emitted
as a `"""` text block; single-line strings stay quoted. Option keys are regenerated
from codings or labels when the source's keys are not canonical; labels and codes are
always preserved. After Apply the editor shows the canonical text.

`ranking` items exist in the questionnaire schema but are **not expressible** in source
v1. A questionnaire containing a ranking item can be serialized and viewed, but applying
any source to it is blocked with a validation error, because applying would remove the
ranking item. Author ranking questions in the visual builder.

## Reserved words

`svelp title description language paper orientation section new_page instruction
callout single multiple yesno shorttext longtext number date time likert matrix
consent participant_signature researcher_signature required min max step unit
maxlen option code use scale columns column rows single_per_row multiple_per_row
keep_together yes no questions using introduction purpose procedures risks
benefits confidentiality voluntary withdrawal contacts acknowledgement
printed_name no_printed_name no_date role true false`

## Unsupported constructs

- Ranking questions (see above).
- `keep_together` is parsed but never emitted in v1.
- Comments (`#` produces a dedicated error), blank-line comments, any comment syntax.
- Expressions, arithmetic, conditionals, loops, functions, or arbitrary JavaScript.
- Custom validation beyond `required`, `min`, `max`, `step`, `maxlen`, selection bounds.
- Multiple questionnaires per file; imports of other source files.

## Full questionnaire example

```svelp
svelp 1

title "Household Food Waste Survey"
description "Weekly household food waste and attitudes study"
language "en"
paper a4
orientation portrait

scale frequency
  option never "Never" code 0
  option rarely "Rarely" code 1
  option sometimes "Sometimes" code 2
  option often "Often" code 3
  option always "Always" code 4

section background "Background"
description "About your household"
new_page

instruction intro "Please answer for your household for the past seven days."
  callout

single size_band "How many people live in your household?"
  option one "1 person" code 1
  option two "2 people" code 2
  option three "3-4 people" code 3
  option five "5 or more" code 4
  required

number household_members "Exact number of household members"
  min 1
  max 30
  step 1
  unit "people"
  required

yesno compost "Do you compost food scraps?"
  yes 1
  no 0

section waste "Food waste"

multiple wasted_items "Which foods are thrown away most often?"
  min 1
  max 3
  option rice "Rice"
  option bread "Bread"
  option vegetables "Vegetables"
  option dairy "Dairy"
  option meat "Meat"
  required

likert planning "Planning meals reduces waste"
  1 "Strongly disagree"
  2 "Disagree"
  3 "Neutral"
  4 "Agree"
  5 "Strongly agree"

likert attitude_shopping "We buy too much food"
  use frequency

matrix staples "How often does your household throw away:"
  scale frequency
  single_per_row
  rows {
    rice "Cooked rice"
    bread "Bread and bakery"
    vegetables "Fresh vegetables"
  }
  required

longtext notes "Anything else about food waste in your home?"
  maxlen 500

section follow_up "Follow-up"
new_page

questions using frequency {
  leftover_grains "Leftover grains thrown away"
  spoiled_produce "Produce spoiled before use"
}

date survey_date "Survey week starting"
time disposal_time "Usual disposal time"

consent consent_main "Study participation"
  introduction """
  Your answers are confidential and used only for this study.
  You may stop at any time.
  """
  purpose "Purpose of the study"
  procedures "What you will do"
  confidentiality "How your data is protected"
  acknowledgement "I have read the information above and agree to participate"
  required

participant_signature respondent_sign "Respondent"
  printed_name
  date
  required

researcher_signature enumerator_sign "Enumerator"
  role "Enumerator"
  no_printed_name
```

## Bangla example

Human-facing strings are Bangla; identifiers stay ASCII for portability.

```svelp
svelp 1

title "গৃহস্থালির খাদ্য অপচয় সম্পর্কিত জরিপ"
language "bn"

section background "সাধারণ তথ্য"
description "আপনার পরিবার সম্পর্কে কিছু তথ্য"

number age "আপনার বয়স কত?"
  min 0
  max 120
  step 1
  unit "বছর"
  required

yesno food_waste "আপনার পরিবারে খাবার অপচয় হয় কি?"
  yes 1
  no 0
  required

single education "আপনার শিক্ষাগত অবস্থা কী?"
  option primary "প্রাথমিক" code 1
  option secondary "মাধ্যমিক" code 2
  option higher "উচ্চ" code 3

shorttext village "আপনার গ্রামের নাম"
  maxlen 80
```

## Common mistakes

Missing header:

```svelp-error The file must start with
title "Forgot the header"

section s "Section"
```

Duplicate variable names:

```svelp-error Duplicate variable
svelp 1

title "Duplicate variable"

section s "Section"

shorttext name "First"
shorttext name "Second"
```

Unknown scale:

```svelp-error Unknown scale
svelp 1

title "Unknown scale"

section s "Section"

likert pace "The survey was easy"
  use missing_scale
```

Directive not valid for the question type:

```svelp-error is not valid for a single question
svelp 1

title "Wrong directive"

section s "Section"

single sex "Sex"
  option male "Male" code 1
  option female "Female" code 2
  unit "years"
```

Malformed option:

```svelp-error Expected an option label
svelp 1

title "Malformed option"

section s "Section"

single sex "Sex"
  option male
  option female "Female"
```

Duplicate codes:

```svelp-error Duplicate code
svelp 1

title "Duplicate code"

section s "Section"

single sex "Sex"
  option male "Male" code 1
  option female "Female" code 1
```

Ranking is not a source type:

```svelp-error cannot start a line here
svelp 1

title "Ranking attempt"

ranking priorities "Rank these"
```

Invalid identifier (uppercase or hyphen):

```svelp-error Identifiers use lowercase letters, digits, and underscores
svelp 1

title "Bad identifier"

section s "Section"

shorttext villageName "Where do you live?"
```

Unterminated string:

```svelp-error Missing closing quote
svelp 1

title "Unterminated"

section s "Section"

shorttext village "Where do you live?
```

Unterminated text block:

```svelp-error never closed
svelp 1

title "Open block"

consent agree "Agreement"
  introduction """
  This block never ends.
  acknowledgement "I agree"
```
