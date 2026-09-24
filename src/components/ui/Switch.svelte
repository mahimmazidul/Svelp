<script lang="ts">
  let {
    checked = $bindable(false),
    label,
    hint = null,
    disabled = false,
    onchange
  }: {
    checked?: boolean;
    label: string;
    hint?: string | null;
    disabled?: boolean;
    onchange?: (bal_checked: boolean) => void;
  } = $props();
</script>

<label class="switch-row">
  <input
    class="switch-input"
    type="checkbox"
    role="switch"
    bind:checked
    {disabled}
    onchange={(bal_event) => onchange?.(bal_event.currentTarget.checked)}
  />
  <span class="switch-track" aria-hidden="true">
    <span class="switch-thumb"></span>
  </span>
  <span class="switch-text">
    <span class="switch-label">{label}</span>
    {#if hint}<span class="switch-hint">{hint}</span>{/if}
  </span>
</label>

<style>
  .switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: 40px;
    cursor: pointer;
  }

  .switch-input {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .switch-track {
    display: inline-flex;
    align-items: center;
    width: 36px;
    height: 20px;
    padding: 2px;
    border-radius: var(--radius-full);
    background: var(--color-border-strong);
    flex: none;
    order: 2;
    transition: background var(--dur-fast) ease;
  }

  .switch-thumb {
    display: block;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: var(--shadow-1);
    transition: transform var(--dur-fast) ease;
  }

  .switch-input:checked + .switch-track {
    background: var(--color-accent);
  }

  .switch-input:checked + .switch-track .switch-thumb {
    transform: translateX(16px);
  }

  .switch-input:focus-visible + .switch-track {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .switch-input:disabled + .switch-track {
    opacity: 0.45;
  }

  .switch-input:disabled ~ .switch-text {
    opacity: 0.6;
  }

  .switch-text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .switch-label {
    font-size: var(--text-md);
    color: var(--color-ink);
  }

  .switch-hint {
    font-size: var(--text-xs);
    color: var(--color-ink-3);
  }
</style>
