<script lang="ts">
  import { page } from "$app/stores";

  let { children } = $props();

  // Get page title from navigation based on current path
  function getPageTitle(pathname: string): string {
    for (const section of navigation) {
      for (const item of section.items) {
        if (item.href === pathname) {
          return item.title;
        }
      }
    }
    return "Documentation";
  }

  const navigation = [
    {
      title: "Getting Started",
      items: [
        { title: "Installation", href: "/docs/getting-started/installation" },
        { title: "Quick Start", href: "/docs/getting-started/quick-start" },
      ],
    },
    {
      title: "Guides",
      items: [
        { title: "Agents", href: "/docs/guides/agents" },
        { title: "Spaces", href: "/docs/guides/spaces" },
        { title: "Tools", href: "/docs/guides/tools" },
        { title: "State", href: "/docs/guides/state" },
        { title: "Streaming", href: "/docs/guides/streaming" },
      ],
    },
    {
      title: "Tutorials",
      items: [
        { title: "Overview", href: "/docs/tutorials/index" },
        { title: "1. First Agent", href: "/docs/tutorials/1-first-agent" },
        { title: "2. Multi-Agent", href: "/docs/tutorials/2-multi-agent" },
        { title: "3. Custom Tools", href: "/docs/tutorials/3-custom-tools" },
        { title: "4. Configuration", href: "/docs/tutorials/4-configuration" },
        {
          title: "Comprehensive Systems",
          href: "/docs/tutorials/91-comprehensive-systems",
        },
      ],
    },
    {
      title: "Design",
      items: [
        { title: "Architecture", href: "/docs/design/arch" },
        {
          title: "Plan and Artifacts",
          href: "/docs/design/plan-and-artifacts",
        },
        { title: "Philosophy", href: "/docs/design/philosophy" },
        { title: "Viber Daemon", href: "/docs/design/viber-daemon" },
        { title: "Viber vs Clawdbot", href: "/docs/design/viber-vs-clawdbot" },
        { title: "Channels", href: "/docs/design/channels" },
        { title: "Skills", href: "/docs/design/skills" },
        { title: "Task Lifecycle", href: "/docs/design/task-lifecycle" },
        {
          title: "Tmux Coding Scenario",
          href: "/docs/design/tmux-coding-scenario",
        },
        { title: "Tool Execution", href: "/docs/design/tool-execution" },
        { title: "Memory", href: "/docs/design/memory" },
        { title: "Message Parts", href: "/docs/design/message-parts" },
        { title: "Desktop Tools", href: "/docs/design/desktop-tools" },
        { title: "Communication", href: "/docs/design/communication" },
        { title: "Package Structure", href: "/docs/design/package-structure" },
        { title: "Security", href: "/docs/design/security" },
      ],
    },
    {
      title: "API Reference",
      items: [
        { title: "API Overview", href: "/docs/api" },
        { title: "Types", href: "/docs/api/types" },
      ],
    },
    {
      title: "Reference",
      items: [{ title: "Glossary", href: "/docs/reference/glossary" }],
    },
  ];
</script>

<svelte:head>
  <title>{getPageTitle($page.url.pathname)} - Viber Docs</title>
</svelte:head>

<div class="flex flex-1 min-h-0 overflow-hidden">
  <!-- Sidebar -->
  <aside
    class="w-56 shrink-0 hidden lg:block border-r border-border/50 overflow-y-auto bg-muted/20"
  >
    <nav class="py-6 pr-4">
      {#each navigation as section, i}
        <div class={i > 0 ? "mt-6" : ""}>
          <h3 class="sidebar-section-title">
            {section.title}
          </h3>
          <ul class="sidebar-list">
            {#each section.items as item}
              {@const isActive = $page.url.pathname === item.href}
              <li>
                <a
                  href={item.href}
                  class="sidebar-link"
                  class:active={isActive}
                >
                  {item.title}
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </nav>
  </aside>

  <!-- Main content -->
  <main class="flex-1 min-w-0 overflow-y-auto">
    <div class="max-w-3xl mx-auto px-8 py-8">
      <article class="prose prose-slate dark:prose-invert max-w-none">
        {@render children()}
      </article>
    </div>
  </main>
</div>

<style>
  /* Sidebar styles */
  .sidebar-section-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--foreground));
    padding: 0.5rem 1rem 0.5rem 1.25rem;
    margin-bottom: 0.25rem;
  }

  .sidebar-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .sidebar-link {
    display: block;
    font-size: 0.875rem;
    line-height: 1.5;
    padding: 0.375rem 1rem 0.375rem 1.25rem;
    color: hsl(var(--muted-foreground));
    border-left: 2px solid transparent;
    transition: all 0.15s ease;
  }

  .sidebar-link:hover {
    color: hsl(var(--foreground));
    background: hsl(var(--muted) / 0.5);
  }

  .sidebar-link.active {
    color: hsl(var(--primary));
    font-weight: 500;
    border-left-color: hsl(var(--primary));
    background: hsl(var(--primary) / 0.05);
  }

  /* Prose styles */
  :global(.prose) {
    color: hsl(var(--foreground));
  }
  :global(.prose h1) {
    color: hsl(var(--foreground));
    font-size: 2.25rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }
  :global(.prose h2) {
    color: hsl(var(--foreground));
    font-size: 1.5rem;
    font-weight: 600;
    margin-top: 2rem;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid hsl(var(--border));
  }
  :global(.prose h3) {
    color: hsl(var(--foreground));
    font-size: 1.25rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }
  :global(.prose p) {
    margin-bottom: 1rem;
    line-height: 1.75;
  }
  :global(.prose code) {
    background: hsl(var(--muted));
    padding: 0.2em 0.4em;
    border-radius: 0.25rem;
    font-size: 0.875em;
  }
  :global(.prose pre) {
    background: hsl(var(--muted));
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1rem 0;
  }
  :global(.prose pre code) {
    background: none;
    padding: 0;
  }
  :global(.prose a) {
    color: hsl(var(--primary));
    text-decoration: underline;
  }
  :global(.prose ul) {
    list-style-type: disc;
    padding-left: 1.5rem;
    margin-bottom: 1rem;
  }
  :global(.prose ol) {
    list-style-type: decimal;
    padding-left: 1.5rem;
    margin-bottom: 1rem;
  }
  :global(.prose li) {
    margin-bottom: 0.5rem;
  }
  :global(.prose blockquote) {
    border-left: 4px solid hsl(var(--border));
    padding-left: 1rem;
    font-style: italic;
    color: hsl(var(--muted-foreground));
  }
</style>
