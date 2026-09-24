<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import Dialog from '../../components/ui/Dialog.svelte';
  import Field from '../../components/ui/Field.svelte';
  import { bal_plan_bulk_questions, bal_split_paste_lines } from './builder_ops';
  import { builder_state } from './builder_state';

  let {
    open = $bindable(false),
    sectionId = null
  }: {
    open?: boolean;
    sectionId?: string | null;
  } = $props();

  const bal_state = $derived($builder_state);
  const bal_q = $derived(bal_state.questionnaire);

  const BAL_BULK_EXAMPLE = 'Rice\nFish\nEgg\nMilk';

  let bal_target = $state<string | null>(null);
  let bal_type = $state<'single_choice' | 'multiple_choice'>('single_choice');
  let bal_scale_id = $state<string>('');
  let bal_text = $state('');

  $effect(() => {
    if (open) {
      bal_target = sectionId ?? bal_q?.sections[0]?.id ?? null;
      bal_type = 'single_choice';
      bal_scale_id = '';
      bal_text = '';
    }
  });

  const bal_labels = $derived(bal_split_paste_lines(bal_text));
  const bal_plan = $derived(
    bal_q && bal_labels.length > 0 ? bal_plan_bulk_questions(bal_q, bal_labels) : []
  );

  function bal_create(): void {
    if (!bal_target || bal_labels.length === 0) return;
    builder_state.bulk_create(
      bal_target,
      bal_type,
      bal_labels,
      bal_scale_id === '' ? null : bal_scale_id
    );
    open = false;
  }
</script>

<Dialog bind:open title="Create questions from a list" onclose={() => (open = false)}>
  <div class="bulk">
    <p class="bulk-hint">
      Paste one question label per line. Every line becomes a question with a suggested
      variable name, sharing the selected response scale.
    </p>
    <Field label="Question labels" hint="For example a full food list for a frequency questionnaire.">
      <textarea
        class="bulk-area"
        rows="8"
        bind:value={bal_text}
        placeholder={BAL_BULK_EXAMPLE}
        aria-label="Question labels, one per line"
      ></textarea>
    </Field>
    <div class="bulk-row">
      <Field label="Question type">
        <select class="bulk-select" bind:value={bal_type}>
          <option value="single_choice">Single choice</option>
          <option value="multiple_choice">Multiple choice</option>
        </select>
      </Field>
      <Field label="Shared response scale">
        <select class="bulk-select" bind:value={bal_scale_id}>
          <option value="">No scale, default options</option>
          {#each bal_state.scales as bal_scale (bal_scale.id)}
            <option value={bal_scale.id}>{bal_scale.name}</option>
          {/each}
        </select>
      </Field>
    </div>
    <Field label="Target section">
      <select class="bulk-select" bind:value={bal_target}>
        {#each bal_q?.sections ?? [] as bal_section, bal_si (bal_section.id)}
          <option value={bal_section.id}>
            {bal_si + 1}. {bal_section.title.trim() !== '' ? bal_section.title : 'Untitled section'}
          </option>
        {/each}
      </select>
    </Field>
    {#if bal_plan.length > 0}
      <div class="bulk-preview">
        <div class="preview-head">
          <span>{bal_plan.length} question{bal_plan.length === 1 ? '' : 's'} will be created</span>
          <span class="preview-col">Variable names</span>
        </div>
        <ul class="preview-list">
          {#each bal_plan as bal_entry (bal_entry.variableName)}
            <li>
              <span class="preview-label">{bal_entry.label}</span>
              <code class="preview-var">{bal_entry.variableName}</code>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
  {#snippet footer()}
    <div class="bulk-actions">
      <Button variant="secondary" onclick={() => (open = false)}>Cancel</Button>
      <Button
        variant="primary"
        disabled={bal_plan.length === 0 || !bal_target}
        onclick={bal_create}
      >
        Create {bal_plan.length > 0 ? bal_plan.length : ''}
      </Button>
    </div>
  {/snippet}
</Dialog>

<style>
  .bulk {
    display: grid;
    gap: var(--space-4);
  }

  .bulk-hint {
    font-size: var(--text-sm);
    color: var(--color-ink-2);
  }

  .bulk-area {
    width: 100%;
    resize: vertical;
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    line-height: var(--leading);
    color: var(--color-ink);
    background: var(--color-surface);
  }

  .bulk-area:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .bulk-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  .bulk-select {
    width: 100%;
    height: var(--control-height);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .bulk-select:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .bulk-preview {
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .preview-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface-2);
    border-bottom: var(--border-width) solid var(--color-border);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-ink-2);
  }

  .preview-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 200px;
    overflow-y: auto;
  }

  .preview-list li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-sm);
  }

  .preview-list li:nth-child(odd) {
    background: var(--color-surface-2);
  }

  .preview-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-var {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-accent);
    flex: none;
  }

  .bulk-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }

  @media (max-width: 560px) {
    .bulk-row {
      grid-template-columns: 1fr;
    }
  }
</style>
