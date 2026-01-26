<script lang="ts">
  import { playgroundStore, type Message } from "$lib/stores/playground-store";
  import ChatInput from "../chat-input.svelte";
  import { User, Sparkles } from "lucide-svelte";
  import { marked } from "marked";

  // Configure marked for safe rendering
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  function renderMarkdown(content: string): string {
    try {
      return marked.parse(content) as string;
    } catch {
      return content;
    }
  }

  interface Props {
    onSendMessage: (content: string) => void;
    isLoading?: boolean;
  }

  let { onSendMessage, isLoading = false }: Props = $props();

  const space = $derived($playgroundStore);
  const hasMessages = $derived(space.messages.length > 0 || space.isStreaming);

  const samplePrompts = [
    "Write a product requirements document for a task management app",
    "Analyze the pros and cons of microservices architecture",
    "Create a weekly meal plan with shopping list",
    "Draft a cold outreach email for potential investors",
  ];

  // Auto-scroll to bottom when new messages arrive
  let messagesContainer: HTMLDivElement;
  $effect(() => {
    // Track dependencies
    const _messages = space.messages.length;
    const _streaming = space.streamingContent;

    if (messagesContainer) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      });
    }
  });
</script>

<div class="chat-zone">
  {#if !hasMessages}
    <!-- Welcome State -->
    <div class="welcome-state">
      <div class="welcome-content">
        <div class="welcome-icon">
          <Sparkles size={48} />
        </div>
        <h1 class="welcome-title">What can I help you build?</h1>
        <p class="welcome-subtitle">
          Start a conversation to explore Viber's multi-agent capabilities
        </p>

        <div class="sample-prompts">
          {#each samplePrompts as prompt}
            <button class="sample-prompt" onclick={() => onSendMessage(prompt)}>
              {prompt}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <!-- Messages -->
    <div class="messages-container" bind:this={messagesContainer}>
      {#each space.messages as message (message.id)}
        <div
          class="message"
          class:user={message.role === "user"}
          class:assistant={message.role === "assistant"}
        >
          {#if message.role === "user"}
            <div class="message-avatar">
              <User size={16} />
            </div>
          {/if}
          <div class="message-content">
            <div class="message-header">
              <span class="message-role">
                {message.role === "user" ? "You" : "Assistant"}
              </span>
            </div>
            <div class="message-text markdown-content">
              {@html renderMarkdown(message.content)}
            </div>
          </div>
        </div>
      {/each}

      <!-- Streaming message -->
      {#if space.isStreaming}
        <div class="message assistant streaming">
          <div class="message-content">
            <div class="message-header">
              <span class="message-role">Assistant</span>
              <span class="streaming-indicator">
                <span class="pulse"></span>
                Generating...
              </span>
            </div>
            <div class="message-text markdown-content">
              {#if space.streamingContent}
                {@html renderMarkdown(space.streamingContent)}<span
                  class="cursor"
                ></span>
              {:else}
                <span class="thinking">Thinking...</span>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Input -->
  <div class="input-container">
    <ChatInput
      {onSendMessage}
      isLoading={isLoading || space.isStreaming}
      placeholder={hasMessages
        ? "Continue the conversation..."
        : "Describe what you want to build..."}
    />
  </div>
</div>

<style>
  .chat-zone {
    display: flex;
    flex-direction: column;
    flex: 1;
    height: 100%;
    overflow: hidden;
  }

  /* Welcome State */
  .welcome-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .welcome-content {
    max-width: 640px;
    text-align: center;
  }

  .welcome-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(
      135deg,
      oklch(0.7 0.15 200) 0%,
      oklch(0.6 0.2 280) 100%
    );
    color: white;
    margin-bottom: 1.5rem;
  }

  .welcome-title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--sl-color-text);
    margin: 0 0 0.5rem;
  }

  .welcome-subtitle {
    font-size: 1.125rem;
    color: var(--sl-color-gray-2);
    margin: 0 0 2rem;
  }

  .sample-prompts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
  }

  .sample-prompt {
    padding: 0.75rem 1.25rem;
    font-size: 0.875rem;
    color: var(--sl-color-text);
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 2rem;
    cursor: pointer;
    transition: all 0.2s ease;
    backdrop-filter: blur(8px);
  }

  .sample-prompt:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
  }

  /* Messages */
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .message {
    display: flex;
    gap: 0.75rem;
    max-width: 100%;
    animation: fadeIn 0.2s ease;
    align-self: flex-start;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .message.user {
    /* Left aligned like assistant */
  }

  .message.assistant {
    /* Left aligned */
  }

  .message-avatar {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--sl-color-gray-5);
    color: var(--sl-color-text);
  }

  .message.user .message-avatar {
    background: var(--sl-color-accent);
    color: white;
  }

  .message.assistant .message-avatar {
    background: linear-gradient(
      135deg,
      oklch(0.7 0.15 200) 0%,
      oklch(0.6 0.2 280) 100%
    );
    color: white;
  }

  .message-content {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .message-role {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sl-color-gray-4);
  }

  .streaming-indicator {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.6875rem;
    color: var(--sl-color-accent);
    font-weight: 500;
  }

  .pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--sl-color-accent);
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(0.8);
    }
  }

  .message-text {
    padding: 0.875rem 1.125rem;
    border-radius: 1.25rem;
    font-size: 0.9375rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .message.user .message-text {
    background: var(--sl-color-accent);
    color: white;
  }

  .message.assistant .message-text {
    background: rgba(255, 255, 255, 0.08);
    color: var(--sl-color-text);
  }

  .message.streaming .message-text {
    background: linear-gradient(
      135deg,
      var(--sl-color-gray-6) 0%,
      var(--sl-color-gray-5) 100%
    );
  }

  .cursor {
    display: inline-block;
    width: 2px;
    height: 1.1em;
    background: var(--sl-color-accent);
    margin-left: 2px;
    animation: blink 0.8s infinite;
    vertical-align: text-bottom;
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  .thinking {
    color: var(--sl-color-gray-3);
    font-style: italic;
  }

  /* Input Container */
  .input-container {
    padding: 1rem 1rem 1.5rem;
    background: var(--sl-color-bg);
  }

  /* Markdown Content Styles */
  .markdown-content {
    white-space: normal;
  }

  .markdown-content :global(> *:first-child) {
    margin-top: 0;
  }

  .markdown-content :global(> *:last-child) {
    margin-bottom: 0;
  }

  .markdown-content :global(p) {
    margin: 0 0 0.875em;
    line-height: 1.65;
  }

  .markdown-content :global(h1),
  .markdown-content :global(h2),
  .markdown-content :global(h3),
  .markdown-content :global(h4) {
    margin: 1.25em 0 0.625em;
    font-weight: 700;
    line-height: 1.35;
    letter-spacing: -0.01em;
  }

  .markdown-content :global(h1) {
    font-size: 1.375em;
  }
  .markdown-content :global(h2) {
    font-size: 1.1875em;
  }
  .markdown-content :global(h3) {
    font-size: 1.0625em;
  }
  .markdown-content :global(h4) {
    font-size: 1em;
    opacity: 0.9;
  }

  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    margin: 0.75em 0;
    padding-left: 1.75em;
  }

  .markdown-content :global(li) {
    margin: 0.375em 0;
    line-height: 1.55;
  }

  .markdown-content :global(li::marker) {
    color: var(--sl-color-accent);
  }

  .message.user .markdown-content :global(li::marker) {
    color: rgba(255, 255, 255, 0.7);
  }

  /* Inline code */
  .markdown-content :global(code) {
    font-family: "SF Mono", "Fira Code", "JetBrains Mono", var(--sl-font-mono);
    font-size: 0.85em;
    padding: 0.2em 0.45em;
    background: var(--sl-color-gray-5);
    border-radius: 0.35em;
    font-weight: 500;
  }

  .message.user .markdown-content :global(code) {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  /* Code blocks */
  .markdown-content :global(pre) {
    margin: 1em 0;
    padding: 1em 1.25em;
    background: var(--sl-color-black);
    border-radius: 0.625em;
    overflow-x: auto;
    border: 1px solid var(--sl-color-gray-5);
  }

  .message.user .markdown-content :global(pre) {
    background: rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .markdown-content :global(pre code) {
    padding: 0;
    background: none;
    font-size: 0.8125em;
    line-height: 1.6;
    color: var(--sl-color-gray-1);
  }

  .message.user .markdown-content :global(pre code) {
    color: rgba(255, 255, 255, 0.95);
  }

  /* Blockquotes */
  .markdown-content :global(blockquote) {
    margin: 1em 0;
    padding: 0.75em 1em;
    background: var(--sl-color-gray-6);
    border-left: 4px solid var(--sl-color-accent);
    border-radius: 0 0.5em 0.5em 0;
    font-style: italic;
  }

  .message.user .markdown-content :global(blockquote) {
    background: rgba(255, 255, 255, 0.1);
    border-left-color: rgba(255, 255, 255, 0.6);
  }

  .markdown-content :global(blockquote p) {
    margin: 0;
  }

  /* Links */
  .markdown-content :global(a) {
    color: var(--sl-color-accent);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.15s ease;
  }

  .markdown-content :global(a:hover) {
    border-bottom-color: var(--sl-color-accent);
  }

  .message.user .markdown-content :global(a) {
    color: white;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .markdown-content :global(strong) {
    font-weight: 700;
  }

  .markdown-content :global(em) {
    font-style: italic;
  }

  /* Horizontal rule */
  .markdown-content :global(hr) {
    margin: 1.5em 0;
    border: none;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--sl-color-gray-4) 20%,
      var(--sl-color-gray-4) 80%,
      transparent 100%
    );
  }

  /* Tables */
  .markdown-content :global(table) {
    width: 100%;
    margin: 1em 0;
    border-collapse: collapse;
    font-size: 0.875em;
    border-radius: 0.5em;
    overflow: hidden;
  }

  .markdown-content :global(thead) {
    background: var(--sl-color-gray-5);
  }

  .message.user .markdown-content :global(thead) {
    background: rgba(255, 255, 255, 0.15);
  }

  .markdown-content :global(th),
  .markdown-content :global(td) {
    padding: 0.625em 0.875em;
    border: 1px solid var(--sl-color-gray-5);
    text-align: left;
  }

  .message.user .markdown-content :global(th),
  .message.user .markdown-content :global(td) {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .markdown-content :global(th) {
    font-weight: 600;
  }

  .markdown-content :global(tbody tr:hover) {
    background: var(--sl-color-gray-6);
  }

  /* Task lists */
  .markdown-content :global(input[type="checkbox"]) {
    margin-right: 0.5em;
    accent-color: var(--sl-color-accent);
  }

  /* Images */
  .markdown-content :global(img) {
    max-width: 100%;
    border-radius: 0.5em;
    margin: 0.75em 0;
  }
</style>
