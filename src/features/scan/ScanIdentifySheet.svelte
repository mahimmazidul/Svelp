<script lang="ts">
  import Sheet from '../../components/ui/Sheet.svelte';
  import Button from '../../components/ui/Button.svelte';
  import Field from '../../components/ui/Field.svelte';
  import TextInput from '../../components/ui/TextInput.svelte';
  import type { ScanPageRecord } from '../../models/scan_models';
  import type { PrintLayoutRecord } from '../../models/print_models';
  import type { QuestionnaireRecord } from '../../models/types';

  let {
    open,
    page,
    questionnaires,
    layouts,
    onsubmit,
    onclose
  }: {
    open: boolean;
    page: ScanPageRecord | null;
    questionnaires: QuestionnaireRecord[];
    layouts: PrintLayoutRecord[];
    onsubmit: (bal_assignment: {
      questionnaireId: string;
      version: number;
      respondentId: string;
      pageNumber: number;
    }) => Promise<void> | void;
    onclose: () => void;
  } = $props();

  let bal_questionnaire_id = $state('');
  let bal_version_text = $state('1');
  let bal_respondent = $state('');
  let bal_page_text = $state('1');
  let bal_error = $state<string | null>(null);
  let bal_saving = $state(false);

  $effect(() => {
    if (open && questionnaires.length > 0 && bal_questionnaire_id === '') {
      bal_questionnaire_id = questionnaires[0].id;
      const bal_layout = layouts.find((bal_candidate) => bal_candidate.questionnaireId === bal_questionnaire_id);
      if (bal_layout) bal_version_text = String(bal_layout.questionnaireVersion);
    }
  });

  const bal_page_count = $derived.by(() => {
    const bal_layout = layouts.find(
      (bal_candidate) =>
        bal_candidate.questionnaireId === bal_questionnaire_id &&
        bal_candidate.questionnaireVersion === Number(bal_version_text)
    );
    return bal_layout ? bal_layout.geometry.pageCount || bal_layout.geometry.pages.length : 0;
  });

  async function bal_save(): Promise<void> {
    bal_error = null;
    if (!bal_questionnaire_id) {
      bal_error = 'Choose a questionnaire.';
      return;
    }
    const bal_version = Number(bal_version_text);
    const bal_page_number = Number(bal_page_text);
    if (!bal_version_text || Number.isNaN(bal_version) || bal_version < 1) {
      bal_error = 'Enter a valid version number.';
      return;
    }
    if (!bal_page_text || Number.isNaN(bal_page_number) || bal_page_number < 1) {
      bal_error = 'Enter a valid page number.';
      return;
    }
    if (bal_page_count > 0 && bal_page_number > bal_page_count) {
      bal_error = `This version has ${bal_page_count} pages.`;
      return;
    }
    if (!bal_respondent.trim()) {
      bal_error = 'Enter the respondent identifier.';
      return;
    }
    bal_saving = true;
    try {
      await onsubmit({
        questionnaireId: bal_questionnaire_id,
        version: bal_version,
        respondentId: bal_respondent.trim(),
        pageNumber: bal_page_number
      });
      bal_respondent = '';
      bal_page_text = '1';
    } finally {
      bal_saving = false;
    }
  }
</script>

<Sheet {open} title="Assign this page" side="bottom" {onclose}>
  {#if page}
    <div class="identify">
      <p class="context">
        {page.sourceName}
        {#if page.detectedPayloads && page.detectedPayloads.length > 0}
          — detected code{page.detectedPayloads.length > 1 ? 's' : ''}:
          {page.detectedPayloads.join(', ')}
        {/if}
      </p>
      <Field label="Questionnaire">
        <select bind:value={bal_questionnaire_id}>
          {#each questionnaires as bal_questionnaire (bal_questionnaire.id)}
            <option value={bal_questionnaire.id}>{bal_questionnaire.title}</option>
          {/each}
        </select>
      </Field>
      <div class="grid">
        <Field label="Version">
          <TextInput bind:value={bal_version_text} />
        </Field>
        <Field label="Page number" hint={bal_page_count > 0 ? `1 to ${bal_page_count}` : undefined}>
          <TextInput bind:value={bal_page_text} />
        </Field>
      </div>
      <Field label="Respondent identifier">
        <TextInput bind:value={bal_respondent} />
      </Field>
      {#if bal_error}
        <p class="error" role="alert">{bal_error}</p>
      {/if}
      <div class="actions">
        <Button variant="secondary" onclick={onclose}>Cancel</Button>
        <Button variant="primary" disabled={bal_saving} onclick={() => void bal_save()}>
          {bal_saving ? 'Saving…' : 'Assign page'}
        </Button>
      </div>
    </div>
  {/if}
</Sheet>

<style>
  .identify {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .context {
    margin: 0;
    color: var(--color-ink-2);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  select {
    height: 40px;
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    font: inherit;
    color: var(--color-ink);
  }
  .error {
    margin: 0;
    color: var(--color-danger);
    font-size: var(--text-sm);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
