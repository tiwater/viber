<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import {
    ArrowLeft,
    Send,
    Circle,
    Settings,
    RefreshCw,
    Cpu,
  } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";

  interface Viber {
    id: string;
    name: string;
    platform: string | null;
    version: string | null;
    capabilities: string[] | null;
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

  let viber = $state<Viber | null>(null);
  let messages = $state<Message[]>([]);
  let loading = $state(true);
  let inputValue = $state("");
  let sending = $state(false);
  let currentTaskId = $state<string | null>(null);
  let messagesContainer: HTMLDivElement | null = null;

  $effect(() => {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });

  async function fetchViber() {
    const id = $page.params.id;
    try {
      const response = await fetch(`/api/vibers/${id}`);
      if (response.ok) {
        viber = await response.json();
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

  async function sendMessage() {
    if (!inputValue.trim() || sending || !viber?.isConnected) return;

    const content = inputValue.trim();
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

    let pollingStarted = false;

    try {
      const response = await fetch(`/api/vibers/${viber.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: content }),
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
            return true;
          }
          if (task.status === "error") {
            messages = messages.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: `Error: ${task.error || "Task failed"}` }
                : m,
            );
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
    fetchViber();
    // Poll for viber status updates
    const interval = setInterval(fetchViber, 5000);
    return () => clearInterval(interval);
  });
</script>

<svelte:head>
  <title>{viber?.name || "Viber"} - Viber Cockpit</title>
</svelte:head>

<div class="h-[calc(100vh-65px)] flex flex-col">
  <!-- Header -->
  <div
    class="border-b border-border px-4 py-3 flex items-center justify-between"
  >
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" href="/vibers">
        <ArrowLeft class="size-4" />
      </Button>
      {#if viber}
        <div>
          <h1
            class="text-lg font-semibold flex items-center gap-2 text-foreground"
          >
            {viber.name}
            {#if viber.isConnected}
              <Badge
                variant="default"
                class="bg-green-500/20 text-green-700 dark:text-green-400 border-0"
              >
                <Circle class="size-2 mr-1 fill-current" />
                Online
              </Badge>
            {:else}
              <Badge variant="secondary">
                <Circle class="size-2 mr-1" />
                Offline
              </Badge>
            {/if}
          </h1>
          <p class="text-sm text-muted-foreground">
            {formatPlatform(viber.platform)}
            {#if viber.version}· v{viber.version}{/if}
            {#if viber.capabilities}
              · {viber.capabilities.join(", ")}
            {/if}
          </p>
        </div>
      {:else}
        <div class="h-10" />
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <Button variant="ghost" size="icon" onclick={fetchViber}>
        <RefreshCw class="size-4" />
      </Button>
      <Button variant="ghost" size="icon">
        <Settings class="size-4" />
      </Button>
    </div>
  </div>

  <!-- Messages -->
  <div
    bind:this={messagesContainer}
    class="flex-1 overflow-y-auto p-4 space-y-4"
  >
    {#if loading}
      <div class="text-center py-12 text-muted-foreground">Loading...</div>
    {:else if !viber?.isConnected}
      <div class="text-center py-12 text-muted-foreground">
        <Cpu class="size-12 mx-auto mb-4 opacity-50" />
        <p class="text-lg font-medium">Viber is Offline</p>
        <p class="text-sm mt-2">
          This viber is not currently connected. Start the viber daemon to chat.
        </p>
      </div>
    {:else if messages.length === 0}
      <div class="text-center py-12 text-muted-foreground">
        <p class="text-lg font-medium mb-2">Ready to Chat</p>
        <p class="text-sm">Send a message to start a task on this viber</p>
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
            <p class="whitespace-pre-wrap">{message.content}</p>
            <p class="text-xs mt-1 opacity-70">
              {new Date(message.createdAt).toLocaleTimeString()}
            </p>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Input -->
  <div class="border-t border-border p-4">
    <div class="flex gap-2">
      <textarea
        bind:value={inputValue}
        onkeydown={handleKeydown}
        placeholder={viber?.isConnected
          ? "Send a task to this viber..."
          : "Viber is offline"}
        class="flex-1 resize-none rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        rows="1"
        disabled={sending || !viber?.isConnected}
      />
      <Button
        onclick={sendMessage}
        disabled={sending || !inputValue.trim() || !viber?.isConnected}
      >
        <Send class="size-4" />
      </Button>
    </div>
  </div>
</div>
