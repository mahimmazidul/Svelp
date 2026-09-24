<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import Icon from '../../icons/Icon.svelte';
  import { derive_numbering } from '../../models/numbering';
  import { item_descriptor } from '../../models/item_catalog';
  import AddItemMenu from './AddItemMenu.svelte';
  import { builder_state } from './builder_state';

  const bal_state = $derived($builder_state);
  const bal_q = $derived(bal_state.questionnaire);
  const bal_numbering = $derived(bal_q ? derive_numbering(bal_q) : null);

  let bal_collapsed = $state<Record<string, boolean>>({});

  function bal_display_label(bal_type: string, bal_label: string): string {
    if (bal_label.trim() !== '') return bal_label;
    if (bal_type === 'instruction') return 'Instruction';
    return 'Untitled question';
  }

  function bal_toggle(bal_section_id: string): void {
    bal_collapsed[bal_section_id] = !bal_collapsed[bal_section_id];
  }
</script>

<div class="structure">
  <header class="head">
    <h2 class="head-title">Structure</h2>
    <AddItemMenu />
  </header>

  {#if bal_q && bal_numbering}
    {#if bal_q.sections.length === 0}
      <div class="structure-empty">
        <p>No sections yet. Add a section to start organizing questions.</p>
        <Button variant="secondary" icon="plus" onclick={() => builder_state.add_section()}>
          Add section
        </Button>
      </div>
    {:else}
      <div class="sections">
        {#each bal_q.sections as bal_section, bal_si (bal_section.id)}
          <div class="section-group">
            <div class="section-row">
              <button
                class="collapse"
                type="button"
                aria-expanded={!bal_collapsed[bal_section.id]}
                aria-label={bal_collapsed[bal_section.id] ? 'Expand section' : 'Collapse section'}
                onclick={() => bal_toggle(bal_section.id)}
              >
                <Icon
                  name={bal_collapsed[bal_section.id] ? 'chevron-right' : 'chevron-down'}
                  size={16}
                />
              </button>
              <button
                class="row-main"
                class:selected={bal_state.selectedSectionId === bal_section.id &&
                  bal_state.selectedItemId === null}
                type="button"
                onclick={() => builder_state.select_section(bal_section.id)}
              >
                <span class="num">{bal_si + 1}</span>
                <span class="row-title">
                  {bal_section.title.trim() !== '' ? bal_section.title : 'Untitled section'}
                </span>
                <span class="count">{bal_section.items.length}</span>
              </button>
              <AddItemMenu sectionId={bal_section.id} label="" variant="ghost" />
            </div>
            {#if !bal_collapsed[bal_section.id]}
              <div class="items">
                {#each bal_section.items as bal_item (bal_item.id)}
                  {@const bal_descriptor = item_descriptor(bal_item.type)}
                  <button
                    class="item-row"
                    class:selected={bal_state.selectedItemId === bal_item.id}
                    type="button"
                    onclick={() => builder_state.select_item(bal_item.id)}
                  >
                    <Icon name={bal_descriptor.icon} size={15} />
                    <span class="num small">
                      {bal_numbering.itemLabels[bal_item.id] ?? ''}
                    </span>
                    <span class="row-title">
                      {bal_display_label(bal_item.type, bal_item.label)}
                    </span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
      <div class="structure-foot">
        <Button variant="ghost" icon="plus" onclick={() => builder_state.add_section()}>
          Add section
        </Button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .structure {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-3) var(--space-2);
    flex: none;
  }

  .head-title {
    font-size: var(--text-sm);
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-ink-3);
  }

  .sections {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 var(--space-2) var(--space-3);
    display: grid;
    gap: var(--space-1);
    align-content: start;
  }

  .section-group {
    display: grid;
    gap: 2px;
  }

  .section-row,
  .item-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    border-radius: var(--radius-md);
    padding: 0 var(--space-2);
    min-height: 40px;
    color: var(--color-ink);
  }

  .section-row {
    background: var(--color-surface-2);
  }

  .collapse {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: none;
    color: var(--color-ink-3);
    cursor: pointer;
    border-radius: var(--radius-sm);
    flex: none;
  }

  .row-main {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
    min-width: 0;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    padding: var(--space-2) 0;
    color: inherit;
  }

  .row-main.selected {
    color: var(--color-accent);
  }

  .item-row:hover {
    background: var(--color-surface-2);
  }

  .item-row.selected {
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }

  .num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 20px;
    padding: 0 5px;
    border-radius: var(--radius-full);
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-border);
    color: var(--color-ink-2);
    font-size: 11px;
    font-weight: 600;
    flex: none;
  }

  .num.small {
    min-width: 26px;
  }

  .row-title {
    flex: 1;
    min-width: 0;
    font-size: var(--text-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .count {
    font-size: var(--text-xs);
    color: var(--color-ink-3);
    flex: none;
  }

  .items {
    display: grid;
    gap: 2px;
    padding-left: var(--space-5);
  }

  .structure-empty {
    display: grid;
    justify-items: start;
    gap: var(--space-3);
    margin: 0 var(--space-3);
    padding: var(--space-4);
    border: var(--border-width) dashed var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--color-ink-2);
  }

  .structure-foot {
    flex: none;
    border-top: var(--border-width) solid var(--color-border);
    padding: var(--space-2) var(--space-3);
  }
</style>
