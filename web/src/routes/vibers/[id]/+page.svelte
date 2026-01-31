<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { headerStore } from "$lib/stores/header";
  import { Send, Cpu } from "@lucide/svelte";
  import { marked } from "marked";
  import { Button } from "$lib/components/ui/button";
  import DevServerPanel from "$lib/components/dev-server-panel.svelte";
  import TerminalsPanel from "$lib/components/terminals-panel.svelte";

  // Markdown → HTML for message content (GFM, line breaks)
  marked.setOptions({ gfm: true, breaks: true });
  function renderMarkdown(text: string): string {
    if (!text) return "";
    return marked.parse(text) as string;
  }

  interface ViberSkill {
    id: string;
    name: string;
    description: string;
  }

  interface Viber {
    id: string;
    name: string;
    platform: string | null;
    version: string | null;
    capabilities: string[] | null;
    skills?: ViberSkill[] | null;
    isConnected: boolean;
    runningTasks: string[];
    status?: {
      uptime: number;
      runningTasks: number;
    };
  }

  interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: Date;
  }

  interface TaskSummary {
    id: string;
    goal: string;
    status: string;
    createdAt: string;
    result?: { text?: string; summary?: string };
    error?: string;
  }

  let viber = $state<Viber | null>(null);
  let messages = $state<Message[]>([]);
  let loading = $state(true);
  let inputValue = $state("");
  let sending = $state(false);
  let currentTaskId = $state<string | null>(null);
  let messagesContainer: HTMLDivElement | null = null;
  let viberTasks = $state<TaskSummary[]>([]);
  let stoppingTaskId = $state<string | null>(null);

  async function stopTask(taskId: string) {
    if (stoppingTaskId) return;
    stoppingTaskId = taskId;
    try {
      const res = await fetch(`/api/tasks/${taskId}/stop`, { method: "POST" });
      if (res.ok) {
        await fetchTasksForViber();
      }
    } finally {
      stoppingTaskId = null;
    }
  }

  $effect(() => {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });

  async function fetchTasksForViber() {
    if (!viber?.id) return;
    try {
      const res = await fetch(
        `/api/tasks?viberId=${encodeURIComponent(viber.id)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      viberTasks = (data.tasks || []).sort(
        (a: TaskSummary, b: TaskSummary) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } catch (_) {
      /* ignore */
    }
  }

  async function fetchMessages(viberId: string) {
    try {
      const res = await fetch(`/api/vibers/${viberId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      messages = (data.messages || []).map(
        (m: {
          id: string;
          role: string;
          content: string;
          createdAt: string | number;
        }) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
          createdAt:
            typeof m.createdAt === "number"
              ? new Date(m.createdAt)
              : new Date(m.createdAt),
        }),
      );
    } catch (_) {
      /* ignore */
    }
  }

  async function fetchViber() {
    const id = $page.params.id;
    try {
      const response = await fetch(`/api/vibers/${id}`);
      if (response.ok) {
        viber = await response.json();
        if (id) await fetchMessages(id);
      } else {
        goto("/vibers");
      }
    } catch (error) {
      console.error("Failed to fetch viber:", error);
      goto("/vibers");
    } finally {
      loading = false;
    }
  }

  async function sendMessage(overrideContent?: string) {
    const content = (overrideContent ?? inputValue).trim();
    if (!content || sending || !viber?.isConnected) return;

    inputValue = "";
    sending = true;

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date(),
    };
    messages = [...messages, userMessage];

    // Persist user message at cockpit level
    try {
      await fetch(`/api/vibers/${viber.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content }),
      });
    } catch (_) {
      /* ignore */
    }

    let pollingStarted = false;

    try {
      // Send full chat history so viber has context (orchestration only; no viber-side persistence)
      const response = await fetch(`/api/vibers/${viber.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: content,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit task");
      }

      const { taskId } = await response.json();
      currentTaskId = taskId;

      const assistantMessageId = `msg-${Date.now()}-assistant`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "Processing task...",
        createdAt: new Date(),
      };
      messages = [...messages, assistantMessage];

      const pollInterval = 1200;
      const maxAttempts = 120;
      let attempts = 0;

      const poll = async (): Promise<boolean> => {
        try {
          const taskRes = await fetch(`/api/tasks/${taskId}`);
          if (!taskRes.ok) return false;
          const task = await taskRes.json();
          if (task.status === "completed") {
            const text =
              (task.result?.text as string)?.trim() ||
              task.result?.summary ||
              "(No response text)";
            messages = messages.map((m) =>
              m.id === assistantMessageId ? { ...m, content: text } : m,
            );
            // Persist assistant message at cockpit level
            try {
              await fetch(`/api/vibers/${viber!.id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  role: "assistant",
                  content: text,
                  taskId,
                }),
              });
            } catch (_) {
              /* ignore */
            }
            return true;
          }
          if (task.status === "error") {
            const errText = `Error: ${task.error || "Task failed"}`;
            messages = messages.map((m) =>
              m.id === assistantMessageId ? { ...m, content: errText } : m,
            );
            try {
              await fetch(`/api/vibers/${viber!.id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  role: "assistant",
                  content: errText,
                  taskId,
                }),
              });
            } catch (_) {
              /* ignore */
            }
            return true;
          }
        } catch (_) {
          /* ignore */
        }
        return false;
      };

      pollingStarted = true;
      const intervalId = setInterval(async () => {
        attempts++;
        const done = await poll();
        if (done || attempts >= maxAttempts) {
          clearInterval(intervalId);
          if (attempts >= maxAttempts) {
            const last = await poll();
            if (!last) {
              messages = messages.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, content: "Task timed out. No response received." }
                  : m,
              );
            }
          }
          sending = false;
        }
      }, pollInterval);

      const done = await poll();
      if (done) {
        clearInterval(intervalId);
        sending = false;
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Failed to submit task"}`,
        createdAt: new Date(),
      };
      messages = [...messages, errorMessage];
    } finally {
      if (!pollingStarted) {
        sending = false;
      }
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Sync viber context to global header (single row), including skills for discoverability
  $effect(() => {
    if (viber?.id) {
      headerStore.setViberContext({
        viberId: viber.id,
        viberName: viber.name,
        isConnected: viber.isConnected,
        platform: viber.platform,
        skills: viber.skills ?? [],
      });
    }
  });

  // Read active tab from header store
  let activeTab = $derived($headerStore.viber?.activeTab ?? "chat");

  // When layout "Refresh" is clicked, header store requests refresh; we refetch
  let lastRefreshRequested = 0;
  $effect(() => {
    const r = $headerStore.viber?.refreshRequested ?? 0;
    if (r && r !== lastRefreshRequested && viber?.id) {
      lastRefreshRequested = r;
      fetchViber();
    }
  });

  onMount(() => {
    fetchViber();
    const interval = setInterval(fetchViber, 5000);
    return () => {
      clearInterval(interval);
      headerStore.setViberContext(null);
    };
  });

  $effect(() => {
    if (viber?.id && viber.isConnected) {
      fetchTasksForViber();
      const t = setInterval(fetchTasksForViber, 4000);
      return () => clearInterval(t);
    }
  });
</script>

<svelte:head>
  <title>{viber?.name || "Viber"} - Viber Cockpit</title>
</svelte:head>

<div class="flex-1 flex flex-col min-h-0 overflow-hidden">
  {#if activeTab === "terminals"}
    <div class="flex-1 min-h-0 flex flex-col">
      <TerminalsPanel></TerminalsPanel>
    </div>
  {:else if activeTab === "dev-server"}
    <div class="flex-1 min-h-0 flex flex-col">
      <DevServerPanel></DevServerPanel>
    </div>
  {:else}
    <!-- Messages (max space) -->
    <div
      bind:this={messagesContainer}
      class="flex-1 min-h-0 overflow-y-auto p-3 space-y-3"
    >
      {#if loading}
        <div
          class="min-h-full flex items-center justify-center text-center text-muted-foreground"
        >
          Loading...
        </div>
      {:else if !viber?.isConnected}
        <div
          class="min-h-full flex items-center justify-center text-center text-muted-foreground"
        >
          <div>
            <Cpu class="size-12 mx-auto mb-4 opacity-50" />
            <p class="text-lg font-medium">Viber is Offline</p>
            <p class="text-sm mt-2">
              This viber is not currently connected. Start the viber daemon to
              chat.
            </p>
          </div>
        </div>
      {:else if messages.length === 0}
        <div
          class="min-h-full flex items-center justify-center text-center text-muted-foreground"
        >
          <div>
            <p class="text-sm font-medium text-foreground mb-0.5">
              No messages yet
            </p>
            <p class="text-xs">
              Send a task or goal. Type in the box below and press Enter.
            </p>
            {#if viber.skills && viber.skills.length > 0}
              <p class="text-xs mt-1.5 opacity-80">
                This viber has skills: {viber.skills
                  .map((s) => s.name)
                  .join(", ")}. Open
                <strong>Skills ({viber.skills.length})</strong> in the header to
                see how to use each (e.g. “Use cursor-agent to …”).
              </p>
            {/if}
          </div>
        </div>
      {:else}
        {#each messages as message (message.id)}
          <div
            class="flex {message.role === 'user'
              ? 'justify-end'
              : 'justify-start'}"
          >
            <div
              class="max-w-[80%] rounded-lg px-4 py-2 {message.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'}"
            >
              <div class="message-markdown">
                {@html renderMarkdown(message.content)}
              </div>
              <p class="text-xs mt-1 opacity-70">
                {new Date(message.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Input: single row only -->
    <div class="border-t border-border p-2 shrink-0">
      <div class="flex gap-2 items-end">
        <textarea
          bind:value={inputValue}
          onkeydown={handleKeydown}
          placeholder={viber?.isConnected
            ? "Send a task or command..."
            : "Viber is offline"}
          class="flex-1 min-h-[36px] max-h-24 resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          rows="1"
          disabled={sending || !viber?.isConnected}
        ></textarea>
        <Button
          onclick={() => sendMessage()}
          disabled={sending || !inputValue.trim() || !viber?.isConnected}
          class="size-9 shrink-0"
        >
          <Send class="size-4" />
        </Button>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.message-markdown) {
    line-height: 1.6;
  }
  :global(.message-markdown p) {
    margin-bottom: 0.5rem;
  }
  :global(.message-markdown p:last-child) {
    margin-bottom: 0;
  }
  :global(.message-markdown code) {
    background: hsl(var(--muted));
    padding: 0.15em 0.35em;
    border-radius: 0.25rem;
    font-size: 0.875em;
  }
  :global(.message-markdown pre) {
    background: hsl(var(--muted));
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 0.5rem 0;
  }
  :global(.message-markdown pre code) {
    background: none;
    padding: 0;
  }
  :global(.message-markdown ul) {
    list-style-type: disc;
    padding-left: 1.25rem;
    margin: 0.5rem 0;
  }
  :global(.message-markdown ol) {
    list-style-type: decimal;
    padding-left: 1.25rem;
    margin: 0.5rem 0;
  }
  :global(.message-markdown li) {
    margin-bottom: 0.25rem;
  }
  :global(.message-markdown a) {
    text-decoration: underline;
  }
  :global(.message-markdown blockquote) {
    border-left: 4px solid hsl(var(--border));
    padding-left: 0.75rem;
    margin: 0.5rem 0;
    font-style: italic;
    color: hsl(var(--muted-foreground));
  }
  :global(.message-markdown h1),
  :global(.message-markdown h2),
  :global(.message-markdown h3) {
    font-weight: 600;
    margin-top: 0.75rem;
    margin-bottom: 0.5rem;
  }
</style>
