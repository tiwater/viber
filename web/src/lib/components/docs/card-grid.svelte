<script lang="ts">
  interface Props {
    stagger?: boolean;
    children?: any;
  }

  let { stagger = false, children }: Props = $props();
</script>

<div class="grid gap-4 md:grid-cols-2 my-4" class:stagger>
  {@render children?.()}
</div>

<style>
  .stagger > :global(*:nth-child(even)) {
    transform: translateY(1rem);
  }
</style>
