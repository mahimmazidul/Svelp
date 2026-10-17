<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Button from '../../components/ui/Button.svelte';
  import Sheet from '../../components/ui/Sheet.svelte';
  import Icon from '../../icons/Icon.svelte';
  import { builder_state } from '../builder/builder_state';
  import { project_context } from '../../app/project_context';
  import { ken_pori_responses_by_project } from '../../db/response_repo';
  import { malta_download_file } from '../../utils/download';
  import { bal_sanitize_filename } from '../mahim/mahim_filenames';
  import {
    bal_source_apply_plan,
    bal_source_format,
    bal_source_from_questionnaire,
    type bal_ParseOutcome
  } from './bal_source_pipeline';
  import type { bal_ApplyPlan } from './bani_compile';
  import type { bal_EditorHost } from './source_editor_cm';

  let bal_host_el: HTMLDivElement | null = $state(null);
  let bal_editor: bal_EditorHost | null = null;
  let bal_editor_ready = $state(false);
  let bal_load_error = $state(false);
  let bal_text = $state('');
  let bal_canonical = $state('');
  let bal_parse_timer: ReturnType<typeof setTimeout> | null = null;
  let bal_outcome = $state<bal_ParseOutcome>({ ok: false, problems: { errors: [], warnings: [], infos: [] }, applyPlan: null });
  let bal_data_variables = new Set<string>();
  let bal_preview_open = $state(false);
  let bal_problems_open = $state(false);
  let bal_goto_open = $state(false);
  let bal_goto_value = $state('');
  let bal_copied = $state(false);
  let bal_help_open = $state(false);

  const bal_docs_base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : import.meta.env.BASE_URL + '/';

  const BAL_HELP_SECTIONS: { title: string; code: string }[] = [
    {
      title: 'File',
      code: [
        'svelp 1',
        '',
        'title "Survey title"',
        'description "Optional study description"',
        'language "bn"',
        'paper a4',
        'orientation portrait'
      ].join('\n')
    },
    {
      title: 'Sections and questions',
      code: [
        'section background "Background"',
        'description "Who is answering"',
        'new_page',
        '',
        'instruction intro "Please answer honestly."',
        '',
        'single sex "Sex"',
        '  option male "Male" code 1',
        '  option female "Female" code 2',
        '  required',
        '',
        'multiple crops "Which crops?"',
        '  min 1',
        '  max 3',
        '  option rice "Rice"',
        '  option wheat "Wheat"',
        '',
        'yesno owns_land "Do you own land?"',
        '  required',
        '',
        'shorttext village "Village name"',
        '  maxlen 60',
        '',
        'longtext notes "Any notes?"',
        '  maxlen 500',
        '',
        'number age "Age in years"',
        '  min 0',
        '  max 120',
        '  step 1',
        '  unit "years"',
        '  required',
        '',
        'date visited "Last visit"',
        'time wake_up "Wake up time"',
        '',
        'likert trust "I trust the process"',
        '  1 "Strongly disagree"',
        '  2 "Disagree"',
        '  3 "Neutral"',
        '  4 "Agree"',
        '  5 "Strongly agree"'
      ].join('\n')
    },
    {
      title: 'Scales, matrices, bulk questions',
      code: [
        'scale frequency',
        '  option never "Never" code 0',
        '  option often "Often" code 1',
        '',
        'matrix diet "How often do you eat:"',
        '  scale frequency',
        '  single_per_row',
        '  rows {',
        '    rice "Rice"',
        '    wheat "Wheat"',
        '  }',
        '',
        'questions using frequency {',
        '  breakfast "Breakfast"',
        '  dinner "Dinner"',
        '}'
      ].join('\n')
    },
    {
      title: 'Consent and signatures',
      code: [
        'consent agree "Participation"',
        '  introduction """',
        '  You may leave the study at any time.',
        '  """',
        '  purpose "Why this study runs"',
        '  acknowledgement "I agree"',
        '  required',
        '',
        'participant_signature sign1 "Participant"',
        '  printed_name',
        '  date',
        '',
        'researcher_signature sign2 "Researcher"',
        '  role "Enumerator"'
      ].join('\n')
    }
  ];

  const BAL_HELP_RULES: string[] = [
    'The file must start with svelp 1.',
    'Names are lowercase with underscores, like rice_price.',
    'Reserved words cannot be names; hyphens and capitals are not allowed.',
    'Variable names must be unique across the questionnaire.',
    'Codes must not repeat inside one question or scale.',
    'There are no comments, expressions, ranking, or code execution in v1.'
  ];
  let bal_import_input: HTMLInputElement | null = $state(null);

  let bal_dirty = $derived(bal_text !== bal_canonical);
  let bal_plan = $derived<bal_ApplyPlan | null>(
    bal_outcome.ok && bal_outcome.applyPlan ? bal_outcome.applyPlan : null
  );
  let bal_all_problems = $derived([
    ...bal_outcome.problems.errors,
    ...bal_outcome.problems.warnings,
    ...bal_outcome.problems.infos
  ]);

  function bal_regenerate(): void {
    const bal_state = builder_state.current();
    if (!bal_state.questionnaire) return;
    const bal_result = bal_source_from_questionnaire(bal_state.questionnaire, bal_state.scales);
    bal_canonical = bal_result.text;
    if (!bal_dirty) {
      bal_text = bal_result.text;
      if (bal_editor) bal_editor.view.dispatch({ changes: { from: 0, to: bal_editor.view.state.doc.length, insert: bal_result.text } });
    }
    void bal_schedule_parse();
  }

  function bal_schedule_parse(): void {
    if (bal_parse_timer) clearTimeout(bal_parse_timer);
    bal_parse_timer = setTimeout(() => {
      bal_parse_timer = null;
      bal_outcome = bal_source_apply_plan(bal_text, builder_state.current().questionnaire, builder_state.current().scales, bal_data_variables);
      bal_editor?.set_problems(bal_all_problems);
    }, 400);
  }

  function bal_apply(): void {
    if (!bal_plan || !bal_plan.ok) return;
    const bal_changes = bal_plan.changes;
    const bal_destructive =
      bal_changes.itemsRemoved > 0 ||
      bal_changes.variablesRemovedWithData.length > 0 ||
      bal_changes.variablesRenamed.length > 0;
    if (bal_destructive) {
      bal_preview_open = true;
      return;
    }
    bal_commit();
  }

  function bal_commit(): void {
    if (!bal_plan || !bal_plan.ok) return;
    builder_state.apply_source(bal_plan.questionnaire, bal_plan.scales);
    bal_preview_open = false;
    bal_dirty = false;
    setTimeout(() => bal_regenerate(), 30);
  }

  function bal_format(): void {
    const bal_formatted = bal_source_format(bal_text);
    if (bal_formatted === null) return;
    bal_text = bal_formatted;
    bal_editor?.view.dispatch({ changes: { from: 0, to: bal_editor.view.state.doc.length, insert: bal_formatted } });
  }

  async function bal_copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(bal_text);
      bal_copied = true;
      setTimeout(() => (bal_copied = false), 1500);
    } catch {
      bal_copied = false;
    }
  }

  async function bal_paste(): Promise<void> {
    try {
      const bal_clip = await navigator.clipboard.readText();
      if (bal_clip.length === 0) return;
      bal_editor?.view.dispatch({ changes: { from: 0, to: bal_editor.view.state.doc.length, insert: bal_clip } });
    } catch {
      return;
    }
  }

  function bal_export(): void {
    const bal_state = builder_state.current();
    if (!bal_state.questionnaire) return;
    const bal_project = $project_context.project;
    const bal_name = `${bal_project?.title ?? 'Svelp'}-v${bal_state.questionnaire.version}-questionnaire`;
    malta_download_file(bal_sanitize_filename(bal_name, '.svelp.txt'), bal_text, 'text/plain');
  }

  async function bal_import_file(bal_file: File): Promise<void> {
    const bal_content = await bal_file.text();
    bal_editor?.view.dispatch({ changes: { from: 0, to: bal_editor.view.state.doc.length, insert: bal_content } });
  }

  function bal_goto(): void {
    const bal_line = Number.parseInt(bal_goto_value, 10);
    if (Number.isFinite(bal_line)) bal_editor?.focus_line(bal_line, 1);
    bal_goto_open = false;
  }

  export function bal_is_dirty(): boolean {
    return bal_dirty;
  }

  export function bal_apply_now(): void {
    bal_apply();
  }

  export function bal_discard(): void {
    bal_text = bal_canonical;
    bal_editor?.view.dispatch({ changes: { from: 0, to: bal_editor.view.state.doc.length, insert: bal_canonical } });
    void bal_schedule_parse();
  }

  onMount(() => {
    void (async () => {
      const bal_responses = await ken_pori_responses_by_project($project_context.project?.id ?? '').catch(
        () => []
      );
      bal_data_variables = new Set(
        bal_responses.map((bal_r) => bal_r.variableName).filter((bal_v): bal_v is string => Boolean(bal_v))
      );
      const bal_state = builder_state.current();
      if (bal_state.questionnaire) {
        const bal_result = bal_source_from_questionnaire(bal_state.questionnaire, bal_state.scales);
        bal_canonical = bal_result.text;
        bal_text = bal_result.text;
      }
      const bal_cm = await import('./source_editor_cm').catch(() => null);
      if (!bal_cm) {
        bal_load_error = true;
        return;
      }
      await tick();
      if (bal_host_el) {
        bal_editor = bal_cm.bal_mount_source_editor(bal_host_el, bal_text, (bal_next) => {
          bal_text = bal_next;
          void bal_schedule_parse();
        });
        bal_editor_ready = true;
        bal_outcome = bal_source_apply_plan(bal_text, bal_state.questionnaire, bal_state.scales, bal_data_variables);
        bal_editor.set_problems(bal_all_problems);
      }
    })();
    return () => {
      bal_editor?.destroy();
      bal_editor = null;
    };
  });

  $effect(() => {
    const bal_state = builder_state.current();
    if (bal_state.questionnaire && !bal_dirty) {
      const bal_result = bal_source_from_questionnaire(bal_state.questionnaire, bal_state.scales);
      if (bal_result.text !== bal_canonical && bal_result.text !== bal_text) {
        bal_canonical = bal_result.text;
        bal_text = bal_result.text;
        bal_editor?.view.dispatch({ changes: { from: 0, to: bal_editor.view.state.doc.length, insert: bal_result.text } });
      }
    }
  });

</script>

<div class="source-mode">
  <div class="toolbar">
    <Button size="sm" variant="primary" disabled={!bal_plan} onclick={bal_apply}>
      <Icon name="check" size={14} />
      Apply
    </Button>
    <Button size="sm" onclick={bal_format} disabled={!bal_dirty}>Format</Button>
    <span class="state" data-state={bal_dirty ? 'dirty' : bal_outcome.ok ? 'valid' : 'invalid'}>
      {bal_dirty ? (bal_outcome.ok ? 'Unapplied changes · valid' : 'Unapplied changes · invalid') : bal_outcome.ok ? 'Valid' : 'Invalid'}
    </span>
    <span class="spacer"></span>
    <Button size="sm" onclick={() => (bal_problems_open = true)}>
      Problems{bal_all_problems.length > 0 ? ` · ${bal_all_problems.length}` : ''}
    </Button>
    <Button size="sm" onclick={() => (bal_goto_open = !bal_goto_open)}>Go to line</Button>
    <Button size="sm" onclick={() => bal_editor?.select_all()}>Select all</Button>
    <Button size="sm" onclick={() => void bal_copy()}>{bal_copied ? 'Copied' : 'Copy'}</Button>
    <Button size="sm" onclick={() => void bal_paste()}>Paste</Button>
    <Button size="sm" onclick={() => bal_import_input?.click()}>Import</Button>
    <Button size="sm" onclick={bal_export}>Export</Button>
    <Button size="sm" onclick={() => (bal_help_open = true)}>Help</Button>
    <input
      type="file"
      accept=".txt,.svelp.txt,text/plain"
      hidden
      bind:this={bal_import_input}
      onchange={(bal_event) => {
        const bal_file = bal_event.currentTarget.files?.[0];
        if (bal_file) void bal_import_file(bal_file);
        bal_event.currentTarget.value = '';
      }}
    />
  </div>

  {#if bal_goto_open}
    <form class="goto" onsubmit={(bal_event) => { bal_event.preventDefault(); bal_goto(); }}>
      <label for="goto-line">Line</label>
      <input id="goto-line" type="number" min="1" bind:value={bal_goto_value} />
      <Button size="sm" type="submit">Go</Button>
    </form>
  {/if}

  {#if bal_load_error}
    <div class="placeholder" role="alert">
      <p>The source editor could not be loaded. Your questionnaire is safe.</p>
      <p>Reload the app, then open the Source tab again.</p>
      <Button variant="primary" onclick={() => window.location.reload()}>Reload</Button>
    </div>
  {:else if !bal_editor_ready}
    <div class="placeholder"><p class="muted">Loading editor…</p></div>
  {/if}
  <div class="editor-host" bind:this={bal_host_el} class:hidden={!bal_editor_ready}></div>

  {#snippet bal_problem_rows()}
    <ul>
      {#each bal_all_problems.slice(0, 50) as bal_problem, bal_problem_index (bal_problem_index)}
        <li class={bal_problem.severity}>
          <button
            type="button"
            onclick={() => {
              bal_editor?.focus_line(bal_problem.line, bal_problem.column);
              bal_problems_open = false;
            }}
          >
            <span class="loc">Line {bal_problem.line}</span>
            {bal_problem.message}
          </button>
        </li>
      {/each}
      {#if bal_all_problems.length > 50}
        <li class="muted">Showing the first 50 of {bal_all_problems.length}.</li>
      {/if}
    </ul>
  {/snippet}

  <aside class="problems" class:empty={bal_all_problems.length === 0}>
    <h3>
      Problems
      {#if bal_outcome.problems.errors.length > 0}
        <span class="count error">{bal_outcome.problems.errors.length} errors</span>
      {/if}
      {#if bal_outcome.problems.warnings.length > 0}
        <span class="count warning">{bal_outcome.problems.warnings.length} warnings</span>
      {/if}
      {#if bal_outcome.problems.infos.length > 0}
        <span class="count info">{bal_outcome.problems.infos.length} info</span>
      {/if}
      {#if bal_all_problems.length === 0}
        <span class="count ok">No problems</span>
      {/if}
    </h3>
    {@render bal_problem_rows()}
  </aside>

  <Sheet bind:open={bal_problems_open} side="bottom" title="Problems">
    <div class="problems sheet-body" class:empty={bal_all_problems.length === 0}>
      {@render bal_problem_rows()}
    </div>
  </Sheet>

  <Sheet bind:open={bal_help_open} side="bottom" title="Svelp source syntax">
    <div class="help-body">
      <p class="help-lede">
        This sheet covers the everyday syntax. The complete language reference is also published on
        the web and ships with the app.
      </p>
      {#each BAL_HELP_SECTIONS as bal_section (bal_section.title)}
        <h4>{bal_section.title}</h4>
        <pre>{bal_section.code}</pre>
      {/each}
      <h4>Rules</h4>
      <ul class="help-rules">
        {#each BAL_HELP_RULES as bal_rule (bal_rule)}
          <li>{bal_rule}</li>
        {/each}
      </ul>
      <p class="help-doc-link">
        <a href="{bal_docs_base}docs/source-language/" target="_blank" rel="noopener">Open the full language reference</a>
      </p>
    </div>
  </Sheet>

  {#if bal_preview_open && bal_plan?.ok}
    <div class="overlay" role="dialog" aria-modal="true">
      <div class="dialog">
        <h3>Apply source changes?</h3>
        <ul class="changes">
          <li>{bal_plan.changes.itemsAdded} question{bal_plan.changes.itemsAdded === 1 ? '' : 's'} added</li>
          <li>{bal_plan.changes.itemsRemoved} question{bal_plan.changes.itemsRemoved === 1 ? '' : 's'} removed</li>
          <li>{bal_plan.changes.itemsModified} question{bal_plan.changes.itemsModified === 1 ? '' : 's'} modified</li>
          <li>{bal_plan.changes.sectionsAdded} section{bal_plan.changes.sectionsAdded === 1 ? '' : 's'} added · {bal_plan.changes.sectionsRemoved} removed</li>
          {#each bal_plan.changes.variablesRenamed as bal_rename (bal_rename.from + bal_rename.to)}
            <li>Variable renamed: {bal_rename.from} → {bal_rename.to}</li>
          {/each}
          <li>0 validation errors</li>
        </ul>
        {#if bal_plan.changes.variablesRemovedWithData.length > 0}
          <p class="warn-text">
            Removing questions that already have responses also removes their answers from review and exports:
            {bal_plan.changes.variablesRemovedWithData.join(', ')}.
          </p>
        {/if}
        <div class="dialog-actions">
          <Button onclick={() => (bal_preview_open = false)}>Stay in source</Button>
          <Button variant="danger" onclick={bal_commit}>Apply changes</Button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .source-mode {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    min-height: 0;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .toolbar :global(button) {
    flex: 0 0 auto;
  }
  .spacer {
    flex: 1 1 auto;
  }
  .state {
    font-size: 13px;
    color: var(--text-muted);
  }
  .state[data-state='valid'] {
    color: var(--success, #1a7f37);
  }
  .state[data-state='invalid'] {
    color: var(--danger, #c62828);
  }
  .goto {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .goto input {
    width: 90px;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .placeholder,
  .editor-host {
    flex: 1 1 auto;
    min-height: 220px;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: auto;
    background: var(--surface);
  }
  .placeholder {
    display: grid;
    place-items: center;
  }
  .editor-host.hidden {
    display: none;
  }
  .editor-host :global(.cm-editor) {
    height: 100%;
    font-size: 13px;
  }
  .editor-host :global(.cm-scroller) {
    font-family: var(--font-mono, ui-monospace, monospace);
    line-height: 1.55;
  }
  .problems {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    padding: 10px 12px;
    max-height: 220px;
    overflow-y: auto;
  }
  .problems.empty {
    opacity: 0.85;
  }
  @media (max-width: 768px) {
    .problems:not(.sheet-body) {
      display: none;
    }
    .sheet-body {
      border: none;
      max-height: 50vh;
    }
  }
  .help-body {
    display: grid;
    gap: 10px;
  }
  .help-body h4 {
    margin: 4px 0 0;
    font-size: 13px;
  }
  .help-body pre {
    margin: 0;
    padding: 8px 10px;
    background: var(--color-surface-2);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre;
  }
  .help-doc-link {
    margin: 0.75rem 0 0;
  }
  .help-doc-link a {
    color: var(--accent);
    font-weight: 600;
  }
  .help-lede {
    margin: 0;
    font-size: 13px;
    color: var(--color-ink-2);
  }
  .help-rules {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
    display: grid;
    gap: 4px;
  }
  .problems h3 {
    margin: 0 0 6px;
    font-size: 13px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .count {
    font-weight: 500;
  }
  .count.error {
    color: var(--danger, #c62828);
  }
  .count.warning {
    color: var(--warning, #b45309);
  }
  .count.info {
    color: var(--accent, #1c5d99);
  }
  .count.ok {
    color: var(--success, #1a7f37);
  }
  .problems ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .problems button {
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    padding: 4px 6px;
    border-radius: 6px;
    cursor: pointer;
    width: 100%;
  }
  .problems button:hover {
    background: var(--surface-raised);
  }
  .loc {
    display: inline-block;
    min-width: 64px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(9, 18, 30, 0.45);
    display: grid;
    place-items: center;
    z-index: 60;
    padding: 16px;
  }
  .dialog {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px;
    max-width: 460px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .dialog h3 {
    margin: 0;
    font-size: 16px;
  }
  .changes {
    margin: 0;
    padding-left: 18px;
    font-size: 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .warn-text {
    margin: 0;
    font-size: 13px;
    color: var(--danger, #c62828);
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  @media (max-width: 768px) {
    .toolbar :global(button) {
      flex: 1 1 auto;
    }
    .problems {
      max-height: 160px;
    }
  }
</style>
