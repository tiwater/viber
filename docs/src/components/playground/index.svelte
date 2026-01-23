<script lang="ts">
  import { onMount } from "svelte";
  import { playgroundStore } from "$lib/stores/playground-store";
  import ChatZone from "./chat-zone.svelte";
  import SpacePanel from "./space-panel.svelte";
  import { Trash2 } from "lucide-svelte";

  let isLoading = $state(false);

  onMount(() => {
    // Initialize store from localStorage
    playgroundStore.init();

    // Check for initial prompt from URL
    const params = new URLSearchParams(window.location.search);
    const initialPrompt = params.get("prompt");
    if (initialPrompt) {
      handleSendMessage(initialPrompt);
      window.history.replaceState({}, "", "/playground");
    }
  });

  async function handleSendMessage(content: string) {
    if (!content.trim() || isLoading) return;

    isLoading = true;

    // Add user message
    playgroundStore.addMessage("user", content);

    try {
      // Build conversation history for context
      const state = playgroundStore.getState();
      const conversationHistory = state.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4",
          messages: conversationHistory,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      playgroundStore.startStreaming();
      const decoder = new TextDecoder();
      let buffer = "";
      let toolCalls: any[] = [];
      let hasToolCalls = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              // Handle content streaming
              if (delta?.content) {
                playgroundStore.appendStreamingContent(delta.content);
              }

              // Handle tool calls
              if (delta?.tool_calls) {
                hasToolCalls = true;
                for (const tc of delta.tool_calls) {
                  const index = tc.index ?? 0;
                  if (!toolCalls[index]) {
                    toolCalls[index] = {
                      id: tc.id || "",
                      function: { name: "", arguments: "" },
                    };
                  }
                  if (tc.function?.name) {
                    toolCalls[index].function.name = tc.function.name;
                  }
                  if (tc.function?.arguments) {
                    toolCalls[index].function.arguments +=
                      tc.function.arguments;
                  }
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      // Finish streaming and save message
      playgroundStore.finishStreaming();

      // Process tool calls after streaming completes
      if (hasToolCalls && toolCalls.length > 0) {
        const artifactNames: string[] = [];
        for (const toolCall of toolCalls) {
          if (toolCall.function?.name === "create_artifact") {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              playgroundStore.addArtifact(
                args.filename,
                args.content,
                args.file_type || "text",
              );
              artifactNames.push(args.filename);
            } catch (e) {
              console.error("Failed to parse tool call:", e);
            }
          }
        }

        // Add acknowledgment message if artifacts were created
        if (artifactNames.length > 0) {
          playgroundStore.addMessage(
            "assistant",
            `✨ Created ${artifactNames.join(", ")} in your workspace.`,
          );
        }
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      playgroundStore.cancelStreaming();
      playgroundStore.addMessage(
        "assistant",
        `Sorry, I encountered an error: ${error.message}`,
      );
    } finally {
      isLoading = false;
    }
  }

  function handleClearSpace() {
    if (confirm("Clear all messages and artifacts?")) {
      playgroundStore.clearSpace();
    }
  }
</script>

<div class="playground-layout">
  <!-- Chat Zone -->
  <div class="main-area">
    <button
      class="clear-btn"
      onclick={handleClearSpace}
      title="Clear workspace"
    >
      <Trash2 size={14} />
      Clear
    </button>
    <ChatZone onSendMessage={handleSendMessage} {isLoading} />
  </div>

  <!-- Space Panel -->
  <SpacePanel />
</div>

<style>
  .playground-layout {
    display: flex;
    height: 100%;
    background: var(--sl-color-bg);
  }

  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    position: relative;
  }

  .clear-btn {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sl-color-gray-4);
    background: var(--sl-color-bg-nav);
    border: 1px solid var(--sl-color-hairline);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.15s ease;
    opacity: 0.7;
  }

  .clear-btn:hover {
    opacity: 1;
    color: oklch(0.577 0.245 27.325);
    border-color: oklch(0.577 0.245 27.325 / 0.5);
    background: oklch(0.577 0.245 27.325 / 0.1);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .playground-layout {
      flex-direction: column;
    }

    .playground-layout :global(.space-panel) {
      width: 100%;
      min-width: 100%;
      height: 40%;
      border-left: none;
      border-top: 1px solid var(--sl-color-hairline);
    }
  }
</style>
