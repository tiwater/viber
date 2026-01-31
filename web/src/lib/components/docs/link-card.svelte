<script lang="ts">
  import { ArrowRight } from "@lucide/svelte";

  interface Props {
    title: string;
    description?: string;
    href: string;
  }

  let { title, description, href }: Props = $props();
</script>

<a
  {href}
  class="block rounded-lg border border-border bg-card p-4 hover:border-primary hover:bg-accent transition-colors group"
>
  <div class="flex items-center justify-between">
    <h3 class="font-semibold group-hover:text-primary">{title}</h3>
    <ArrowRight class="size-4 text-muted-foreground group-hover:text-primary" />
  </div>
  {#if description}
    <p class="text-sm text-muted-foreground mt-1">{description}</p>
  {/if}
</a>
