<script lang="ts">
  import type { DerivedNumbering } from '../../../models/numbering';
  import type { QuestionnaireSection } from '../../../models/types';
  import InstructionView from './InstructionView.svelte';
  import SingleChoiceView from './SingleChoiceView.svelte';

  let {
    section,
    section_index,
    numbering,
    answers,
    onanswer
  }: {
    section: QuestionnaireSection;
    section_index: number;
    numbering: DerivedNumbering;
    answers: Record<string, string>;
    onanswer: (bal_item_id: string, bal_option_id: string) => void;
  } = $props();
</script>

<section class="pv-section">
  <h3 class="pv-section-title">
    {section_index + 1}. {section.title.trim() !== '' ? section.title : 'Untitled section'}
  </h3>
  {#if section.description}
    <p class="pv-section-desc">{section.description}</p>
  {/if}
  {#each section.items as bal_item (bal_item.id)}
    {#if bal_item.type === 'instruction'}
      <InstructionView item={bal_item} />
    {:else if bal_item.type === 'single_choice'}
      <SingleChoiceView
        item={bal_item}
        number={numbering.itemLabels[bal_item.id] ?? ''}
        selected={answers[bal_item.id] ?? null}
        onanswer={(bal_option_id) => onanswer(bal_item.id, bal_option_id)}
      />
    {/if}
  {/each}
</section>

<style>
  .pv-section {
    display: grid;
    gap: var(--space-4);
  }

  .pv-section-title {
    font-size: var(--text-xl);
    font-weight: 650;
    padding-bottom: var(--space-2);
    border-bottom: var(--border-width) solid var(--color-border);
  }

  .pv-section-desc {
    color: var(--color-ink-2);
    margin-top: calc(-1 * var(--space-2));
  }
</style>
