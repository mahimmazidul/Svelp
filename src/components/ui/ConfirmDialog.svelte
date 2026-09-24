<script lang="ts">
  import Dialog from './Dialog.svelte';
  import Button from './Button.svelte';

  let {
    open = $bindable(false),
    title,
    body,
    confirm_label = 'Confirm',
    cancel_label = 'Cancel',
    danger = false,
    onconfirm,
    onclose
  }: {
    open?: boolean;
    title: string;
    body: string;
    confirm_label?: string;
    cancel_label?: string;
    danger?: boolean;
    onconfirm: () => void;
    onclose?: () => void;
  } = $props();

  function bal_cancel(): void {
    open = false;
    onclose?.();
  }

  function bal_confirm(): void {
    open = false;
    onconfirm();
  }
</script>

<Dialog bind:open {title} onclose={bal_cancel}>
  <p class="body-text">{body}</p>
  {#snippet footer()}
    <div class="foot-row">
      <Button variant="secondary" onclick={bal_cancel}>{cancel_label}</Button>
      <Button variant={danger ? 'danger' : 'primary'} onclick={bal_confirm}>
        {confirm_label}
      </Button>
    </div>
  {/snippet}
</Dialog>

<style>
  .body-text {
    color: var(--color-ink-2);
  }

  .foot-row {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }

  @media (max-width: 480px) {
    .foot-row {
      flex-direction: column-reverse;
    }

    .foot-row :global(.btn) {
      width: 100%;
    }
  }
</style>
