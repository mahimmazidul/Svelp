<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import EmptyState from '../../components/ui/EmptyState.svelte';
  import IconButton from '../../components/ui/IconButton.svelte';
  import Sheet from '../../components/ui/Sheet.svelte';
  import { project_context } from '../../app/project_context';
  import { ghora_layout, type LayoutMode } from '../../utils/breakpoints';
  import { bal_banaitesi_draft } from '../../services/project_service';
  import AddItemMenu from './AddItemMenu.svelte';
  import InspectorPanel from './InspectorPanel.svelte';
  import ItemEditor from './ItemEditor.svelte';
  import StructurePanel from './StructurePanel.svelte';
  import ValidationPanel from './ValidationPanel.svelte';
  import ScalesManagerSheet from './ScalesManagerSheet.svelte';
  import { builder_state } from './builder_state';

  let { projectId }: { projectId: string } = $props();

  let shawya_structure_open = $state(false);
  let shawya_check_open = $state(false);
  let shawya_scales_open = $state(false);

  const bal_mode = $derived<LayoutMode>($ghora_layout);
  const bal_state = $derived($builder_state);

  $effect(() => {
    void builder_state.load(projectId);
    return () => {
      void builder_state.flush();
    };
  });

  $effect(() => {
    const bal_handler = (bal_event: KeyboardEvent): void => {
      if (!(bal_event.metaKey || bal_event.ctrlKey)) return;
      const bal_key = bal_event.key.toLowerCase();
      if (bal_key === 'z' && !bal_event.shiftKey) {
        bal_event.preventDefault();
        builder_state.undo();
      } else if ((bal_key === 'z' && bal_event.shiftKey) || bal_key === 'y') {
        bal_event.preventDefault();
        builder_state.redo();
      }
    };
    window.addEventListener('keydown', bal_handler);
    return () => window.removeEventListener('keydown', bal_handler);
  });

  const bal_save_label = $derived(
    bal_state.saveStatus === 'saved'
      ? 'All changes saved'
      : bal_state.saveStatus === 'dirty'
        ? 'Unsaved changes'
        : bal_state.saveStatus === 'saving'
          ? 'Saving…'
          : 'Save failed'
  );

  async function bal_recreate(): Promise<void> {
    const bal_project = $project_context.project;
    if (!bal_project) return;
    await bal_banaitesi_draft(bal_project.id, bal_project.title);
    await builder_state.reload(bal_project.id);
  }
</script>

{#if bal_state.status === 'loading' || bal_state.status === 'empty'}
  <div class="page">
    <p class="muted">Loading questionnaire…</p>
  </div>
{:else if bal_state.status === 'missing'}
  <div class="page">
    <EmptyState
      icon="file-text"
      title="No draft questionnaire"
      body="This project does not have a questionnaire attached. You can recreate an empty draft."
    >
      <Button variant="primary" icon="plus" onclick={() => void bal_recreate()}>
        Recreate draft
      </Button>
    </EmptyState>
  </div>
{:else if bal_state.status === 'error'}
  <div class="page">
    <EmptyState
      icon="alert"
      title="Could not load the questionnaire"
      body="The questionnaire could not be read from local storage."
    >
      <Button variant="secondary" onclick={() => void builder_state.reload(projectId)}>
        Try again
      </Button>
    </EmptyState>
  </div>
{:else if bal_state.questionnaire}
  <div class="builder" data-mode={bal_mode}>
    {#if bal_mode !== 'mobile'}
      <div class="panel structure-panel">
        <StructurePanel />
      </div>
    {/if}
    <div class="panel canvas-panel">
      <header class="canvas-head">
        <span class="canvas-crumb">{bal_state.questionnaire.title}</span>
        <div class="canvas-tools">
          <IconButton
            label="Undo"
            icon="undo"
            glyph={17}
            disabled={!bal_state.canUndo}
            onclick={() => builder_state.undo()}
          />
          <IconButton
            label="Redo"
            icon="redo"
            glyph={17}
            disabled={!bal_state.canRedo}
            onclick={() => builder_state.redo()}
          />
          <Button variant="secondary" size="sm" icon="check" onclick={() => (shawya_check_open = true)}>
            Check
          </Button>
          <Button variant="secondary" size="sm" icon="sliders" onclick={() => (shawya_scales_open = true)}>
            Scales
          </Button>
          <span class="save-state" data-state={bal_state.saveStatus}>
            <span class="save-dot" aria-hidden="true"></span>
            {bal_save_label}
          </span>
        </div>
      </header>
      <div class="canvas-body">
        <ItemEditor mode={bal_mode} />
      </div>
    </div>
    {#if bal_mode === 'desktop'}
      <div class="panel inspector-panel">
        <InspectorPanel />
      </div>
    {/if}
    {#if bal_mode === 'mobile'}
      <div class="mobile-toolbar">
        <Button
          variant="secondary"
          icon="layers"
          onclick={() => (shawya_structure_open = true)}
        >
          Structure
        </Button>
        <div class="mobile-tools">
          <IconButton
            label="Undo"
            icon="undo"
            glyph={17}
            disabled={!bal_state.canUndo}
            onclick={() => builder_state.undo()}
          />
          <IconButton
            label="Redo"
            icon="redo"
            glyph={17}
            disabled={!bal_state.canRedo}
            onclick={() => builder_state.redo()}
          />
          <IconButton
            label="Check questionnaire"
            icon="circle-check"
            glyph={17}
            onclick={() => (shawya_check_open = true)}
          />
          <IconButton
            label="Response scales"
            icon="sliders"
            glyph={17}
            onclick={() => (shawya_scales_open = true)}
          />
          <AddItemMenu label="Add" show_bulk={true} />
        </div>
      </div>
      <Sheet bind:open={shawya_structure_open} side="start" title="Structure">
        <div class="sheet-structure">
          <StructurePanel />
        </div>
      </Sheet>
    {/if}
  </div>
{/if}

<ValidationPanel
  open={shawya_check_open}
  onnavigate={(bal_section_id, bal_item_id) => {
    if (bal_item_id) {
      builder_state.select_item(bal_item_id);
    } else if (bal_section_id) {
      builder_state.select_section(bal_section_id);
    }
    if (bal_mode === 'mobile') shawya_structure_open = false;
  }}
/>

<ScalesManagerSheet bind:open={shawya_scales_open} />

<style>
  .builder {
    display: grid;
    min-height: 0;
  }

  .builder[data-mode='desktop'] {
    grid-template-columns: 290px minmax(0, 1fr) 330px;
    height: 100dvh;
  }

  .builder[data-mode='tablet'] {
    grid-template-columns: 250px minmax(0, 1fr);
    height: 100dvh;
  }

  .builder[data-mode='mobile'] {
    display: block;
  }

  .panel {
    min-height: 0;
    background: var(--color-surface);
  }

  .structure-panel {
    border-right: var(--border-width) solid var(--color-border);
  }

  .inspector-panel {
    border-left: var(--border-width) solid var(--color-border);
  }

  .canvas-panel {
    display: flex;
    flex-direction: column;
    background: var(--color-canvas);
  }

  .canvas-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-3) var(--space-2) var(--space-5);
    border-bottom: var(--border-width) solid var(--color-border);
    background: var(--color-surface);
    flex: none;
  }

  .canvas-crumb {
    font-size: var(--text-sm);
    font-weight: 650;
    color: var(--color-ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .canvas-tools {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: none;
  }

  .canvas-tools :global(.ibtn) {
    width: 34px;
    height: 34px;
  }

  .save-state {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-ink-3);
    white-space: nowrap;
    flex: none;
  }

  .save-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-success);
  }

  .save-state[data-state='dirty'] .save-dot {
    background: var(--color-border-strong);
  }

  .save-state[data-state='saving'] .save-dot {
    background: var(--color-accent);
  }

  .save-state[data-state='error'] .save-dot {
    background: var(--color-danger);
  }

  .canvas-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-5);
  }

  .mobile-toolbar {
    position: sticky;
    bottom: 0;
    z-index: var(--z-topbar);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    padding-bottom: max(var(--space-2), env(safe-area-inset-bottom));
    background: var(--color-surface);
    border-top: var(--border-width) solid var(--color-border);
  }

  .mobile-tools {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .builder[data-mode='mobile'] .canvas-panel {
    border-top: none;
  }

  .builder[data-mode='mobile'] .canvas-head {
    padding: var(--space-2) var(--space-3);
  }

  .builder[data-mode='mobile'] .canvas-body {
    padding: var(--space-4);
    padding-bottom: 96px;
  }

  .sheet-structure {
    height: 100%;
    min-height: 0;
  }

  @media (max-width: 767px) {
    .canvas-tools :global(.btn) {
      display: none;
    }
  }
</style>
