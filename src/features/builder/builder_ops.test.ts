import { describe, expect, it } from 'vitest';
import {
  bal_add_item,
  bal_taken_variable_names,
  ghora_add_section,
  ghora_move_item,
  ghora_move_option,
  komola_add_option,
  lichu_item,
  lichu_option,
  malta_item,
  ram_chagol_section
} from './builder_ops';
import { dhon_banaitesi_questionnaire } from '../../models/factories';

function bal_fixture() {
  const bal_q = dhon_banaitesi_questionnaire({ projectId: 'p1', title: 'Test' });
  return bal_q;
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
    const bal_c = bal_add_item(
      bal_q,
      bal_q.sections[0].id,
      'instruction',
      bal_a.itemId
    );
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
});

describe('ghora_move_item', () => {
  it('moves an item into the previous section when crossing the top', () => {
    let bal_q = bal_fixture();
    const bal_second = ghora_add_section(bal_q, 'Second');
    bal_q = bal_second.q;
    const bal_added = bal_add_item(bal_q, bal_second.sectionId, 'single_choice');
    bal_q = bal_added.q;
    const bal_moved = ghora_move_item(bal_q, bal_added.itemId as string, -1);
    expect(bal_moved.sections[0].items.map((bal_i) => bal_i.id)).toContain(
      bal_added.itemId
    );
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

describe('deletion', () => {
  it('removes items while keeping sections', () => {
    let bal_q = bal_fixture();
    const bal_added = bal_add_item(bal_q, bal_q.sections[0].id, 'single_choice');
    bal_q = bal_added.q;
    bal_q = lichu_item(bal_q, bal_added.itemId as string);
    expect(bal_q.sections[0].items).toHaveLength(0);
    expect(bal_q.sections).toHaveLength(1);
  });
});
