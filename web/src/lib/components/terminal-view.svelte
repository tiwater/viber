<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  // xterm is browser-only, dynamically imported in onMount
  type TerminalType = import("@xterm/xterm").Terminal;
  type FitAddonType = import("@xterm/addon-fit").FitAddon;

  interface Props {
    /** Target pane (e.g. "coding:1.0") */
    target: string;
    /** WebSocket to communicate with viber daemon */
    ws: WebSocket | null;
    /** Called when terminal is closed */
    onClose?: () => void;
  }

  let { target, ws, onClose }: Props = $props();

  let terminalEl: HTMLDivElement | null = null;
  let term: TerminalType | null = null;
  let fitAddon: FitAddonType | null = null;
  let attached = $state(false);
  let error = $state<string | null>(null);

  // Handle messages from viber
  function handleMessage(event: MessageEvent) {
    try {
      const msg = JSON.parse(event.data);
      if (msg.target !== target) return;

      switch (msg.type) {
        case "terminal:output":
          term?.write(msg.data);
          break;
        case "terminal:attached":
          attached = msg.ok;
          if (!msg.ok) {
            error = msg.error || "Failed to attach";
          }
          break;
        case "terminal:detached":
          attached = false;
          break;
      }
    } catch {
      // Ignore non-JSON messages
    }
  }

  // Send input to viber
  function sendInput(keys: string) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "terminal:input", target, keys }));
    }
  }

  // Attach to the terminal
  function attach() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "terminal:attach", target }));
    }
  }

  // Detach from the terminal
  function detach() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "terminal:detach", target }));
    }
  }

  let resizeObserver: ResizeObserver | null = null;

  onMount(() => {
    if (!terminalEl) return;

    // Dynamically import xterm (browser-only) and initialize
    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      const { WebLinksAddon } = await import("@xterm/addon-web-links");

      // Create terminal
      term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "Menlo, Monaco, 'Courier New', monospace",
        theme: {
          background: "#1e1e1e",
          foreground: "#d4d4d4",
          cursor: "#d4d4d4",
          cursorAccent: "#1e1e1e",
          selectionBackground: "#264f78",
        },
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());

      term.open(terminalEl!);
      fitAddon.fit();
      // Use fixed wide cols so tmux full-width lines don't wrap; container scrolls horizontally
      const COLS = 132;
      if (term.rows) term.resize(COLS, term.rows);

      // Handle user input
      term.onData((data) => {
        sendInput(data);
      });

      // Listen for messages
      ws?.addEventListener("message", handleMessage);

      // Attach to the pane
      attach();

      // Handle resize: fit height (rows) only, keep wide cols for horizontal scroll
      resizeObserver = new ResizeObserver(() => {
        fitAddon?.fit();
        if (term && term.rows) term.resize(COLS, term.rows);
      });
      resizeObserver.observe(terminalEl!);
    })();

    return () => {
      resizeObserver?.disconnect();
    };
  });

  onDestroy(() => {
    ws?.removeEventListener("message", handleMessage);
    detach();
    term?.dispose();
  });
</script>

<div class="terminal-container">
  <div class="terminal-header">
    <span class="terminal-target">{target}</span>
    {#if onClose}
      <button class="terminal-close" onclick={onClose}>×</button>
    {/if}
  </div>
  {#if error}
    <div class="terminal-error">{error}</div>
  {/if}
  <div class="terminal-content" bind:this={terminalEl}></div>
</div>

<style>
  .terminal-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1e1e1e;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .terminal-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: #2d2d2d;
    border-bottom: 1px solid #3d3d3d;
    font-size: 0.75rem;
  }

  .terminal-target {
    font-family: monospace;
    color: #d4d4d4;
  }

  .terminal-close {
    margin-left: auto;
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0 0.25rem;
  }

  .terminal-close:hover {
    color: #fff;
  }

  .terminal-error {
    padding: 0.5rem;
    background: #5d2a2a;
    color: #ff7d7d;
    font-size: 0.75rem;
  }

  .terminal-content {
    flex: 1;
    min-height: 0;
    padding: 0.25rem;
  }

  .terminal-content :global(.xterm) {
    height: 100%;
  }

  .terminal-content :global(.xterm-viewport) {
    overflow-x: auto !important;
    overflow-y: auto !important;
  }
</style>
