<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import ConfirmDialog from '../../components/ui/ConfirmDialog.svelte';
  import Field from '../../components/ui/Field.svelte';
  import Switch from '../../components/ui/Switch.svelte';
  import TextInput from '../../components/ui/TextInput.svelte';
  import { derive_numbering } from '../../models/numbering';
  import { item_descriptor } from '../../models/item_catalog';
  import { validate_variable_name, suggest_variable_name } from '../../models/variable_names';
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

  const bal_descriptor = $derived(
    bal_item_found ? item_descriptor(bal_item_found.item.type) : null
  );

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

  function bal_suggest(): void {
    if (!bal_item_found) return;
    const bal_suggestion = suggest_variable_name(bal_item_found.item.label);
    if (bal_suggestion === '') return;
    const bal_others = builder_state
      .taken_variable_names()
      .filter((bal_name) => bal_name !== bal_item_found.item.variableName);
    bal_var_draft = unique_with(bal_others, bal_suggestion);
    bal_commit_variable();
  }

  function unique_with(bal_others: string[], bal_desired: string): string {
    let bal_name = bal_desired;
    let bal_n = 2;
    while (bal_others.includes(bal_name)) {
      bal_name = `${bal_desired}_${bal_n}`;
      bal_n += 1;
    }
    return bal_name;
  }

  function bal_number_value(bal_value: unknown): string {
    return typeof bal_value === 'number' ? String(bal_value) : '';
  }

  function bal_validation_number(
    bal_key: 'min' | 'max' | 'step' | 'maxLength' | 'minSelections' | 'maxSelections',
    bal_raw: string
  ): void {
    if (!bal_item_found) return;
    const bal_parsed = bal_raw.trim() === '' ? null : Number(bal_raw);
    const bal_validation = {
      ...(bal_item_found.item.validation ?? {}),
      [bal_key]: bal_parsed !== null && Number.isFinite(bal_parsed) ? bal_parsed : null
    };
    builder_state.update_item(bal_item_found.item.id, { validation: bal_validation });
  }

  function bal_assign_scale(bal_event: Event): void {
    if (!bal_item_found) return;
    const bal_value = (bal_event.currentTarget as HTMLSelectElement).value;
    if (bal_value === '') {
      if (bal_item_found.item.scaleId) {
        const bal_scale = bal_state.scales.find(
          (bal_s) => bal_s.id === bal_item_found.item.scaleId
        );
        builder_state.detach_scale(bal_item_found.item.id, bal_scale ? bal_scale.options : []);
      }
      return;
    }
    builder_state.assign_scale(bal_item_found.item.id, bal_value);
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
        <div class="var-row">
          <TextInput
            bind:value={bal_var_draft}
            error={bal_var_error !== null}
            maxlength="64"
            oninput={() => bal_commit_variable()}
          />
          <Button
            variant="secondary"
            size="sm"
            icon="wand"
            onclick={bal_suggest}
            disabled={bal_item_found.item.label.trim() === ''}
          >
            Suggest
          </Button>
        </div>
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
    {#if bal_descriptor.acceptsScale}
      <Field
        label="Response scale"
        hint="Assign a reusable scale. Detaching keeps the current options as independent copies."
      >
        <select
          class="scale-select"
          value={bal_item_found.item.scaleId ?? ''}
          onchange={bal_assign_scale}
        >
          <option value="">No scale</option>
          {#each bal_state.scales as bal_scale (bal_scale.id)}
            <option value={bal_scale.id}>{bal_scale.name}</option>
          {/each}
        </select>
      </Field>
    {/if}
    {#if bal_item_found.item.type === 'multiple_choice'}
      <div class="range-grid">
        <Field label="Minimum selections">
          <TextInput
            type="number"
            min="0"
            value={bal_number_value(bal_item_found.item.validation?.minSelections)}
            oninput={(bal_value) => bal_validation_number('minSelections', bal_value)}
          />
        </Field>
        <Field label="Maximum selections">
          <TextInput
            type="number"
            min="0"
            value={bal_number_value(bal_item_found.item.validation?.maxSelections)}
            oninput={(bal_value) => bal_validation_number('maxSelections', bal_value)}
          />
        </Field>
      </div>
    {/if}
    {#if bal_item_found.item.type === 'number'}
      <div class="range-grid">
        <Field label="Minimum">
          <TextInput
            type="number"
            value={bal_number_value(bal_item_found.item.validation?.min)}
            oninput={(bal_value) => bal_validation_number('min', bal_value)}
          />
        </Field>
        <Field label="Maximum">
          <TextInput
            type="number"
            value={bal_number_value(bal_item_found.item.validation?.max)}
            oninput={(bal_value) => bal_validation_number('max', bal_value)}
          />
        </Field>
        <Field label="Step">
          <TextInput
            type="number"
            value={bal_number_value(bal_item_found.item.validation?.step)}
            oninput={(bal_value) => bal_validation_number('step', bal_value)}
          />
        </Field>
      </div>
      <Switch
        label="Decimals allowed"
        checked={bal_item_found.item.validation?.decimalAllowed ?? true}
        onchange={(bal_checked) =>
          builder_state.update_item(bal_item_found.item.id, {
            validation: {
              ...(bal_item_found.item.validation ?? {}),
              decimalAllowed: bal_checked
            }
          })}
      />
    {/if}
    {#if bal_item_found.item.type === 'short_text' || bal_item_found.item.type === 'long_text'}
      <Field label="Maximum length" hint="Leave empty for no limit.">
        <TextInput
          type="number"
          min="1"
          value={bal_number_value(bal_item_found.item.validation?.maxLength)}
          oninput={(bal_value) => bal_validation_number('maxLength', bal_value)}
        />
      </Field>
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
        Print layout and scanner configuration for this question will be managed here in a
        future release.
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
    <Switch
      label="Start on a new page when printed"
      hint="A layout preference for the future print renderer."
      checked={bal_section_ref.printConfig?.pageBreakBefore ?? false}
      onchange={(bal_checked) =>
        builder_state.update_section(bal_section_ref.id, {
          printConfig: { pageBreakBefore: bal_checked }
        })}
    />
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

  .var-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .var-row :global(.ti) {
    flex: 1;
    min-width: 0;
  }

  .range-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .scale-select {
    width: 100%;
    height: var(--control-height);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .scale-select:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
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

  @media (max-width: 420px) {
    .range-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
