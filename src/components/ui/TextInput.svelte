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

<input
  class="ti"
  class:error
  bind:value
  oninput={(bal_event) => oninput?.((bal_event.currentTarget as HTMLInputElement).value)}
  {...rest}
/>

<style>
  .ti {
    width: 100%;
    height: var(--control-height);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
    transition:
      border-color var(--dur-fast) ease,
      box-shadow var(--dur-fast) ease;
  }

  .ti::placeholder {
    color: var(--color-ink-3);
  }

  .ti:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .ti:disabled {
    background: var(--color-surface-2);
    color: var(--color-ink-3);
    cursor: not-allowed;
  }

  .ti.error {
    border-color: var(--color-danger);
  }

  .ti.error:focus {
    box-shadow: 0 0 0 3px var(--color-danger-soft);
  }
</style>
