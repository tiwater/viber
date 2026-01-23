<script lang="ts">
  import { cn } from "$lib/utils";
  import Button from "./ui/button.svelte";
  import { ArrowUp, StopCircle, Sparkles, MessageSquare } from "lucide-svelte";
  import { onMount, tick } from "svelte";

  let {
    onSendMessage,
    isLoading = false,
    placeholder = "Type a message...",
    disabled = false,
  } = $props();

  let input = $state("");
  let mode = $state<"agent" | "chat">("agent");
  let textarea: HTMLTextAreaElement | undefined = $state();

  // Auto-resize
  function resize() {
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }

  $effect(() => {
    resize();
    // dependency on input is implicit
    input;
  });

  function handleSubmit() {
    if (input.trim() && !isLoading && !disabled) {
      onSendMessage(input.trim());
      input = "";
      tick().then(resize);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }
</script>

<div class="relative mx-auto w-full max-w-3xl">
  <div class="relative group">
    <textarea
      bind:this={textarea}
      bind:value={input}
      onkeydown={handleKeyDown}
      oninput={resize}
      {placeholder}
      {disabled}
      rows={1}
      class={cn(
        "w-full resize-none rounded-2xl bg-background",
        "pl-4 pr-12 pt-4 pb-12", // ChatGPT/Manus-like padding
        "min-h-[80px] max-h-[150px]",
        "placeholder:text-muted-foreground/60",
        "transition-all duration-200",
        "border border-border", // Basic border
        "outline-none focus:ring-1 focus:ring-ring", // Focus ring
        "disabled:opacity-50 disabled:cursor-not-allowed",
      )}
      style="overflow-y: hidden;"
    ></textarea>

    <!-- Mode toggle -->
    <div class="absolute left-3 bottom-4">
      <div class="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          class={cn(
            "h-6 rounded-full text-xs gap-1 border",
            mode === "agent"
              ? "bg-accent/10 border-accent text-accent-foreground"
              : "border-transparent text-muted-foreground",
          )}
          onclick={() => (mode = "agent")}
        >
          <Sparkles size={12} />
          Agent
        </Button>
        <Button
          size="sm"
          variant="ghost"
          class={cn(
            "h-6 rounded-full text-xs gap-1 border",
            mode === "chat"
              ? "bg-accent/10 border-accent text-accent-foreground"
              : "border-transparent text-muted-foreground",
          )}
          onclick={() => (mode = "chat")}
        >
          <MessageSquare size={12} />
          Chat
        </Button>
      </div>
    </div>

    <!-- Send Button -->
    <div class="absolute right-2 bottom-3">
      <Button
        size="icon"
        class="h-8 w-8 rounded-full"
        disabled={!input.trim() || isLoading}
        onclick={handleSubmit}
      >
        {#if isLoading}
          <StopCircle size={16} />
        {:else}
          <ArrowUp size={16} />
        {/if}
      </Button>
    </div>
  </div>
</div>
