<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import EmptyState from '../../components/ui/EmptyState.svelte';
  import Icon from '../../icons/Icon.svelte';
  import type { ValidationSeverity } from '../../models/questionnaire_validation';
  import { validate_questionnaire, type ValidationIssue } from '../../models/questionnaire_validation';
  import { derive_numbering } from '../../models/numbering';
  import Sheet from '../../components/ui/Sheet.svelte';
  import { builder_state } from './builder_state';

  let {
    open = $bindable(false),
    onnavigate
  }: {
    open?: boolean;
    onnavigate: (bal_section_id: string | null, bal_item_id: string | null) => void;
  } = $props();

  const bal_state = $derived($builder_state);

  const bal_issues = $derived.by<ValidationIssue[]>(() => {
    if (!bal_state.questionnaire) return [];
    return validate_questionnaire(bal_state.questionnaire, bal_state.scales);
  });

  const bal_numbering = $derived(
    bal_state.questionnaire ? derive_numbering(bal_state.questionnaire) : null
  );

  function bal_label_for(bal_issue: ValidationIssue): string {
    if (!bal_numbering || !bal_state.questionnaire) return '';
    if (bal_issue.itemId) {
      const bal_num = bal_numbering.itemLabels[bal_issue.itemId];
      if (bal_num) return bal_num;
      for (const bal_section of bal_state.questionnaire.sections) {
        const bal_item = bal_section.items.find((bal_i) => bal_i.id === bal_issue.itemId);
        if (bal_item) {
          return bal_item.type === 'instruction' ? 'Instruction' : bal_item.type;
        }
      }
    }
    if (bal_issue.sectionId) {
      const bal_si = bal_state.questionnaire.sections.findIndex(
        (bal_s) => bal_s.id === bal_issue.sectionId
      );
      if (bal_si !== -1) return `Section ${bal_si + 1}`;
    }
    return 'Scale';
  }

  function bal_jump(bal_issue: ValidationIssue): void {
    if (bal_issue.itemId || bal_issue.sectionId) {
      onnavigate(bal_issue.sectionId ?? null, bal_issue.itemId ?? null);
      open = false;
    }
  }
</script>

<Sheet bind:open side="bottom" title="Questionnaire check">
  <div class="check">
    {#if bal_issues.length === 0}
      <EmptyState
        icon="circle-check"
        title="No problems found"
        body="Variable names, options, codings, ranges, and structure all look consistent."
      />
    {:else}
      <p class="check-summary">
        {bal_issues.filter((bal_i) => bal_i.severity === 'error').length}
        error(s),
        {bal_issues.filter((bal_i) => bal_i.severity === 'warning').length}
        warning(s)
      </p>
      <ul class="issue-list">
        {#each bal_issues as bal_issue (bal_issue.code + (bal_issue.itemId ?? '') + (bal_issue.scaleId ?? '') + bal_issue.message)}
          <li>
            <button
              class="issue-row"
              type="button"
              disabled={!bal_issue.itemId && !bal_issue.sectionId}
              onclick={() => bal_jump(bal_issue)}
            >
              <span
                class="issue-mark"
                class:error={bal_issue.severity === ('error' as ValidationSeverity)}
                aria-hidden="true"
              >
                <Icon
                  name={bal_issue.severity === 'error' ? 'alert' : 'info'}
                  size={15}
                />
              </span>
              <span class="issue-text">
                <span class="issue-loc">{bal_label_for(bal_issue)}</span>
                <span class="issue-msg">{bal_issue.message}</span>
              </span>
              {#if bal_issue.itemId || bal_issue.sectionId}
                <span class="issue-go">
                  Show
                  <Icon name="chevron-right" size={14} />
                </span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="check-foot">
      <Button variant="secondary" onclick={() => (open = false)}>Close</Button>
    </div>
  </div>
</Sheet>

<style>
  .check {
    display: grid;
    gap: var(--space-3);
  }

  .check-summary {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-ink-2);
  }

  .issue-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
  }

  .issue-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    text-align: left;
    cursor: pointer;
    color: var(--color-ink);
  }

  .issue-row:hover:not(:disabled) {
    border-color: var(--color-border-strong);
    background: var(--color-surface-2);
  }

  .issue-row:disabled {
    cursor: default;
  }

  .issue-mark {
    display: inline-flex;
    margin-top: 2px;
    color: var(--color-warning-ink);
    flex: none;
  }

  .issue-mark.error {
    color: var(--color-danger);
  }

  .issue-text {
    display: grid;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }

  .issue-loc {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-ink-3);
  }

  .issue-msg {
    font-size: var(--text-sm);
  }

  .issue-go {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: var(--text-xs);
    color: var(--color-accent);
    flex: none;
    margin-top: 3px;
  }

  .check-foot {
    display: flex;
    justify-content: flex-end;
  }
</style>
