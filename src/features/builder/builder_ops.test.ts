import { describe, expect, it } from 'vitest';
import {
  bal_add_item,
  bal_banaitesi_bulk_questions,
  bal_paste_matrix_columns,
  bal_paste_matrix_rows,
  bal_plan_bulk_questions,
  bal_split_paste_lines,
  bal_taken_variable_names,
  ghora_add_matrix_column,
  ghora_add_matrix_row,
  ghora_add_section,
  ghora_move_item,
  ghora_move_matrix_column,
  ghora_move_matrix_row,
  ghora_move_option,
  komola_add_option,
  komola_assign_scale,
  komola_detach_scale,
  lichu_item,
  lichu_matrix_column,
  lichu_matrix_row,
  lichu_option,
  malta_item,
  ram_chagol_section,
  ram_chagol_selection_mode,
  dhon_set_likert_points,
  dhon_update_item
} from './builder_ops';
import { apel_clone_item, dhon_banaitesi_item, dhon_banaitesi_questionnaire } from '../../models/factories';

function bal_fixture() {
  return dhon_banaitesi_questionnaire({ projectId: 'p1', title: 'Test' });
}

describe('bal_add_item', () => {
  it('appends items with unique variable names', () => {
    let bal_q = bal_fixture();
    const bal_first = bal_add_item(bal_q, bal_q.sections[0].id, 'single_choice');
    bal_q = bal_first.q;
    const bal_second = bal_add_item(bal_q, bal_q.sections[0].id, 'single_choice');
    bal_q = bal_second.q;
    expect(bal_taken_variable_names(bal_q)).toEqual(['q1', 'q2']);
    expect(bal_q.sections[0].items).toHaveLength(2);
  });

  it('inserts after a given item', () => {
    let bal_q = bal_fixture();
    const bal_a = bal_add_item(bal_q, bal_q.sections[0].id, 'single_choice');
    bal_q = bal_a.q;
    const bal_b = bal_add_item(bal_q, bal_q.sections[0].id, 'single_choice');
    bal_q = bal_b.q;
    const bal_c = bal_add_item(bal_q, bal_q.sections[0].id, 'instruction', bal_a.itemId);
    bal_q = bal_c.q;
    expect(bal_q.sections[0].items[1].type).toBe('instruction');
  });
});

describe('malta_item', () => {
  it('duplicates with fresh ids and a unique variable name', () => {
    let bal_q = bal_fixture();
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'single_choice');
    bal_q = bal_added.q;
    const bal_dup = malta_item(bal_q, bal_added.itemId as string);
    bal_q = bal_dup.q;
    const bal_items = bal_q.sections[0].items;
    expect(bal_items).toHaveLength(2);
    expect(bal_items[0].id).not.toBe(bal_items[1].id);
    expect(bal_items[1].variableName).toBe('q1_2');
    expect(bal_items[1].options.map((bal_o) => bal_o.id)).not.toEqual(
      bal_items[0].options.map((bal_o) => bal_o.id)
    );
  });

  it('duplicates matrices with fresh row and column ids', () => {
    let bal_q = bal_fixture();
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'matrix');
    bal_q = bal_added.q;
    const bal_matrix_id = bal_added.itemId as string;
    bal_q = bal_paste_matrix_rows(bal_q, bal_matrix_id, ['Rice', 'Fish']);
    bal_q = bal_paste_matrix_columns(bal_q, bal_matrix_id, ['Never', 'Daily']);
    const bal_dup = malta_item(bal_q, bal_matrix_id);
    bal_q = bal_dup.q;
    const bal_original = bal_q.sections[0].items[0];
    const bal_copy = bal_q.sections[0].items[1];
    expect(bal_copy.rows.map((bal_r) => bal_r.label)).toEqual(['Rice', 'Fish']);
    expect(bal_copy.columns.map((bal_c) => bal_c.label)).toEqual(['Never', 'Daily']);
    expect(bal_copy.rows.map((bal_r) => bal_r.id)).not.toEqual(
      bal_original.rows.map((bal_r) => bal_r.id)
    );
    expect(bal_copy.columns.map((bal_c) => bal_c.id)).not.toEqual(
      bal_original.columns.map((bal_c) => bal_c.id)
    );
    expect(bal_copy.variableName).not.toBe(bal_original.variableName);
  });
});

describe('ghora_move_item', () => {
  it('moves an item into the previous section when crossing the top', () => {
    let bal_q = bal_fixture();
    const bal_second = ghora_add_section(bal_q, 'Second');
    bal_q = bal_second.q;
    const bal_added = bal_add_item(bal_q, bal_second.sectionId, 'single_choice');
    bal_q = bal_added.q;
    const bal_moved = ghora_move_item(bal_q, bal_added.itemId as string, -1);
    expect(bal_moved.sections[0].items.map((bal_i) => bal_i.id)).toContain(bal_added.itemId);
    expect(bal_moved.sections[1].items).toHaveLength(0);
  });
});

describe('options', () => {
  it('adds, renames, and refuses to remove the last option', () => {
    let bal_q = bal_fixture();
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'single_choice');
    bal_q = bal_added.q;
    const bal_item_id = bal_added.itemId as string;
    bal_q = komola_add_option(bal_q, bal_item_id);
    expect(bal_q.sections[0].items[0].options).toHaveLength(3);
    const bal_option_id = bal_q.sections[0].items[0].options[0].id;
    bal_q = ram_chagol_section(bal_q, bal_q.sections[0].id, { title: 'Renamed' });
    bal_q = lichu_option(bal_q, bal_item_id, bal_option_id);
    expect(bal_q.sections[0].items[0].options).toHaveLength(2);
    let bal_single = bal_q;
    for (const bal_o of bal_q.sections[0].items[0].options.slice(1)) {
      bal_single = lichu_option(bal_single, bal_item_id, bal_o.id);
    }
    const bal_last = bal_single.sections[0].items[0].options[0].id;
    const bal_blocked = lichu_option(bal_single, bal_item_id, bal_last);
    expect(bal_blocked.sections[0].items[0].options).toHaveLength(1);
  });

  it('reorders options', () => {
    let bal_q = bal_fixture();
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'single_choice');
    bal_q = bal_added.q;
    const bal_item_id = bal_added.itemId as string;
    const bal_first = bal_q.sections[0].items[0].options[0].id;
    bal_q = ghora_move_option(bal_q, bal_item_id, bal_first, 1);
    expect(bal_q.sections[0].items[0].options[1].id).toBe(bal_first);
  });
});

describe('matrix rows and columns', () => {
  it('pastes multiple rows at once', () => {
    let bal_q = bal_fixture();
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'matrix');
    bal_q = bal_added.q;
    const bal_item_id = bal_added.itemId as string;
    bal_q = bal_paste_matrix_rows(bal_q, bal_item_id, ['Rice', 'Fish', 'Egg', 'Milk', 'Beef']);
    expect(bal_q.sections[0].items[0].rows.map((bal_r) => bal_r.label)).toEqual([
      'Rice',
      'Fish',
      'Egg',
      'Milk',
      'Beef'
    ]);
    const bal_ids = new Set(
      bal_q.sections[0].items[0].rows.map((bal_r) => bal_r.id)
    );
    expect(bal_ids.size).toBe(5);
  });

  it('pastes multiple columns and clears any scale link', () => {
    let bal_q = bal_fixture();
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'matrix');
    bal_q = bal_added.q;
    const bal_item_id = bal_added.itemId as string;
    bal_q = komola_assign_scale(bal_q, bal_item_id, 'scale-1');
    bal_q = bal_paste_matrix_columns(bal_q, bal_item_id, ['Never', 'Weekly', 'Daily']);
    const bal_matrix = bal_q.sections[0].items[0];
    expect(bal_matrix.scaleId).toBeNull();
    expect(bal_matrix.columns).toHaveLength(3);
  });

  it('moves and removes rows and columns with stable ids', () => {
    let bal_q = bal_fixture();
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'matrix');
    bal_q = bal_added.q;
    const bal_item_id = bal_added.itemId as string;
    bal_q = bal_paste_matrix_rows(bal_q, bal_item_id, ['Rice', 'Fish', 'Egg']);
    bal_q = bal_paste_matrix_columns(bal_q, bal_item_id, ['Never', 'Weekly', 'Daily']);
    const bal_first_row = bal_q.sections[0].items[0].rows[0].id;
    bal_q = ghora_move_matrix_row(bal_q, bal_item_id, bal_first_row, 1);
    expect(bal_q.sections[0].items[0].rows[1].id).toBe(bal_first_row);
    bal_q = lichu_matrix_row(bal_q, bal_item_id, bal_first_row);
    expect(bal_q.sections[0].items[0].rows).toHaveLength(2);

    const bal_last_col = bal_q.sections[0].items[0].columns[2].id;
    bal_q = ghora_move_matrix_column(bal_q, bal_item_id, bal_last_col, -1);
    expect(bal_q.sections[0].items[0].columns[1].id).toBe(bal_last_col);
    bal_q = lichu_matrix_column(bal_q, bal_item_id, bal_last_col);
    expect(bal_q.sections[0].items[0].columns).toHaveLength(2);
  });

  it('adds single rows and columns', () => {
    let bal_q = bal_fixture();
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'matrix');
    bal_q = bal_added.q;
    const bal_item_id = bal_added.itemId as string;
    bal_q = ghora_add_matrix_row(bal_q, bal_item_id);
    bal_q = ghora_add_matrix_column(bal_q, bal_item_id, 'Often');
    expect(bal_q.sections[0].items[0].rows).toHaveLength(1);
    expect(bal_q.sections[0].items[0].columns[0].label).toBe('Often');
  });

  it('toggles selection mode', () => {
    let bal_q = bal_fixture();
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'matrix');
    bal_q = bal_added.q;
    bal_q = ram_chagol_selection_mode(bal_q, bal_added.itemId as string, 'multiple');
    expect(bal_q.sections[0].items[0].selectionMode).toBe('multiple');
  });
});

describe('likert points', () => {
  it('applies presets with sequential codings', () => {
    let bal_q = bal_fixture();
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'likert_scale');
    bal_q = bal_added.q;
    bal_q = dhon_set_likert_points(bal_q, bal_added.itemId as string, 5);
    const bal_points = bal_q.sections[0].items[0].options;
    expect(bal_points).toHaveLength(5);
    expect(bal_points[0].label).toBe('Strongly disagree');
    expect(bal_points[4].coding).toBe('5');
    bal_q = dhon_set_likert_points(bal_q, bal_added.itemId as string, 7);
    expect(bal_q.sections[0].items[0].options).toHaveLength(7);
  });
});

describe('scale assignment', () => {
  it('assigns a scale and clears local options', () => {
    let bal_q = bal_fixture();
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'single_choice');
    bal_q = bal_added.q;
    bal_q = komola_assign_scale(bal_q, bal_added.itemId as string, 'scale-9');
    const bal_item = bal_q.sections[0].items[0];
    expect(bal_item.scaleId).toBe('scale-9');
    expect(bal_item.options).toHaveLength(0);
  });

  it('detaches with snapshot copies of the scale options', () => {
    let bal_q = bal_fixture();
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'single_choice');
    bal_q = bal_added.q;
    const bal_item_id = bal_added.itemId as string;
    bal_q = komola_assign_scale(bal_q, bal_item_id, 'scale-9');
    const bal_snapshot = [
      { id: 'x1', label: 'Never', coding: '0' },
      { id: 'x2', label: 'Daily', coding: '3' }
    ];
    bal_q = komola_detach_scale(bal_q, bal_item_id, bal_snapshot);
    const bal_item = bal_q.sections[0].items[0];
    expect(bal_item.scaleId).toBeNull();
    expect(bal_item.options.map((bal_o) => bal_o.label)).toEqual(['Never', 'Daily']);
    expect(bal_item.options.map((bal_o) => bal_o.id)).not.toEqual(['x1', 'x2']);
  });
});

describe('bulk creation', () => {
  it('plans unique variable names from labels', () => {
    const bal_q = bal_fixture();
    const bal_plan = bal_plan_bulk_questions(bal_q, ['Rice', 'Fish', 'Rice']);
    expect(bal_plan).toHaveLength(3);
    const bal_names = bal_plan.map((bal_e) => bal_e.variableName);
    expect(new Set(bal_names).size).toBe(3);
    expect(bal_names[0]).toBe('rice');
    expect(bal_names[2]).not.toBe('rice');
  });

  it('creates one question per pasted label with the shared scale', () => {
    let bal_q = bal_fixture();
    const bal_plan = bal_plan_bulk_questions(bal_q, ['Rice', 'Fish', 'Egg', 'Milk', 'Beef', 'Chicken']);
    const bal_result = bal_banaitesi_bulk_questions(
      bal_q,
      bal_q.sections[0].id,
      'single_choice',
      bal_plan,
      'scale-ffq'
    );
    bal_q = bal_result.q;
    const bal_items = bal_q.sections[0].items;
    expect(bal_items).toHaveLength(6);
    expect(bal_result.itemIds).toHaveLength(6);
    expect(new Set(bal_result.itemIds).size).toBe(6);
    for (const bal_item of bal_items) {
      expect(bal_item.scaleId).toBe('scale-ffq');
      expect(bal_item.options).toHaveLength(0);
      expect(bal_item.label.trim()).not.toBe('');
    }
    const bal_names = bal_items.map((bal_i) => bal_i.variableName);
    expect(new Set(bal_names).size).toBe(6);
  });
});

describe('cloning isolation', () => {
  it('deep-clones validation and consent with fresh ids', () => {
    const bal_item = dhon_banaitesi_item('consent', null);
    bal_item.consent = {
      title: 'T',
      introduction: 'I',
      sections: [{ id: 's1', kind: 'risks', title: 'Risks', body: 'B' }],
      acknowledgementLabel: 'OK'
    };
    bal_item.validation = { requireAllRows: true };
    const bal_clone = apel_clone_item(bal_item);
    expect(bal_clone.id).not.toBe(bal_item.id);
    expect(bal_clone.validation).toEqual(bal_item.validation);
    expect(bal_clone.validation).not.toBe(bal_item.validation);
    expect(bal_clone.consent?.sections[0].id).not.toBe('s1');
    expect(bal_clone.consent?.sections[0].title).toBe('Risks');
  });
});

describe('updates and deletion', () => {
  it('updates item fields immutably', () => {
    let bal_q = bal_fixture();
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'short_text');
    bal_q = bal_added.q;
    bal_q = dhon_update_item(bal_q, bal_added.itemId as string, {
      label: 'Name',
      placeholder: 'Full name',
      validation: { maxLength: 80 }
    });
    const bal_item = bal_q.sections[0].items[0];
    expect(bal_item.label).toBe('Name');
    expect(bal_item.placeholder).toBe('Full name');
    expect(bal_item.validation).toEqual({ maxLength: 80 });
  });

  it('removes items while keeping sections', () => {
    let bal_q = bal_fixture();
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'single_choice');
    bal_q = bal_added.q;
    bal_q = lichu_item(bal_q, bal_added.itemId as string);
    expect(bal_q.sections[0].items).toHaveLength(0);
    expect(bal_q.sections).toHaveLength(1);
  });
});

describe('bal_split_paste_lines', () => {
  it('splits multiline paste and trims empties', () => {
    expect(bal_split_paste_lines('Rice\r\nFish\n\n  Egg  \n')).toEqual([
      'Rice',
      'Fish',
      'Egg'
    ]);
    expect(bal_split_paste_lines('')).toEqual([]);
  });
});
