<script lang="ts">
  import { onMount } from "svelte";
  import { Sun, Moon } from "lucide-svelte";

  let theme = $state<"light" | "dark">("dark");

  onMount(() => {
    // Initial sync
    const stored = localStorage.getItem("starlight-theme");
    const system = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    theme = stored === "dark" || stored === "light" ? stored : system;

    // Apply initial
    updateTheme(theme);
  });

  function updateTheme(newTheme: "light" | "dark") {
    const root = document.documentElement;
    if (newTheme === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }
    localStorage.setItem("starlight-theme", newTheme);
    theme = newTheme;

    // Dispatch Starlight's theme change event for proper sync
    document.dispatchEvent(
      new CustomEvent("starlight-theme-change", {
        detail: { theme: newTheme },
      }),
    );
  }

  function toggleTheme() {
    const newTheme = theme === "dark" ? "light" : "dark";
    updateTheme(newTheme);
  }
</script>

<button
  onclick={toggleTheme}
  class="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
  aria-label="Toggle theme"
>
  {#if theme === "light"}
    <Sun class="h-4 w-4 transition-all" />
  {:else}
    <Moon class="h-4 w-4 transition-all" />
  {/if}
</button>
