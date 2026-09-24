<script lang="ts">
  import type { AnswerMap, MatrixAnswer, SignatureAnswer } from '../preview_answers';
  import type { DerivedNumbering } from '../../../models/numbering';
  import type { QuestionnaireSection, ResponseScaleRecord } from '../../../models/types';
  import InstructionView from './InstructionView.svelte';
  import SingleChoiceView from './SingleChoiceView.svelte';
  import MultipleChoiceView from './MultipleChoiceView.svelte';
  import YesNoView from './YesNoView.svelte';
  import LikertView from './LikertView.svelte';
  import TextView from './TextView.svelte';
  import NumberView from './NumberView.svelte';
  import DateView from './DateView.svelte';
  import MatrixView from './MatrixView.svelte';
  import ConsentView from './ConsentView.svelte';
  import SignatureView from './SignatureView.svelte';

  let {
    section,
    section_index,
    numbering,
    answers,
    scales,
    errors = {},
    onanswer
  }: {
    section: QuestionnaireSection;
    section_index: number;
    numbering: DerivedNumbering;
    answers: AnswerMap;
    scales: ResponseScaleRecord[];
    errors?: Record<string, string>;
    onanswer: (bal_item_id: string, bal_value: unknown) => void;
  } = $props();
</script>

<section class="pv-section" data-break={section.printConfig?.pageBreakBefore ? 'before' : null}>
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
        options={bal_item.scaleId
          ? (scales.find((bal_s) => bal_s.id === bal_item.scaleId)?.options ?? [])
          : bal_item.options}
        selected={(answers[bal_item.id] as string) ?? null}
        error={errors[bal_item.id] ?? null}
        onanswer={(bal_option_id) => onanswer(bal_item.id, bal_option_id)}
      />
    {:else if bal_item.type === 'multiple_choice'}
      <MultipleChoiceView
        item={bal_item}
        number={numbering.itemLabels[bal_item.id] ?? ''}
        options={bal_item.scaleId
          ? (scales.find((bal_s) => bal_s.id === bal_item.scaleId)?.options ?? [])
          : bal_item.options}
        selected={(answers[bal_item.id] as string[]) ?? []}
        error={errors[bal_item.id] ?? null}
        ontoggle={(bal_option_id) => {
          const bal_current = (answers[bal_item.id] as string[]) ?? [];
          onanswer(
            bal_item.id,
            bal_current.includes(bal_option_id)
              ? bal_current.filter((bal_id) => bal_id !== bal_option_id)
              : [...bal_current, bal_option_id]
          );
        }}
      />
    {:else if bal_item.type === 'yes_no'}
      <YesNoView
        item={bal_item}
        number={numbering.itemLabels[bal_item.id] ?? ''}
        {scales}
        selected={(answers[bal_item.id] as string) ?? null}
        error={errors[bal_item.id] ?? null}
        onanswer={(bal_option_id) => onanswer(bal_item.id, bal_option_id)}
      />
    {:else if bal_item.type === 'likert_scale'}
      <LikertView
        item={bal_item}
        number={numbering.itemLabels[bal_item.id] ?? ''}
        {scales}
        selected={(answers[bal_item.id] as string) ?? null}
        error={errors[bal_item.id] ?? null}
        onanswer={(bal_option_id) => onanswer(bal_item.id, bal_option_id)}
      />
    {:else if bal_item.type === 'short_text' || bal_item.type === 'long_text'}
      <TextView
        item={bal_item}
        number={numbering.itemLabels[bal_item.id] ?? ''}
        value={(answers[bal_item.id] as string) ?? ''}
        error={errors[bal_item.id] ?? null}
        oninput={(bal_value) => onanswer(bal_item.id, bal_value)}
      />
    {:else if bal_item.type === 'number'}
      <NumberView
        item={bal_item}
        number={numbering.itemLabels[bal_item.id] ?? ''}
        value={(answers[bal_item.id] as string) ?? ''}
        error={errors[bal_item.id] ?? null}
        oninput={(bal_value) => onanswer(bal_item.id, bal_value)}
      />
    {:else if bal_item.type === 'date'}
      <DateView
        item={bal_item}
        number={numbering.itemLabels[bal_item.id] ?? ''}
        value={(answers[bal_item.id] as string) ?? ''}
        error={errors[bal_item.id] ?? null}
        oninput={(bal_value) => onanswer(bal_item.id, bal_value)}
      />
    {:else if bal_item.type === 'matrix'}
      <MatrixView
        item={bal_item}
        number={numbering.itemLabels[bal_item.id] ?? ''}
        {scales}
        answer={(answers[bal_item.id] as MatrixAnswer) ?? null}
        error={errors[bal_item.id] ?? null}
        onchange={(bal_matrix) => onanswer(bal_item.id, bal_matrix)}
      />
    {:else if bal_item.type === 'consent'}
      <ConsentView
        item={bal_item}
        checked={answers[bal_item.id] === true}
        error={errors[bal_item.id] ?? null}
        onchange={(bal_checked) => onanswer(bal_item.id, bal_checked)}
      />
    {:else if bal_item.type === 'participant_signature' || bal_item.type === 'researcher_signature'}
      <SignatureView
        item={bal_item}
        number={numbering.itemLabels[bal_item.id] ?? ''}
        answer={(answers[bal_item.id] as SignatureAnswer) ?? null}
        onanswer={(bal_signature) => onanswer(bal_item.id, bal_signature)}
      />
    {/if}
  {/each}
</section>

<style>
  .pv-section {
    display: grid;
    gap: var(--space-4);
  }

  .pv-section[data-break='before'] {
    border-top: var(--border-width) dashed var(--color-border-strong);
    padding-top: var(--space-5);
    margin-top: var(--space-2);
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
