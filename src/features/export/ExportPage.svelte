<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../../components/ui/Button.svelte';
  import EmptyState from '../../components/ui/EmptyState.svelte';
  import Icon from '../../icons/Icon.svelte';
  import { malta_download_file } from '../../utils/download';
  import { dhon_project } from '../../db/projects_repo';
  import {
    bal_save_dataset_snapshot,
    ken_pori_dataset_snapshots,
    ken_pori_response_audit_by_project
  } from '../../db/response_repo';
  import type { DatasetSnapshotRecord } from '../../models/response_models';
  import { BAL_MAHIM_PAYLOAD_VERSION } from '../mahim/mahim_container';
  import { BAL_READER_ALGORITHM_VERSION } from '../../models/response_models';
  import { bal_load_dataset_context, type bal_DatasetContext } from '../reading/reading_context';
  import {
    BAL_CODEBOOK_HEADERS,
    bal_build_codebook,
    bal_build_export_rows,
    bal_build_json_dataset,
    bal_codebook_to_csv,
    bal_codebook_to_json,
    bal_export_columns,
    bal_export_filenames,
    bal_export_headers,
    bal_to_csv,
    type bal_CodebookRow,
    type bal_ExportColumn
  } from './export_dataset';
  import {
    bal_audit_rows,
    bal_audit_to_csv,
    bal_diagnostics_to_csv,
    bal_r_helper,
    bal_reproducibility_manifest,
    bal_research_summary,
    bal_spss_syntax
  } from './export_scripts';

  let { projectId }: { projectId: string } = $props();

  let bal_status = $state<'loading' | 'ready' | 'missing'>('loading');
  let bal_project_title = $state('');
  let bal_context = $state<bal_DatasetContext | null>(null);
  let bal_columns = $state<bal_ExportColumn[]>([]);
  let bal_codebook = $state<bal_CodebookRow[]>([]);
  let bal_option_columns = $state(false);
  let bal_bom = $state(false);
  let bal_warnings_acknowledged = $state(false);
  let bal_codebook_open = $state(false);
  let bal_snapshots = $state<DatasetSnapshotRecord[]>([]);
  let bal_codebook_search = $state('');
  let bal_codebook_section = $state('');
  let bal_codebook_type = $state('');

  const BAL_UNRESOLVED_STATUSES = new Set<string>([
    'needs-review',
    'ambiguous',
    'multiple-marks',
    'unreadable',
    'manual-only'
  ]);

  let bal_unresolved_responses = $derived(
    bal_context ? bal_context.responses.filter((bal_r) => BAL_UNRESOLVED_STATUSES.has(bal_r.status)).length : 0
  );
  let bal_missing_page_respondents = $derived(bal_context ? bal_context.summary.missingPages : 0);
  let bal_has_warnings = $derived(bal_unresolved_responses > 0 || bal_missing_page_respondents > 0);
  let bal_export_allowed = $derived(bal_has_warnings ? bal_warnings_acknowledged : true);
  let bal_codebook_sections = $derived(
    bal_context ? [...new Set(bal_context.questionnaire.sections.map((bal_s) => bal_s.title))].sort() : []
  );
  let bal_codebook_types = $derived([...new Set(bal_codebook.map((bal_row) => bal_row.itemType))].sort());
  let bal_codebook_filtered = $derived(
    bal_codebook.filter((bal_row) => {
      if (bal_codebook_section && bal_row.sectionTitle !== bal_codebook_section) return false;
      if (bal_codebook_type && bal_row.itemType !== bal_codebook_type) return false;
      if (bal_codebook_search) {
        const bal_needle = bal_codebook_search.toLowerCase();
        const bal_haystack = `${bal_row.variableName} ${bal_row.questionLabel} ${bal_row.sectionTitle}`.toLowerCase();
        if (!bal_haystack.includes(bal_needle)) return false;
      }
      return true;
    })
  );
  let bal_codebook_grouped = $derived(
    Object.entries(
      bal_codebook_filtered.reduce<Record<string, { row: bal_CodebookRow; options: string[] }>>((bal_acc, bal_row) => {
        const bal_key = `${bal_row.variableName}|${bal_row.matrixRowLabel ?? ''}`;
        if (!bal_acc[bal_key]) bal_acc[bal_key] = { row: bal_row, options: [] };
        if (bal_row.optionLabel !== null) {
          bal_acc[bal_key].options.push(bal_row.optionCode ? `${bal_row.optionLabel} (${bal_row.optionCode})` : bal_row.optionLabel);
        }
        return bal_acc;
      }, {})
    )
  );

  function bal_prepare(bal_context_data: bal_DatasetContext): {
    columns: bal_ExportColumn[];
    codebook: bal_CodebookRow[];
    respondents: string[];
  } {
    const bal_cols = bal_export_columns(bal_context_data.questionnaire, { optionColumns: bal_option_columns });
    return {
      columns: bal_cols,
      codebook: bal_build_codebook(bal_cols, bal_context_data.questionnaire, bal_context_data.scales),
      respondents: bal_context_data.respondents
    };
  }

  function bal_names() {
    return bal_export_filenames(bal_project_title || 'Svelp', bal_context?.questionnaire.version ?? 1);
  }

  function bal_record_snapshot(bal_format: string): void {
    if (!bal_context) return;
    const bal_responses = bal_context.responses;
    const bal_counts = {
      autoAccepted: bal_responses.filter((bal_r) => bal_r.status === 'accepted' && !bal_r.manuallyReviewed).length,
      reviewedCorrected: bal_responses.filter((bal_r) => bal_r.manuallyReviewed).length,
      blank: bal_responses.filter((bal_r) => bal_r.status === 'blank').length,
      needsReview: bal_responses.filter((bal_r) => bal_r.status === 'needs-review' || bal_r.status === 'ambiguous' || bal_r.status === 'multiple-marks').length,
      manualOnly: bal_responses.filter((bal_r) => bal_r.status === 'manual-only').length,
      unreadable: bal_responses.filter((bal_r) => bal_r.status === 'unreadable').length
    };
    const bal_row: DatasetSnapshotRecord = {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      questionnaireId: bal_context.questionnaire.id,
      questionnaireVersion: bal_context.questionnaire.version,
      algorithmVersion: bal_responses.length > 0 ? bal_responses[0].algorithmVersion : BAL_READER_ALGORITHM_VERSION,
      profileName: [...new Set(bal_responses.map((bal_r) => bal_r.thresholdProfileName))].join(', ') || 'default',
      respondentCount: bal_context.respondents.length,
      unresolvedCount: bal_unresolved_responses,
      missingPageRespondents: bal_missing_page_respondents,
      counts: bal_counts,
      exportConfig: { format: bal_format, optionColumns: bal_option_columns, bom: bal_bom, includeDiagnostics: true },
      svelpVersion: __SVELP_VERSION__,
      createdAt: Date.now()
    };
    void bal_save_dataset_snapshot(bal_row).then(() => {
      bal_snapshots = [bal_row, ...bal_snapshots];
    });
  }

  function bal_review_issues(): void {
    window.location.hash = `#/project/${encodeURIComponent(projectId)}/responses`;
  }

  function bal_export_anyway(): void {
    bal_warnings_acknowledged = true;
  }

  async function bal_download_csv(): Promise<void> {
    if (!bal_context) return;
    const bal_prepared = bal_prepare(bal_context);
    const bal_rows = bal_build_export_rows(
      bal_prepared.columns,
      bal_context.questionnaire,
      bal_context.scales,
      bal_context.responses,
      bal_prepared.respondents
    );
    malta_download_file(
      bal_names().responsesCsv,
      bal_to_csv(bal_rows, bal_export_headers(bal_prepared.columns, false), bal_bom),
      'text/csv'
    );
    bal_record_snapshot('csv');
  }

  async function bal_download_json(): Promise<void> {
    if (!bal_context) return;
    const bal_prepared = bal_prepare(bal_context);
    malta_download_file(
      bal_names().responsesJson,
      bal_build_json_dataset(
        bal_prepared.columns,
        bal_context.questionnaire,
        bal_context.scales,
        bal_context.responses,
        bal_prepared.respondents
      ),
      'application/json'
    );
    bal_record_snapshot('json');
  }

  async function bal_download_codebook_csv(): Promise<void> {
    if (!bal_context) return;
    const bal_prepared = bal_prepare(bal_context);
    malta_download_file(bal_names().codebookCsv, bal_codebook_to_csv(bal_prepared.codebook, bal_bom), 'text/csv');
  }

  async function bal_download_codebook_json(): Promise<void> {
    if (!bal_context) return;
    const bal_prepared = bal_prepare(bal_context);
    malta_download_file(
      bal_names().codebookJson,
      bal_codebook_to_json(bal_prepared.codebook, bal_context.questionnaire),
      'application/json'
    );
  }

  async function bal_download_diagnostics(): Promise<void> {
    if (!bal_context) return;
    malta_download_file(
      bal_names().diagnosticsCsv,
      bal_diagnostics_to_csv(bal_context.responses, bal_context.respondents, bal_bom),
      'text/csv'
    );
  }

  async function bal_download_audit(): Promise<void> {
    if (!bal_context) return;
    const bal_events = await ken_pori_response_audit_by_project(projectId);
    const bal_by_id = new Map(bal_context.responses.map((bal_response) => [bal_response.id, bal_response]));
    const bal_value_text = (bal_event: (typeof bal_events)[number], bal_key: 'previousValue' | 'finalValue'): string =>
      (bal_event[bal_key] ?? []).join('; ');
    malta_download_file(bal_names().auditCsv, bal_audit_to_csv(bal_audit_rows(bal_events, bal_by_id, bal_value_text), bal_bom), 'text/csv');
  }

  async function bal_download_summary(): Promise<void> {
    if (!bal_context) return;
    const bal_responses = bal_context.responses;
    const bal_algorithm = bal_responses.length > 0 ? bal_responses[0].algorithmVersion : BAL_READER_ALGORITHM_VERSION;
    const bal_profiles = [...new Set(bal_responses.map((bal_response) => bal_response.thresholdProfileName))];
    malta_download_file(
      bal_names().summaryJson,
      bal_research_summary({
        questionnaireTitle: bal_context.questionnaire.title,
        questionnaireVersion: bal_context.questionnaire.version,
        respondentCount: bal_context.respondents.length,
        algorithmVersion: bal_algorithm,
        profileName: bal_profiles.join(', ') || 'default',
        autoAccepted: bal_responses.filter((bal_r) => bal_r.status === 'accepted' && !bal_r.manuallyReviewed).length,
        reviewedCorrected: bal_responses.filter((bal_r) => bal_r.manuallyReviewed).length,
        blanks: bal_responses.filter((bal_r) => bal_r.status === 'blank').length,
        unresolved: bal_unresolved_responses,
        missingPageRespondents: bal_missing_page_respondents,
        transcriptionPending: bal_context.summary.transcriptionPending,
        versionConflicts: bal_context.summary.versionConflicts,
        svelpVersion: __SVELP_VERSION__
      }),
      'application/json'
    );
  }

  async function bal_download_manifest(): Promise<void> {
    if (!bal_context) return;
    const bal_responses = bal_context.responses;
    malta_download_file(
      bal_names().base + '-manifest.json',
      bal_reproducibility_manifest({
        svelpVersion: __SVELP_VERSION__,
        questionnaireVersion: bal_context.questionnaire.version,
        mahimFormatVersion: BAL_MAHIM_PAYLOAD_VERSION,
        algorithmVersion: bal_responses.length > 0 ? bal_responses[0].algorithmVersion : BAL_READER_ALGORITHM_VERSION,
        profileName: [...new Set(bal_responses.map((bal_r) => bal_r.thresholdProfileName))].join(', ') || 'default',
        respondentCount: bal_context.respondents.length,
        unresolvedCount: bal_unresolved_responses,
        exportConfig: { format: 'csv', optionColumns: bal_option_columns, bom: bal_bom, includeDiagnostics: true },
        snapshotAt: new Date().toISOString(),
        responsesCsv: bal_names().responsesCsv,
        responsesJson: bal_names().responsesJson,
        codebookCsv: bal_names().codebookCsv
      }),
      'application/json'
    );
  }

  async function bal_download_spss(): Promise<void> {
    if (!bal_context) return;
    const bal_prepared = bal_prepare(bal_context);
    malta_download_file(
      bal_names().spssSyntax,
      bal_spss_syntax(bal_prepared.columns, bal_prepared.codebook, bal_names().responsesCsv),
      'text/plain'
    );
  }

  async function bal_download_r(): Promise<void> {
    if (!bal_context) return;
    const bal_prepared = bal_prepare(bal_context);
    malta_download_file(
      bal_names().rHelper,
      bal_r_helper(bal_names().responsesCsv, bal_prepared.columns, bal_prepared.codebook),
      'text/plain'
    );
  }

  onMount(() => {
    void (async () => {
      const bal_loaded = await bal_load_dataset_context(projectId);
      if (!bal_loaded) {
        bal_status = 'missing';
        return;
      }
      const bal_project = await dhon_project(projectId);
      bal_project_title = bal_project?.title ?? 'Svelp';
      bal_snapshots = await ken_pori_dataset_snapshots(projectId);
      const bal_cols = bal_export_columns(bal_loaded.questionnaire);
      bal_context = bal_loaded;
      bal_columns = bal_cols;
      bal_codebook = bal_build_codebook(bal_cols, bal_loaded.questionnaire, bal_loaded.scales);
      bal_status = 'ready';
    })();
  });
</script>

<div class="page">
  <header class="head">
    <h1>Export</h1>
    <p class="sub">Download reviewed answers as a clean, reproducible research dataset.</p>
  </header>

  {#if bal_status === 'loading'}
    <p class="muted">Loading…</p>
  {:else if bal_status === 'missing' || !bal_context}
    <EmptyState icon="download" title="Nothing to export yet" body="Create a questionnaire and read scanned responses first." />
  {:else}
    <section class="card">
      <h2>Export preview</h2>
      <dl class="stats">
        <div>
          <dt>Questionnaire</dt>
          <dd>{bal_context.questionnaire.title} · v{bal_context.questionnaire.version}</dd>
        </div>
        <div>
          <dt>Respondents</dt>
          <dd>{bal_context.respondents.length}</dd>
        </div>
        <div>
          <dt>Variables</dt>
          <dd>{bal_export_columns(bal_context.questionnaire, { optionColumns: bal_option_columns }).length}</dd>
        </div>
        <div>
          <dt>Unresolved responses</dt>
          <dd class:warn={bal_unresolved_responses > 0}>{bal_unresolved_responses}</dd>
        </div>
        <div>
          <dt>Missing pages</dt>
          <dd class:warn={bal_missing_page_respondents > 0}>{bal_missing_page_respondents}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>CSV, UTF-8{bal_bom ? ' with BOM' : ''}</dd>
        </div>
      </dl>
      <div class="options">
        <label>
          <input type="checkbox" bind:checked={bal_option_columns} />
          <span>Binary 0/1 columns for multiple choice (each option becomes its own variable)</span>
        </label>
        <label>
          <input type="checkbox" bind:checked={bal_bom} />
          <span>Add UTF-8 BOM (helps Excel detect encoding; off for R and Python)</span>
        </label>
      </div>
      <p class="muted">
        Clean exports use final reviewed values. Cells still awaiting review stay empty in the clean dataset and are
        documented in the diagnostics file.
      </p>
    </section>

    {#if bal_has_warnings && !bal_warnings_acknowledged}
      <section class="warning" role="alert">
        <div class="warning-text">
          <strong>Review before exporting.</strong>
          This dataset still contains {bal_unresolved_responses} unresolved response{bal_unresolved_responses === 1 ? '' : 's'}
          and {bal_missing_page_respondents} respondent{bal_missing_page_respondents === 1 ? '' : 's'} with missing pages.
        </div>
        <div class="warning-actions">
          <Button onclick={bal_review_issues}>Review issues</Button>
          <Button variant="primary" onclick={bal_export_anyway}>Export anyway</Button>
        </div>
      </section>
    {/if}

    <section class="card">
      <h2>Dataset</h2>
      <div class="actions">
        <Button variant="primary" disabled={!bal_export_allowed || bal_context.respondents.length === 0} onclick={bal_download_csv}>
          <Icon name="download" size={16} />
          Responses CSV
        </Button>
        <Button disabled={!bal_export_allowed || bal_context.respondents.length === 0} onclick={bal_download_json}>
          <Icon name="download" size={16} />
          Responses JSON
        </Button>
        <Button disabled={bal_columns.length === 0} onclick={bal_download_diagnostics}>
          <Icon name="download" size={16} />
          Diagnostics CSV
        </Button>
      </div>
      <p class="muted">Diagnostics carry machine values, statuses, and evidence scores for every cell.</p>
    </section>

    <section class="card">
      <h2>Documentation</h2>
      <div class="actions">
        <Button disabled={bal_columns.length === 0} onclick={bal_download_codebook_csv}>
          <Icon name="file-text" size={16} />
          Codebook CSV
        </Button>
        <Button disabled={bal_columns.length === 0} onclick={bal_download_codebook_json}>
          <Icon name="file-text" size={16} />
          Codebook JSON
        </Button>
        <Button disabled={bal_columns.length === 0} onclick={() => (bal_codebook_open = !bal_codebook_open)}>
          {bal_codebook_open ? 'Hide codebook' : 'View codebook'}
        </Button>
      </div>
      {#if bal_codebook_open}
        <div class="codebook">
          <div class="codebook-filters">
            <input type="search" placeholder="Search variable, label, or section" bind:value={bal_codebook_search} />
            <select bind:value={bal_codebook_section}>
              <option value="">All sections</option>
              {#each bal_codebook_sections as bal_section (bal_section)}
                <option value={bal_section}>{bal_section}</option>
              {/each}
            </select>
            <select bind:value={bal_codebook_type}>
              <option value="">All types</option>
              {#each bal_codebook_types as bal_type (bal_type)}
                <option value={bal_type}>{bal_type}</option>
              {/each}
            </select>
          </div>
          <div class="codebook-scroll">
            <table>
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Section</th>
                  <th>#</th>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Options</th>
                </tr>
              </thead>
              <tbody>
                {#each bal_codebook_grouped as [bal_key, bal_group] (bal_key)}
                  <tr>
                    <td class="mono">{bal_group.row.variableName}{bal_group.row.matrixRowLabel ? ` · ${bal_group.row.matrixRowLabel}` : ''}</td>
                    <td>{bal_group.row.sectionTitle}</td>
                    <td>{bal_group.row.questionNumber}</td>
                    <td>{bal_group.row.questionLabel}</td>
                    <td>{bal_group.row.itemType}</td>
                    <td>{bal_group.row.required ? 'Yes' : 'No'}</td>
                    <td>{bal_group.options.join(', ') || '—'}</td>
                  </tr>
                {:else}
                  <tr>
                    <td colspan="7" class="muted">No codebook rows match this search.</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <p class="muted">{BAL_CODEBOOK_HEADERS.length} documented columns · {bal_codebook_filtered.length} rows shown</p>
        </div>
      {/if}
    </section>

    <section class="card">
      <h2>Provenance and analysis tools</h2>
      <div class="actions">
        <Button onclick={bal_download_audit}>
          <Icon name="file-text" size={16} />
          Audit CSV
        </Button>
        <Button onclick={bal_download_summary}>
          <Icon name="file-text" size={16} />
          Summary JSON
        </Button>
        <Button disabled={bal_columns.length === 0} onclick={bal_download_spss}>
          <Icon name="download" size={16} />
          SPSS syntax (.sps)
        </Button>
        <Button disabled={bal_columns.length === 0} onclick={bal_download_r}>
          <Icon name="download" size={16} />
          R helper (.R)
        </Button>
      </div>
      <p class="muted">
        SPSS syntax reads the responses CSV, declares variable and value labels, and marks blank numeric cells as
        missing. The R helper reads the same CSV and converts coded answers to labelled factors. XLSX is
        intentionally not produced; the CSV opens directly in Excel, LibreOffice, Google Sheets, R, Python, and SPSS.
      </p>
      <div class="actions">
        <Button onclick={bal_download_manifest}>
          <Icon name="file-text" size={16} />
          Reproducibility manifest
        </Button>
      </div>
      {#if bal_snapshots.length > 0}
        <div class="snapshots">
          <h3>Recorded exports</h3>
          {#each bal_snapshots.slice(0, 8) as bal_snapshot (bal_snapshot.id)}
            <div class="snapshot-row">
              <span class="mono">{new Date(bal_snapshot.createdAt).toLocaleString()}</span>
              <span>
                {bal_snapshot.respondentCount} respondents · {bal_snapshot.exportConfig.format}
                {bal_snapshot.exportConfig.optionColumns ? ' · binary columns' : ''}{bal_snapshot.exportConfig.bom ? ' · BOM' : ''}
              </span>
              <span class="muted">
                {bal_snapshot.unresolvedCount} unresolved · v{bal_snapshot.questionnaireVersion} · {bal_snapshot.algorithmVersion} · {bal_snapshot.profileName}
              </span>
            </div>
          {/each}
          <p class="muted">Snapshots record export configuration and data counts; no response data is duplicated.</p>
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .head h1 {
    margin: 0 0 4px;
    font-size: 22px;
  }
  .sub {
    margin: 0;
    color: var(--text-muted);
    font-size: 14px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .card h2 {
    margin: 0;
    font-size: 15px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
    margin: 0;
  }
  .stats dt {
    font-size: 12px;
    color: var(--text-muted);
  }
  .stats dd {
    margin: 2px 0 0;
    font-size: 14px;
    font-weight: 600;
  }
  .stats dd.warn {
    color: var(--warning-text, #9a6700);
  }
  .options {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .options label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .warning {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid var(--warning-border, #d4a72c);
    background: var(--warning-surface, #fff8e1);
    border-radius: 10px;
    padding: 12px 16px;
  }
  .warning-text {
    font-size: 14px;
  }
  .warning-actions {
    display: flex;
    gap: 10px;
  }
  .codebook {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .codebook-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .codebook-filters input[type='search'] {
    flex: 1 1 220px;
  }
  .codebook-scroll {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .codebook table {
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
  }
  .codebook th,
  .codebook td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  .codebook th {
    position: sticky;
    top: 0;
    background: var(--surface);
    font-size: 12px;
    color: var(--text-muted);
  }
  .mono {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin: 0;
  }
  .snapshots {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .snapshots h3 {
    margin: 0;
    font-size: 13px;
  }
  .snapshot-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    font-size: 13px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 6px;
  }
  @media (max-width: 768px) {
    .page {
      padding: 12px;
    }
    .actions :global(button) {
      flex: 1 1 100%;
      justify-content: center;
    }
    .warning-actions {
      width: 100%;
    }
    .warning-actions :global(button) {
      flex: 1 1 100%;
      justify-content: center;
    }
  }
</style>
