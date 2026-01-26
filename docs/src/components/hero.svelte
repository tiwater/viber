<script lang="ts">
  import ChatInput from "./chat-input.svelte";
  import { ArrowRight } from "lucide-svelte";

  function handleSendMessage(prompt: string) {
    if (!prompt.trim()) return;
    // Redirect to playground with prompt
    window.location.href = `/playground?prompt=${encodeURIComponent(prompt)}`;
  }
</script>

<div
  class="flex flex-col items-center justify-center py-20 px-4 text-center space-y-8 max-w-4xl mx-auto"
>
  <div class="space-y-4">
    <h1
      class="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent pb-2"
    >
      Viber
    </h1>
    <p
      class="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
    >
      Multi-agent collaboration framework for vibe working.
      <br class="hidden md:block" />
      Build, orchestrate, and deploy autonomous agents with ease.
    </p>
  </div>

  <div
    class="w-full max-w-2xl transform transition-all duration-500 hover:scale-[1.01]"
  >
    <ChatInput
      onSendMessage={handleSendMessage}
      placeholder="Describe an agent you want to build..."
    />
  </div>

  <div
    class="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground pt-4"
  >
    <span class="opacity-70">Try:</span>
    <button
      onclick={() => handleSendMessage("Create a market research agent")}
      class="hover:text-primary transition-colors hover:underline underline-offset-4"
    >
      Market Research
    </button>
    <span class="opacity-30">•</span>
    <button
      onclick={() =>
        handleSendMessage("Build a python documentation generator")}
      class="hover:text-primary transition-colors hover:underline underline-offset-4"
    >
      Doc Generator
    </button>
    <span class="opacity-30">•</span>
    <button
      onclick={() => handleSendMessage("Setup a customer support bot")}
      class="hover:text-primary transition-colors hover:underline underline-offset-4"
    >
      Support Bot
    </button>
  </div>
</div>
