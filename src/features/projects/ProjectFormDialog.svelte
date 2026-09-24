<script lang="ts">
  import Dialog from '../../components/ui/Dialog.svelte';
  import Button from '../../components/ui/Button.svelte';
  import Field from '../../components/ui/Field.svelte';
  import TextInput from '../../components/ui/TextInput.svelte';
  import TextArea from '../../components/ui/TextArea.svelte';
  import type { ProjectRecord } from '../../models/types';

  let {
    open = $bindable(false),
    mode,
    initial = null,
    onsubmit,
    oncancel
  }: {
    open?: boolean;
    mode: 'create' | 'rename';
    initial?: ProjectRecord | null;
    onsubmit: (bal_values: { title: string; description: string }) => Promise<void> | void;
    oncancel: () => void;
  } = $props();

  let bal_title = $state('');
  let bal_description = $state('');
  let bal_error = $state<string | null>(null);
  let bal_busy = $state(false);

  $effect(() => {
    if (open) {
      bal_title = initial?.title ?? '';
      bal_description = initial?.description ?? '';
      bal_error = null;
    }
  });

  async function bal_submit(bal_event: SubmitEvent): Promise<void> {
    bal_event.preventDefault();
    const bal_trimmed = bal_title.trim();
    if (bal_trimmed === '') {
      bal_error = 'A project title is required.';
      return;
    }
    bal_busy = true;
    try {
      await onsubmit({ title: bal_trimmed, description: bal_description.trim() });
    } finally {
      bal_busy = false;
    }
  }
</script>

<Dialog bind:open title={mode === 'create' ? 'New project' : 'Rename project'} onclose={oncancel}>
  <form class="form" onsubmit={bal_submit}>
    <Field label="Title" error={bal_error}>
      <TextInput
        placeholder="For example: Community Nutrition Survey 2026"
        bind:value={bal_title}
        error={bal_error !== null}
        maxlength="120"
      />
    </Field>
    <Field label="Description" hint="Optional. Describe the study or questionnaire.">
      <TextArea rows="3" maxlength="280" bind:value={bal_description} placeholder="Optional description" />
    </Field>
    <div class="actions">
      <Button variant="secondary" onclick={oncancel}>Cancel</Button>
      <Button variant="primary" type="submit" disabled={bal_busy}>
        {mode === 'create' ? 'Create project' : 'Save changes'}
      </Button>
    </div>
  </form>
</Dialog>

<style>
  .form {
    display: grid;
    gap: var(--space-4);
    padding-bottom: var(--space-2);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    padding-top: var(--space-2);
  }

  @media (max-width: 480px) {
    .actions {
      flex-direction: column-reverse;
    }

    .actions :global(.btn) {
      width: 100%;
    }
  }
</style>
