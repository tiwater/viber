<script lang="ts">
  import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
  } from "$lib/components/ui/card/index.js";

  interface Feature {
    icon?: string;
    title: string;
    description: string;
  }

  interface Props {
    features: Feature[];
    columns?: 2 | 3 | 4;
  }

  let { features, columns = 3 }: Props = $props();

  const gridCols: Record<number, string> = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  };
</script>

<div class="feature-grid grid grid-cols-1 {gridCols[columns]} gap-4 my-8">
  {#each features as feature}
    <Card class="hover:shadow-md transition-shadow duration-200">
      <CardHeader class="pb-2">
        <CardTitle class="text-lg flex items-center gap-2">
          {#if feature.icon}
            <span class="text-xl">{feature.icon}</span>
          {/if}
          {feature.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription class="text-sm">{feature.description}</CardDescription>
      </CardContent>
    </Card>
  {/each}
</div>
