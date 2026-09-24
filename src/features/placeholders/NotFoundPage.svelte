<script lang="ts">
  import Button from '../../components/ui/Button.svelte';
  import EmptyState from '../../components/ui/EmptyState.svelte';
  import { route_store } from '../../app/router/route_store';

  const bal_path = $derived($route_store.name === 'not-found' ? $route_store.path : '');
</script>

<div class="page">
  <EmptyState
    icon="alert"
    title="Page not found"
    body={bal_path !== ''
      ? `Nothing is mapped to "${bal_path}".`
      : 'This address does not match any screen in Svelp.'}
  >
    <Button variant="primary" href="#/projects">Go to Projects</Button>
  </EmptyState>
</div>
