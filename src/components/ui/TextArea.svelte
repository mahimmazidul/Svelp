<script lang="ts">
  let {
    value = $bindable(''),
    error = false,
    oninput,
    ...rest
  }: {
    value?: string;
    error?: boolean;
    oninput?: (bal_value: string) => void;
    [key: string]: unknown;
  } = $props();
</script>

<textarea
  class="ta"
  class:error
  bind:value
  oninput={(bal_event) => oninput?.((bal_event.currentTarget as HTMLTextAreaElement).value)}
  {...rest}
></textarea>

<style>
  .ta {
    width: 100%;
    min-height: 74px;
    padding: var(--space-2) var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
    resize: vertical;
    line-height: var(--leading);
    transition:
      border-color var(--dur-fast) ease,
      box-shadow var(--dur-fast) ease;
  }

  .ta::placeholder {
    color: var(--color-ink-3);
  }

  .ta:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .ta:disabled {
    background: var(--color-surface-2);
    color: var(--color-ink-3);
    cursor: not-allowed;
  }

  .ta.error {
    border-color: var(--color-danger);
  }

  .ta.error:focus {
    box-shadow: 0 0 0 3px var(--color-danger-soft);
  }
</style>
