<script lang="ts">
  import Field from '../../components/ui/Field.svelte';
  import Button from '../../components/ui/Button.svelte';
  import Sheet from '../../components/ui/Sheet.svelte';
  import TextInput from '../../components/ui/TextInput.svelte';
  import type { PrintBatchRecord } from '../../models/print_models';
  import type { QuestionnaireRecord, ResponseScaleRecord } from '../../models/types';
  import { bal_plan_respondent_ids, type bal_BatchPlanInput } from './print_batch';
  import { hati_pdf_bytes_many } from './biriyani_pdf';
  import { bal_generate_batch } from '../../services/print_service';

  let {
    open = $bindable(false),
    questionnaire,
    scales,
    projectId,
    onfinished
  }: {
    open?: boolean;
    questionnaire: QuestionnaireRecord;
    scales: ResponseScaleRecord[];
    projectId: string;
    onfinished?: (bal_batch: PrintBatchRecord) => void;
  } = $props();

  let bal_mode = $state<bal_BatchPlanInput['mode']>('sequential');
  let bal_count_text = $state('30');
  let bal_start_text = $state('1');
  let bal_prefix = $state('');
  let bal_padding_text = $state('3');
  let bal_custom_ids = $state('');
  let bal_working = $state(false);
  let bal_result = $state<{ batch: PrintBatchRecord; pages: number; bytes: Uint8Array } | null>(null);
  let bal_error = $state<string | null>(null);

  const bal_plan = $derived(
    bal_plan_respondent_ids({
      mode: bal_mode,
      count: Number(bal_count_text),
      start: Number(bal_start_text),
      prefix: bal_prefix,
      padding: Number(bal_padding_text),
      customIds: bal_custom_ids
    })
  );

  async function bal_run(): Promise<void> {
    bal_working = true;
    bal_error = null;
    try {
      const bal_generated = await bal_generate_batch({
        questionnaire,
        scales,
        projectId,
        plan: {
          mode: bal_mode,
          count: Number(bal_count_text),
          start: Number(bal_start_text),
          prefix: bal_prefix,
          padding: Number(bal_padding_text),
          customIds: bal_custom_ids
        }
      });
      const bal_bytes = await hati_pdf_bytes_many(bal_generated.documents as never);
      bal_result = {
        batch: bal_generated.batch,
        pages: (bal_generated.documents as { pageCount: number }[]).reduce(
          (bal_sum, bal_doc) => bal_sum + bal_doc.pageCount,
          0
        ),
        bytes: bal_bytes
      };
      onfinished?.(bal_generated.batch);
    } catch (bal_catch) {
      bal_error = bal_catch instanceof Error ? bal_catch.message : 'Batch generation failed.';
    } finally {
      bal_working = false;
    }
  }

  function bal_download(): void {
    if (!bal_result) return;
    const bal_blob = new Blob([bal_result.bytes as BlobPart], { type: 'application/pdf' });
    const bal_url = URL.createObjectURL(bal_blob);
    const bal_anchor = document.createElement('a');
    bal_anchor.href = bal_url;
    bal_anchor.download = `svelp-batch-${bal_result.batch.id.slice(0, 8)}.pdf`;
    document.body.appendChild(bal_anchor);
    bal_anchor.click();
    bal_anchor.remove();
    URL.revokeObjectURL(bal_url);
  }
</script>

<Sheet bind:open title="Generate print batch" side="bottom">
  <div class="batch">
    <div class="mode-row">
      <button
        type="button"
        class="mode"
        class:active={bal_mode === 'sequential'}
        onclick={() => (bal_mode = 'sequential')}
      >
        Sequential IDs
      </button>
      <button
        type="button"
        class="mode"
        class:active={bal_mode === 'list'}
        onclick={() => (bal_mode = 'list')}
      >
        Pasted ID list
      </button>
    </div>

    {#if bal_mode === 'sequential'}
      <div class="row-3">
        <Field label="Copies">
          <TextInput type="number" min="1" max="500" bind:value={bal_count_text} />
        </Field>
        <Field label="Start at">
          <TextInput type="number" min="0" bind:value={bal_start_text} />
        </Field>
        <Field label="Zero padding">
          <TextInput type="number" min="1" max="6" bind:value={bal_padding_text} />
        </Field>
      </div>
      <Field label="Prefix (optional)">
        <TextInput value={bal_prefix} placeholder="FFQ-" oninput={(bal_v) => (bal_prefix = bal_v)} />
      </Field>
    {:else}
      <Field label="One respondent ID per line" hint="Duplicates are rejected. Up to 500 IDs.">
        <textarea
          class="ids"
          bind:value={bal_custom_ids}
          rows={6}
          placeholder={'DFD-A01\nDFD-A02\nDFD-B07'}
        ></textarea>
      </Field>
    {/if}

    <div class="summary">
      {#if bal_plan.valid}
        <p class="ok">{bal_plan.respondentIds.length} respondents, first {bal_plan.respondentIds[0]}, last {bal_plan.respondentIds[bal_plan.respondentIds.length - 1]}</p>
      {:else}
        {#each bal_plan.errors as bal_message (bal_message)}
          <p class="bad">{bal_message}</p>
        {/each}
      {/if}
    </div>

    {#if bal_error}
      <p class="bad" role="alert">{bal_error}</p>
    {/if}

    {#if bal_result}
      <div class="result">
        <p class="ok">Batch saved. {bal_result.batch.respondentIds.length} copies, {bal_result.pages} PDF pages.</p>
        <Button variant="primary" icon="download" onclick={bal_download}>Download batch PDF</Button>
      </div>
    {/if}

    <div class="actions">
      <Button variant="ghost" onclick={() => (open = false)}>Close</Button>
      <Button
        variant="primary"
        icon="printer"
        disabled={!bal_plan.valid || bal_working}
        onclick={() => void bal_run()}
      >
        {bal_working ? 'Generating…' : 'Generate batch'}
      </Button>
    </div>
  </div>
</Sheet>

<style>
  .batch {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .mode-row {
    display: flex;
    gap: var(--space-2);
  }

  .mode {
    flex: 1;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    border-radius: var(--radius-md);
    height: 2.4rem;
    font-size: var(--text-sm);
    color: var(--color-ink);
    cursor: pointer;
  }

  .mode.active {
    border-color: var(--color-accent);
    color: var(--color-accent);
    background: var(--color-accent-soft);
  }

  .row-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
  }

  .ids {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-ink);
    background: var(--color-surface);
    resize: vertical;
  }

  .summary p,
  .result p {
    margin: 0;
    font-size: var(--text-sm);
  }

  .ok {
    color: var(--color-success-ink, var(--color-success));
  }

  .bad {
    color: var(--color-danger);
  }

  .result {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
