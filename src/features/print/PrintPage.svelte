<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../../components/ui/Button.svelte';
  import EmptyState from '../../components/ui/EmptyState.svelte';
  import IconButton from '../../components/ui/IconButton.svelte';
  import Sheet from '../../components/ui/Sheet.svelte';
  import { dhon_questionnaire_by_project } from '../../db/questionnaires_repo';
  import { bal_save_questionnaire } from '../../db/questionnaires_repo';
  import { ken_pori_scales } from '../../db/scales_repo';
  import { normalize_questionnaire } from '../../models/factories';
  import type { Orientation, PaperSize, PrintSettings, QuestionnaireRecord, ResponseScaleRecord } from '../../models/types';
  import {
    bal_apply_preset as bal_preset_settings,
    bal_default_print_settings,
    bal_normalize_print_settings
  } from './print_settings';
  import { bal_build_print_document } from './print_layout';
  import { bal_validate_print } from './print_validate';
  import { hati_pdf_bytes } from './biriyani_pdf';
  import PrintSettingsPanel from './PrintSettingsPanel.svelte';
  import PrintPreview from './PrintPreview.svelte';
  import PrintBatchSheet from './PrintBatchSheet.svelte';
  import type { PrintPreset } from './print_settings';

  let { projectId }: { projectId: string } = $props();

  let bal_q = $state<QuestionnaireRecord | null>(null);
  let bal_scales = $state<ResponseScaleRecord[]>([]);
  let bal_status = $state<'loading' | 'ready' | 'missing'>('loading');
  let bal_settings = $state<PrintSettings>(bal_default_print_settings());
  let bal_page = $state(1);
  let bal_settings_sheet = $state(false);
  let bal_batch_sheet = $state(false);
  let bal_exporting = $state(false);
  let bal_saved_note = $state(false);

  let bal_save_timer: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    void (async () => {
      const bal_raw = await dhon_questionnaire_by_project(projectId);
      if (!bal_raw) {
        bal_status = 'missing';
        return;
      }
      bal_q = normalize_questionnaire(bal_raw);
      bal_scales = await ken_pori_scales();
      bal_settings = bal_normalize_print_settings(bal_q.printSettings);
      bal_status = 'ready';
    })();
  });

  const bal_document = $derived(
    bal_q
      ? bal_build_print_document({
          questionnaire: { ...bal_q, printSettings: bal_settings },
          scales: bal_scales
        })
      : null
  );
  const bal_readiness = $derived(bal_document ? bal_validate_print(bal_document) : null);

  function bal_queue_save(): void {
    if (!bal_q) return;
    if (bal_save_timer) clearTimeout(bal_save_timer);
    bal_save_timer = setTimeout(() => {
      if (!bal_q) return;
      bal_q = { ...bal_q, printSettings: bal_settings, updatedAt: Date.now() };
      void bal_save_questionnaire(bal_q).then(() => {
        bal_saved_note = true;
        setTimeout(() => (bal_saved_note = false), 1600);
      });
    }, 600);
  }

  function bal_apply_settings(bal_next: PrintSettings): void {
    bal_settings = bal_next;
    bal_queue_save();
  }

  function bal_apply_paper(bal_size: PaperSize): void {
    if (!bal_q) return;
    bal_q = { ...bal_q, paperSize: bal_size, updatedAt: Date.now() };
    void bal_save_questionnaire(bal_q);
  }

  function bal_apply_orientation(bal_orientation: Orientation): void {
    if (!bal_q) return;
    bal_q = { ...bal_q, orientation: bal_orientation, updatedAt: Date.now() };
    void bal_save_questionnaire(bal_q);
  }

  function bal_apply_preset(bal_preset: PrintPreset): void {
    if (!bal_q) return;
    bal_q = { ...bal_q, paperSize: bal_preset.paperSize, orientation: bal_preset.orientation, updatedAt: Date.now() };
    void bal_save_questionnaire(bal_q);
    bal_settings = bal_preset_settings(bal_preset);
    bal_queue_save();
  }

  async function bal_download_pdf(): Promise<void> {
    if (!bal_document) return;
    bal_exporting = true;
    try {
      const bal_bytes = await hati_pdf_bytes(bal_document);
      const bal_blob = new Blob([bal_bytes as BlobPart], { type: 'application/pdf' });
      const bal_url = URL.createObjectURL(bal_blob);
      const bal_anchor = document.createElement('a');
      bal_anchor.href = bal_url;
      bal_anchor.download = `${bal_document.studyCode || 'svelp'}-v${bal_document.questionnaireVersion}.pdf`;
      document.body.appendChild(bal_anchor);
      bal_anchor.click();
      bal_anchor.remove();
      URL.revokeObjectURL(bal_url);
    } finally {
      bal_exporting = false;
    }
  }

  function bal_download_geometry(): void {
    if (!bal_document) return;
    const bal_blob = new Blob([JSON.stringify(bal_document.geometry, null, 2)], {
      type: 'application/json'
    });
    const bal_url = URL.createObjectURL(bal_blob);
    const bal_anchor = document.createElement('a');
    bal_anchor.href = bal_url;
    bal_anchor.download = `${bal_document.studyCode || 'svelp'}-geometry.json`;
    document.body.appendChild(bal_anchor);
    bal_anchor.click();
    bal_anchor.remove();
    URL.revokeObjectURL(bal_url);
  }
</script>

{#if bal_status === 'loading'}
  <div class="state"><p>Loading…</p></div>
{:else if bal_status === 'missing' || !bal_q || !bal_document}
  <div class="state">
    <EmptyState
      icon="printer"
      title="No questionnaire yet"
      body="Create the questionnaire in the builder before printing."
    >
      <a class="build-link" href={`#/project/${projectId}/build`}>Open builder</a>
    </EmptyState>
  </div>
{:else}
  <div class="print-page">
    <header class="topbar">
      <div class="titles">
        <h2>Print</h2>
        <p class="sub">
          {bal_document.pageCount} page{bal_document.pageCount === 1 ? '' : 's'}
          {#if bal_saved_note}<span class="saved">Settings saved</span>{/if}
        </p>
      </div>
      <div class="tools">
        <IconButton
          icon="sliders"
          label="Print settings"
          onclick={() => (bal_settings_sheet = true)}
        />
        <Button size="sm" icon="download" disabled={bal_exporting} onclick={() => void bal_download_pdf()}>
          {bal_exporting ? 'Preparing…' : 'Download PDF'}
        </Button>
        <Button size="sm" variant="primary" icon="copy" onclick={() => (bal_batch_sheet = true)}>
          Generate batch
        </Button>
      </div>
    </header>

    <div class="layout">
      <aside class="settings-col">
        <PrintSettingsPanel
          settings={bal_settings}
          paperSize={bal_q.paperSize}
          orientation={bal_q.orientation}
          onchange={bal_apply_settings}
          onpaper={bal_apply_paper}
          onorientation={bal_apply_orientation}
          onpreset={bal_apply_preset}
        />
      </aside>

      <main class="preview-col">
        <PrintPreview document={bal_document} pageNumber={bal_page} onpage={(bal_n) => (bal_page = bal_n)} />
      </main>

      <aside class="readiness-col">
        <h3>Print readiness</h3>
        {#if bal_readiness}
          <p class="status" class:ok={bal_readiness.status === 'ready'} class:warn={bal_readiness.status === 'warnings'} class:bad={bal_readiness.status === 'errors'}>
            {bal_readiness.status === 'ready' ? 'Ready' : bal_readiness.status === 'warnings' ? 'Warnings' : 'Errors'}
          </p>
          <ul class="groups">
            {#each bal_readiness.groups as bal_group (bal_group.category)}
              <li>
                <span>{bal_group.label}</span>
                <span class="counts">
                  {#if bal_group.errors > 0}<b class="bad">{bal_group.errors}</b>{/if}
                  {#if bal_group.warnings > 0}<b class="warn">{bal_group.warnings}</b>{/if}
                  {#if bal_group.errors === 0 && bal_group.warnings === 0}<span class="ok">OK</span>{/if}
                </span>
              </li>
            {/each}
          </ul>
          {#if bal_readiness.issues.length > 0}
            <ul class="issues">
              {#each bal_readiness.issues.slice(0, 12) as bal_issue (bal_issue.code + String(bal_issue.pageNumber))}
                <li>
                  <b class={bal_issue.severity}>{bal_issue.severity}</b>
                  <span>{bal_issue.message}</span>
                </li>
              {/each}
            </ul>
          {/if}
          <Button size="sm" variant="ghost" icon="download" onclick={bal_download_geometry}>
            Export scanner geometry
          </Button>
        {/if}
      </aside>
    </div>

    <Sheet bind:open={bal_settings_sheet} title="Print settings" side="start">
      <div class="sheet-settings">
        <PrintSettingsPanel
          settings={bal_settings}
          paperSize={bal_q.paperSize}
          orientation={bal_q.orientation}
          onchange={bal_apply_settings}
          onpaper={bal_apply_paper}
          onorientation={bal_apply_orientation}
          onpreset={bal_apply_preset}
        />
      </div>
    </Sheet>

    <PrintBatchSheet
      bind:open={bal_batch_sheet}
      questionnaire={{ ...bal_q, printSettings: bal_settings }}
      scales={bal_scales}
      {projectId}
    />
  </div>
{/if}

<style>
  .state {
    padding: var(--space-8) var(--space-4);
  }

  .build-link {
    color: var(--color-accent);
    font-size: var(--text-sm);
  }

  .print-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    max-width: 1600px;
    margin: 0 auto;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .titles h2 {
    margin: 0;
    font-size: var(--text-lg);
  }

  .sub {
    margin: 0.15rem 0 0;
    font-size: var(--text-xs);
    color: var(--color-ink);
    opacity: 0.7;
    display: flex;
    gap: var(--space-3);
  }

  .saved {
    color: var(--color-success);
  }

  .tools {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .layout {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr) 260px;
    gap: var(--space-5);
    align-items: start;
  }

  .settings-col {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    background: var(--color-surface);
    position: sticky;
    top: var(--space-4);
    max-height: calc(100vh - 8rem);
    overflow: auto;
  }

  .readiness-col {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    background: var(--color-surface);
    position: sticky;
    top: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .readiness-col h3 {
    margin: 0;
    font-size: var(--text-sm);
  }

  .status {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .status.ok,
  .ok {
    color: var(--color-success);
  }

  .status.warn,
  .warn {
    color: var(--color-warning-ink, #92600a);
  }

  .status.bad,
  .bad {
    color: var(--color-danger);
  }

  .groups {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .groups li {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-xs);
  }

  .counts {
    display: flex;
    gap: 0.4rem;
  }

  .issues {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-3);
  }

  .issues li {
    display: flex;
    gap: 0.5rem;
    font-size: var(--text-xs);
    line-height: 1.4;
  }

  .issues b {
    flex: none;
    text-transform: capitalize;
  }

  .sheet-settings {
    padding: var(--space-2);
  }

  @media (max-width: 1279px) {
    .layout {
      grid-template-columns: 250px minmax(0, 1fr);
    }

    .readiness-col {
      grid-column: 1 / -1;
      position: static;
    }
  }

  @media (max-width: 1023px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }

    .settings-col {
      display: none;
    }

    .readiness-col {
      position: static;
    }
  }
</style>
