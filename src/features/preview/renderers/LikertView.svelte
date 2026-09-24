<script lang="ts">
  import type { QuestionnaireItem, ResponseScaleRecord } from '../../../models/types';
  import { bal_item_options } from '../preview_answers';
  import SingleChoiceView from './SingleChoiceView.svelte';

  let {
    item,
    number,
    scales,
    selected = null,
    error = null,
    onanswer
  }: {
    item: QuestionnaireItem;
    number: string;
    scales: ResponseScaleRecord[];
    selected?: string | null;
    error?: string | null;
    onanswer: (bal_option_id: string) => void;
  } = $props();
</script>

<SingleChoiceView {item} {number} options={bal_item_options(item, scales)} {selected} {error} {onanswer} />
