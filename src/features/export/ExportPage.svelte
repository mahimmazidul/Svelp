<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../../components/ui/Button.svelte';
  import EmptyState from '../../components/ui/EmptyState.svelte';
  import Icon from '../../icons/Icon.svelte';
  import { dhon_project } from '../../db/projects_repo';
  import { dhon_questionnaire_by_project } from '../../db/questionnaires_repo';
  import { ken_pori_scales } from '../../db/scales_repo';
  import { ken_pori_responses_by_project } from '../../db/response_repo';
  import { malta_download_file } from '../../utils/download';
  import {
    bal_build_codebook,
    bal_build_export_rows,
    bal_codebook_to_csv,
    bal_export_columns,
    bal_export_filenames,
    bal_export_headers,
    bal_build_json_dataset,
    bal_to_csv
  } from './export_dataset';

  let { projectId }: { projectId: string } = $props();

  let bal_status = $state<'loading' | 'ready' | 'missing'>('loading');
  let bal_project_title = $state('');
  let bal_questionnaire_title = $state('');
  let bal_version = $state(0);
  let bal_respondent_count = $state(0);
  let bal_variable_count = $state(0);
  let bal_review_count = $state(0);
  let bal_include_diagnostics = $state(false);

  async function bal_download_csv(): Promise<void> {
    const bal_q = await dhon_questionnaire_by_project(projectId);
    if (!bal_q) return;
    const bal_scales = await ken_pori_scales();
    const bal_responses = await ken_pori_responses_by_project(projectId);
    const bal_columns = bal_export_columns(bal_q);
    const bal_respondents = [...new Set(bal_responses.map((bal_r) => bal_r.respondentId))].sort();
    const bal_rows = bal_build_export_rows(
      bal_columns,
      bal_q,
      bal_scales,
      bal_responses,
      bal_respondents,
      bal_include_diagnostics
    );
    const bal_names = bal_export_filenames(bal_project_title || 'Svelp', bal_q.version);
    malta_download_file(bal_names.responsesCsv, bal_to_csv(bal_rows, bal_export_headers(bal_columns, bal_include_diagnostics)), 'text/csv');
  }

  async function bal_download_json(): Promise<void> {
    const bal_q = await dhon_questionnaire_by_project(projectId);
    if (!bal_q) return;
    const bal_scales = await ken_pori_scales();
    const bal_responses = await ken_pori_responses_by_project(projectId);
    const bal_columns = bal_export_columns(bal_q);
    const bal_respondents = [...new Set(bal_responses.map((bal_r) => bal_r.respondentId))].sort();
    const bal_names = bal_export_filenames(bal_project_title || 'Svelp', bal_q.version);
    malta_download_file(
      bal_names.responsesJson,
      bal_build_json_dataset(bal_columns, bal_q, bal_scales, bal_responses, bal_respondents),
      'application/json'
    );
  }

  async function bal_download_codebook(): Promise<void> {
    const bal_q = await dhon_questionnaire_by_project(projectId);
    if (!bal_q) return;
    const bal_scales = await ken_pori_scales();
    const bal_columns = bal_export_columns(bal_q);
    const bal_names = bal_export_filenames(bal_project_title || 'Svelp', bal_q.version);
    malta_download_file(
      bal_names.codebookCsv,
      bal_codebook_to_csv(bal_build_codebook(bal_columns, bal_q, bal_scales)),
      'text/csv'
    );
  }

  onMount(() => {
    void (async () => {
      const bal_project = await dhon_project(projectId);
      if (!bal_project) {
        bal_status = 'missing';
        return;
      }
      bal_project_title = bal_project.title;
      const bal_q = await dhon_questionnaire_by_project(projectId);
      if (!bal_q) {
        bal_status = 'missing';
        return;
      }
      bal_questionnaire_title = bal_q.title;
      bal_version = bal_q.version;
      const bal_responses = await ken_pori_responses_by_project(projectId);
      bal_respondent_count = new Set(bal_responses.map((bal_r) => bal_r.respondentId)).size;
      bal_variable_count = bal_export_columns(bal_q).length;
      bal_review_count = bal_responses.filter(
        (bal_r) =>
          bal_r.status === 'needs-review' ||
          bal_r.status === 'ambiguous' ||
          bal_r.status === 'multiple-marks' ||
          bal_r.status === 'unreadable' ||
          bal_r.status === 'manual-only'
      ).length;
      bal_status = 'ready';
    })();
  });
</script>

<div class="page">
  <header class="head">
    <h1>Export</h1>
    <p class="sub">Download reviewed answers as a clean research dataset with a matching codebook.</p>
  </header>

  {#if bal_status === 'loading'}
    <p class="muted">Loading…</p>
  {:else if bal_status === 'missing'}
    <EmptyState icon="download" title="Nothing to export yet" body="Create a questionnaire and read scanned responses first." />
  {:else}
    <section class="card">
      <div class="meta">
        <div>
          <strong>{bal_questionnaire_title}</strong>
          <span class="muted"> · version {bal_version}</span>
        </div>
        <span class="muted">{bal_respondent_count} respondent{bal_respondent_count === 1 ? '' : 's'} · {bal_variable_count} variable{bal_variable_count === 1 ? '' : 's'}</span>
      </div>
      <p class="muted">
        Exports use final reviewed values. Answers still awaiting review are left empty in the clean dataset
        {bal_review_count > 0 ? `(${bal_review_count} now)` : ''}. Codebook values come from the questionnaire schema.
      </p>
      <label class="diag">
        <input type="checkbox" bind:checked={bal_include_diagnostics} />
        <span>Include recognition diagnostics (status, confidence, machine value, corrected flag)</span>
      </label>
      <div class="actions">
        <Button variant="primary" disabled={bal_respondent_count === 0} onclick={bal_download_csv}>
          <Icon name="download" size={16} />
          Responses CSV
        </Button>
        <Button disabled={bal_respondent_count === 0} onclick={bal_download_json}>
          <Icon name="download" size={16} />
          Responses JSON
        </Button>
        <Button disabled={bal_variable_count === 0} onclick={bal_download_codebook}>
          <Icon name="file-text" size={16} />
          Codebook CSV
        </Button>
      </div>
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
  .meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
  }
  .diag {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin: 0;
  }
  @media (max-width: 768px) {
    .page {
      padding: 12px;
    }
    .actions :global(button) {
      flex: 1 1 100%;
      justify-content: center;
    }
  }
</style>
