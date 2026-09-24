<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import EmptyState from '../../components/ui/EmptyState.svelte';
  import Icon from '../../icons/Icon.svelte';
  import { dhon_questionnaire_by_project } from '../../db/questionnaires_repo';
  import { derive_numbering, type DerivedNumbering } from '../../models/numbering';
  import type { QuestionnaireRecord } from '../../models/types';
  import SectionView from './renderers/SectionView.svelte';

  let { projectId }: { projectId: string } = $props();

  let bal_q = $state<QuestionnaireRecord | null>(null);
  let bal_status = $state<'loading' | 'ready' | 'error'>('loading');
  let bal_answers = $state<Record<string, string>>({});

  $effect(() => {
    void bal_load(projectId);
  });

  async function bal_load(bal_project_id: string): Promise<void> {
    bal_status = 'loading';
    try {
      bal_q = (await dhon_questionnaire_by_project(bal_project_id)) ?? null;
      bal_answers = {};
      bal_status = 'ready';
    } catch {
      bal_q = null;
      bal_status = 'error';
    }
  }

  const bal_numbering = $derived<DerivedNumbering | null>(bal_q ? derive_numbering(bal_q) : null);
  const bal_has_sections = $derived((bal_q?.sections.length ?? 0) > 0);
  const bal_paper_label = $derived(
    bal_q ? `${bal_q.paperSize.toUpperCase()} ${bal_q.orientation}` : ''
  );
</script>

<div class="page">
  <div class="page-header">
    <div class="page-header-text">
      <h1>Preview</h1>
      <p class="page-lede">
        A participant-facing rendering of the questionnaire definition. Answers shown here are
        kept in this view only and are never recorded.
      </p>
      {#if bal_q}
        <div class="chips">
          <span class="chip">Draft v{bal_q.version}</span>
          <span class="chip">{bal_q.language.toUpperCase()}</span>
          <span class="chip">{bal_paper_label}</span>
        </div>
      {/if}
    </div>
    <Button variant="secondary" icon="layers" href="#/project/{projectId}/build">
      Back to Build
    </Button>
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
        output and scanner templates.
      </p>
    </div>
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
          onanswer={(bal_item_id, bal_option_id) => {
            bal_answers[bal_item_id] = bal_option_id;
          }}
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
