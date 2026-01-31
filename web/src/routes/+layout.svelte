<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { headerStore } from "$lib/stores/header";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import {
    ArrowLeft,
    RefreshCw,
    Settings,
    MessageSquare,
    Monitor,
    Circle,
    Lightbulb,
    ChevronDown,
    Terminal as TerminalIcon,
    Server,
    BookOpen,
  } from "@lucide/svelte";

  let { children } = $props();
  let skillsOpen = $state(false);
  let skillsButtonEl = $state<HTMLButtonElement | undefined>(undefined);

  function closeSkillsOnClickOutside(e: MouseEvent) {
    if (skillsButtonEl && !skillsButtonEl.contains(e.target as Node)) {
      const popover = document.getElementById("skills-popover");
      if (popover && !popover.contains(e.target as Node)) skillsOpen = false;
    }
  }

  // Respect system preference, default to light
  onMount(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
    } else if (stored === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark) {
        document.documentElement.classList.add("dark");
      }
    }
    document.addEventListener("click", closeSkillsOnClickOutside);
    return () =>
      document.removeEventListener("click", closeSkillsOnClickOutside);
  });
</script>

<div class="h-screen bg-background flex flex-col overflow-hidden">
  <header class="border-b border-border shrink-0">
    <nav class="flex items-center gap-1.5 px-2 py-1 text-sm min-h-8 flex-wrap">
      <a
        href="/"
        class="font-semibold text-foreground flex items-center gap-1.5 shrink-0"
      >
        <img src="/favicon.png" alt="Viber" class="size-4" />
        Cockpit
      </a>

      {#if $headerStore.viber}
        <span class="w-px h-4 bg-border shrink-0" aria-hidden="true"></span>
        <Button
          variant="ghost"
          size="icon"
          href="/vibers"
          class="size-7 shrink-0"
        >
          <ArrowLeft class="size-3" />
        </Button>
        <span
          class="font-medium truncate max-w-[120px] shrink-0"
          title={$headerStore.viber.viberName}
        >
          {$headerStore.viber.viberName}
        </span>
        {#if $headerStore.viber.isConnected}
          <span class="text-green-600 dark:text-green-400 shrink-0" title="Online">
            <Circle class="size-1.5 fill-current inline" aria-hidden="true"></Circle>
          </span>
        {:else}
          <span class="text-muted-foreground shrink-0" title="Offline">
            <Circle class="size-1.5 inline" aria-hidden="true"></Circle>
          </span>
        {/if}
        <span
          class="w-px h-4 bg-border shrink-0 hidden sm:block"
          aria-hidden="true"
        ></span>
        <div
          class="flex items-center rounded-md border border-border/50 bg-muted/30 p-0.5 shrink-0"
        >
          <button
            type="button"
            class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors {$headerStore
              .viber.activeTab === 'chat'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => headerStore.setActiveTab("chat")}
            title="Chat"
          >
            <MessageSquare class="size-3 shrink-0" />
            <span class="hidden sm:inline">Chat</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors {$headerStore
              .viber.activeTab === 'terminals'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => headerStore.setActiveTab("terminals")}
            title="Terminals"
          >
            <TerminalIcon class="size-3 shrink-0" />
            <span class="hidden sm:inline">Terminals</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors {$headerStore
              .viber.activeTab === 'dev-server'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => headerStore.setActiveTab("dev-server")}
            title="Dev Server"
          >
            <Monitor class="size-3 shrink-0" />
            <span class="hidden sm:inline">Dev Server</span>
          </button>
        </div>
        <!-- Skills: what this viber can do + how to use -->
        {#if $headerStore.viber.skills?.length > 0}
          <div class="relative shrink-0">
            <button
              bind:this={skillsButtonEl}
              type="button"
              class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50"
              onclick={(e) => {
                e.stopPropagation();
                skillsOpen = !skillsOpen;
              }}
              title="Skills"
            >
              <Lightbulb class="size-3 shrink-0" />
              <span class="hidden sm:inline">Skills ({$headerStore.viber.skills.length})</span>
              <ChevronDown
                class="size-3 shrink-0 transition-transform hidden sm:block {skillsOpen
                  ? 'rotate-180'
                  : ''}"
              />
            </button>
            {#if skillsOpen}
              <div
                id="skills-popover"
                class="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-popover p-2 shadow-md"
              >
                <p
                  class="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wide"
                >
                  This viber can use these skills. In chat, ask e.g.:
                </p>
                <ul class="space-y-2 max-h-48 overflow-y-auto">
                  {#each $headerStore.viber.skills as skill}
                    <li class="rounded border border-border/50 bg-muted/20 p-2">
                      <p class="font-medium text-xs text-foreground">
                        {skill.name}
                      </p>
                      <p
                        class="text-[11px] text-muted-foreground mt-0.5 line-clamp-2"
                      >
                        {skill.description}
                      </p>
                      <p class="text-[10px] text-primary mt-1 font-mono">
                        “Use {skill.name} to &lt;your task&gt;”
                      </p>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>
        {/if}
        <div class="flex items-center gap-0.5 ml-auto shrink-0">
          <Button
            variant="ghost"
            size="icon"
            class="size-7"
            onclick={() => headerStore.requestRefresh()}
          >
            <RefreshCw class="size-3" />
          </Button>
          <Button variant="ghost" size="icon" class="size-7">
            <Settings class="size-3" />
          </Button>
          <a
            href="/vibers"
            class="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs px-1.5 py-0.5 rounded transition-colors"
            title="Vibers"
          >
            <Server class="size-3 shrink-0" />
            <span class="hidden sm:inline">Vibers</span>
          </a>
          <a
            href="/docs"
            class="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs px-1.5 py-0.5 rounded transition-colors"
            title="Docs"
          >
            <BookOpen class="size-3 shrink-0" />
            <span class="hidden sm:inline">Docs</span>
          </a>
        </div>
      {:else}
        <div class="flex items-center gap-1 ml-auto">
          <a
            href="/vibers"
            class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0 px-1.5 py-0.5 rounded"
            title="Vibers"
          >
            <Server class="size-3 shrink-0" />
            <span class="hidden sm:inline">Vibers</span>
          </a>
          <a
            href="/docs"
            class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0 px-1.5 py-0.5 rounded"
            title="Docs"
          >
            <BookOpen class="size-3 shrink-0" />
            <span class="hidden sm:inline">Docs</span>
          </a>
        </div>
      {/if}
    </nav>
  </header>

  <main class="flex-1 min-h-0 flex flex-col">
    {@render children()}
  </main>
</div>
