<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import ConfirmDialog from '../../components/ui/ConfirmDialog.svelte';
  import Field from '../../components/ui/Field.svelte';
  import Switch from '../../components/ui/Switch.svelte';
  import TextInput from '../../components/ui/TextInput.svelte';
  import { derive_numbering } from '../../models/numbering';
  import { item_descriptor } from '../../models/item_catalog';
  import { validate_variable_name } from '../../models/variable_names';
  import { builder_state } from './builder_state';

  const bal_state = $derived($builder_state);
  const bal_q = $derived(bal_state.questionnaire);
  const bal_numbering = $derived(bal_q ? derive_numbering(bal_q) : null);

  const bal_item_found = $derived.by(() => {
    if (!bal_q || bal_state.selectedItemId === null) return null;
    for (const bal_s of bal_q.sections) {
      const bal_item = bal_s.items.find((bal_x) => bal_x.id === bal_state.selectedItemId);
      if (bal_item) return { item: bal_item, section: bal_s };
    }
    return null;
  });

  const bal_section_ref = $derived(
    bal_q && !bal_item_found && bal_state.selectedSectionId
      ? bal_q.sections.find((bal_s) => bal_s.id === bal_state.selectedSectionId) ?? null
      : null
  );

  const bal_descriptor = $derived(bal_item_found ? item_descriptor(bal_item_found.item.type) : null);

  let bal_var_draft = $state('');
  let bal_var_touched_id = $state<string | null>(null);

  $effect(() => {
    const bal_item = bal_item_found?.item ?? null;
    if (bal_item && bal_var_touched_id !== bal_item.id) {
      bal_var_draft = bal_item.variableName ?? '';
      bal_var_touched_id = bal_item.id;
    }
  });

  const bal_var_error = $derived.by(() => {
    if (!bal_item_found || !bal_descriptor?.usesVariableName) return null;
    const bal_others = builder_state
      .taken_variable_names()
      .filter((bal_name) => bal_name !== bal_item_found.item.variableName);
    return validate_variable_name(bal_var_draft, bal_others);
  });

  function bal_commit_variable(): void {
    if (!bal_item_found || bal_var_error !== null) return;
    const bal_trimmed = bal_var_draft.trim();
    if (bal_trimmed === '') return;
    builder_state.update_item(bal_item_found.item.id, { variableName: bal_trimmed });
  }

  let shawya_delete_kind = $state<null | 'item' | 'section'>(null);
</script>

{#if bal_item_found && bal_descriptor && bal_numbering}
  <div class="props">
    {#if bal_descriptor.usesVariableName}
      <Field
        label="Variable name"
        hint="Stable analysis name. Question numbers stay derived and never become identifiers."
        error={bal_var_error}
      >
        <TextInput
          bind:value={bal_var_draft}
          error={bal_var_error !== null}
          maxlength="64"
          oninput={() => bal_commit_variable()}
        />
      </Field>
    {/if}
    {#if bal_descriptor.supportsRequired}
      <Switch
        label="Required"
        hint="Participants must answer before moving on in digital previews."
        checked={bal_item_found.item.required}
        onchange={(bal_checked) =>
          builder_state.update_item(bal_item_found.item.id, { required: bal_checked })}
      />
    {/if}
    <div class="meta">
      <div class="meta-row">
        <span class="meta-key">Derived number</span>
        <span class="meta-value">{bal_numbering.itemLabels[bal_item_found.item.id] ?? '—'}</span>
      </div>
      <div class="meta-row">
        <span class="meta-key">Item type</span>
        <span class="meta-value">{bal_descriptor.label}</span>
      </div>
      <div class="meta-row">
        <span class="meta-key">Stable ID</span>
        <span class="meta-value mono">{bal_item_found.item.id}</span>
      </div>
    </div>
    <div class="future">
      <p class="future-text">
        Scanner and print configuration for this question will be managed here in a future
        release.
      </p>
    </div>
    <div class="actions">
      <Button
        variant="secondary"
        size="sm"
        icon="chevron-up"
        onclick={() => builder_state.move_item(bal_item_found.item.id, -1)}
      >
        Move up
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon="chevron-down"
        onclick={() => builder_state.move_item(bal_item_found.item.id, 1)}
      >
        Move down
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon="copy"
        onclick={() => builder_state.duplicate_item(bal_item_found.item.id)}
      >
        Duplicate
      </Button>
      <Button
        variant="danger"
        size="sm"
        icon="trash"
        onclick={() => (shawya_delete_kind = 'item')}
      >
        Delete
      </Button>
    </div>
  </div>
{:else if bal_section_ref && bal_numbering}
  <div class="props">
    <div class="meta">
      <div class="meta-row">
        <span class="meta-key">Derived label</span>
        <span class="meta-value">{bal_numbering.sectionLabels[bal_section_ref.id] ?? 'Section'}</span>
      </div>
      <div class="meta-row">
        <span class="meta-key">Questions</span>
        <span class="meta-value">{bal_section_ref.items.length}</span>
      </div>
      <div class="meta-row">
        <span class="meta-key">Stable ID</span>
        <span class="meta-value mono">{bal_section_ref.id}</span>
      </div>
    </div>
    <div class="actions">
      <Button
        variant="secondary"
        size="sm"
        icon="chevron-up"
        onclick={() => builder_state.move_section(bal_section_ref.id, -1)}
      >
        Move up
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon="chevron-down"
        onclick={() => builder_state.move_section(bal_section_ref.id, 1)}
      >
        Move down
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon="copy"
        onclick={() => builder_state.duplicate_section(bal_section_ref.id)}
      >
        Duplicate
      </Button>
      <Button
        variant="danger"
        size="sm"
        icon="trash"
        onclick={() => (shawya_delete_kind = 'section')}
      >
        Delete
      </Button>
    </div>
  </div>
{:else}
  <p class="placeholder-text">Select a question or section to edit its properties.</p>
{/if}

<ConfirmDialog
  open={shawya_delete_kind !== null}
  title={shawya_delete_kind === 'section' ? 'Delete section' : 'Delete question'}
  body={
    shawya_delete_kind === 'section'
      ? `This deletes the section and its ${bal_section_ref?.items.length ?? 0} question(s). This cannot be undone.`
      : 'This deletes the question and its options. This cannot be undone.'
  }
  confirm_label="Delete"
  danger
  onconfirm={() => {
    if (shawya_delete_kind === 'section' && bal_section_ref) {
      builder_state.delete_section(bal_section_ref.id);
    } else if (shawya_delete_kind === 'item' && bal_item_found) {
      builder_state.delete_item(bal_item_found.item.id);
    }
    shawya_delete_kind = null;
  }}
  onclose={() => (shawya_delete_kind = null)}
/>

<style>
  .props {
    display: grid;
    gap: var(--space-4);
  }

  .meta {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }

  .meta-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .meta-key {
    font-size: var(--text-xs);
    color: var(--color-ink-3);
    flex: none;
  }

  .meta-value {
    font-size: var(--text-sm);
    color: var(--color-ink);
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mono {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .future {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-warning-soft);
  }

  .future-text {
    font-size: var(--text-xs);
    color: var(--color-warning-ink);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .placeholder-text {
    color: var(--color-ink-3);
    font-size: var(--text-sm);
  }
</style>
