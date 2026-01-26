<script lang="ts">
  import {
    Alert,
    AlertTitle,
    AlertDescription,
  } from "$lib/components/ui/alert/index.js";

  interface Principle {
    number: number;
    title: string;
    description: string;
  }

  interface Props {
    principles: Principle[];
  }

  let { principles }: Props = $props();
</script>

<div class="principles-list my-8 space-y-4">
  {#each principles as principle}
    <div
      class="principle-item flex gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
    >
      <div
        class="principle-number flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg"
      >
        {principle.number}
      </div>
      <div class="principle-content">
        <div class="font-semibold text-foreground">{principle.title}</div>
        <div class="text-sm text-muted-foreground">{principle.description}</div>
      </div>
    </div>
  {/each}
</div>
