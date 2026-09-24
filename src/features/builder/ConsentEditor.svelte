<script lang="ts">
  import Field from '../../components/ui/Field.svelte';

  import IconButton from '../../components/ui/IconButton.svelte';
  import TextArea from '../../components/ui/TextArea.svelte';
  import TextInput from '../../components/ui/TextInput.svelte';
  import {
    BAL_CONSENT_SECTION_KINDS,
    BAL_CONSENT_SECTION_LABELS
  } from '../../models/factories';
  import type { ConsentSectionKind, QuestionnaireItem } from '../../models/types';
  import { builder_state } from './builder_state';

  let { item }: { item: QuestionnaireItem } = $props();

  const bal_consent = $derived(item.consent);

  const bal_available_kinds = $derived(
    bal_consent
      ? BAL_CONSENT_SECTION_KINDS.filter(
          (bal_kind) => !bal_consent.sections.some((bal_s) => bal_s.kind === bal_kind)
        )
      : []
  );
</script>

{#if bal_consent}
  <div class="consent">
    <Field label="Consent title">
      <TextInput
        value={bal_consent.title}
        maxlength="120"
        placeholder="For example: Informed consent"
        oninput={(bal_value) =>
          builder_state.update_consent(item.id, { title: bal_value }, `consent-title:${item.id}`)}
      />
    </Field>
    <Field label="Introduction" hint="Short opening addressed to the participant.">
      <TextArea
        rows="3"
        value={bal_consent.introduction}
        placeholder="You are being invited to take part in this study…"
        oninput={(bal_value) =>
          builder_state.update_consent(
            item.id,
            { introduction: bal_value },
            `consent-intro:${item.id}`
          )}
      />
    </Field>

    <div class="sections">
      <div class="sections-head">
        <h4 class="sections-title">Consent sections</h4>
        {#if bal_available_kinds.length > 0}
          <div class="add-section">
            <select
              class="kind-select"
              aria-label="Add a consent section"
              id="consent-kind-{item.id}"
            >
              <option value="">Add a section…</option>
              {#each bal_available_kinds as bal_kind (bal_kind)}
                <option value={bal_kind}>{BAL_CONSENT_SECTION_LABELS[bal_kind]}</option>
              {/each}
            </select>
            <IconButton
              label="Add consent section"
              icon="plus"
              glyph={16}
              onclick={() => {
                const bal_select = document.getElementById(
                  `consent-kind-${item.id}`
                ) as HTMLSelectElement | null;
                if (bal_select && bal_select.value !== '') {
                  builder_state.add_consent_section(item.id, bal_select.value as ConsentSectionKind);
                  bal_select.value = '';
                }
              }}
            />
          </div>
        {/if}
      </div>

      {#each bal_consent.sections as bal_section, bal_si (bal_section.id)}
        <div class="section-card">
          <div class="section-head">
            <span class="section-kind">{BAL_CONSENT_SECTION_LABELS[bal_section.kind]}</span>
            <div class="section-tools">
              <IconButton
                label="Move section up"
                icon="chevron-up"
                glyph={14}
                disabled={bal_si === 0}
                onclick={() =>
                  builder_state.move_consent_section(item.id, bal_section.id, -1)}
              />
              <IconButton
                label="Move section down"
                icon="chevron-down"
                glyph={14}
                disabled={bal_si === bal_consent.sections.length - 1}
                onclick={() =>
                  builder_state.move_consent_section(item.id, bal_section.id, 1)}
              />
              <IconButton
                label="Remove section"
                icon="trash"
                glyph={14}
                onclick={() => builder_state.remove_consent_section(item.id, bal_section.id)}
              />
            </div>
          </div>
          <label class="visually-hidden" for="cst-{bal_section.id}">Section title</label>
          <input
            id="cst-{bal_section.id}"
            class="section-title"
            value={bal_section.title}
            placeholder="Section title"
            oninput={(bal_event) =>
              builder_state.update_consent_section(
                item.id,
                bal_section.id,
                { title: (bal_event.currentTarget as HTMLInputElement).value },
                `csec-t:${bal_section.id}`
              )}
          />
          <label class="visually-hidden" for="csb-{bal_section.id}">Section text</label>
          <textarea
            id="csb-{bal_section.id}"
            class="section-body"
            rows="3"
            value={bal_section.body}
            placeholder="Write the exact wording participants will read. Svelp supplies no legal text."
            oninput={(bal_event) =>
              builder_state.update_consent_section(
                item.id,
                bal_section.id,
                { body: (bal_event.currentTarget as HTMLTextAreaElement).value },
                `csec-b:${bal_section.id}`
              )}
          ></textarea>
        </div>
      {/each}
      {#if bal_consent.sections.length === 0}
        <p class="empty-note">
          No sections yet. Add purpose, procedures, risks, confidentiality, and contact
          information as needed.
        </p>
      {/if}
    </div>

    <Field label="Acknowledgement label" hint="Shown next to the agreement checkbox.">
      <TextArea
        rows="2"
        value={bal_consent.acknowledgementLabel}
        placeholder="I have read and understood the information above, and I agree to take part."
        oninput={(bal_value) =>
          builder_state.update_consent(
            item.id,
            { acknowledgementLabel: bal_value },
            `consent-ack:${item.id}`
          )}
      />
    </Field>
  </div>
{:else}
  <p class="empty-note">This consent block has no configuration.</p>
{/if}

<style>
  .consent {
    display: grid;
    gap: var(--space-4);
  }

  .sections {
    display: grid;
    gap: var(--space-3);
  }

  .sections-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .sections-title {
    font-size: var(--text-md);
    font-weight: 650;
  }

  .add-section {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .kind-select {
    height: calc(var(--control-height) - 8px);
    padding: 0 var(--space-2);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
    font-size: var(--text-sm);
  }

  .kind-select:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .section-card {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .section-kind {
    font-size: var(--text-xs);
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-ink-3);
  }

  .section-tools {
    display: flex;
  }

  .section-tools :global(.ibtn) {
    width: 30px;
    height: 30px;
  }

  .section-title {
    height: 36px;
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .section-title:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .section-body {
    width: 100%;
    resize: vertical;
    padding: var(--space-2) var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
    line-height: var(--leading);
  }

  .section-body:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .empty-note {
    font-size: var(--text-sm);
    color: var(--color-ink-3);
  }
</style>
