<script lang="ts">
  let {
    tone = 'neutral',
    label
  }: { tone?: 'neutral' | 'success' | 'warning' | 'accent'; label: string } = $props();
</script>

<span class="pill" class:success={tone === 'success'} class:warning={tone === 'warning'} class:accent={tone === 'accent'}>
  {label}
</span>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
    border: var(--border-width) solid var(--color-border);
    color: var(--color-ink-2);
    font-size: var(--text-xs);
    font-weight: 600;
    white-space: nowrap;
  }

  .pill.success {
    background: var(--color-success-soft);
    border-color: transparent;
    color: var(--color-success);
  }

  .pill.warning {
    background: var(--color-warning-soft);
    border-color: transparent;
    color: var(--color-warning-ink);
  }

  .pill.accent {
    background: var(--color-accent-soft);
    border-color: transparent;
    color: var(--color-accent);
  }
</style>
