<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import IconButton from '../../components/ui/IconButton.svelte';
  import Dialog from '../../components/ui/Dialog.svelte';
  import Icon from '../../icons/Icon.svelte';
  import type { ChoiceOption } from '../../models/types';
  import { bal_split_paste_lines } from './builder_ops';

  let {
    options,
    show_coding = true,
    onlabel,
    oncoding,
    onmove,
    onremove,
    onadd,
    onpaste,
    add_label = 'Add option',
    locked = false,
    locked_note = null
  }: {
    options: ChoiceOption[];
    show_coding?: boolean;
    onlabel: (bal_option_id: string, bal_value: string) => void;
    oncoding: (bal_option_id: string, bal_value: string) => void;
    onmove: (bal_option_id: string, bal_dir: -1 | 1) => void;
    onremove: (bal_option_id: string) => void;
    onadd: () => void;
    onpaste?: ((bal_labels: string[]) => void) | null;
    add_label?: string;
    locked?: boolean;
    locked_note?: string | null;
  } = $props();

  const BAL_PASTE_EXAMPLE = 'Never\nSometimes\nOften\nAlways';

  let shawya_paste_open = $state(false);
  let bal_paste_text = $state('');

  function bal_submit_paste(): void {
    const bal_lines = bal_split_paste_lines(bal_paste_text);
    shawya_paste_open = false;
    bal_paste_text = '';
    if (bal_lines.length > 0 && onpaste) onpaste(bal_lines);
  }
</script>

<div class="options">
  {#if locked}
    <p class="locked-note">{locked_note ?? 'Options come from the assigned response scale.'}</p>
  {/if}
  {#each options as bal_option, bal_oi (bal_option.id)}
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
          disabled={locked}
          oninput={(bal_event) =>
            onlabel(bal_option.id, (bal_event.currentTarget as HTMLInputElement).value)}
        />
        {#if show_coding}
          <label class="visually-hidden" for="code-{bal_option.id}">
            Option {bal_oi + 1} numeric code
          </label>
          <input
            id="code-{bal_option.id}"
            class="opt-code"
            value={bal_option.coding ?? ''}
            placeholder="Code"
            disabled={locked}
            oninput={(bal_event) =>
              oncoding(
                bal_option.id,
                (bal_event.currentTarget as HTMLInputElement).value
              )}
          />
        {/if}
      </div>
      {#if !locked}
        <div class="opt-tools">
          <IconButton
            label="Move option {bal_oi + 1} up"
            icon="chevron-up"
            glyph={14}
            disabled={bal_oi === 0}
            onclick={() => onmove(bal_option.id, -1)}
          />
          <IconButton
            label="Move option {bal_oi + 1} down"
            icon="chevron-down"
            glyph={14}
            disabled={bal_oi === options.length - 1}
            onclick={() => onmove(bal_option.id, 1)}
          />
          <IconButton
            label="Remove option {bal_oi + 1}"
            icon="trash"
            glyph={14}
            disabled={options.length <= 1}
            onclick={() => onremove(bal_option.id)}
          />
        </div>
      {/if}
    </div>
  {/each}
  {#if !locked}
    <div class="opt-add">
      <Button variant="ghost" size="sm" icon="plus" onclick={onadd}>{add_label}</Button>
      {#if onpaste}
        <Button
          variant="ghost"
          size="sm"
          icon="upload"
          onclick={() => (shawya_paste_open = true)}
        >
          Paste list
        </Button>
      {/if}
    </div>
  {/if}
</div>

<Dialog
  bind:open={shawya_paste_open}
  title="Paste options"
  onclose={() => (shawya_paste_open = false)}
>
  <div class="paste-body">
    <p class="paste-hint">
      One option per line. Each line becomes a new option appended to the list.
    </p>
    <textarea
      class="paste-area"
      rows="7"
      bind:value={bal_paste_text}
      placeholder={BAL_PASTE_EXAMPLE}
      aria-label="Options, one per line"
    ></textarea>
  </div>
  {#snippet footer()}
    <div class="paste-actions">
      <Button variant="secondary" onclick={() => (shawya_paste_open = false)}>
        Cancel
      </Button>
      <Button variant="primary" onclick={bal_submit_paste}>Add options</Button>
    </div>
  {/snippet}
</Dialog>

<style>
  .options {
    display: grid;
    gap: var(--space-2);
  }

  .locked-note {
    font-size: var(--text-xs);
    color: var(--color-ink-3);
    background: var(--color-surface-2);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
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
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .paste-body {
    display: grid;
    gap: var(--space-3);
  }

  .paste-hint {
    font-size: var(--text-sm);
    color: var(--color-ink-2);
  }

  .paste-area {
    width: 100%;
    resize: vertical;
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    line-height: var(--leading);
    color: var(--color-ink);
    background: var(--color-surface);
  }

  .paste-area:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .paste-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
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
