<script lang="ts">
  import type { QuestionnaireItem } from '../../../models/types';
  import { BAL_CONSENT_SECTION_LABELS } from '../../../models/factories';

  let {
    item,
    checked = false,
    error = null,
    onchange
  }: {
    item: QuestionnaireItem;
    checked?: boolean;
    error?: string | null;
    onchange: (bal_checked: boolean) => void;
  } = $props();

  const bal_consent = $derived(item.consent);
</script>

{#if bal_consent}
  <section class="pv-consent" class:has-error={error !== null}>
    <div class="pv-consent-head">
      <h4 class="pv-consent-title">
        {bal_consent.title.trim() !== '' ? bal_consent.title : 'Consent'}
      </h4>
      {#if item.required}
        <span class="pv-req">Required</span>
      {/if}
    </div>
    {#if bal_consent.introduction.trim() !== ''}
      <p class="pv-consent-intro">{bal_consent.introduction}</p>
    {/if}
    <dl class="pv-consent-sections">
      {#each bal_consent.sections as bal_section (bal_section.id)}
        <div class="pv-consent-section">
          <dt>{bal_section.title.trim() !== '' ? bal_section.title : BAL_CONSENT_SECTION_LABELS[bal_section.kind]}</dt>
          {#if bal_section.body.trim() !== ''}
            <dd>{bal_section.body}</dd>
          {/if}
        </div>
      {/each}
    </dl>
    <label class="pv-consent-ack">
      <input
        type="checkbox"
        checked={checked}
        onchange={(bal_event) =>
          onchange((bal_event.currentTarget as HTMLInputElement).checked)}
      />
      <span>
        {bal_consent.acknowledgementLabel.trim() !== ''
          ? bal_consent.acknowledgementLabel
          : 'Acknowledgement'}
      </span>
    </label>
    {#if error}
      <p class="pv-error" role="alert">{error}</p>
    {/if}
  </section>
{/if}

<style>
  .pv-consent {
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-4) var(--space-4) var(--space-5);
    display: grid;
    gap: var(--space-3);
    background: var(--color-surface);
  }

  .pv-consent.has-error {
    border-color: var(--color-danger);
  }

  .pv-consent-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .pv-consent-title {
    font-size: var(--text-lg);
  }

  .pv-req {
    flex: none;
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-warning-ink);
    background: var(--color-warning-soft);
    border-radius: var(--radius-full);
    padding: 2px 8px;
  }

  .pv-consent-intro {
    color: var(--color-ink-2);
  }

  .pv-consent-sections {
    margin: 0;
    display: grid;
    gap: var(--space-3);
    border-top: var(--border-width) solid var(--color-border);
    padding-top: var(--space-3);
  }

  .pv-consent-section dt {
    font-size: var(--text-sm);
    font-weight: 650;
    color: var(--color-ink);
  }

  .pv-consent-section dd {
    margin: var(--space-1) 0 0;
    font-size: var(--text-sm);
    color: var(--color-ink-2);
    white-space: pre-wrap;
  }

  .pv-consent-ack {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .pv-consent-ack:has(input:checked) {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }

  .pv-consent-ack input {
    accent-color: var(--color-accent);
    width: 18px;
    height: 18px;
    flex: none;
    margin-top: 2px;
  }

  .pv-error {
    font-size: var(--text-sm);
    color: var(--color-danger);
  }
</style>
