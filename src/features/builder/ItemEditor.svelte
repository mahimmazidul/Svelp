<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import EmptyState from '../../components/ui/EmptyState.svelte';
  import Field from '../../components/ui/Field.svelte';
  import Icon from '../../icons/Icon.svelte';
  import TextArea from '../../components/ui/TextArea.svelte';
  import TextInput from '../../components/ui/TextInput.svelte';
  import { derive_numbering } from '../../models/numbering';
  import { item_descriptor } from '../../models/item_catalog';
  import {
    apel_find_item,
    vorki_find_section,
    suggest_label_variable
  } from './builder_ops';
  import { builder_state } from './builder_state';
  import AddItemMenu from './AddItemMenu.svelte';
  import ItemProperties from './ItemProperties.svelte';
  import OptionEditor from './OptionEditor.svelte';
  import MatrixEditor from './MatrixEditor.svelte';
  import ConsentEditor from './ConsentEditor.svelte';
  import SignatureEditor from './SignatureEditor.svelte';
  import type { LayoutMode } from '../../utils/breakpoints';

  let { mode }: { mode: LayoutMode } = $props();

  const bal_state = $derived($builder_state);
  const bal_q = $derived(bal_state.questionnaire);
  const bal_numbering = $derived(bal_q ? derive_numbering(bal_q) : null);
  const bal_item_found = $derived(
    bal_q && bal_state.selectedItemId ? apel_find_item(bal_q, bal_state.selectedItemId) : null
  );
  const bal_section_found = $derived(
    bal_q && !bal_item_found && bal_state.selectedSectionId
      ? vorki_find_section(bal_q, bal_state.selectedSectionId)
      : null
  );
  const bal_descriptor = $derived(
    bal_item_found ? item_descriptor(bal_item_found.item.type) : null
  );

  const BAL_LIKERT_PRESETS = [3, 5, 7];
</script>

{#if bal_q && bal_numbering}
  {#if bal_item_found && bal_descriptor}
    <div class="editor">
      <header class="editor-head">
        <span class="kind">
          <Icon name={bal_descriptor.icon} size={16} />
          {bal_descriptor.label}
        </span>
        <span class="qnum">{bal_numbering.itemLabels[bal_item_found.item.id] ?? ''}</span>
      </header>

      {#if bal_item_found.item.type === 'instruction'}
        <Field label="Heading">
          <TextInput
            placeholder="Optional heading, for example: About this section"
            value={bal_item_found.item.heading ?? ''}
            maxlength="120"
            oninput={(bal_value) =>
              builder_state.update_item(
                bal_item_found.item.id,
                { heading: bal_value === '' ? null : bal_value },
                `heading:${bal_item_found.item.id}`
              )}
          />
        </Field>
        <Field label="Text" hint="Shown to participants between questions.">
          <TextArea
            rows="4"
            placeholder="Write the instruction participants will read."
            value={bal_item_found.item.label}
            oninput={(bal_value) =>
              builder_state.update_item(
                bal_item_found.item.id,
                { label: bal_value },
                `label:${bal_item_found.item.id}`
              )}
          />
        </Field>
        <Field label="Style">
          <select
            class="emphasis-select"
            value={bal_item_found.item.emphasis}
            aria-label="Instruction style"
            onchange={(bal_event) =>
              builder_state.update_item(bal_item_found.item.id, {
                emphasis: (bal_event.currentTarget as HTMLSelectElement)
                  .value as 'normal' | 'callout'
              })}
          >
            <option value="normal">Plain text</option>
            <option value="callout">Highlighted note</option>
          </select>
        </Field>
      {:else if bal_item_found.item.consent}
        <ConsentEditor item={bal_item_found.item} />
      {:else if bal_item_found.item.signature}
        <Field label="Field label">
          <TextInput
            placeholder={
              bal_item_found.item.type === 'participant_signature'
                ? 'Signature of participant'
                : 'Signature of researcher'
            }
            value={bal_item_found.item.label}
            maxlength="120"
            oninput={(bal_value) =>
              builder_state.update_item(
                bal_item_found.item.id,
                { label: bal_value },
                `label:${bal_item_found.item.id}`
              )}
          />
        </Field>
        <SignatureEditor item={bal_item_found.item} />
      {:else if bal_item_found.item.type === 'matrix'}
        <Field label="Matrix title">
          <TextArea
            rows="2"
            placeholder="For example: Food frequency"
            value={bal_item_found.item.label}
            oninput={(bal_value) =>
              builder_state.update_item(
                bal_item_found.item.id,
                { label: bal_value },
                `label:${bal_item_found.item.id}`
              )}
          />
        </Field>
        <MatrixEditor item={bal_item_found.item} />
      {:else}
        <Field label="Question">
          <TextArea
            rows="2"
            placeholder="Write the question exactly as participants will see it."
            value={bal_item_found.item.label}
            oninput={(bal_value) =>
              builder_state.update_item(
                bal_item_found.item.id,
                { label: bal_value },
                `label:${bal_item_found.item.id}`
              )}
          />
        </Field>

        {#if bal_item_found.item.type === 'short_text' || bal_item_found.item.type === 'long_text'}
          <Field label="Placeholder" hint="Shown inside the empty answer field.">
            <TextInput
              placeholder={
                bal_item_found.item.type === 'short_text'
                  ? 'Short answer'
                  : 'Longer answer'
              }
              value={bal_item_found.item.placeholder ?? ''}
              maxlength="80"
              oninput={(bal_value) =>
                builder_state.update_item(
                  bal_item_found.item.id,
                  { placeholder: bal_value === '' ? null : bal_value },
                  `ph:${bal_item_found.item.id}`
                )}
            />
          </Field>
        {/if}

        {#if bal_item_found.item.type === 'number'}
          <Field label="Unit label" hint="Shown after the answer, for example years, kg, or mmHg.">
            <TextInput
              placeholder="years"
              value={bal_item_found.item.unitLabel ?? ''}
              maxlength="24"
              oninput={(bal_value) =>
                builder_state.update_item(
                  bal_item_found.item.id,
                  { unitLabel: bal_value === '' ? null : bal_value },
                  `unit:${bal_item_found.item.id}`
                )}
            />
          </Field>
        {/if}

        {#if bal_descriptor.usesOptions}
          <section class="block">
            <div class="block-head">
              <h3 class="block-title">
                {bal_item_found.item.type === 'likert_scale' ? 'Scale points' : 'Options'}
              </h3>
              {#if bal_item_found.item.type === 'likert_scale'}
                <div class="likert-presets">
                  {#each BAL_LIKERT_PRESETS as bal_points (bal_points)}
                    <Button
                      variant="secondary"
                      size="sm"
                      onclick={() =>
                        builder_state.set_likert_points(bal_item_found.item.id, bal_points)}
                    >
                      {bal_points}-point
                    </Button>
                  {/each}
                </div>
              {/if}
            </div>
            <OptionEditor
              options={bal_item_found.item.options}
              onlabel={(bal_option_id, bal_value) =>
                builder_state.update_option(
                  bal_item_found.item.id,
                  bal_option_id,
                  { label: bal_value },
                  `opt:${bal_option_id}`
                )}
              oncoding={(bal_option_id, bal_value) =>
                builder_state.update_option(
                  bal_item_found.item.id,
                  bal_option_id,
                  { coding: bal_value === '' ? null : bal_value },
                  `optcode:${bal_option_id}`
                )}
              onmove={(bal_option_id, bal_dir) =>
                builder_state.move_option(bal_item_found.item.id, bal_option_id, bal_dir)}
              onremove={(bal_option_id) =>
                builder_state.remove_option(bal_item_found.item.id, bal_option_id)}
              onadd={() => builder_state.add_option(bal_item_found.item.id)}
              add_label={bal_item_found.item.type === 'likert_scale' ? 'Add point' : 'Add option'}
            />
            {#if bal_item_found.item.type === 'yes_no'}
              <p class="type-note">
                Yes and No labels and codes can be adjusted. Keep exactly two options.
              </p>
            {/if}
          </section>
        {/if}
      {/if}

      {#if mode !== 'desktop'}
        <section class="block bordered">
          <h3 class="block-title">Properties</h3>
          <ItemProperties />
        </section>
      {/if}
    </div>
  {:else if bal_section_found}
    <div class="editor">
      <header class="editor-head">
        <span class="kind">
          <Icon name="layers" size={16} />
          {bal_numbering.sectionLabels[bal_section_found.section.id] ?? 'Section'}
        </span>
        <span class="qnum">{bal_section_found.section.items.length} item(s)</span>
      </header>
      <Field label="Section title">
        <TextInput
          placeholder="For example: Background information"
          value={bal_section_found.section.title}
          maxlength="120"
          oninput={(bal_value) =>
            builder_state.update_section(
              bal_section_found.section.id,
              { title: bal_value },
              `stitle:${bal_section_found.section.id}`
            )}
        />
      </Field>
      <Field label="Description" hint="Optional text shown under the section heading.">
        <TextArea
          rows="2"
          placeholder="Optional section description"
          value={bal_section_found.section.description ?? ''}
          oninput={(bal_value) =>
            builder_state.update_section(
              bal_section_found.section.id,
              { description: bal_value === '' ? null : bal_value },
              `sdesc:${bal_section_found.section.id}`
            )}
        />
      </Field>
      <section class="block">
        <div class="block-head">
          <h3 class="block-title">Questions in this section</h3>
          <div class="block-tools">
            <AddItemMenu sectionId={bal_section_found.section.id} label="Add" />
            <AddItemMenu
              sectionId={bal_section_found.section.id}
              label=""
              variant="ghost"
              show_bulk={true}
            />
          </div>
        </div>
        {#if bal_section_found.section.items.length === 0}
          <p class="block-empty">No questions in this section yet.</p>
        {:else}
          <div class="mini-list">
            {#each bal_section_found.section.items as bal_item (bal_item.id)}
              {@const bal_item_descriptor = item_descriptor(bal_item.type)}
              <button
                class="mini-row"
                type="button"
                onclick={() => builder_state.select_item(bal_item.id)}
              >
                <Icon name={bal_item_descriptor.icon} size={15} />
                <span class="mini-num">{bal_numbering.itemLabels[bal_item.id] ?? '—'}</span>
                <span class="mini-label">
                  {suggest_label_variable(bal_item)}
                </span>
                <Icon name="chevron-right" size={15} />
              </button>
            {/each}
          </div>
        {/if}
      </section>
      {#if mode !== 'desktop'}
        <section class="block bordered">
          <h3 class="block-title">Properties</h3>
          <ItemProperties />
        </section>
      {/if}
    </div>
  {:else}
    <div class="overview">
      <EmptyState
        icon="file-text"
        title="Nothing selected"
        body="Select an item in the structure panel to edit it, or add a new question."
      >
        <AddItemMenu label="Add question" show_bulk={true} />
        <Button variant="secondary" icon="plus" onclick={() => builder_state.add_section()}>
          Add section
        </Button>
      </EmptyState>
    </div>
  {/if}
{/if}

<style>
  .editor {
    display: grid;
    gap: var(--space-4);
    max-width: 720px;
  }

  .editor-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .kind {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-ink-2);
  }

  .qnum {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-ink-3);
  }

  .emphasis-select {
    height: var(--control-height);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
    max-width: 260px;
  }

  .emphasis-select:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .block {
    display: grid;
    gap: var(--space-3);
  }

  .block.bordered {
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    padding: var(--space-4);
  }

  .block-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .block-tools {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .block-title {
    font-size: var(--text-md);
    font-weight: 650;
  }

  .likert-presets {
    display: flex;
    gap: var(--space-2);
  }

  .type-note {
    font-size: var(--text-xs);
    color: var(--color-ink-3);
  }

  .block-empty {
    font-size: var(--text-sm);
    color: var(--color-ink-3);
  }

  .mini-list {
    display: grid;
    gap: var(--space-1);
  }

  .mini-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    cursor: pointer;
    text-align: left;
    color: var(--color-ink-2);
  }

  .mini-row:hover {
    border-color: var(--color-border-strong);
    background: var(--color-surface-2);
  }

  .mini-num {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-ink-3);
    flex: none;
    min-width: 26px;
  }

  .mini-label {
    flex: 1;
    min-width: 0;
    font-size: var(--text-sm);
    color: var(--color-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .overview {
    max-width: 560px;
  }
</style>
