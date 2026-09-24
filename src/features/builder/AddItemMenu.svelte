<script lang="ts">
  import DropdownMenu from '../../components/ui/DropdownMenu.svelte';
  import { builder_state } from './builder_state';
  import { bal_addable_catalog, type ItemDescriptor } from '../../models/item_catalog';
  import type { BuildableItemType } from './builder_ops';

  let {
    sectionId = null,
    label = 'Add',
    variant = 'secondary'
  }: {
    sectionId?: string | null;
    label?: string;
    variant?: 'secondary' | 'ghost';
  } = $props();

  const bal_descriptors = bal_addable_catalog();

  function bal_item_for(bal_descriptor: ItemDescriptor) {
    return {
      id: bal_descriptor.type,
      label: bal_descriptor.label,
      icon: bal_descriptor.icon,
      disabled: !bal_descriptor.available,
      tag: bal_descriptor.available ? undefined : 'Upcoming',
      onSelect: () => {
        if (bal_descriptor.available) {
          builder_state.add_item(bal_descriptor.type as BuildableItemType, sectionId);
        }
      }
    };
  }
</script>

<DropdownMenu {label} trigger_icon="plus" {variant} items={bal_descriptors.map(bal_item_for)} />
