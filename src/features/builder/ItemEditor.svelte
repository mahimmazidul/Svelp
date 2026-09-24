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
    vorki_find_section
  } from './builder_ops';
  import { builder_state } from './builder_state';
  import AddItemMenu from './AddItemMenu.svelte';
  import ItemProperties from './ItemProperties.svelte';
  import OptionEditor from './OptionEditor.svelte';
  import type { LayoutMode } from '../../utils/breakpoints';

  let { mode }: { mode: LayoutMode } = $props();

  const bal_state = $derived($builder_state);
  const bal_q = $derived(bal_state.questionnaire);
  const bal_numbering = $derived(bal_q ? derive_numbering(bal_q) : null);
  const bal_item_found = $derived(
    bal_q && bal_state.selectedItemId
      ? apel_find_item(bal_q, bal_state.selectedItemId)
      : null
  );
  const bal_section_found = $derived(
    bal_q && !bal_item_found && bal_state.selectedSectionId
      ? vorki_find_section(bal_q, bal_state.selectedSectionId)
      : null
  );
  const bal_descriptor = $derived(bal_item_found ? item_descriptor(bal_item_found.item.type) : null);
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
        <Field label="Text" hint="Shown to participants between questions.">
          <TextArea
            rows="4"
            placeholder="Write the instruction participants will read."
            value={bal_item_found.item.label}
            oninput={(bal_value) =>
              builder_state.update_item(bal_item_found.item.id, { label: bal_value })}
          />
        </Field>
      {:else}
        <Field label="Question">
          <TextArea
            rows="2"
            placeholder="Write the question exactly as participants will see it."
            value={bal_item_found.item.label}
            oninput={(bal_value) =>
              builder_state.update_item(bal_item_found.item.id, { label: bal_value })}
          />
        </Field>
        <section class="block">
          <h3 class="block-title">Options</h3>
          <OptionEditor item={bal_item_found.item} />
        </section>
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
            builder_state.update_section(bal_section_found.section.id, { title: bal_value })}
        />
      </Field>
      <Field label="Description" hint="Optional text shown under the section heading.">
        <TextArea
          rows="2"
          placeholder="Optional section description"
          value={bal_section_found.section.description ?? ''}
          oninput={(bal_value) =>
            builder_state.update_section(bal_section_found.section.id, {
              description: bal_value === '' ? null : bal_value
            })}
        />
      </Field>
      <section class="block">
        <div class="block-head">
          <h3 class="block-title">Questions in this section</h3>
          <AddItemMenu sectionId={bal_section_found.section.id} label="Add to section" />
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
                  {bal_item.label.trim() !== ''
                    ? bal_item.label
                    : bal_item.type === 'instruction'
                      ? 'Instruction'
                      : 'Untitled question'}
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
        <AddItemMenu label="Add question" />
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

  .block-title {
    font-size: var(--text-md);
    font-weight: 650;
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
