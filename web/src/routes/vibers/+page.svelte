<script lang="ts">
  import { onMount } from "svelte";
  import {
    RefreshCw,
    Circle,
    MessageSquare,
    Cpu,
    Clock,
    Server,
  } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
  } from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";

  interface Viber {
    id: string;
    name: string;
    platform: string | null;
    version: string | null;
    capabilities: string[] | null;
    isConnected: boolean;
    connectedAt: string | null;
    runningTasks: number;
  }

  let vibers = $state<Viber[]>([]);
  let loading = $state(true);
  let hubConnected = $state(false);

  async function fetchVibers() {
    loading = true;
    try {
      // Check hub status
      const hubResponse = await fetch("/api/hub");
      const hubStatus = await hubResponse.json();
      hubConnected = hubStatus.connected;

      if (hubConnected) {
        const response = await fetch("/api/vibers");
        const data = await response.json();
        vibers = Array.isArray(data) ? data : [];
      } else {
        vibers = [];
      }
    } catch (error) {
      console.error("Failed to fetch vibers:", error);
      hubConnected = false;
      vibers = [];
    } finally {
      loading = false;
    }
  }

  function formatPlatform(platform: string | null): string {
    switch (platform) {
      case "darwin":
        return "macOS";
      case "linux":
        return "Linux";
      case "win32":
        return "Windows";
      default:
        return platform || "Unknown";
    }
  }

  onMount(() => {
    fetchVibers();
    // Poll for updates
    const interval = setInterval(fetchVibers, 5000);
    return () => clearInterval(interval);
  });
</script>

<svelte:head>
  <title>Vibers - Viber Cockpit</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-3xl font-bold text-foreground">Vibers</h1>
      <p class="text-sm mt-1 text-muted-foreground flex items-center gap-2">
        {#if hubConnected}
          <span class="flex items-center gap-1">
            <Circle class="size-2 fill-green-500 text-green-500" />
            Hub connected
          </span>
          · {vibers.length} viber{vibers.length !== 1 ? "s" : ""} online
        {:else}
          <span class="flex items-center gap-1">
            <Circle class="size-2 fill-red-500 text-red-500" />
            Hub disconnected
          </span>
        {/if}
      </p>
    </div>
    <Button variant="outline" size="icon" onclick={fetchVibers}>
      <RefreshCw class="size-4" />
    </Button>
  </div>

  {#if loading && vibers.length === 0}
    <div class="text-center py-12 text-muted-foreground">Loading vibers...</div>
  {:else if !hubConnected}
    <Card class="text-center py-12">
      <CardContent>
        <div class="mb-4 text-muted-foreground">
          <Server class="size-12 mx-auto mb-4 opacity-50" />
          <p class="text-lg font-medium">Hub Not Connected</p>
          <p class="text-sm mt-2 max-w-md mx-auto">
            The viber hub server is not running. Start it with:
          </p>
        </div>
        <div class="mt-6 p-4 bg-muted rounded-lg text-left max-w-md mx-auto">
          <p class="text-sm font-mono text-muted-foreground">
            # Start the hub server<br />
            pnpm dev:hub<br /><br />
            # Or run everything together<br />
            pnpm dev
          </p>
        </div>
      </CardContent>
    </Card>
  {:else if vibers.length === 0}
    <Card class="text-center py-12">
      <CardContent>
        <div class="mb-4 text-muted-foreground">
          <Cpu class="size-12 mx-auto mb-4 opacity-50" />
          <p class="text-lg font-medium">No Vibers Connected</p>
          <p class="text-sm mt-2 max-w-md mx-auto">
            Hub is running. Start a viber daemon to connect:
          </p>
        </div>
        <div class="mt-6 p-4 bg-muted rounded-lg text-left max-w-md mx-auto">
          <p class="text-sm font-mono text-muted-foreground">
            # Connect a viber to the hub<br />
            viber start --server ws://localhost:6007/vibers/ws --token dev
          </p>
        </div>
      </CardContent>
    </Card>
  {:else}
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each vibers as viber (viber.id)}
        <Card>
          <CardHeader>
            <div class="flex items-start justify-between">
              <div class="space-y-1">
                <CardTitle class="flex items-center gap-2">
                  {viber.name}
                  <Badge
                    variant="default"
                    class="bg-green-500/20 text-green-700 dark:text-green-400 border-0"
                  >
                    <Circle class="size-2 mr-1 fill-current" />
                    Online
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {formatPlatform(viber.platform)}
                  {#if viber.version}
                    · v{viber.version}
                  {/if}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent class="space-y-3">
            {#if viber.capabilities && viber.capabilities.length > 0}
              <div class="flex flex-wrap gap-1">
                {#each viber.capabilities as cap}
                  <Badge variant="outline" class="text-xs">{cap}</Badge>
                {/each}
              </div>
            {/if}
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock class="size-4" />
              Connected
            </div>
            {#if viber.runningTasks > 0}
              <div class="text-sm text-muted-foreground">
                {viber.runningTasks} task{viber.runningTasks > 1 ? "s" : ""} running
              </div>
            {/if}
          </CardContent>
          <CardFooter>
            <Button variant="default" size="sm" href="/vibers/{viber.id}">
              <MessageSquare class="size-4" />
              Chat
            </Button>
          </CardFooter>
        </Card>
      {/each}
    </div>
  {/if}
</div>
