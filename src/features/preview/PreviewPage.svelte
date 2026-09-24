<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import EmptyState from '../../components/ui/EmptyState.svelte';
  import Icon from '../../icons/Icon.svelte';
  import { ken_pori_scales } from '../../db/scales_repo';
  import { dhon_questionnaire_by_project } from '../../db/questionnaires_repo';
  import { normalize_questionnaire } from '../../models/factories';
  import { derive_numbering, type DerivedNumbering } from '../../models/numbering';
  import type { QuestionnaireRecord, ResponseScaleRecord } from '../../models/types';
  import {
    bal_empty_answers,
    bal_validate_answers,
    type AnswerMap
  } from './preview_answers';
  import SectionView from './renderers/SectionView.svelte';

  let { projectId }: { projectId: string } = $props();

  let bal_q = $state<QuestionnaireRecord | null>(null);
  let bal_scales = $state<ResponseScaleRecord[]>([]);
  let bal_status = $state<'loading' | 'ready' | 'error'>('loading');
  let bal_answers = $state<AnswerMap>({});
  let bal_errors = $state<Record<string, string>>({});
  let bal_checked_once = $state(false);

  $effect(() => {
    void bal_load(projectId);
  });

  async function bal_load(bal_project_id: string): Promise<void> {
    bal_status = 'loading';
    try {
      const bal_raw = await dhon_questionnaire_by_project(bal_project_id);
      bal_q = bal_raw ? normalize_questionnaire(bal_raw) : null;
      bal_scales = await ken_pori_scales();
      bal_answers = bal_q ? bal_empty_answers(bal_q) : {};
      bal_errors = {};
      bal_checked_once = false;
      bal_status = 'ready';
    } catch {
      bal_q = null;
      bal_status = 'error';
    }
  }

  function bal_reset(): void {
    if (!bal_q) return;
    bal_answers = bal_empty_answers(bal_q);
    bal_errors = {};
    bal_checked_once = false;
  }

  function bal_check(): void {
    if (!bal_q) return;
    bal_errors = bal_validate_answers(bal_q, bal_scales, bal_answers);
    bal_checked_once = true;
  }

  const bal_numbering = $derived<DerivedNumbering | null>(bal_q ? derive_numbering(bal_q) : null);
  const bal_has_sections = $derived((bal_q?.sections.length ?? 0) > 0);
  const bal_error_count = $derived(Object.keys(bal_errors).length);

  function bal_answer(bal_item_id: string, bal_value: unknown): void {
    bal_answers = { ...bal_answers, [bal_item_id]: bal_value as AnswerMap[string] };
    if (bal_checked_once && bal_errors[bal_item_id]) {
      const bal_rest = { ...bal_errors };
      delete bal_rest[bal_item_id];
      bal_errors = bal_rest;
    }
  }
</script>

<div class="page">
  <div class="page-header">
    <div class="page-header-text">
      <h1>Preview</h1>
      <p class="page-lede">
        Test the questionnaire as a fake respondent. Answers shown here stay on this screen
        and are never recorded.
      </p>
      {#if bal_q}
        <div class="chips">
          <span class="chip">Draft v{bal_q.version}</span>
          <span class="chip">{bal_q.language.toUpperCase()}</span>
          <span class="chip">{bal_q.paperSize.toUpperCase()} {bal_q.orientation}</span>
        </div>
      {/if}
    </div>
    <div class="header-actions">
      <Button variant="secondary" icon="history" onclick={bal_reset}>Reset</Button>
      <Button variant="primary" icon="check" onclick={bal_check}>Check answers</Button>
    </div>
  </div>

  {#if bal_status === 'loading'}
    <p class="muted">Loading preview…</p>
  {:else if bal_status === 'error' || !bal_q || !bal_numbering}
    <EmptyState
      icon="alert"
      title="Preview unavailable"
      body="The questionnaire could not be loaded from local storage."
    >
      <Button variant="secondary" onclick={() => void bal_load(projectId)}>Try again</Button>
    </EmptyState>
  {:else if !bal_has_sections}
    <EmptyState
      icon="file-text"
      title="Nothing to preview yet"
      body="This questionnaire has no sections or questions. Build it first, then return here."
    >
      <Button variant="primary" icon="layers" href="#/project/{projectId}/build">
        Open builder
      </Button>
    </EmptyState>
  {:else}
    <div class="notice">
      <Icon name="info" size={17} />
      <p>
        This preview renders from the same structured definition that will later drive print
        output and scanner templates. Required fields and validation rules behave as they
        will for participants.
      </p>
    </div>
    {#if bal_checked_once && bal_error_count > 0}
      <div class="result" role="status">
        <Icon name="alert" size={17} />
        <p>
          {bal_error_count}
          {bal_error_count === 1 ? 'answer needs' : 'answers need'} attention below.
        </p>
      </div>
    {:else if bal_checked_once && bal_error_count === 0}
      <div class="result ok" role="status">
        <Icon name="circle-check" size={17} />
        <p>Every answer passes the questionnaire's validation rules.</p>
      </div>
    {/if}
    <article class="sheet">
      <header class="sheet-head">
        <h2 class="sheet-title">{bal_q.title}</h2>
        {#if bal_q.description}
          <p class="sheet-desc">{bal_q.description}</p>
        {/if}
      </header>
      {#each bal_q.sections as bal_section, bal_si (bal_section.id)}
        <SectionView
          section={bal_section}
          section_index={bal_si}
          numbering={bal_numbering}
          answers={bal_answers}
          scales={bal_scales}
          errors={bal_errors}
          onanswer={bal_answer}
        />
      {/each}
    </article>
  {/if}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .chip {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-ink-2);
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-full);
    padding: 3px 10px;
  }

  .header-actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .notice {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border: var(--border-width) solid var(--color-border);
    border-left: 3px solid var(--color-accent);
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    color: var(--color-ink-2);
    margin-bottom: var(--space-5);
  }

  .notice :global(svg) {
    flex: none;
    color: var(--color-accent);
    margin-top: 2px;
  }

  .result {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border: var(--border-width) solid var(--color-warning-soft);
    border-left: 3px solid var(--color-warning-ink);
    border-radius: var(--radius-md);
    background: var(--color-warning-soft);
    color: var(--color-warning-ink);
    margin-bottom: var(--space-5);
    font-size: var(--text-sm);
  }

  .result.ok {
    border-color: transparent;
    border-left: 3px solid var(--color-success);
    background: var(--color-success-soft);
    color: var(--color-success);
  }

  .result :global(svg) {
    flex: none;
    margin-top: 2px;
  }

  .sheet {
    max-width: 760px;
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: clamp(var(--space-4), 4vw, var(--space-7));
    display: grid;
    gap: var(--space-6);
  }

  .sheet-head {
    display: grid;
    gap: var(--space-2);
    padding-bottom: var(--space-4);
    border-bottom: var(--border-width) solid var(--color-border);
  }

  .sheet-title {
    font-size: var(--text-2xl);
  }

  .sheet-desc {
    color: var(--color-ink-2);
  }
</style>
