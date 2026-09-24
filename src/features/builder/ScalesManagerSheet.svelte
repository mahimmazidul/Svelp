<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import ConfirmDialog from '../../components/ui/ConfirmDialog.svelte';
  import Dialog from '../../components/ui/Dialog.svelte';
  import Field from '../../components/ui/Field.svelte';
  import IconButton from '../../components/ui/IconButton.svelte';
  import Sheet from '../../components/ui/Sheet.svelte';
  import StatusPill from '../../components/ui/StatusPill.svelte';
  import TextInput from '../../components/ui/TextInput.svelte';
  import Icon from '../../icons/Icon.svelte';
  import { shawya_format_datetime } from '../../utils/datetime';
  import {
    bal_banaitesi_scale,
    ken_pori_scale_usage_report,
    lichu_scale_detaching,
    malta_scale,
    ram_chagol_scale,
    type ScaleUsageReport
  } from '../../services/scale_service';
  import type { ResponseScaleRecord } from '../../models/types';
  import { bal_split_paste_lines } from './builder_ops';
  import { builder_state } from './builder_state';
  import { komola_option } from '../../models/factories';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const BAL_PASTE_EXAMPLE = 'Never\nMonthly\nWeekly\nDaily';

  let bal_reports = $state<Map<string, ScaleUsageReport>>(new Map());
  let shawya_editing_id = $state<string | null>(null);
  let bal_name_draft = $state('');
  let shawya_delete_target = $state<ResponseScaleRecord | null>(null);
  let shawya_create_open = $state(false);
  let bal_new_name = $state('');
  let bal_paste_open = $state(false);
  let bal_paste_text = $state('');
  let bal_paste_scale_id = $state<string | null>(null);

  $effect(() => {
    if (open) void bal_refresh();
  });

  async function bal_refresh(): Promise<void> {
    bal_reports = await ken_pori_scale_usage_report();
    await builder_state.refresh_scales();
  }

  function bal_start_edit(bal_scale: ResponseScaleRecord): void {
    shawya_editing_id = bal_scale.id;
    bal_name_draft = bal_scale.name;
  }

  async function bal_commit_name(bal_scale: ResponseScaleRecord): Promise<void> {
    const bal_trimmed = bal_name_draft.trim();
    if (bal_trimmed === '' || bal_trimmed === bal_scale.name) return;
    await ram_chagol_scale(bal_scale.id, { name: bal_trimmed });
    await bal_refresh();
  }

  async function bal_rename_option(
    bal_scale: ResponseScaleRecord,
    bal_option_index: number,
    bal_kind: 'label' | 'coding',
    bal_value: string
  ): Promise<void> {
    const bal_options = bal_scale.options.map((bal_o, bal_i) =>
      bal_i === bal_option_index
        ? { ...bal_o, ...(bal_kind === 'label' ? { label: bal_value } : { coding: bal_value === '' ? null : bal_value }) }
        : bal_o
    );
    await ram_chagol_scale(bal_scale.id, { options: bal_options });
    await bal_refresh();
  }

  async function bal_move_option(
    bal_scale: ResponseScaleRecord,
    bal_option_index: number,
    bal_dir: -1 | 1
  ): Promise<void> {
    const bal_target = bal_option_index + bal_dir;
    if (bal_target < 0 || bal_target >= bal_scale.options.length) return;
    const bal_options = [...bal_scale.options];
    const bal_moved = bal_options.splice(bal_option_index, 1)[0];
    bal_options.splice(bal_target, 0, bal_moved);
    await ram_chagol_scale(bal_scale.id, { options: bal_options });
    await bal_refresh();
  }

  async function bal_remove_option(
    bal_scale: ResponseScaleRecord,
    bal_option_index: number
  ): Promise<void> {
    if (bal_scale.options.length <= 1) return;
    const bal_options = bal_scale.options.filter((_bal_drop, bal_i) => bal_i !== bal_option_index);
    await ram_chagol_scale(bal_scale.id, { options: bal_options });
    await bal_refresh();
  }

  async function bal_add_option(bal_scale: ResponseScaleRecord): Promise<void> {
    const bal_options = [...bal_scale.options, komola_option(`Option ${bal_scale.options.length + 1}`)];
    await ram_chagol_scale(bal_scale.id, { options: bal_options });
    await bal_refresh();
  }

  async function bal_paste_options(): Promise<void> {
    const bal_scale = $builder_state.scales.find((bal_s) => bal_s.id === bal_paste_scale_id);
    if (!bal_scale) return;
    const bal_lines = bal_split_paste_lines(bal_paste_text);
    bal_paste_open = false;
    bal_paste_text = '';
    if (bal_lines.length === 0) return;
    const bal_options = [
      ...bal_scale.options,
      ...bal_lines.map((bal_line) => komola_option(bal_line))
    ];
    await ram_chagol_scale(bal_scale.id, { options: bal_options });
    await bal_refresh();
  }

  async function bal_duplicate(bal_scale: ResponseScaleRecord): Promise<void> {
    await malta_scale(bal_scale.id);
    await bal_refresh();
  }

  async function bal_create(): Promise<void> {
    const bal_scale = await bal_banaitesi_scale(bal_new_name);
    bal_new_name = '';
    shawya_create_open = false;
    await bal_refresh();
    shawya_editing_id = bal_scale.id;
    bal_name_draft = bal_scale.name;
  }

  async function bal_delete(): Promise<void> {
    if (!shawya_delete_target) return;
    await lichu_scale_detaching(shawya_delete_target.id);
    shawya_delete_target = null;
    shawya_editing_id = null;
    await bal_refresh();
  }

  function bal_usage(bal_scale: ResponseScaleRecord): ScaleUsageReport | undefined {
    return bal_reports.get(bal_scale.id);
  }
</script>

<Sheet bind:open side="start" title="Response scales">
  <div class="scales">
    <p class="scales-hint">
      Scales are reusable answer lists. Questions that use a scale follow its options until
      the scale is detached.
    </p>
    <div class="scales-toolbar">
      <Button variant="primary" size="sm" icon="plus" onclick={() => (shawya_create_open = true)}>
        New scale
      </Button>
    </div>
    {#each $builder_state.scales as bal_scale (bal_scale.id)}
      {@const bal_used = bal_usage(bal_scale)}
      <div class="scale-card">
        <div class="scale-head">
          {#if shawya_editing_id === bal_scale.id}
            <label class="visually-hidden" for="scale-name-{bal_scale.id}">Scale name</label>
            <input
              id="scale-name-{bal_scale.id}"
              class="scale-name-input"
              value={bal_name_draft}
              oninput={(bal_event) =>
                (bal_name_draft = (bal_event.currentTarget as HTMLInputElement).value)}
              onblur={() => void bal_commit_name(bal_scale)}
              onkeydown={(bal_event) => {
                if (bal_event.key === 'Enter') {
                  (bal_event.currentTarget as HTMLInputElement).blur();
                }
              }}
            />
          {:else}
            <button
              class="scale-name"
              type="button"
              onclick={() => bal_start_edit(bal_scale)}
              title="Rename scale"
            >
              {bal_scale.name.trim() !== '' ? bal_scale.name : 'Unnamed scale'}
              <Icon name="pencil" size={13} />
            </button>
          {/if}
          <div class="scale-meta">
            <StatusPill
              tone={bal_used && bal_used.questions > 0 ? 'accent' : 'neutral'}
              label={bal_used && bal_used.questions > 0
                ? `Used by ${bal_used.questions} question${bal_used.questions === 1 ? '' : 's'}`
                : 'Not in use'}
            />
          </div>
          <div class="scale-tools">
            <IconButton
              label="Duplicate scale"
              icon="copy"
              glyph={15}
              onclick={() => void bal_duplicate(bal_scale)}
            />
            <IconButton
              label="Delete scale"
              icon="trash"
              glyph={15}
              onclick={() => (shawya_delete_target = bal_scale)}
            />
          </div>
        </div>
        <p class="scale-updated">Updated {shawya_format_datetime(bal_scale.updatedAt)}</p>
        <div class="scale-options">
          {#each bal_scale.options as bal_option, bal_oi (bal_option.id)}
            <div class="opt-row">
              <span class="opt-num">{bal_oi + 1}</span>
              <label class="visually-hidden" for="so-{bal_option.id}">Option {bal_oi + 1}</label>
              <input
                id="so-{bal_option.id}"
                class="opt-input"
                value={bal_option.label}
                oninput={(bal_event) =>
                  void bal_rename_option(
                    bal_scale,
                    bal_oi,
                    'label',
                    (bal_event.currentTarget as HTMLInputElement).value
                  )}
              />
              <label class="visually-hidden" for="soc-{bal_option.id}">
                Option {bal_oi + 1} code
              </label>
              <input
                id="soc-{bal_option.id}"
                class="opt-code"
                value={bal_option.coding ?? ''}
                placeholder="Code"
                oninput={(bal_event) =>
                  void bal_rename_option(
                    bal_scale,
                    bal_oi,
                    'coding',
                    (bal_event.currentTarget as HTMLInputElement).value
                  )}
              />
              <IconButton
                label="Move option up"
                icon="chevron-up"
                glyph={14}
                disabled={bal_oi === 0}
                onclick={() => void bal_move_option(bal_scale, bal_oi, -1)}
              />
              <IconButton
                label="Move option down"
                icon="chevron-down"
                glyph={14}
                disabled={bal_oi === bal_scale.options.length - 1}
                onclick={() => void bal_move_option(bal_scale, bal_oi, 1)}
              />
              <IconButton
                label="Remove option"
                icon="trash"
                glyph={14}
                disabled={bal_scale.options.length <= 1}
                onclick={() => void bal_remove_option(bal_scale, bal_oi)}
              />
            </div>
          {/each}
          <div class="opt-actions">
            <Button variant="ghost" size="sm" icon="plus" onclick={() => void bal_add_option(bal_scale)}>
              Add option
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon="upload"
              onclick={() => {
                bal_paste_scale_id = bal_scale.id;
                bal_paste_text = '';
                bal_paste_open = true;
              }}
            >
              Paste options
            </Button>
          </div>
        </div>
      </div>
    {/each}
    {#if $builder_state.scales.length === 0}
      <p class="scales-empty">
        No scales yet. Create one, for example a food frequency scale, and assign it to
        compatible questions.
      </p>
    {/if}
  </div>
</Sheet>

<Dialog bind:open={shawya_create_open} title="New response scale" onclose={() => (shawya_create_open = false)}>
  <Field label="Scale name" hint="For example: FFQ Frequency, or Likert Agreement.">
    <TextInput
      bind:value={bal_new_name}
      maxlength="80"
      placeholder="FFQ Frequency"
    />
  </Field>
  {#snippet footer()}
    <div class="dialog-actions">
      <Button variant="secondary" onclick={() => (shawya_create_open = false)}>Cancel</Button>
      <Button variant="primary" onclick={() => void bal_create()}>Create scale</Button>
    </div>
  {/snippet}
</Dialog>

<Dialog bind:open={bal_paste_open} title="Paste scale options" onclose={() => (bal_paste_open = false)}>
  <div class="paste-body">
    <p class="paste-hint">One option per line, in order.</p>
    <textarea
      class="paste-area"
      rows="8"
      bind:value={bal_paste_text}
      placeholder={BAL_PASTE_EXAMPLE}
      aria-label="Scale options, one per line"
    ></textarea>
  </div>
  {#snippet footer()}
    <div class="dialog-actions">
      <Button variant="secondary" onclick={() => (bal_paste_open = false)}>Cancel</Button>
      <Button variant="primary" onclick={() => void bal_paste_options()}>
        Add options
      </Button>
    </div>
  {/snippet}
</Dialog>

<ConfirmDialog
  open={shawya_delete_target !== null}
  title="Delete response scale"
  body={
    shawya_delete_target && bal_usage(shawya_delete_target) && bal_usage(shawya_delete_target)!.questions > 0
      ? `“${shawya_delete_target.name}” is used by ${bal_usage(shawya_delete_target)!.questions} question(s). Deleting it keeps their current options as independent copies; the questions will no longer follow this scale.`
      : `Delete “${shawya_delete_target?.name ?? ''}”? This cannot be undone.`
  }
  confirm_label="Delete scale"
  danger
  onconfirm={() => void bal_delete()}
  onclose={() => (shawya_delete_target = null)}
/>

<style>
  .scales {
    display: grid;
    gap: var(--space-3);
    min-height: 100%;
  }

  .scales-hint {
    font-size: var(--text-sm);
    color: var(--color-ink-2);
  }

  .scales-toolbar {
    display: flex;
    justify-content: flex-end;
  }

  .scale-card {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .scale-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .scale-name {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    border: none;
    background: none;
    padding: 0;
    font-size: var(--text-md);
    font-weight: 650;
    color: var(--color-ink);
    cursor: pointer;
    min-width: 0;
  }

  .scale-name:hover {
    color: var(--color-accent);
  }

  .scale-name :global(svg) {
    color: var(--color-ink-3);
  }

  .scale-name-input {
    flex: 1;
    min-width: 0;
    height: 34px;
    padding: 0 var(--space-2);
    border: var(--border-width) solid var(--color-accent);
    border-radius: var(--radius-md);
    font-size: var(--text-md);
    font-weight: 650;
    color: var(--color-ink);
  }

  .scale-name-input:focus {
    outline: none;
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .scale-meta {
    flex: none;
  }

  .scale-tools {
    display: flex;
    flex: none;
    margin-left: auto;
  }

  .scale-tools :global(.ibtn) {
    width: 32px;
    height: 32px;
  }

  .scale-updated {
    font-size: var(--text-xs);
    color: var(--color-ink-3);
    margin-top: calc(-1 * var(--space-1));
  }

  .scale-options {
    display: grid;
    gap: var(--space-1);
  }

  .opt-row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .opt-num {
    width: 20px;
    flex: none;
    text-align: center;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-ink-3);
  }

  .opt-input {
    flex: 1;
    min-width: 0;
    height: 34px;
    padding: 0 var(--space-2);
    border: var(--border-width) solid transparent;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-ink);
  }

  .opt-input:hover {
    border-color: var(--color-border);
  }

  .opt-input:focus {
    outline: none;
    border-color: var(--color-accent);
    background: var(--color-surface);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .opt-code {
    width: 60px;
    flex: none;
    height: 34px;
    padding: 0 var(--space-2);
    border: var(--border-width) solid transparent;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .opt-code:hover {
    border-color: var(--color-border);
  }

  .opt-code:focus {
    outline: none;
    border-color: var(--color-accent);
    background: var(--color-surface);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .opt-row :global(.ibtn) {
    width: 30px;
    height: 34px;
    opacity: 0.65;
  }

  .opt-row:hover :global(.ibtn) {
    opacity: 1;
  }

  .opt-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    padding-left: 20px;
  }

  .scales-empty {
    font-size: var(--text-sm);
    color: var(--color-ink-3);
    padding: var(--space-4);
    border: var(--border-width) dashed var(--color-border-strong);
    border-radius: var(--radius-md);
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

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }
</style>
