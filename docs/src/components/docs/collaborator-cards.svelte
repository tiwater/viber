<script lang="ts">
  import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
  } from "$lib/components/ui/card/index.js";

  interface Collaborator {
    name: string;
    description: string;
  }

  interface Props {
    title: string;
    subtitle?: string;
    collaborators: Collaborator[];
  }

  let { title, subtitle, collaborators }: Props = $props();
</script>

<div class="collaborator-section bg-muted/50 py-12 px-8 rounded-2xl my-8">
  <div
    class="text-3xl font-bold text-center mb-8 leading-relaxed text-foreground"
  >
    {title}
  </div>
  {#if subtitle}
    <div
      class="text-lg text-center mb-12 max-w-3xl mx-auto text-muted-foreground"
    >
      {subtitle}
    </div>
  {/if}
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
    {#each collaborators as collab}
      <Card class="bg-card hover:shadow-lg transition-shadow duration-200">
        <CardHeader class="pb-2">
          <CardTitle class="text-xl">{collab.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-muted-foreground">{collab.description}</p>
        </CardContent>
      </Card>
    {/each}
  </div>
</div>
