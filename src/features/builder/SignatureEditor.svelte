<script lang="ts">
  import Field from '../../components/ui/Field.svelte';
  import Switch from '../../components/ui/Switch.svelte';
  import TextInput from '../../components/ui/TextInput.svelte';
  import type { QuestionnaireItem } from '../../models/types';
  import { builder_state } from './builder_state';

  let { item }: { item: QuestionnaireItem } = $props();

  const bal_signature = $derived(item.signature);
</script>

{#if bal_signature}
  <div class="signature">
    <Field label="Signer role">
      <TextInput
        value={bal_signature.signerRole}
        maxlength="60"
        placeholder={item.type === 'participant_signature' ? 'Participant' : 'Researcher'}
        oninput={(bal_value) =>
          builder_state.update_signature(
            item.id,
            { signerRole: bal_value },
            `sig-role:${item.id}`
          )}
      />
    </Field>
    <Switch
      label="Include printed name field"
      checked={bal_signature.includePrintedName}
      onchange={(bal_checked) =>
        builder_state.update_signature(item.id, { includePrintedName: bal_checked })}
    />
    <Switch
      label="Include date field"
      checked={bal_signature.includeDate}
      onchange={(bal_checked) =>
        builder_state.update_signature(item.id, { includeDate: bal_checked })}
    />
    <p class="note">
      On paper forms this becomes a signature box. Digital signing arrives in a later
      release.
    </p>
  </div>
{:else}
  <p class="note">This signature field has no configuration.</p>
{/if}

<style>
  .signature {
    display: grid;
    gap: var(--space-3);
  }

  .note {
    font-size: var(--text-xs);
    color: var(--color-ink-3);
  }
</style>
