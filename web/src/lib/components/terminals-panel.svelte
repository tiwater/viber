<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import TerminalView from "./terminal-view.svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCw, Plus, Minus } from "@lucide/svelte";

  interface TmuxPane {
    session: string;
    window: string;
    windowName: string;
    pane: string;
    command: string;
    target: string;
  }

  interface TmuxSession {
    name: string;
    windows: number;
    attached: boolean;
  }

  let sessions = $state<TmuxSession[]>([]);
  let panes = $state<TmuxPane[]>([]);
  let ws = $state<WebSocket | null>(null);
  let connected = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);

  /** Which panes are open in the UI */
  let openPanes = $state<Set<string>>(new Set());

  // WebSocket URL - computed in browser only
  let wsUrl = "";

  function connect() {
    if (typeof window === "undefined") return;
    wsUrl = `ws://${window.location.hostname}:6008`;

    error = null;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      connected = true;
      loading = false;
      requestList();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch {
        // Ignore non-JSON
      }
    };

    ws.onerror = () => {
      error = "WebSocket error";
    };

    ws.onclose = () => {
      connected = false;
      ws = null;
    };
  }

  function handleMessage(msg: any) {
    switch (msg.type) {
      case "terminal:list":
        sessions = msg.sessions || [];
        panes = msg.panes || [];
        break;
    }
  }

  function requestList() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "terminal:list" }));
    }
  }

  function togglePane(target: string) {
    const newSet = new Set(openPanes);
    if (newSet.has(target)) {
      newSet.delete(target);
    } else {
      newSet.add(target);
    }
    openPanes = newSet;
  }

  function closePane(target: string) {
    const newSet = new Set(openPanes);
    newSet.delete(target);
    openPanes = newSet;
  }

  onMount(() => {
    connect();
  });

  onDestroy(() => {
    ws?.close();
  });

  // Group panes by session
  const panesBySession = $derived(() => {
    const map = new Map<string, TmuxPane[]>();
    for (const pane of panes) {
      const list = map.get(pane.session) || [];
      list.push(pane);
      map.set(pane.session, list);
    }
    return map;
  });
</script>

<svelte:head>
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/@xterm/xterm@6.0.0/css/xterm.min.css"
  />
</svelte:head>

<div class="terminals-panel">
  {#if loading}
    <div class="loading">Connecting to viber terminals...</div>
  {:else if error}
    <div class="error">
      {error}
      <Button variant="outline" size="sm" onclick={connect}>Retry</Button>
    </div>
  {:else if panes.length === 0}
    <div class="empty">
      <p>No tmux sessions found.</p>
      <p class="hint">
        Create a session with: <code>tmux new-session -d -s coding</code>
      </p>
    </div>
  {:else}
    <div class="terminals-layout">
      <!-- Session/pane list -->
      <aside class="pane-list">
        <div class="pane-list-header">
          <h2>Sessions</h2>
          <Button variant="ghost" size="icon" class="size-6" onclick={requestList} title="Refresh">
            <RefreshCw class="size-3" />
          </Button>
        </div>
        {#each Array.from(panesBySession().entries()) as [sessionName, sessionPanes]}
          <div class="session-group">
            <div class="session-name">{sessionName}</div>
            <ul class="pane-items">
              {#each sessionPanes as pane}
                <li class="pane-item" class:open={openPanes.has(pane.target)}>
                  <button
                    class="pane-button"
                    onclick={() => togglePane(pane.target)}
                  >
                    <span class="pane-target">{pane.windowName}:{pane.pane}</span>
                    <span class="pane-command">{pane.command}</span>
                    {#if openPanes.has(pane.target)}
                      <Minus class="size-3" />
                    {:else}
                      <Plus class="size-3" />
                    {/if}
                  </button>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </aside>

      <!-- Open terminal views -->
      <main class="terminal-views">
        {#if openPanes.size === 0}
          <div class="no-terminals">
            <p>Click a pane on the left to open a terminal view.</p>
          </div>
        {:else}
          <div
            class="terminal-grid"
            style="grid-template-columns: repeat({Math.min(
              openPanes.size,
              2
            )}, 1fr);"
          >
            {#each Array.from(openPanes) as target (target)}
              <div class="terminal-wrapper">
                <TerminalView
                  {target}
                  {ws}
                  onClose={() => closePane(target)}
                />
              </div>
            {/each}
          </div>
        {/if}
      </main>
    </div>
  {/if}
</div>

<style>
  .terminals-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: hsl(var(--background));
  }

  .pane-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .pane-list-header h2 {
    margin-bottom: 0;
  }

  .loading,
  .error,
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 0.75rem;
    padding: 1.5rem;
    color: hsl(var(--muted-foreground));
    text-align: center;
  }

  .error {
    color: hsl(var(--destructive));
  }

  .hint {
    font-size: 0.8rem;
  }

  .hint code {
    background: hsl(var(--muted));
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
  }

  .terminals-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .pane-list {
    width: 180px;
    border-right: 1px solid hsl(var(--border));
    padding: 0.5rem;
    overflow-y: auto;
    background: hsl(var(--muted) / 0.2);
  }

  .pane-list h2 {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    color: hsl(var(--muted-foreground));
  }

  .session-group {
    margin-bottom: 0.75rem;
  }

  .session-name {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.4rem;
    background: hsl(var(--muted));
    border-radius: 0.2rem;
    margin-bottom: 0.2rem;
  }

  .pane-items {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .pane-item {
    margin: 0.1rem 0;
  }

  .pane-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0.4rem;
    background: none;
    border: 1px solid transparent;
    border-radius: 0.2rem;
    text-align: left;
    cursor: pointer;
    font-size: 0.7rem;
    color: hsl(var(--foreground));
    transition: background 0.15s, border-color 0.15s;
  }

  .pane-button:hover {
    background: hsl(var(--muted));
  }

  .pane-item.open .pane-button {
    background: hsl(var(--primary) / 0.1);
    border-color: hsl(var(--primary) / 0.3);
  }

  .pane-target {
    font-family: monospace;
    font-weight: 500;
  }

  .pane-command {
    flex: 1;
    color: hsl(var(--muted-foreground));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .terminal-views {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .no-terminals {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: hsl(var(--muted-foreground));
    font-size: 0.85rem;
  }

  .terminal-grid {
    display: grid;
    gap: 0.25rem;
    padding: 0.25rem;
    height: 100%;
  }

  .terminal-wrapper {
    min-height: 150px;
    overflow: hidden;
  }
</style>
