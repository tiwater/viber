<script lang="ts">
  import ChatInput from "./chat-input.svelte";

  function handleSendMessage(prompt: string) {
    if (!prompt.trim()) return;
    window.location.href = `/playground?prompt=${encodeURIComponent(prompt)}`;
  }

  const samples = [
    "Market Research Agent",
    "Documentation Generator",
    "Customer Support Bot",
    "Data Extraction Assistant",
  ];
</script>

<div class="w-full max-w-3xl mx-auto px-4 py-8">
  <ChatInput
    onSendMessage={handleSendMessage}
    placeholder="Describe an agent to build..."
  />

  <div class="flex flex-wrap items-center justify-center gap-2 mt-4 text-sm">
    {#each samples as sample}
      <button
        onclick={() => handleSendMessage(sample)}
        class="px-3 py-1 bg-secondary/50 hover:bg-secondary text-secondary-foreground rounded-full text-xs transition-colors"
      >
        {sample}
      </button>
    {/each}
  </div>
</div>
