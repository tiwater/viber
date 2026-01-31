<script lang="ts">
  import { onMount } from "svelte";
  import { RefreshCw, ExternalLink } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";

  const DEFAULT_URL = "http://localhost:6006";
  const STORAGE_KEY = "viber-cockpit-dev-server-url";

  let url = $state(DEFAULT_URL);
  let iframeKey = $state(0);

  function refresh() {
    iframeKey += 1;
  }

  function openInNewTab() {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  onMount(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      url = stored;
    }
  });

  $effect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, url);
    }
  });
</script>

<div class="flex flex-col h-full min-h-0">
  <div
    class="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-muted/30 shrink-0"
  >
    <label for="dev-url" class="text-xs font-medium text-foreground shrink-0">
      URL
    </label>
    <input
      id="dev-url"
      type="url"
      bind:value={url}
      class="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      placeholder="http://localhost:6006"
    />
    <Button variant="outline" size="sm" onclick={refresh}>
      <RefreshCw class="size-4 mr-1" />
      Refresh
    </Button>
    <Button variant="outline" size="sm" onclick={openInNewTab}>
      <ExternalLink class="size-4 mr-1" />
      Open in new tab
    </Button>
  </div>
  <div class="flex-1 min-h-0 bg-muted/20">
    {#key iframeKey}
      <iframe
        src={url}
        title="Dev Server"
        class="w-full h-full border-0 bg-background"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      ></iframe>
    {/key}
  </div>
</div>
