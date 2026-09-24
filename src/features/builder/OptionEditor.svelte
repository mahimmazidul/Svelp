<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import IconButton from '../../components/ui/IconButton.svelte';
  import Icon from '../../icons/Icon.svelte';
  import type { QuestionnaireItem } from '../../models/types';
  import { builder_state } from './builder_state';

  let { item }: { item: QuestionnaireItem } = $props();
</script>

<div class="options">
  {#each item.options as bal_option, bal_oi (bal_option.id)}
    <div class="opt-row">
      <span class="opt-glyph" aria-hidden="true">
        <Icon name="circle-check" size={15} />
      </span>
      <div class="opt-fields">
        <label class="visually-hidden" for="opt-{bal_option.id}">
          Option {bal_oi + 1} label
        </label>
        <input
          id="opt-{bal_option.id}"
          class="opt-input"
          value={bal_option.label}
          placeholder="Option {bal_oi + 1}"
          oninput={(bal_event) =>
            builder_state.update_option(item.id, bal_option.id, {
              label: bal_event.currentTarget.value
            })}
        />
        <label class="visually-hidden" for="code-{bal_option.id}">
          Option {bal_oi + 1} numeric code
        </label>
        <input
          id="code-{bal_option.id}"
          class="opt-code"
          value={bal_option.coding ?? ''}
          placeholder="Code"
          oninput={(bal_event) =>
            builder_state.update_option(item.id, bal_option.id, {
              coding: bal_event.currentTarget.value === '' ? null : bal_event.currentTarget.value
            })}
        />
      </div>
      <div class="opt-tools">
        <IconButton
          label="Move option {bal_oi + 1} up"
          icon="chevron-up"
          glyph={14}
          disabled={bal_oi === 0}
          onclick={() => builder_state.move_option(item.id, bal_option.id, -1)}
        />
        <IconButton
          label="Move option {bal_oi + 1} down"
          icon="chevron-down"
          glyph={14}
          disabled={bal_oi === item.options.length - 1}
          onclick={() => builder_state.move_option(item.id, bal_option.id, 1)}
        />
        <IconButton
          label="Remove option {bal_oi + 1}"
          icon="trash"
          glyph={14}
          disabled={item.options.length <= 1}
          onclick={() => builder_state.remove_option(item.id, bal_option.id)}
        />
      </div>
    </div>
  {/each}
  <div class="opt-add">
    <Button variant="ghost" size="sm" icon="plus" onclick={() => builder_state.add_option(item.id)}>
      Add option
    </Button>
  </div>
</div>

<style>
  .options {
    display: grid;
    gap: var(--space-2);
  }

  .opt-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .opt-glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 36px;
    color: var(--color-ink-3);
    flex: none;
  }

  .opt-fields {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: var(--space-2);
  }

  .opt-input {
    flex: 1;
    min-width: 0;
    height: 36px;
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .opt-input:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .opt-code {
    width: 84px;
    flex: none;
    height: 36px;
    padding: 0 var(--space-2);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .opt-code:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .opt-tools {
    display: flex;
    flex: none;
  }

  .opt-tools :global(.ibtn) {
    width: 32px;
    height: 36px;
  }

  .opt-add {
    padding-left: 30px;
  }

  @media (max-width: 420px) {
    .opt-fields {
      flex-wrap: wrap;
    }

    .opt-input {
      width: 100%;
      flex-basis: 100%;
    }

    .opt-code {
      flex: 1;
      width: auto;
    }
  }
</style>
