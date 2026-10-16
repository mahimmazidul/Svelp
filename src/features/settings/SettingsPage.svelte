<script lang="ts">
  import { BAL_DB_VERSION } from '../../db/client';
  import { BAL_THRESHOLD_PROFILE_NAME } from '../../models/response_models';
  import { BAL_MAHIM_PAYLOAD_VERSION } from '../mahim/mahim_container';

  const bal_rows: { label: string; value: string }[] = [
    { label: 'Svelp version', value: __SVELP_VERSION__ },
    { label: 'Database schema version', value: `v${BAL_DB_VERSION}` },
    { label: 'Recognition profile', value: BAL_THRESHOLD_PROFILE_NAME },
    { label: 'MAHIM payload compatibility', value: `v${BAL_MAHIM_PAYLOAD_VERSION}` }
  ];

  const bal_environment = typeof navigator === 'undefined' ? '' : navigator.userAgent;
</script>

<div class="page">
  <header class="head">
    <h1>Settings</h1>
    <p class="sub">Diagnostics and version information for this installation.</p>
  </header>

  <section class="card">
    <h2>About Svelp</h2>
    <p class="card-lead">
      Svelp is an offline-first research questionnaire tool. Questionnaires, scans, and responses are
      stored locally on this device. Include the details below when reporting a problem.
    </p>
    <dl class="info-grid">
      {#each bal_rows as bal_row (bal_row.label)}
        <div class="info-row">
          <dt>{bal_row.label}</dt>
          <dd>{bal_row.value}</dd>
        </div>
      {/each}
      <div class="info-row">
        <dt>Browser</dt>
        <dd class="wrap-anywhere">{bal_environment}</dd>
      </div>
    </dl>
  </section>

  <section class="card">
    <h2>Local data</h2>
    <p class="card-lead">
      All project data lives in this browser's local storage. Use a project's export actions to back
      it up as files, and the MAHIM import on the Projects page to restore it on another device.
      Clearing this browser's site data removes local projects.
    </p>
  </section>
</div>

<style>
  .head {
    margin-bottom: var(--space-4);
  }
  .head h1 {
    margin: 0 0 var(--space-1);
    font-size: 1.3rem;
  }
  .sub {
    margin: 0;
    color: var(--color-muted);
    font-size: 0.92rem;
  }
  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: var(--space-4);
    margin-bottom: var(--space-4);
  }
  .card h2 {
    margin: 0 0 var(--space-2);
    font-size: 1.05rem;
  }
  .card-lead {
    margin: 0 0 var(--space-3);
    color: var(--color-muted);
    font-size: 0.92rem;
    line-height: 1.5;
  }
  .info-grid {
    margin: 0;
    display: grid;
    gap: var(--space-2);
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.92rem;
  }
  .info-row:last-child {
    border-bottom: 0;
  }
  .info-row dt {
    color: var(--color-muted);
  }
  .info-row dd {
    margin: 0;
    font-weight: 600;
    text-align: end;
    font-variant-numeric: tabular-nums;
  }
  .wrap-anywhere {
    max-width: 60%;
    overflow-wrap: anywhere;
    font-weight: 400;
    font-size: 0.85rem;
  }
</style>
