import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine } from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { linter, forceLinting, type Diagnostic } from '@codemirror/lint';
import { bal_svelp_language, bal_svelp_highlight } from './svelp_language';
import type { bal_SemanticIssue } from './bhul_validate';

export interface bal_EditorHost {
  view: EditorView;
  set_problems: (bal_problems: bal_SemanticIssue[]) => void;
  focus_line: (bal_line: number, bal_column: number) => void;
  get_text: () => string;
  destroy: () => void;
}

export function bal_mount_source_editor(
  bal_host: HTMLElement,
  bal_initial: string,
  bal_on_change: (bal_text: string) => void
): bal_EditorHost {
  let bal_latest: bal_SemanticIssue[] = [];
  const bal_lint = linter((bal_view) =>
    bal_latest.map((bal_issue) => {
      const bal_total = bal_view.state.doc.lines;
      const bal_target = Math.min(Math.max(1, bal_issue.line), bal_total);
      const bal_line_obj = bal_view.state.doc.line(bal_target);
      return {
        from: bal_line_obj.from,
        to: Math.max(bal_line_obj.from + 1, bal_line_obj.to),
        severity: bal_issue.severity === 'error' ? ('error' as const) : ('warning' as const),
        message: bal_issue.message
      } satisfies Diagnostic;
    })
  );
  const bal_extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLine(),
    drawSelection(),
    history(),
    search(),
    highlightSelectionMatches(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    bal_lint,
    bal_svelp_language,
    bal_svelp_highlight,
    EditorView.lineWrapping,
    EditorView.updateListener.of((bal_update) => {
      if (bal_update.docChanged) bal_on_change(bal_update.state.doc.toString());
    })
  ];
  const bal_view = new EditorView({
    state: EditorState.create({ doc: bal_initial, extensions: bal_extensions }),
    parent: bal_host
  });
  return {
    view: bal_view,
    set_problems: (bal_problems: bal_SemanticIssue[]): void => {
      bal_latest = bal_problems;
      forceLinting(bal_view);
    },
    focus_line: (bal_line: number, bal_column: number): void => {
      const bal_total = bal_view.state.doc.lines;
      const bal_target = Math.min(Math.max(1, bal_line), bal_total);
      const bal_line_obj = bal_view.state.doc.line(bal_target);
      const bal_pos = Math.min(bal_line_obj.from + Math.max(0, bal_column - 1), bal_line_obj.to);
      bal_view.dispatch({
        selection: { anchor: bal_pos },
        effects: EditorView.scrollIntoView(bal_pos, { y: 'center' })
      });
      bal_view.focus();
    },
    get_text: (): string => bal_view.state.doc.toString(),
    destroy: (): void => bal_view.destroy()
  };
}
