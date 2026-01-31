<script lang="ts">
  import { ArrowRight, Bot, Database, Zap } from "@lucide/svelte";
</script>

<svelte:head>
  <title>Viber Cockpit</title>
</svelte:head>

<div class="container mx-auto px-4 py-12">
  <div class="max-w-4xl mx-auto text-center mb-16">
    <h1 class="text-4xl font-bold mb-4 text-foreground">Viber Cockpit</h1>
    <p class="text-xl text-muted-foreground">
      Monitor, manage, and interact with your Viber agents from a single
      dashboard
    </p>
  </div>

  <div class="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
    <div class="p-6 rounded-lg border border-border bg-card">
      <div
        class="size-12 rounded-lg flex items-center justify-center mb-4 bg-secondary"
      >
        <Bot class="size-6 text-foreground" />
      </div>
      <h3 class="text-lg font-semibold mb-2 text-card-foreground">
        Manage Vibers
      </h3>
      <p class="text-muted-foreground">
        Register, monitor, and control multiple Viber instances across your
        infrastructure
      </p>
    </div>

    <div class="p-6 rounded-lg border border-border bg-card">
      <div
        class="size-12 rounded-lg flex items-center justify-center mb-4 bg-secondary"
      >
        <Zap class="size-6 text-foreground" />
      </div>
      <h3 class="text-lg font-semibold mb-2 text-card-foreground">
        Real-time Chat
      </h3>
      <p class="text-muted-foreground">
        Interact with any Viber agent through streaming chat with full context
        awareness
      </p>
    </div>

    <div class="p-6 rounded-lg border border-border bg-card">
      <div
        class="size-12 rounded-lg flex items-center justify-center mb-4 bg-secondary"
      >
        <Database class="size-6 text-foreground" />
      </div>
      <h3 class="text-lg font-semibold mb-2 text-card-foreground">
        Observe Spaces
      </h3>
      <p class="text-muted-foreground">
        Browse spaces, tasks, and artifacts created by your agents
      </p>
    </div>
  </div>

  <div class="flex justify-center gap-4">
    <a
      href="/vibers"
      class="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      View Vibers
      <ArrowRight class="size-4" />
    </a>
    <a
      href="/docs"
      class="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium border border-border text-foreground hover:bg-accent transition-colors"
    >
      Read Docs
    </a>
  </div>
</div>
